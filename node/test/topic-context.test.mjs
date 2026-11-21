// skills/hooks/topic-context.py: the hook that puts this session's topics, as
// Gemini read them, into its context and warns when the daemon stops reading
// or a job it runs is failing. Driven as a subprocess over a scratch archive:
// an origin repository built with git plumbing, its `main` holding records and
// its `background` companions and the daemon's job state, and a checkout that
// declares the store and points at it. TMPDIR is the scratch folder, so each
// test keeps its own state file and mirror. The clock is fixed at NOW through
// TOPIC_CONTEXT_NOW and the zone set through OWNER_TZ.
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const HOOK = path.join(repoRoot, 'skills/hooks/topic-context.py');
const HOOKS_JSON = JSON.parse(
  readFileSync(path.join(repoRoot, 'skills/hooks/hooks.json'), 'utf8'));
const SESSION = 'f701fa79-e1c0-5997-b6c3-709182f8e137';
const RECORD = 'sessions/2026/11/2026-11-14-f701fa79.json';
const COMPANION = 'sessions/topics/2026/11/2026-11-14-f701fa79.json';
const FIXES = 'sessions/topics/2026/11/2026-11-14-f701fa79.corrections.jsonl';
const OTHER = 'sessions/topics/2026/11/2026-11-14-0a0b0c0d.json';
const JOBS = 'state/scheduled-daemon.json';
const MIN = 60_000, HOUR = 60 * MIN;
const NOW = Date.parse('2026-11-14T18:14:00Z');  // 10:14am in America/Los_Angeles
const ago = (ms) => NOW - ms;
const iso = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
const minute = (t) => new Date(t).toISOString().slice(0, 16) + 'Z';
// A suite run inside a git hook must not reach the repository the hook belongs to.
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
const TOPICS = ['Alpha', 'Beta', 'Gamma'];
const STATUS = [
  { topic: 'Alpha', status: 'open', waits_on: 'owner', waiting: 'sign off two calls' },
  { topic: 'Beta', status: 'done', waits_on: null, waiting: null },
  { topic: 'Gamma', status: 'open', waits_on: 'external', waiting: 'a worker' },
];

const companion = ({ blob, ended, analyzed, topics = TOPICS, status = STATUS, corrections } = {}) =>
  JSON.stringify({ format: 7, session_id: SESSION, short_id: 'f701fa79', day: '2026-11-14',
    source_path: RECORD, source_blob: blob, source_ended: iso(ended), analyzed_at: iso(analyzed),
    topics, topic_status: status, ...(corrections ? { corrections } : {}) });

function scratch() {
  const dir = mkdtempSync(path.join(tmpdir(), 'topic-context-'));
  const origin = path.join(dir, 'origin');
  const root = path.join(dir, 'work');
  const archive = path.join(root, 'archive');
  const git = (cwd, args, more = {}) => execFileSync('git', args, {
    cwd, env: { ...ENV, ...more.env }, input: more.input, encoding: 'utf8' }).trim();
  git(dir, ['init', '-q', origin]);
  git(origin, ['config', 'uploadpack.allowFilter', 'true']);
  git(origin, ['config', 'uploadpack.allowAnySHA1InWant', 'true']);
  // The checkout the hook finds: the manifest, the runner and the remote.
  mkdirSync(path.join(archive, 'sessions', 'tools'), { recursive: true });
  writeFileSync(path.join(archive, '.web-tools.json'), JSON.stringify({ sessions: 'sessions' }));
  writeFileSync(path.join(archive, 'sessions', 'tools', 'on-stop.sh'), '');
  git(archive, ['init', '-q']);
  git(archive, ['remote', 'add', 'origin', 'file://' + origin]);

  // A commit on a branch of origin, dated `at`, built without a work tree.
  const oids = {};
  const commit = (branch, files, at, subject) => {
    const date = `@${Math.floor(at / 1000)} +0000`;
    const env = { GIT_INDEX_FILE: path.join(dir, `index-${branch}`), GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date, GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.com' };
    for (const [file, text] of Object.entries(files)) {
      const oid = git(origin, ['hash-object', '-w', '--stdin'], { input: text });
      git(origin, ['update-index', '--add', '--cacheinfo', `100644,${oid},${file}`], { env });
      oids[file] = oid;
    }
    const tree = git(origin, ['write-tree'], { env });
    let parent = '';
    try { parent = git(origin, ['rev-parse', '-q', '--verify', `refs/heads/${branch}`]); } catch { /* first commit */ }
    const sha = git(origin, ['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', subject], { env });
    git(origin, ['update-ref', `refs/heads/${branch}`, sha]);
    return oids[Object.keys(files)[0]];
  };
  const record = (at, text = `{"ended": "${iso(at)}"}`) => commit('main', { [RECORD]: text }, at,
    'sessions: 2026-11-14-f701fa79');
  const otherRecord = (at) => commit('main', { 'sessions/2026/11/2026-11-14-0a0b0c0d.json': `{"at": ${at}}` }, at,
    'sessions: 2026-11-14-0a0b0c0d');
  const topics = (at, files) => commit('background', files, at, 'topics: 2026-11-14-f701fa79 via Gemini daemon');
  const jobs = (at, rows) => commit('background', { [JOBS]: JSON.stringify(rows) }, at,
    'scheduled: update daemon run state via Gemini daemon');

  const run = (payload = {}, { now = NOW, env = {} } = {}) => execFileSync('python3', [HOOK], {
    input: typeof payload === 'string' ? payload
      : JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', session_id: SESSION, cwd: root, ...payload }),
    env: { ...ENV, TMPDIR: dir, CLAUDE_PROJECT_DIR: root, SESSIONS_STORE: '',
      TOPIC_CONTEXT_NOW: String(now / 1000), OWNER_TZ: 'America/Los_Angeles', ...env },
    encoding: 'utf8',
  }).trim();
  const unplug = () => renameSync(origin, origin + '.away');
  const replug = () => renameSync(origin + '.away', origin);
  return { dir, root, archive, origin, record, otherRecord, topics, jobs, commit, run, unplug, replug,
    done: () => rmSync(dir, { recursive: true, force: true }) };
}

const context = (out, event = 'SessionStart') => {
  const d = JSON.parse(out).hookSpecificOutput;
  assert.equal(d.hookEventName, event);
  return d.additionalContext;
};

// A session read 40 minutes ago, its record unchanged since, and one healthy job.
function fresh(s) {
  const blob = s.record(ago(50 * MIN));
  s.topics(ago(39 * MIN), { [COMPANION]: companion({ blob, ended: ago(51 * MIN), analyzed: ago(40 * MIN) }) });
  s.jobs(ago(30 * MIN), { 'pr-checks': { fired: minute(ago(30 * MIN)) } });
  return blob;
}

test('a fresh reading: the topics in order with status and what they wait on, and nothing more', () => {
  const s = scratch();
  try {
    fresh(s);
    assert.equal(context(s.run()), [
      "This session's topics, as Gemini read them at 9:34am from the record through 9:23am; that reading covers the record as it stands:",
      '- Alpha: open, waiting on the owner: sign off two calls',
      '- Beta: done',
      '- Gamma: open, waiting on someone outside: a worker',
    ].join('\n'));
  } finally { s.done(); }
});

test('a record that moved since the reading says so, and warns only past three hours', () => {
  const s = scratch();
  try {
    fresh(s);
    s.record(ago(20 * MIN));
    const msg = context(s.run());
    assert.match(msg, /from the record through 9:23am; the record has moved since, last at 9:54am:/);
    assert.doesNotMatch(msg, /passed over/);
  } finally { s.done(); }
  const t = scratch();
  try {
    const blob = t.record(ago(5 * HOUR));
    t.topics(ago(290 * MIN), { [COMPANION]: companion({ blob, ended: ago(301 * MIN), analyzed: ago(290 * MIN) }) });
    t.record(ago(200 * MIN));
    t.record(ago(100 * MIN));
    t.otherRecord(ago(35 * MIN));
    t.topics(ago(30 * MIN), { [OTHER]: '{}' });
    assert.match(context(t.run()), /\nGemini has passed over this session: its record has waited since 6:54am \(3h\) for a reading while Gemini read other sessions, last at 9:44am\.\nMention this to the owner if your work waits on Gemini\.$/);
  } finally { t.done(); }
});

test('no companion yet: "no topics yet" and when Gemini last wrote any', () => {
  const s = scratch();
  try {
    s.otherRecord(ago(20 * MIN));
    s.topics(ago(12 * MIN), { [OTHER]: '{}' });
    s.record(ago(5 * MIN));
    assert.equal(context(s.run()),
      'No topics yet for this session.\nGemini last wrote session topics at 10:02am, 12m ago.');
  } finally { s.done(); }
});

test('records waiting an hour with no topic written: behind, stuck or asleep by the daemon\'s other commits', () => {
  const s = scratch();
  try {
    fresh(s);  // topics last written at 9:35am
    s.otherRecord(ago(30 * MIN));
    assert.doesNotMatch(context(s.run()), /behind/, 'thirty minutes is within the measured lag');
  } finally { s.done(); }
  const t = scratch();
  try {
    const blob = t.record(ago(3 * HOUR));
    t.topics(ago(2 * HOUR), { [COMPANION]: companion({ blob, ended: ago(3 * HOUR), analyzed: ago(2 * HOUR) }) });
    t.otherRecord(ago(100 * MIN));
    t.otherRecord(ago(10 * MIN));
    const asleep = context(t.run());
    assert.match(asleep, /\nGemini is behind: no session topics written since 8:14am \(2h\) while session records have waited since 8:34am, and nothing from the daemon at all since 8:14am: the laptop is asleep or the daemon stopped\.\n/);
    assert.doesNotMatch(asleep, /passed over/, 'behind covers this session too');
    t.jobs(ago(20 * MIN), { 'pr-checks': { fired: minute(ago(20 * MIN)) } });
    assert.match(context(t.run({ source: 'compact' })), /while session records have waited since 8:34am, though the daemon committed other work at 9:54am \(scheduled: update daemon run state\), so its topic reader is the part stopped or stuck\./);
  } finally { t.done(); }
});

test('a job tried since its last success is failing: named, with its error quoted when it has one', () => {
  const s = scratch();
  try {
    fresh(s);
    s.jobs(ago(10 * MIN), {
      'news-capture': { fired: '2026-11-13T23:35Z', tried: '2026-11-14T17:16Z', error: 'capture exited 1:  403   Forbidden' },
      'quiet-fail': { tried: '2026-11-14T16:00Z' },
      recovered: { fired: '2026-11-14T17:00Z' },
      'stale-try': { fired: '2026-11-14T17:00Z', tried: '2026-11-14T16:00Z' },
    });
    const msg = context(s.run());
    assert.match(msg, /\nDaemon job news-capture is failing: last ran 11\/13 3:35pm, last tried 9:16am, error: capture exited 1: 403 Forbidden\.\n/);
    assert.match(msg, /\nDaemon job quiet-fail is failing: never ran, last tried 8:00am, no error recorded\.\n/);
    assert.doesNotMatch(msg, /recovered|stale-try/);
    assert.match(msg, /Mention this to the owner if your work waits on Gemini\.$/);
  } finally { s.done(); }
});

test('corrections the companion has not taken in apply over it, later lines over earlier', () => {
  const s = scratch();
  try {
    const blob = s.record(ago(50 * MIN));
    const line = (o) => JSON.stringify({ at: iso(ago(5 * MIN)), by: 'claude:f701fa79', ...o });
    s.topics(ago(39 * MIN), {
      [COMPANION]: companion({ blob, ended: ago(51 * MIN), analyzed: ago(40 * MIN),
        corrections: { blob: '0'.repeat(40), lines: 1, applied: 1, skipped: [] } }),
      [FIXES]: [line({ op: 'status', topic: 'Gamma', status: 'open', waits_on: 'owner', waiting: 'first' }),
        line({ op: 'rename', topic: 'Alpha', to: 'Alpha prime' }),
        line({ op: 'status', topic: 'Gamma', status: 'done' }),
        line({ op: 'move', turns: [0, 1], topic: 'Delta' }),
        'not json'].join('\n') + '\n',
    });
    assert.match(context(s.run()), /:\n- Alpha prime: open, waiting on the owner: sign off two calls\n- Beta: done\n- Gamma: done$/);
  } finally { s.done(); }
  const t = scratch();
  try {
    const blob = t.record(ago(50 * MIN));
    const fixes = JSON.stringify({ op: 'status', topic: 'Beta', status: 'dropped' }) + '\n';
    const applied = execFileSync('git', ['hash-object', '--stdin'], { input: fixes, encoding: 'utf8', env: ENV }).trim();
    t.topics(ago(39 * MIN), {
      [COMPANION]: companion({ blob, ended: ago(51 * MIN), analyzed: ago(40 * MIN),
        corrections: { blob: applied, lines: 1, applied: 1, skipped: [] } }),
      [FIXES]: fixes,
    });
    assert.match(context(t.run()), /\n- Beta: done\n/, 'a file the companion already took in is not read again');
  } finally { t.done(); }
});

test('more than ten topics fold the done and dropped ones into a count', () => {
  const s = scratch();
  try {
    const blob = s.record(ago(50 * MIN));
    const names = Array.from({ length: 12 }, (_, i) => `T${i}`);
    const status = names.map((topic, i) => ({ topic, status: i % 3 ? 'done' : 'open', waits_on: i % 3 ? null : 'session', waiting: null }));
    s.topics(ago(39 * MIN), { [COMPANION]: companion({ blob, ended: ago(51 * MIN), analyzed: ago(40 * MIN), topics: names, status }) });
    const msg = context(s.run());
    assert.match(msg, /:\n- T0: open, waiting on this session\n- T3: open, waiting on this session\n- T6: open, waiting on this session\n- T9: open, waiting on this session\n- and 8 more, done or dropped$/);
  } finally { s.done(); }
});

test('at a prompt it fetches at most every fifteen minutes and speaks only when the reading changed', () => {
  const s = scratch();
  try {
    const blob = fresh(s);
    context(s.run());
    const prompt = (now) => s.run({ hook_event_name: 'UserPromptSubmit', prompt: 'go' }, { now });
    s.unplug();
    assert.equal(prompt(NOW + 5 * MIN), '', 'within fifteen minutes it does not fetch, so a missing origin goes unnoticed');
    s.replug();
    assert.equal(prompt(NOW + 20 * MIN), '', 'an unchanged reading is not repeated');
    const status = STATUS.map(e => e.topic === 'Gamma' ? { ...e, status: 'done', waits_on: null, waiting: null } : e);
    s.topics(NOW + 25 * MIN, { [COMPANION]: companion({ blob, ended: ago(51 * MIN), analyzed: NOW + 24 * MIN, status }) });
    assert.equal(prompt(NOW + 30 * MIN), '', 'the next check waits its fifteen minutes');
    assert.match(context(prompt(NOW + 40 * MIN), 'UserPromptSubmit'), /as Gemini read them at 10:38am[\s\S]*\n- Gamma: done$/);
    assert.equal(prompt(NOW + 60 * MIN), '', 'and is then quiet again');
  } finally { s.done(); }
});

test('a resume speaks only on a changed reading and leaves the next prompt to say it too', () => {
  const s = scratch();
  try {
    const blob = fresh(s);
    context(s.run());
    assert.equal(s.run({ source: 'resume' }, { now: NOW + 5 * MIN }), '', 'unchanged');
    const status = STATUS.map(e => e.topic === 'Alpha' ? { ...e, waiting: 'sign off one call' } : e);
    s.topics(NOW + 6 * MIN, { [COMPANION]: companion({ blob, ended: ago(51 * MIN), analyzed: NOW + 6 * MIN, status }) });
    assert.match(context(s.run({ source: 'resume' }, { now: NOW + 7 * MIN })), /sign off one call/);
    const next = s.run({ hook_event_name: 'UserPromptSubmit', prompt: 'go' }, { now: NOW + 8 * MIN });
    assert.match(context(next, 'UserPromptSubmit'), /sign off one call/, 'a resume\'s output may not arrive');
    assert.match(context(s.run({ source: 'compact' }, { now: NOW + 9 * MIN })), /sign off one call/, 'a compaction always gets it');
  } finally { s.done(); }
});

test('a failed fetch is said in one line, at once at session start and after an hour at prompts', () => {
  const s = scratch();
  try {
    fresh(s);
    s.unplug();
    assert.match(context(s.run()), /^Could not refresh this session's topics from the session archive \([^)]+\); they are unknown for now\.$/);
  } finally { s.done(); }
  const t = scratch();
  try {
    fresh(t);
    context(t.run());
    t.unplug();
    const prompt = (now) => t.run({ hook_event_name: 'UserPromptSubmit', prompt: 'go' }, { now });
    assert.equal(prompt(NOW + 20 * MIN), '', 'a first failure at a prompt is not said');
    assert.equal(prompt(NOW + 40 * MIN), '');
    const late = context(prompt(NOW + 90 * MIN), 'UserPromptSubmit');
    assert.match(late, /^Could not refresh [^\n]+; what follows is from the last fetch\.\nThis session's topics/);
    assert.equal(prompt(NOW + 110 * MIN), '', 'and is said once');
    assert.match(context(t.run({ source: 'compact' }, { now: NOW + 120 * MIN })), /^Could not refresh [^\n]+; what follows is from the last fetch\.\nThis session's topics/);
  } finally { t.done(); }
});

test('anything it was not aimed at passes silently, and it never fails a turn', () => {
  const s = scratch();
  try {
    fresh(s);
    assert.equal(s.run('not json'), '');
    assert.equal(s.run({ agent_id: 'a1' }), '', 'a subagent');
    assert.equal(s.run({ session_id: '' }), '');
    assert.equal(s.run({ hook_event_name: 'Stop' }), '');
    assert.equal(s.run({}, { env: { CLAUDE_PROJECT_DIR: path.join(s.dir, 'nowhere') } }), '', 'no archive');
  } finally { s.done(); }
  const t = scratch();
  try {
    t.record(ago(10 * MIN));
    assert.equal(t.run(), '', 'an archive with no background branch has no topics to give');
  } finally { t.done(); }
});

test('it is registered on SessionStart for startup, resume and compact, and on UserPromptSubmit, through the plugin root', () => {
  const on = (event) => (HOOKS_JSON.hooks[event] || [])
    .filter(e => e.hooks.some(h => h.command.includes('topic-context.py')));
  const start = on('SessionStart'), prompt = on('UserPromptSubmit');
  assert.equal(start.length, 1);
  assert.equal(prompt.length, 1);
  assert.deepEqual(start[0].matcher.split('|').sort(), ['compact', 'resume', 'startup']);
  for (const entry of [...start, ...prompt]) {
    assert.match(entry.hooks[0].command, /^python3 "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/topic-context\.py"$/);
  }
});
