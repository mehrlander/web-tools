"""Read-only local work evidence and bounded summaries through the existing Gemini worker.

Raw transcripts remain in their original locations. Only compact derived updates
are persisted beside companion settings. No source checkout or Git ref is written.
"""
import argparse
import collections
from contextlib import closing
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import time

FORMAT = 2
NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
IDENT = re.compile(r'^[A-Za-z0-9_.-]{1,96}$')
SECRET = re.compile(r'(?i)(?:bearer\s+\S+|(?:sk-|AIza)[A-Za-z0-9_-]{12,}|(?:token|password|api_key|secret)\s*[:=]\s*\S+)')
FILE_TOOLS = {'write_to_file', 'replace_file_content', 'multi_replace_file_content', 'apply_patch'}


def clean(value, limit=180):
    return SECRET.sub('[redacted]', ' '.join(str(value or '').split()))[:limit]


def stamp():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def instant(value):
    from datetime import datetime
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00')).timestamp()
    except (ValueError, TypeError, OverflowError):
        return 0


def short_path(value):
    parts = str(value or '').replace('\\', '/').split('/')
    if 'gh' in parts:
        return clean('/'.join(parts[parts.index('gh') + 1:]), 120)
    return clean(parts[-1], 80)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=True).encode()).hexdigest()[:20]


def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return default


def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.next')
    temporary.write_text(json.dumps(value, ensure_ascii=True), encoding='utf-8')
    os.replace(temporary, path)


class LogReader:
    def __init__(self):
        self.cache = {}

    def rows(self, path):
        try:
            stat = path.stat()
            signature = (stat.st_size, stat.st_mtime_ns)
            if self.cache.get(path, (None,))[0] == signature:
                return self.cache[path][1]
            with path.open('rb') as stream:
                if stat.st_size > 8 * 1024 * 1024:
                    stream.seek(-8 * 1024 * 1024, 2)
                    stream.readline()  # A bounded tail never parses a partial first record.
                raw = stream.read()
            rows = []
            for line in raw.splitlines():
                try:
                    row = json.loads(line)
                    if isinstance(row, dict):
                        rows.append(row)
                except (ValueError, UnicodeError):
                    pass
            self.cache[path] = (signature, rows)
            return rows
        except OSError:
            return []


def database(path):
    return sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True, timeout=1)


def command_action(command):
    text = str(command or '')
    for pattern, label in [(r'\bgh\s+pr\s+merge\b', 'merge pull request'),
                           (r'\bgit\s+push\b', 'push branch'), (r'\bgit\s+commit\b', 'commit changes'),
                           (r'(?i)(?:\bpytest\b|\b(?:npm|dotnet)\s+(?:run\s+)?(?:test|preflight)|(?:checks|test)[\w./\\-]*\.(?:mjs|py|csproj))', 'run checks'),
                           (r'(?i)install\.ps1', 'install app'),
                           (r'\bgit\s+(?:status|diff|log|show)\b', 'inspect repository')]:
        if re.search(pattern, text):
            return label
    return 'run command'


def outcome(value):
    """Read explicit command exit markers, never equate tool return with command success."""
    if isinstance(value, list):
        states = [outcome(v.get('text', v)) if isinstance(v, dict) else outcome(v) for v in value]
        return 'failed' if 'failed' in states else 'succeeded' if states and all(s == 'succeeded' for s in states) else 'returned'
    if isinstance(value, dict):
        if value.get('isError') is True or value.get('status') == 'rejected':
            return 'failed'
        if isinstance(value.get('exit_code'), int):
            return 'succeeded' if value['exit_code'] == 0 else 'failed'
        nested = [outcome(value[k]) for k in ('value','result','content','structuredContent') if k in value]
        if nested:
            return 'failed' if 'failed' in nested else 'succeeded' if all(v == 'succeeded' for v in nested) else 'returned'
        return 'returned'
    try:
        parsed = json.loads(str(value))
        if isinstance(parsed, (dict, list)):
            return outcome(parsed)
    except ValueError:
        pass
    match = re.search(r'(?im)^\s*(?:Process exited with code|Exit code:)\s*(-?\d+)\s*$', str(value))
    return ('succeeded' if int(match[1]) == 0 else 'failed') if match else 'returned'


def event(identity, at, action, result='attempted', target=''):
    return {'id':identity, 'at':at, 'action':action, 'result':result, 'target':short_path(target)}


def gemini_events(rows, session):
    # The runtime can append a result before its planner row. Step indexes,
    # rather than JSONL order, identify the latest version of each step.
    steps = {r.get('step_index'):r for r in rows if isinstance(r.get('step_index'), int)}
    events, request, turn = [], '', 'initial'
    for index, row in sorted(steps.items()):
        at = row.get('created_at', '')
        if row.get('source') == 'USER_EXPLICIT' and row.get('type') == 'USER_INPUT':
            request = clean(row.get('content'), 500)
            turn = str(index)
        if row.get('type') != 'PLANNER_RESPONSE':
            continue  # GENERIC is tool output; thinking never enters the evidence.
        if row.get('content'):
            events.append({**event(f'g:{session}:{index}:prose',at,'reported progress','reported'), 'turn':turn,
                           'note':clean(row['content'].split('\n\n')[0],280)})
        for n, call in enumerate(row.get('tool_calls') or []):
            args = call.get('args') or {}
            if not isinstance(args, dict):
                continue
            name = call.get('name', '')
            target = args.get('TargetFile') or args.get('AbsolutePath') or ''
            action = 'edit file' if name in FILE_TOOLS else command_action(args.get('CommandLine')) if name == 'run_command' else 'read file' if name == 'view_file' else 'delegate work' if name == 'invoke_subagent' else clean(name, 60)
            result_row = steps.get(index + n + 1, {})
            result = 'attempted'
            if result_row.get('type') == 'GENERIC':
                if result_row.get('status') == 'ERROR':
                    result = 'failed'
                elif result_row.get('status') == 'DONE':
                    result = outcome(result_row.get('content')) if name == 'run_command' else 'succeeded'
            events.append({**event(f'g:{session}:{index}:{n}', at, action, result, target), 'turn':turn,
                           'note':clean(args.get('toolSummary') or args.get('Description'),120)})
    return events, request, turn


def codex_events(rows, session):
    events, calls, request, turn = [], {}, '', 'initial'
    for row in rows:
        payload = row.get('payload') or {}
        if not isinstance(payload, dict):
            continue
        at = row.get('timestamp', '')
        if row.get('type') == 'event_msg' and payload.get('type') == 'task_started':
            turn = payload.get('turn_id') or payload.get('root_turn_id') or at
        if row.get('type') != 'response_item':
            continue
        if payload.get('type') == 'message' and payload.get('role') == 'user':
            request = clean(' '.join(c.get('text', '') for c in payload.get('content', []) if isinstance(c, dict) and c.get('type') in ('input_text', 'text')), 500)
        if payload.get('type') == 'message' and payload.get('role') == 'assistant' and payload.get('phase') in ('commentary','final'):
            visible = ' '.join(c.get('text','') for c in payload.get('content',[]) if isinstance(c,dict) and c.get('type') == 'output_text')
            if visible:
                events.append({**event('c:' + session + ':prose:' + str(row.get('id') or digest([at,visible])), at,'reported progress','reported'),
                               'turn':str(turn),'note':clean(visible.split('\n\n')[0],280)})
        kind = payload.get('type')
        call_id = payload.get('call_id')
        if kind in ('function_call', 'custom_tool_call') and call_id:
            raw = payload.get('arguments', payload.get('input', ''))
            try:
                args = json.loads(raw) if isinstance(raw, str) else raw
            except ValueError:
                args = {}
            if not isinstance(args, dict):
                args = {}
            name = payload.get('name', '')
            text = str(raw)
            action = 'edit file' if name == 'apply_patch' or 'tools.apply_patch(' in text else 'delegate work' if name in ('spawn_agent', 'followup_task') else command_action(args.get('cmd', args.get('command', text))) if name in ('exec', 'exec_command') else clean(name, 60)
            target = args.get('path', '')
            targets = re.findall(r'\*\*\* (?:Update|Add|Delete) File:\s*([^\r\n]+)',text)
            if targets:
                target=targets[0]
            # Wrapped tool calls retain safe named file targets without sending
            # their patches, command bodies, outputs or credentials to the model.
            target_names = re.findall(r'(?:desktop[/\\][A-Za-z0-9_./\\-]+\.(?:js|html|cs|py|csproj)|[A-Za-z0-9_.-]+\.(?:mjs|xlsx|docx))',text)
            calls[call_id] = len(events)
            events.append({**event('c:' + session + ':' + call_id, at, action, target=target), 'turn':str(turn),
                           'note':clean(', '.join(dict.fromkeys(short_path(p) for p in target_names))[:120],120)})
        elif kind in ('function_call_output', 'custom_tool_call_output') and call_id in calls:
            entry = events[calls[call_id]]
            result = outcome(payload.get('output'))
            # A wrapped script may run several commands. Only unambiguous exit
            # results support success; a generic script return stays 'returned'.
            entry['result'] = result
    return [e for e in events if e['turn'] == str(turn)], request, str(turn)


def collect(profile, logs, now=None):
    now = time.time() if now is None else now
    tasks, notices = [], []
    root = profile / '.gemini/antigravity'
    try:
        with closing(database(root / 'conversation_summaries.db')) as db:
            db.row_factory = sqlite3.Row
            rows = [dict(r) for r in db.execute('SELECT conversation_id,title,parent_conversation_id,status,not_fully_idle,last_modified_time,killed FROM conversation_summaries ORDER BY last_modified_time DESC LIMIT 128')]
        by_id = {r['conversation_id']:r for r in rows if IDENT.fullmatch(r['conversation_id'])}
        grouped = collections.defaultdict(list)
        for row in by_id.values():
            ancestor, seen = row, {row['conversation_id']}
            while ancestor.get('parent_conversation_id') in by_id and ancestor['parent_conversation_id'] not in seen:
                ancestor = by_id[ancestor['parent_conversation_id']]
                seen.add(ancestor['conversation_id'])
            grouped[ancestor['conversation_id']].append(row)
        for root_id, members in grouped.items():
            parent = by_id[root_id]
            through = max((r['last_modified_time'] or '' for r in members), key=instant)
            if not -60 <= now - instant(through) < 86400:
                continue
            entries, request, turn, owner_at = [], '', 'initial', 0
            for member in members:
                folder = root / 'brain' / member['conversation_id'] / '.system_generated/logs'
                full = folder / 'transcript_full.jsonl'
                records = logs.rows(full if full.exists() else folder / 'transcript.jsonl')
                found, asked, boundary = gemini_events(records, member['conversation_id'])
                entries.extend(found)
                if member['conversation_id'] == root_id:
                    request, turn = asked, boundary
                    owner_at = max((instant(r.get('created_at')) for r in records if r.get('source') == 'USER_EXPLICIT' and r.get('type') == 'USER_INPUT'), default=0)
            entries = [e for e in entries if max(owner_at,now-86400) <= instant(e['at']) <= now+60]
            agents=sum(r['conversation_id']!=root_id and now-instant(r['last_modified_time'])<86400 for r in members)
            tasks.append({'key':'Gemini:' + root_id, 'provider':'Gemini', 'id':root_id, 'title':clean(parent['title'] or 'Gemini work', 100), 'through':through, 'request':request, 'turn':turn, 'agents':agents, 'events':entries})
    except (sqlite3.Error, OSError, ValueError):
        notices.append('Gemini work evidence unavailable')
    root = profile / '.codex'
    try:
        dbs = sorted(root.glob('state_*.sqlite'), key=lambda p:int(p.stem[6:]) if p.stem[6:].isdigit() else 0, reverse=True)
        if dbs:
            with closing(database(dbs[0])) as db:
                db.row_factory = sqlite3.Row
                rows = [dict(r) for r in db.execute("SELECT id,rollout_path,COALESCE(NULLIF(name,''),NULLIF(title,''),'Codex work') title,source FROM threads WHERE archived=0 ORDER BY updated_at_ms DESC LIMIT 64")]
            grouped = collections.defaultdict(list)
            for row in rows:
                if not IDENT.fullmatch(row['id']):
                    continue
                parent = ''
                if 'subagent' in (row['source'] or ''):
                    try:
                        parent = json.loads(row['source'])['subagent']['thread_spawn']['parent_thread_id']
                    except (ValueError, KeyError, TypeError):
                        continue
                row['parent'] = parent
            by_id = {r['id']:r for r in rows if 'parent' in r}
            for row in by_id.values():
                ancestor, seen = row, {row['id']}
                while ancestor['parent'] in by_id and ancestor['parent'] not in seen:
                    ancestor=by_id[ancestor['parent']]; seen.add(ancestor['id'])
                grouped[ancestor['id']].append(row)
            for root_id,members in grouped.items():
                parent=by_id[root_id]
                entries,request,turn,owner_at,through,agents = [],'', 'initial',0,'',0
                for row in members:
                    path = Path(row['rollout_path'].removeprefix('\\\\?\\')).resolve()
                    if not path.is_relative_to((root / 'sessions').resolve()):
                        continue
                    records=logs.rows(path)
                    found,asked,boundary=codex_events(records,row['id'])
                    entries.extend(found)
                    last=max((r.get('timestamp','') for r in records),key=instant,default='')
                    if row['id']!=root_id and now-instant(last)<86400:agents+=1
                    if instant(last)>instant(through):through=last
                    if row['id']==root_id:
                        request,turn=asked,boundary
                        owner_at=max((instant(r.get('timestamp')) for r in records if r.get('type')=='event_msg' and r.get('payload',{}).get('type')=='task_started'),default=0)
                if not -60 <= now-instant(through)<86400:
                    continue
                entries=[e for e in entries if max(owner_at,now-86400)<=instant(e['at'])<=now+60]
                tasks.append({'key':'Codex:'+root_id,'provider':'Codex','id':root_id,'title':clean(parent['title'],100),'through':through,'request':request,'turn':turn,'agents':agents,'events':entries})
    except (sqlite3.Error, OSError, ValueError):
        notices.append('Codex work evidence unavailable')
    return tasks, notices


def evidence(task, previous):
    seen = set(previous.get('seen') or [])
    fresh = [e for e in task['events'][-300:] if digest(e) not in seen]
    # Outcomes can update an existing attempted call. Keep its identity but
    # include the changed observation, even after an earlier summary used it.
    return sorted(fresh, key=lambda e:instant(e['at']))[-60:]


def prompt_for(task, batch, previous):
    template = Path(__file__).with_name('work_prompt.txt').read_text(encoding='utf-8')
    prior = [{k:v for k,v in item.items() if k in ('headline','summary')} for item in previous.get('segments', [])[:2]]
    payload = {'task':task['title'], 'requestContext':task['request'], 'delegatedAgents':task['agents'], 'previous':prior, 'evidence':batch}
    return template + '\n\nEVIDENCE DATA:\n' + json.dumps(payload, ensure_ascii=True)


def parse_answer(text, batch):
    raw = str(text).strip()
    raw = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw)
    value = json.loads(raw)
    if not isinstance(value, dict) or not isinstance(value.get('continues'), bool):
        raise ValueError('Invalid summary shape')
    known = {e['id'] for e in batch}
    refs = value.get('evidenceIds')
    if not isinstance(refs, list) or not 1 <= len(refs) <= 6 or any(not isinstance(i,str) or i not in known for i in refs):
        raise ValueError('Unsupported evidence references')
    if not isinstance(value.get('headline'),str) or not isinstance(value.get('summary'),str):
        raise ValueError('Invalid summary text')
    headline, summary = clean(value.get('headline'),60), clean(value.get('summary'),180)
    if not headline or not summary or re.search(r'(?i)(?:[A-Z]:\\|/Users/|/home/|https?://|\[redacted\])', headline + summary):
        raise ValueError('Unsafe or empty summary')
    return {'headline':headline, 'summary':summary, 'continues':value['continues'], 'evidenceIds':refs}


def locked_run(args):
    args.state.mkdir(parents=True,exist_ok=True)
    with (args.state/'worker.lock').open('a+b') as lock:
        if lock.tell() == 0:
            lock.write(b'0'); lock.flush()
        lock.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(lock.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError:
            return  # A previous companion's bounded job is still finishing.
        run(args)


def update(task, previous, batch, answer):
    items = list(previous.get('segments') or [])
    keep = bool(items and answer['continues'])
    identity = items[0]['id'] if keep else digest([task['key'], batch[0]['id'], task['turn']])
    referenced = [e for e in batch if e['id'] in answer['evidenceIds']]
    successful = [e for e in referenced if e['result'] == 'succeeded']
    labels = []
    for action, label in [('edit file','file edits'),('run checks','check runs'),('push branch','branch pushes'),('install app','app installations')]:
        count = sum(e['action'] == action for e in successful)
        if count:
            labels.append(f'{count} {label} confirmed')
    failures = sum(e['result'] == 'failed' for e in referenced)
    if failures:
        labels.append(f'{failures} failed calls')
    item = {'id':identity, 'headline':answer['headline'], 'summary':answer['summary'], 'at':max((e['at'] for e in batch), key=instant), 'generatedAt':stamp(), 'evidence':labels, 'evidenceIds':answer['evidenceIds']}
    result = {**previous, 'provider':task['provider'], 'id':task['id'], 'turn':task['turn'], 'through':task['through'], 'agents':task['agents'], 'segments':([item] + (items[1:] if keep else items))[:6], 'seen':[digest(e) for e in task['events'][-300:]], 'lastAttempt':time.time(), 'error':None}
    return result


def load_engine(repo, state):
    """Reuse the existing private worker engine at one immutable revision.

    Only the required Python modules are materialized outside the checkout.
    No fetch, reset, index mutation, publication or API key is involved.
    """
    def git(*args):
        return subprocess.check_output(['git','-C',str(repo),*args], creationflags=NO_WINDOW, timeout=20)
    revision = git('rev-parse','origin/main:sessions/tools').decode().strip()
    folder = state / 'engine' / revision
    folder.mkdir(parents=True, exist_ok=True)
    for name in ('gemini_followup.py','record.py','search.py'):
        path = folder / name
        if not path.exists():
            path.write_bytes(git('show',f'{revision}:{name}'))
    sys.path.insert(0,str(folder))
    spec = importlib.util.spec_from_file_location('now_gemini_engine',folder/'gemini_followup.py')
    engine = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(engine)
    return engine


def worker_busy(profile):
    # The headless CLI does not keep conversation_summaries.db current. Its
    # trajectory is the available completion signal for these inference jobs.
    try:
        root=profile/'.gemini/antigravity-worker/brain'
        for folder in sorted(root.iterdir(),key=lambda p:p.stat().st_mtime,reverse=True)[:20]:
            path=folder/'.system_generated/logs/transcript_full.jsonl'
            if not path.exists():path=path.with_name('transcript.jsonl')
            if not path.exists() or time.time()-path.stat().st_mtime>600:continue
            rows=LogReader().rows(path)
            last=rows[-1] if rows else {}
            done=last.get('type')=='PLANNER_RESPONSE' and last.get('status')=='DONE' and last.get('content') and not last.get('tool_calls')
            if not done:return True
    except OSError:
        return False
    return False


def harvest(previous, engine):
    pending=previous.get('pending')
    if not pending:return previous
    replies=engine.worker_replies(pending['conversation'])
    if replies:
        answer=parse_answer(replies[-1],pending['batch'])
        result=update(pending['task'],previous,pending['batch'],answer)
        result.pop('pending',None)
        return result
    if time.time()-pending['started']>600:
        return {**previous,'pending':None,'lastAttempt':time.time(),'error':'Summary response timed out'}
    return previous


def run(args):
    args.state.mkdir(parents=True,exist_ok=True)
    saved = read_json(args.state/'cache.json',{})
    prompt_hash = digest(Path(__file__).with_name('work_prompt.txt').read_text(encoding='utf-8'))
    if not isinstance(saved,dict) or saved.get('format') != FORMAT or saved.get('promptHash') != prompt_hash:
        saved = {'format':FORMAT,'tasks':{}}
    cache = saved.setdefault('tasks',{})
    logs, engine = LogReader(), None
    while True:
        tasks, notices = collect(args.profile,logs)
        selected = {t['key']:t for t in tasks}
        cache = {k:v for k,v in cache.items() if k in selected}
        if not args.scan_only:
            for key,value in list(cache.items()):
                if not value.get('pending'):continue
                try:
                    if engine is None:engine=load_engine(args.repo,args.state)
                    cache[key]=harvest(value,engine)
                except Exception as exc:
                    cache[key]={**value,'pending':None,'lastAttempt':time.time(),'error':type(exc).__name__}
        jobs=[]
        for task in tasks:
            previous = cache.get(task['key'],{})
            batch = evidence(task,previous)
            if batch and not previous.get('pending') and time.time()-previous.get('lastAttempt',0) >= 120:
                jobs.append((task,batch,previous))
        jobs.sort(key=lambda j:(bool(j[2].get('segments')),j[2].get('lastAttempt',0),-instant(j[0]['through'])))
        # Never summarize the summarizer's own profile. Busy worker errands and
        # cloud summaries take precedence over this low-concurrency lane.
        if jobs and not args.scan_only and not worker_busy(args.profile):
            task,batch,previous=jobs[0]
            try:
                if engine is None:
                    engine=load_engine(args.repo,args.state)
                answer=parse_answer(engine.synthesize_worker(prompt_for(task,batch,previous),'Now local work',timeout_sec=60),batch)
                cache[task['key']]=update(task,previous,batch,answer)
            except TimeoutError as exc:
                match=re.search(r'conversation ([A-Fa-f0-9-]{36})',str(exc))
                snapshot={k:task[k] for k in ('key','provider','id','turn','through','agents')}
                snapshot['events']=task['events'][-300:]
                cache[task['key']]={**previous,'lastAttempt':time.time(),'error':None if match else 'Summary response timed out',
                    'pending':{'conversation':match[1],'started':time.time(),'task':snapshot,'batch':batch} if match else None}
            except Exception as exc:
                cache[task['key']]={**previous,'lastAttempt':time.time(),'error':type(exc).__name__}
        public=[]
        for task in tasks:
            value=cache.get(task['key'],{})
            public.append({'provider':task['provider'],'id':task['id'],'through':value.get('through') or task['through'],'agents':task['agents'],'segments':value.get('segments',[])})
        atomic(args.state/'summaries.json',{'schema':1,'observedAt':stamp(),'items':public,'notices':notices})
        atomic(args.state/'cache.json',{'format':FORMAT,'promptHash':prompt_hash,'tasks':cache})
        if not args.watch:
            return
        time.sleep(30)


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile',type=Path,default=Path.home())
    parser.add_argument('--state',type=Path,required=True)
    parser.add_argument('--repo',type=Path,required=True)
    parser.add_argument('--watch',action='store_true')
    parser.add_argument('--scan-only',action='store_true')
    locked_run(parser.parse_args())
