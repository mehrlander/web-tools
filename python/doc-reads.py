#!/usr/bin/env python3
"""Which sessions opened each Markdown file, by day, from the session records,
as one JSON data file for the Map's Docs → Growth tab.

Reads every record under `sessions/` in the private session store (at a git
ref, through `git cat-file`, so the store's working tree is never touched) and
counts, for each Markdown file of each named repo, the sessions that OPENED it
and, apart, the sessions it was IN CONTEXT for at startup. The two are never
added: a CLAUDE.md loaded into every session has not been read by each.

A session opened a file when one of its calls, its subagents' included, did,
or, for a record that kept no calls, when its own `files` tally marks it read:

    tool    the Read tool, a GitHub MCP file read, or a WebFetch of the file
    shell   a command that reads it: cat, head, tail, sed (not sed -i), awk,
            less, more, nl, grep, egrep, rg, diff, bat or git show, never a
            search pattern or a redirect's target
    skill   the Skill tool, which loads a skill's SKILL.md without a file tool

    python3 python/doc-reads.py ../web-tools-private --ref origin/main \\
        --repo mehrlander/web-tools=. --repo mehrlander/home=../home \\
        -o ../web-tools-private/state/doc-reads.json

A path is found however the session reached it: a checkout (`/home/user/<repo>/`),
raw.githubusercontent.com or a GitHub blob link, the plugin marketplace's clone,
or the plugin cache, which a repo carrying `.claude-plugin/marketplace.json`
maps back through each plugin's `source`. A copy a build writes from a source
(`node/build/vendor-docs.mjs`'s VENDORED) counts for its source. History follows
renames, so a read of `docs/SURFACING.md` counts for `docs/CONVERSATION.md`. A
relative path counts when the command's own `cd` or `git -C` places it, or when
exactly one repo has ever held that path; otherwise it is not attributed.

Each list holds one day per session, as days after `from`, the first record's
day: the day the session first opened the file, or the session's day for
context. The output is private by construction, since it is derived from the
records, so it belongs in the store, never in a public repo.
"""
import argparse, json, os, re, shlex, subprocess, sys, threading, time
from collections import defaultdict
from datetime import date

RECORD = re.compile(r'^sessions/\d{4}/\d{2}/[^/]+\.json$')
READERS = {'cat', 'head', 'tail', 'sed', 'awk', 'less', 'more', 'nl', 'grep', 'egrep', 'rg', 'diff', 'bat'}
# Readers whose first argument is a pattern or a script, not a file.
SCRIPTED = {'sed', 'awk', 'grep', 'egrep', 'rg'}
SEGMENT = re.compile(r'&&|\|\||;|\||\n')
HEREDOC = re.compile(r'''<<-?\s*(['"]?)(\w+)\1[^\n]*\n.*?\n\s*\2\s*(?=\n|$)''', re.S)
MD = re.compile(r'''[^\s'"`<>|;&(){}=]+\.md\b''')


def git(repo, *args):
    r = subprocess.run(['git', '-C', repo, *args], capture_output=True)
    if r.returncode:
        sys.exit(f"git -C {repo} {' '.join(args)}: {r.stderr.decode()[:400]}")
    return r.stdout.decode('utf-8', 'replace')


def shown(repo, ref, path):
    """One file's text at a ref, or None where the ref has no such file."""
    r = subprocess.run(['git', '-C', repo, 'show', f'{ref}:{path}'], capture_output=True)
    return r.stdout.decode('utf-8', 'replace') if r.returncode == 0 else None


class Repo:
    """One repo's Markdown as it has ever been named, and the ways a session
    can spell a path inside it."""

    def __init__(self, full, clone, branch):
        self.full, self.short = full, full.split('/')[-1]
        owner = full.split('/')[0]
        self.alias, self.ever = {}, set()
        # Newest first, as python/doc-growth.py reads it: a rename is met
        # before the commits that used the old path, so `alias` maps every
        # earlier path to the file's current one.
        for line in git(clone, 'log', '--format=', '--name-status', '-M', branch).split('\n'):
            parts = line.split('\t')
            if len(parts) == 3 and parts[0].startswith('R'):
                old, new = parts[1], parts[2]
                if new.endswith('.md'):
                    self.alias[old] = self.alias.get(new, new)
                    self.ever.update((old, new))
            elif len(parts) == 2 and parts[1].endswith('.md'):
                self.ever.add(parts[1])
        self.ever.update(p for p in git(clone, 'ls-tree', '-r', '--name-only', branch).split('\n')
                         if p.endswith('.md'))
        self.copies = {}
        vendored = shown(clone, branch, 'node/build/vendor-docs.mjs') or ''
        m = re.search(r'VENDORED\s*=\s*\[([^\]]*)\]', vendored)
        for name in re.findall(r"'([^']+)'", m.group(1) if m else ''):
            self.copies[f'skills/default/{name}'] = f'docs/{name}'
        e = re.escape
        self.roots = [(re.compile(e(f'/home/user/{self.short}/')), ''),
                      (re.compile(e(f'raw.githubusercontent.com/{owner}/{self.short}/') + r'[^/\s]+/'), ''),
                      (re.compile(e(f'github.com/{owner}/{self.short}/blob/') + r'[^/\s]+/'), '')]
        self.plugins = {}
        try:
            market = json.loads(shown(clone, branch, '.claude-plugin/marketplace.json') or '')
            name = market['name']
            self.roots.append((re.compile(e(f'.claude/plugins/marketplaces/{name}/')), ''))
            for p in market.get('plugins', []):
                src = p['source'].removeprefix('./').rstrip('/')
                pre = src + '/' if src and src != '.' else ''
                self.plugins[p['name']] = pre
                self.roots.append((re.compile(e(f'.claude/plugins/cache/{name}/{p["name"]}/') + r'[^/\s]+/'), pre))
        except (KeyError, ValueError):
            pass

    def canon(self, rel):
        """The file's current path, or None for a path this repo never held."""
        rel = os.path.normpath(rel).lstrip('/') if rel else ''
        if rel not in self.ever:
            return None
        rel = self.alias.get(rel, rel)
        return self.copies.get(rel, rel)

    def locate(self, text):
        """The repo path an absolute path or URL names, if it is in this repo."""
        for pat, pre in self.roots:
            m = pat.search(text)
            if m:
                return self.canon(pre + text[m.end():].split('#')[0].split('?')[0])
        return None


def resolve(repos, token, base):
    """(repo, path) for one path as a command or tool spelled it."""
    if token.startswith('~/'):
        token = '/root/' + token[2:]
    if not token.startswith('/') and '://' not in token and base:
        token = os.path.normpath(os.path.join(base, token))
    for r in repos:
        p = r.locate(token)
        if p:
            return r, p
    if token.startswith('/') or '://' in token:
        return None
    hits = [(r, r.canon(token)) for r in repos if r.canon(token)]
    return hits[0] if len(hits) == 1 else None


def shell_reads(repos, cmd):
    """The files a shell command reads: segment by segment, a segment led by a
    reading command, each path not written by a redirect, against the
    directory the command's own `cd` or `git -C` names."""
    out, base = [], None
    # A heredoc's body is a file being written or a script being run; its
    # lines are not commands.
    cmd = HEREDOC.sub('', cmd)
    for seg in SEGMENT.split(cmd):
        try:
            words = shlex.split(seg)
        except ValueError:
            words = seg.strip().split()
        while words and (re.match(r'^\w+=', words[0]) or words[0] in ('sudo', 'command', 'nohup')):
            words = words[1:]
        if not words:
            continue
        if words[0] in ('cd', 'pushd') and len(words) > 1:
            d = words[1].strip('\'"')
            base = d if d.startswith('/') else os.path.normpath(os.path.join(base or '', d)) if base else None
            continue
        here = base
        if words[0] == 'git':
            if '-C' in words[:-1]:
                d = words[words.index('-C') + 1].strip('\'"')
                here = d if d.startswith('/') else here
            if 'show' not in words:
                continue
            for w in words:
                if ':' in w and w.endswith('.md') and not w.startswith('/'):
                    out.append((w.split(':', 1)[1], here))
            continue
        if words[0] not in READERS or (words[0] == 'sed' and any(w.startswith('-i') for w in words)):
            continue
        # `skip` drops the word after a redirect (a file written) or after
        # -e or -f (a pattern given as an option, so no positional one follows).
        skip = False
        script = words[0] in SCRIPTED and not any(w in ('-e', '-f', '--regexp', '--file') for w in words)
        for w in words[1:]:
            if w in ('>', '>>', '-e', '-f', '--regexp', '--file') or w.startswith('>'):
                skip = True
                continue
            if skip:
                skip = False
                continue
            if script and not w.startswith('-'):
                script = False
                continue
            for m in MD.finditer(w):
                tok = m.group(0)
                if '*' not in tok:
                    out.append((tok, here))
    return out


def skill_file(repos, name):
    """The SKILL.md a Skill call loaded: `plugin:name` from that plugin's
    source; a bare name from a repo's own .claude/skills, else from the one
    plugin that carries it, since a plugin skill and its local twin count as one."""
    if ':' in name:
        plugin, n = name.split(':', 1)
        for r in repos:
            if plugin in r.plugins:
                p = r.canon(f'{r.plugins[plugin]}{n}/SKILL.md')
                if p:
                    return r, p
        return None
    local = [(r, r.canon(f'.claude/skills/{name}/SKILL.md')) for r in repos]
    local = [x for x in local if x[1]]
    if len(local) == 1:
        return local[0]
    for r in repos:
        for pre in r.plugins.values():
            p = r.canon(f'{pre}{name}/SKILL.md')
            if p:
                return r, p
    return None


def opened(repos, rec):
    """{(repo, path): (channel, day)} for one record: the first call that
    opened each file, and how."""
    seen = {}
    day0 = rec.get('day') or (rec.get('started') or '')[:10]

    def hit(found, how, at):
        if found and found not in seen:
            seen[found] = (how, (at or day0)[:10])

    for c in rec.get('calls') or []:
        n, a, at = c.get('name') or '', c.get('arg') or '', c.get('at')
        inp = c.get('input') if isinstance(c.get('input'), dict) else {}
        if n == 'Read':
            hit(resolve(repos, inp.get('file_path') or a, None), 'tool', at)
        elif n == 'WebFetch':
            hit(resolve(repos, inp.get('url') or a, None), 'tool', at)
        elif n.endswith('get_file_contents'):
            full = inp.get('owner', '') + '/' + inp.get('repo', '') if inp.get('repo') else ''
            path = inp.get('path') or a
            if not path.endswith('.md'):
                continue
            if full:
                r = next((r for r in repos if r.full == full), None)
                hit(r and r.canon(path) and (r, r.canon(path)), 'tool', at)
            else:
                hit(resolve(repos, path, None), 'tool', at)
        elif n == 'Bash':
            for tok, base in shell_reads(repos, inp.get('command') or a):
                hit(resolve(repos, tok, base), 'shell', at)
        elif n == 'Skill':
            m = re.search(r'"skill"\s*:\s*"([^"]+)"', a)
            name = inp.get('skill') or (m.group(1) if m else a.strip())
            if name:
                hit(skill_file(repos, name), 'skill', at)
    # The record's own file tally covers a record whose calls were not kept.
    for key, use in (rec.get('files') or {}).items():
        if isinstance(use, dict) and use.get('read'):
            short, _, rel = key.partition('/')
            r = next((r for r in repos if r.short == short), None)
            hit(r and r.canon(rel) and (r, r.canon(rel)), 'tool', None)
    return seen


def in_context(repos, rec):
    """The repo files in context before the session's first turn."""
    out = set()
    for e in rec.get('startup_context') or []:
        short, _, rel = str(e.get('path', '') if isinstance(e, dict) else e).partition('/')
        r = next((r for r in repos if r.short == short), None)
        if r and r.canon(rel):
            out.add((r, r.canon(rel)))
    return out


def records(store, ref):
    paths = [p for p in git(store, 'ls-tree', '-r', '--name-only', ref, 'sessions').split('\n')
             if RECORD.match(p)]
    proc = subprocess.Popen(['git', '-C', store, 'cat-file', '--batch'],
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE)

    # Fed from a thread, as python/doc-growth.py does: the batch outgrows a
    # pipe buffer long before it ends.
    def feed():
        proc.stdin.write(''.join(f'{ref}:{p}\n' for p in paths).encode())
        proc.stdin.close()
    threading.Thread(target=feed, daemon=True).start()
    for p in paths:
        header = proc.stdout.readline().split()
        body = proc.stdout.read(int(header[2]))
        proc.stdout.read(1)
        try:
            yield json.loads(body)
        except ValueError:
            print(f'skipped unreadable record {p}', file=sys.stderr)
    proc.wait()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('store', help='a checkout of the session store')
    ap.add_argument('--ref', default='HEAD', help='the store ref to read records at')
    ap.add_argument('--repo', action='append', required=True, metavar='OWNER/NAME=CLONE')
    ap.add_argument('--branch', default='main', help='the branch each clone is read at')
    ap.add_argument('-o', '--out', required=True)
    a = ap.parse_args()
    repos = [Repo(full, clone, a.branch) for full, clone in (x.split('=', 1) for x in a.repo)]

    opens = defaultdict(dict)        # (repo, path) -> {session: (channel, day)}
    ctx = defaultdict(dict)          # (repo, path) -> {session: day}
    days, n = [], 0
    for rec in records(a.store, a.ref):
        sid = rec.get('session_id') or rec.get('short')
        day = rec.get('day') or (rec.get('started') or '')[:10]
        if not sid or not day:
            continue
        n += 1
        days.append(day)
        for key, hit in opened(repos, rec).items():
            opens[key].setdefault(sid, hit)
        for key in in_context(repos, rec):
            ctx[key].setdefault(sid, day)

    first = min(days)
    off = lambda d: (date.fromisoformat(d) - date.fromisoformat(first)).days
    out = {r.full: {} for r in repos}
    for key in sorted(set(opens) | set(ctx), key=lambda k: (k[0].full, k[1])):
        r, p = key
        row = {'opened': sorted(off(d) for _, d in opens[key].values()),
               'context': sorted(off(d) for d in ctx[key].values())}
        via = defaultdict(int)
        for how, _ in opens[key].values():
            via[how] += 1
        if via:
            row['via'] = dict(sorted(via.items()))
        out[r.full][p] = row
    doc = {'generated': time.strftime('%Y-%m-%d'), 'from': first, 'to': max(days),
           'sessions': n, 'repos': out}
    with open(a.out, 'w') as f:
        json.dump(doc, f, separators=(',', ':'))
        f.write('\n')
    for r in repos:
        rows = out[r.full]
        print(f'{r.full}: {sum(1 for v in rows.values() if v["opened"])} files opened, '
              f'{sum(1 for v in rows.values() if v["context"])} in context')
    print(f'{a.out}: {n} sessions, {first}..{max(days)}')


main()
