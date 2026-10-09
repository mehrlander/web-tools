// python/scheduled-tasks.py: the runner for the estate's scheduled tasks.
//
// The script is python3/stdlib, so this drives it the way the workflow does,
// against a registry, a watched file and pages written to a temp folder, and
// holds the progressive action to its contract: the gate stops what is off or
// not due, the probe stops what has not changed, the classifier stops what
// changed without a new session law, and only what is left reaches the report.
// Offline throughout: --local, --pages, --state-file and --notes-file stand in
// for GitHub and the Legislature.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const SCRIPT = path.join(repoRoot, 'python/scheduled-tasks.py');
const STAGES = 'task,order,stage,cost,does,continue_when,otherwise\n'
  + 'statutes-rcw,0,gate,free,g,due,skipped\n'
  + 'statutes-rcw,1,probe,network,p,changed,unchanged\n'
  + 'statutes-rcw,2,classify,local,c,new law,reworded\n'
  + 'statutes-rcw,3,report,local,r,,finding\n';

// A page shaped like the Legislature's: furniture outside the content element,
// self-closing breaks inside it (the shape that once closed it early), and a
// history note in brackets.
const page = (sec, body, note) => `<html><body><nav>menu</nav>
  <div class="main-page-wrapper"><div class="main-page-content">
    <div id="prev"><font>41.50.090 &lt;&lt; ${sec} &gt;&gt;<br/><br/></font></div>
    <h1>RCW ${sec}</h1><div>${body}</div><div>[ ${note} ]</div>
  </div></div><footer>Washington State Legislature, updated daily</footer></body></html>`;

function setup({ status = 'on', stages = STAGES } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sched-'));
  const store = path.join(dir, 'store'), home = path.join(dir, 'home'), pages = path.join(dir, 'pages');
  mkdirSync(path.join(store, 'data/design'), { recursive: true });
  mkdirSync(path.join(home, 'law'), { recursive: true });
  mkdirSync(pages);
  writeFileSync(path.join(store, 'data/design/scheduled-tasks.csv'),
    'id,keeps,watches,runner,entry,every,authority,budget,findings_to,status\n'
    + `statutes-rcw,k,mehrlander/home@main:law/topics.csv,hosted,mehrlander/web-tools@main:.github/workflows/scheduled-tasks.yml,7d,observe,25,notes,${status}\n`
    + 'other,k,elsewhere,hosted,mehrlander/web-tools@main:.github/workflows/activity-cache.yml,,refresh,,none,on\n');
  writeFileSync(path.join(store, 'data/design/scheduled-task-stages.csv'), stages);
  writeFileSync(path.join(home, 'law/topics.csv'),
    'topic,statutes\na,RCW 41.50.110(7)\nb,RCW 41.50.255; RCW 41.50.110\n');
  const put = (sec, body, note) => writeFileSync(path.join(pages, `rcw-${sec}.html`), page(sec, body, note));
  put('41.50.110', 'Expenses of administration.', '2025 c 424 § 941; 2015 3rd sp.s. c 4 § 951');
  put('41.50.255', 'Payment of expenses.', '2026 c 68 § 1; 1995 c 281 § 1');
  const state = path.join(dir, 'state.json'), notes = path.join(dir, 'notes.jsonl');
  const run = (now, ...extra) => execFileSync('python3', [SCRIPT,
    '--local', `mehrlander/web-tools-private=${store}`, '--local', `mehrlander/home=${home}`,
    '--pages', pages, '--state-file', state, '--notes-file', notes, '--pause', '0', '--now', now, ...extra],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const read = () => JSON.parse(readFileSync(state, 'utf8'));
  const noteLines = () => existsSync(notes) ? readFileSync(notes, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  return { put, run, read, noteLines, state };
}

test('the first run records a baseline: every target fingerprinted, nothing reported', () => {
  const t = setup();
  const out = t.run('2026-10-10T13:41:00Z');
  assert.match(out, /statutes-rcw: due; probe 2, classify 0, report 0 \(baseline 2\)/);
  const s = t.read().tasks['statutes-rcw'];
  assert.equal(s.outcome, 'baseline');
  assert.equal(s.next_due, '2026-10-17');
  assert.deepEqual(Object.keys(s.targets).sort(), ['41.50.110', '41.50.255']);
  assert.match(s.targets['41.50.110'].fp, /^sha256:[0-9a-f]{16}$/);
  assert.equal(s.targets['41.50.110'].head, '2025 c 424 s 941');
  assert.deepEqual(s.targets['41.50.255'].laws, ['2026 c 68 s 1', '1995 c 281 s 1']);
  assert.equal(t.noteLines().length, 0);
});

test('the gate: a task not yet due stops there and writes nothing', () => {
  const t = setup();
  t.run('2026-10-10T13:41:00Z');
  const before = readFileSync(t.state, 'utf8');
  assert.match(t.run('2026-10-12T13:41:00Z'), /statutes-rcw: not due until 2026-10-17/);
  assert.equal(readFileSync(t.state, 'utf8'), before);
});

test('the probe: an unchanged page stops at unchanged, and the furniture outside the content does not count', () => {
  const t = setup();
  t.run('2026-10-10T13:41:00Z');
  const out = t.run('2026-10-17T13:41:00Z');
  assert.match(out, /probe 2, classify 0, report 0 \(unchanged 2\); outcome unchanged; next due 2026-10-24/);
});

test('the classifier: changed wording with no new session law stops at reworded, with no note', () => {
  const t = setup();
  t.run('2026-10-10T13:41:00Z');
  t.put('41.50.255', 'Payment of the expenses.', '2026 c 68 § 1; 1995 c 281 § 1');
  const out = t.run('2026-10-17T13:41:00Z');
  assert.match(out, /probe 2, classify 1, report 0 \(unchanged 1, reworded 1\); outcome reworded/);
  assert.equal(t.noteLines().length, 0);
});

test('the report: a new session law at the head of the note becomes a finding, as a signed note', () => {
  const t = setup();
  t.run('2026-10-10T13:41:00Z');
  t.put('41.50.110', 'Expenses of administration, amended.', '2027 c 12 § 3; 2025 c 424 § 941; 2015 3rd sp.s. c 4 § 951');
  const out = t.run('2026-10-17T13:41:00Z');
  assert.match(out, /probe 2, classify 1, report 1 \(unchanged 1, finding 1\); outcome finding/);
  const [n] = t.noteLines();
  assert.equal(n.author, 'scheduled/statutes-rcw');
  assert.equal(n.about, 'mehrlander/home:projects/budget-drs/data/source/2026-10-09-pension-statutes/html/rcw-41.50.110.html');
  assert.match(n.text, /2027 c 12 s 3/);
  assert.match(n.id, /^n[0-9a-z]+$/);
  assert.equal(t.read().tasks['statutes-rcw'].targets['41.50.110'].head, '2027 c 12 s 3');
});

test('status dry runs every stage and writes nothing; off stops at the gate', () => {
  const dry = setup({ status: 'dry' });
  assert.match(dry.run('2026-10-10T13:41:00Z'), /baseline 2\).*dry, nothing written/);
  assert.equal(existsSync(dry.state), false);
  const off = setup({ status: 'off' });
  assert.match(off.run('2026-10-10T13:41:00Z'), /statutes-rcw: off/);
  assert.equal(existsSync(off.state), false);
});

test('the registry and the code must name the same stages, or nothing runs', () => {
  const t = setup({ stages: STAGES.replace('classify', 'judge') });
  assert.throws(() => t.run('2026-10-10T13:41:00Z'), /declares stages \['gate', 'probe', 'judge', 'report'\]/);
});

test('rows that point at other workflows are left to them', () => {
  const t = setup();
  const out = t.run('2026-10-10T13:41:00Z');
  assert.doesNotMatch(out, /other/);
});
