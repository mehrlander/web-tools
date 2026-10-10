// python/scheduled-tasks.py: the estate's scheduled tasks.
//
// The script is python3/stdlib, so this drives it the way the workflow does,
// against a registry, a watched file and pages written to a temp folder. It
// holds three contracts. Due: a task is due when its cron schedule has
// fired since it last ran, a task that never ran is due only in the hour its
// schedule fires, and no other workflow here carries a cron. The dispatch: a
// row whose entry is another workflow is started with its `with` inputs when
// due, judged by that workflow's newest run of any kind. Progressive action:
// the gate stops what is off or not due, the probe stops what has not changed,
// the classifier stops what changed without a new session law, and only what
// is left reaches the report. Offline throughout: --local, --pages,
// --state-file, --notes-file and --actions-file stand in for GitHub and the
// Legislature.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const SCRIPT = path.join(repoRoot, 'python/scheduled-tasks.py');
const STAGES = 'task,order,stage,cost,does,continue_when,otherwise\n'
  + 'statutes-rcw,0,gate,free,g,due,skipped\n'
  + 'statutes-rcw,1,probe,network,p,changed,unchanged\n'
  + 'statutes-rcw,2,classify,local,c,new law,reworded\n'
  + 'statutes-rcw,3,report,local,r,,finding\n';
const WT = 'mehrlander/web-tools@main:.github/workflows/';

// 2026-10-12 is a Monday; the statute check fires Mondays at 14:00 UTC, and the
// workflow's hourly run reaches it twenty minutes later.
const MON = '2026-10-12T14:20:00Z', MON_LATER = '2026-10-12T15:20:00Z', NEXT_MON = '2026-10-19T14:20:00Z';

// A page shaped like the Legislature's: furniture outside the content element,
// self-closing breaks inside it (the shape that once closed it early), and a
// history note in brackets.
const page = (sec, body, note) => `<html><body><nav>menu</nav>
  <div class="main-page-wrapper"><div class="main-page-content">
    <div id="prev"><font>41.50.090 &lt;&lt; ${sec} &gt;&gt;<br/><br/></font></div>
    <h1>RCW ${sec}</h1><div>${body}</div><div>[ ${note} ]</div>
  </div></div><footer>Washington State Legislature, updated daily</footer></body></html>`;

function setup({ status = 'on', stages = STAGES, schedule = '0 14 * * 1', extra = '', runs = {} } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sched-'));
  const store = path.join(dir, 'store'), home = path.join(dir, 'home'), pages = path.join(dir, 'pages');
  mkdirSync(path.join(store, 'data/design'), { recursive: true });
  mkdirSync(path.join(home, 'law'), { recursive: true });
  mkdirSync(pages);
  writeFileSync(path.join(store, 'data/design/scheduled-tasks.csv'),
    'id,keeps,watches,runner,entry,schedule,with,authority,budget,findings_to,status\n'
    + `statutes-rcw,k,mehrlander/home@main:law/topics.csv,hosted,${WT}scheduled-tasks.yml,${schedule},,observe,25,notes,${status}\n`
    + 'news-fetch,k,feeds,session-start,mehrlander/home@main:.claude/hooks/session-news-fetch.sh,,,ingest,,none,on\n'
    + extra);
  writeFileSync(path.join(store, 'data/design/scheduled-task-stages.csv'), stages);
  writeFileSync(path.join(home, 'law/topics.csv'),
    'topic,statutes\na,RCW 41.50.110(7)\nb,RCW 41.50.255; RCW 41.50.110\n');
  const put = (sec, body, note) => writeFileSync(path.join(pages, `rcw-${sec}.html`), page(sec, body, note));
  put('41.50.110', 'Expenses of administration.', '2025 c 424 § 941; 2015 3rd sp.s. c 4 § 951');
  put('41.50.255', 'Payment of expenses.', '2026 c 68 § 1; 1995 c 281 § 1');
  const state = path.join(dir, 'state.json'), notes = path.join(dir, 'notes.jsonl'), actions = path.join(dir, 'actions.json');
  writeFileSync(actions, JSON.stringify({ runs }));
  const args = (now, extra) => [SCRIPT,
    '--local', `mehrlander/web-tools-private=${store}`, '--local', `mehrlander/home=${home}`,
    '--pages', pages, '--state-file', state, '--notes-file', notes, '--actions-file', actions,
    '--pause', '0', '--now', now, ...extra];
  const run = (now, ...extra) => execFileSync('python3', args(now, extra), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const read = () => JSON.parse(readFileSync(state, 'utf8'));
  const noteLines = () => existsSync(notes) ? readFileSync(notes, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  const dispatched = () => JSON.parse(readFileSync(actions, 'utf8')).dispatched || [];
  return { put, run, read, noteLines, dispatched, state, pages };
}

test('the first run in the hour its schedule fires records a baseline, and nothing is reported', () => {
  const t = setup();
  const out = t.run(MON);
  assert.match(out, /statutes-rcw: due; probe 2, classify 0, report 0 \(baseline 2\); outcome baseline; next 2026-10-19T14:00Z/);
  const s = t.read().tasks['statutes-rcw'];
  assert.equal(s.outcome, 'baseline');
  assert.equal(s.next_at, '2026-10-19T14:00Z');
  assert.deepEqual(Object.keys(s.targets).sort(), ['41.50.110', '41.50.255']);
  assert.match(s.targets['41.50.110'].fp, /^sha256:[0-9a-f]{16}$/);
  assert.equal(s.targets['41.50.110'].head, '2025 c 424 s 941');
  assert.deepEqual(s.targets['41.50.255'].laws, ['2026 c 68 s 1', '1995 c 281 s 1']);
  assert.equal(t.noteLines().length, 0);
});

test('the gate: a task that never ran waits for its schedule, and one that ran waits for the next firing', () => {
  const t = setup();
  assert.match(t.run('2026-10-10T13:20:00Z'), /statutes-rcw: not due; next 2026-10-12T14:00Z/);
  assert.equal(existsSync(t.state), false);
  t.run(MON);
  const before = readFileSync(t.state, 'utf8');
  assert.match(t.run(MON_LATER), /statutes-rcw: not due; next 2026-10-19T14:00Z/);
  assert.equal(readFileSync(t.state, 'utf8'), before);
});

test('a missed firing is caught up: a task that ran before is due at the first hour after', () => {
  const t = setup();
  t.run(MON);
  assert.match(t.run('2026-10-20T03:20:00Z'), /statutes-rcw: due; .*outcome unchanged/);
});

test('the probe: an unchanged page stops at unchanged, and the furniture outside the content does not count', () => {
  const t = setup();
  t.run(MON);
  assert.match(t.run(NEXT_MON), /probe 2, classify 0, report 0 \(unchanged 2\); outcome unchanged; next 2026-10-26T14:00Z/);
});

test('the classifier: changed wording with no new session law stops at reworded, with no note', () => {
  const t = setup();
  t.run(MON);
  t.put('41.50.255', 'Payment of the expenses.', '2026 c 68 § 1; 1995 c 281 § 1');
  assert.match(t.run(NEXT_MON), /probe 2, classify 1, report 0 \(unchanged 1, reworded 1\); outcome reworded/);
  assert.equal(t.noteLines().length, 0);
});

test('the report: a new session law at the head of the note becomes a finding, as a signed note', () => {
  const t = setup();
  t.run(MON);
  t.put('41.50.110', 'Expenses of administration, amended.', '2027 c 12 § 3; 2025 c 424 § 941; 2015 3rd sp.s. c 4 § 951');
  assert.match(t.run(NEXT_MON), /probe 2, classify 1, report 1 \(unchanged 1, finding 1\); outcome finding/);
  const [n] = t.noteLines();
  assert.equal(n.author, 'scheduled/statutes-rcw');
  assert.equal(n.about, 'mehrlander/home:projects/budget-drs/data/source/2026-10-09-pension-statutes/html/rcw-41.50.110.html');
  assert.match(n.text, /2027 c 12 s 3/);
  assert.match(n.id, /^n[0-9a-z]+$/);
  assert.equal(t.read().tasks['statutes-rcw'].targets['41.50.110'].head, '2027 c 12 s 3');
});

test('a run in which every target failed is retried a day later, not a week', () => {
  const t = setup();
  for (const f of readdirSync(t.pages)) writeFileSync(path.join(t.pages, f), '<html></html>');
  assert.match(t.run(MON), /\(failed 2\); outcome failed/);
  assert.equal(t.read().tasks['statutes-rcw'].failures, 1);
  assert.match(t.run('2026-10-12T20:20:00Z'), /statutes-rcw: not due/);
  assert.match(t.run('2026-10-13T14:20:00Z'), /statutes-rcw: due; .*outcome failed/);
  assert.equal(t.read().tasks['statutes-rcw'].failures, 2);
});

test('status dry runs every stage in its hour and writes nothing, so it does not rerun every hour; off stops at the gate', () => {
  const dry = setup({ status: 'dry' });
  assert.match(dry.run(MON), /baseline 2\).*dry, nothing written/);
  assert.match(dry.run(MON_LATER), /statutes-rcw: not due/);
  assert.equal(existsSync(dry.state), false);
  const off = setup({ status: 'off' });
  assert.match(off.run(MON), /statutes-rcw: off/);
  assert.equal(existsSync(off.state), false);
});

test('the registry and the code must name the same stages, or that task does not run and the run fails', () => {
  const t = setup({ stages: STAGES.replace('classify', 'judge') });
  assert.throws(() => t.run(MON), /declares stages \['gate', 'probe', 'judge', 'report'\]/);
});

test('a schedule that is not five cron fields is refused alone, and the other rows still run', () => {
  const t = setup({ schedule: '7d', extra: `hourly,k,x,hosted,${WT}activity-cache.yml,0 * * * *,,refresh,,none,on\n`,
    runs: { 'mehrlander/web-tools:.github/workflows/activity-cache.yml': '2026-10-12T12:30:00Z' } });
  assert.throws(() => t.run(MON), (e) => /statutes-rcw: schedule '7d' is not five cron fields/.test(e.stderr)
    && /hourly: due \(fired 2026-10-12T14:00Z\); dispatched activity-cache\.yml/.test(e.stdout));
});

test('another workflow is dispatched with its inputs when its schedule fired after its newest run of any kind', () => {
  const extra = `activity-cache,k,x,hosted,${WT}activity-cache.yml,0 * * * *,,refresh,,none,on\n`
    + `wsl-fetch,k,x,hosted,${WT}wsl-fetch.yml,0 9 1 * *,biennium=;full=true,ingest,,none,on\n`;
  const runs = { 'mehrlander/web-tools:.github/workflows/activity-cache.yml': '2026-10-12T12:30:00Z',
                 'mehrlander/web-tools:.github/workflows/wsl-fetch.yml': '2026-10-01T09:22:00Z' };
  const t = setup({ extra, runs });
  const out = t.run(MON);
  assert.match(out, /activity-cache: due \(fired 2026-10-12T14:00Z\); dispatched activity-cache\.yml/);
  assert.match(out, /wsl-fetch: not due; next 2026-11-01T09:00Z/);
  assert.deepEqual(t.dispatched(), [{ workflow: 'mehrlander/web-tools:.github/workflows/activity-cache.yml', inputs: {} }]);
  // A push-started run after the firing covers it.
  const pushed = setup({ extra, runs: { ...runs, 'mehrlander/web-tools:.github/workflows/activity-cache.yml': '2026-10-12T14:05:00Z' } });
  assert.match(pushed.run(MON), /activity-cache: not due; next 2026-10-12T15:00Z/);
  // The monthly one carries its row's inputs.
  const monthly = setup({ extra, runs });
  monthly.run('2026-11-01T09:20:00Z');
  assert.deepEqual(monthly.dispatched().find(d => d.workflow.endsWith('wsl-fetch.yml')).inputs, { biennium: '', full: 'true' });
});

test('a dry dispatch is logged and not made; rows on other runners are left to them', () => {
  const t = setup({ extra: `activity-cache,k,x,hosted,${WT}activity-cache.yml,0 * * * *,,refresh,,none,dry\n` });
  const out = t.run(MON);
  assert.match(out, /activity-cache: due \(fired 2026-10-12T14:00Z\); dry, not dispatched/);
  assert.deepEqual(t.dispatched(), []);
  assert.doesNotMatch(out, /news-fetch/);
});

test('one schedule: no workflow but the scheduled-tasks one carries a cron', () => {
  const dir = path.join(repoRoot, '.github/workflows');
  const withCron = readdirSync(dir).filter(f => /\.ya?ml$/.test(f))
    .filter(f => /^\s*schedule:\s*$/m.test(readFileSync(path.join(dir, f), 'utf8')));
  assert.deepEqual(withCron, ['scheduled-tasks.yml'],
    "a schedule belongs in web-tools-private's data/design/scheduled-tasks.csv, where the Map shows it, not in a workflow");
});
