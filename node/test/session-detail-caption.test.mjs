// skills/hooks/session-detail-caption.py: the hook that prints the line a reply
// closes with. Driven as a subprocess over a scratch transcript in the
// harness's shapes and real git checkouts under a scratch project root, with
// TMPDIR pointed at the scratch folder so each test keeps its own state file.
// Times are written relative to the clock, half a minute clear of each
// boundary, because the hook reads the real one.
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const HOOK = path.join(repoRoot, 'skills/hooks/session-detail-caption.py');
const HOOKS_JSON = JSON.parse(
  readFileSync(path.join(repoRoot, 'skills/hooks/hooks.json'), 'utf8'));
const PAGES = 'https://mehrlander.github.io/web-tools/pages/';
const SESSION = 'f701fa79-e1c0-5997-b6c3-709182f8e137';
const SESSION_PAGE = PAGES + 'session.html#id=f701fa79';
const CLOSE = 'Close the reply with that line, unchanged, as its session detail caption.';
const WAKE = '<task-notification>\n<task-id>a1</task-id>';  // a prompt that is not the owner's
const MIN = 60_000, HOUR = 60 * MIN;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
// A commit made by a suite running inside a git hook must land in the scratch
// checkout, not in the repository the hook belongs to.
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));

// ── Transcript entries, in the shapes the harness writes ───────────────────
const line = (entry) => JSON.stringify({ isSidechain: false, ...entry });
const typed = (text, at = ago(5 * MIN), more = {}) =>
  line({ type: 'user', origin: { kind: 'human' }, timestamp: at, message: { role: 'user', content: text }, ...more });
const reply = (tokens, more = {}) => line({
  type: 'assistant', timestamp: ago(MIN),
  message: { role: 'assistant', model: 'claude-fable-5-2', content: [{ type: 'text', text: 'ok' }],
    usage: { input_tokens: 2, cache_creation_input_tokens: 1000, cache_read_input_tokens: tokens - 1002, output_tokens: 50 } },
  ...more,
});
// A message sent while the model was working: the attachment that delivers it,
// then the queue entry that takes it off the queue, both under one id.
const midTurn = (text, origin, id = 'c0ffee') => [
  line({ type: 'attachment', timestamp: ago(3 * MIN),
    attachment: { type: 'queued_command', prompt: text, source_uuid: id, commandMode: 'prompt', origin } }),
  JSON.stringify({ type: 'queue-operation', operation: 'remove', reason: 'absorbed_mid_turn',
    timestamp: ago(3 * MIN), content: text, commandUuid: id }),
];

function scratch({ archive = true } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'session-detail-caption-'));
  const root = path.join(dir, 'work');
  mkdirSync(root);
  if (archive) store(path.join(root, 'archive'));
  const transcript = path.join(dir, 'session.jsonl');
  // `entries` rewrites the transcript whole, which a harness never does, so a
  // test that runs twice over different entries gives each run its own session.
  const run = (entries, payload = {}, env = {}) => {
    if (entries) writeFileSync(transcript, entries.join('\n') + '\n');
    return execFileSync('python3', [HOOK], {
      input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', transcript_path: transcript,
        session_id: SESSION, cwd: root, prompt: WAKE, ...payload }),
      env: { ...ENV, TMPDIR: dir, CLAUDE_PROJECT_DIR: root, SESSIONS_STORE: '', ...env },
      encoding: 'utf8',
    }).trim();
  };
  return { dir, root, transcript, run, done: () => rmSync(dir, { recursive: true, force: true }) };
}

// The session archive as session-record.sh recognises it: a checkout whose
// manifest declares a sessions store that holds the runner.
function store(repo) {
  mkdirSync(path.join(repo, 'sessions', 'tools'), { recursive: true });
  writeFileSync(path.join(repo, '.web-tools.json'), JSON.stringify({ sessions: 'sessions' }));
  writeFileSync(path.join(repo, 'sessions', 'tools', 'on-stop.sh'), '');
}

// A checkout with an origin/main and a branch `changed` files ahead of it.
function checkout(root, name, { changed = 0, branch = 'claude/work' } = {}) {
  const repo = path.join(root, name);
  mkdirSync(repo, { recursive: true });
  const git = (...args) => execFileSync('git',
    ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args],
    { cwd: repo, env: ENV, encoding: 'utf8' });
  const commit = (label, count) => {
    for (let i = 0; i < count; i++) writeFileSync(path.join(repo, `${label}-${i}.txt`), label + '\n');
    git('add', '.');
    git('commit', '-q', '-m', label);
  };
  git('init', '-q', '-b', 'main');
  git('remote', 'add', 'origin', `https://github.com/acme/${name}.git`);
  commit('base', 1);
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  if (branch) git('checkout', '-q', '-b', branch);
  if (changed) commit('first', changed);
  return { repo, git, commit };
}

// The caption line, with the event and the instruction under it checked.
const caption = (out, event = 'UserPromptSubmit') => {
  const d = JSON.parse(out).hookSpecificOutput;
  assert.equal(d.hookEventName, event);
  const [first, second, ...rest] = d.additionalContext.split('\n');
  assert.equal(second, CLOSE);
  assert.deepEqual(rest, []);
  return first;
};

test('the line: the count as the session link, then the time, the context and the files', () => {
  const s = scratch();
  try {
    checkout(s.root, 'app', { changed: 1 });
    const out = s.run([typed('It is a new day.', ago(26 * HOUR + 30 * MIN)), reply(120_000),
      typed('Ok go ahead.'), reply(815_600)], { prompt: 'What next?' });
    assert.equal(caption(out), `💬[3](${SESSION_PAGE}) · 1d 2h · 816k · 1 file`);
  } finally { s.done(); }
});

test('the time since the first owner message: minutes, then hours, then days and hours', () => {
  const s = scratch();
  try {
    const cases = [[30_000, '0m'], [45 * MIN + 30_000, '45m'], [59 * MIN + 30_000, '59m'],
      [60 * MIN + 30_000, '1h'], [7 * HOUR + 30 * MIN, '7h'], [23 * HOUR + 59 * MIN + 30_000, '23h'],
      [24 * HOUR + 30_000, '1d 0h'], [26 * HOUR + 30 * MIN, '1d 2h'], [74 * HOUR + 30 * MIN, '3d 2h']];
    cases.forEach(([ms, want], i) => {
      const got = caption(s.run([typed('first', ago(ms)), reply(50_000), typed('later', ago(10_000))],
        { session_id: 'case-' + i }));
      assert.equal(got, `💬[2](${PAGES}session.html#id=case-${i}) · ${want} · 50k`, `${ms} ms ago`);
    });
  } finally { s.done(); }
});

test('it counts what the owner typed, and a mid-turn message once', () => {
  const s = scratch();
  try {
    const out = s.run([
      typed('one'),
      line({ type: 'user', timestamp: ago(MIN), toolUseResult: { stdout: 'x' },
        message: { role: 'user', content: [{ type: 'tool_result', content: '{"origin":{"kind":"human"}}' }] } }),
      line({ type: 'user', isMeta: true, message: { role: 'user', content: 'Base directory for this skill: /x' } }),
      line({ type: 'user', isCompactSummary: true, message: { role: 'user', content: 'This session is being continued' } }),
      line({ type: 'user', origin: { kind: 'task-notification' }, message: { role: 'user', content: WAKE } }),
      line({ type: 'user', origin: { kind: 'peer', from: 'a1' }, isMeta: true,
        message: { role: 'user', content: 'Another Claude session sent a message' } }),
      line({ type: 'user', isSidechain: true, origin: { kind: 'human' }, message: { role: 'user', content: 'a subagent\'s task' } }),
      reply(40_000),
      ...midTurn('Could we say less?', { kind: 'human' }),
      ...midTurn('<agent-message from="a1">\nreport', { kind: 'peer', from: 'a1' }, 'beef01'),
      ...midTurn(WAKE, { kind: 'task-notification' }, 'beef02'),
      JSON.stringify({ type: 'queue-operation', operation: 'enqueue', timestamp: ago(MIN), content: 'two' }),
      typed('two'),
      reply(41_000),
    ]);
    assert.equal(caption(out), `💬[3](${SESSION_PAGE}) · 5m · 41k`);
  } finally { s.done(); }
});

test('the prompt being submitted is counted once, whether or not the transcript holds it yet', () => {
  const s = scratch();
  try {
    const count = (entries, payload, i) =>
      Number(/^💬\[(\d+)\]/.exec(caption(s.run(entries, { session_id: 'case-' + i, ...payload })))[1]);
    assert.equal(count([typed('one'), reply(9000)], { prompt: 'two' }, 0), 2, 'not written yet, as the harness leaves it');
    assert.equal(count([typed('one'), reply(9000), typed('two')], { prompt: ' two\n' }, 1), 2, 'already written');
    assert.equal(count([typed('ok'), reply(9000)], { prompt: 'ok' }, 2), 2, 'the same words as a message already answered');
    assert.equal(count([typed('one'), reply(9000), typed([{ type: 'image', source: {} }, { type: 'text', text: 'look' }])],
      { prompt: 'look' }, 3), 2, 'already written, with a picture');
    ['<task-notification>\n<task-id>a1</task-id>', '<agent-message from="a1">\nreport', '[SYSTEM] wake',
      '<system-reminder>x</system-reminder>', 'Another Claude session sent a message'].forEach((prompt, i) =>
      assert.equal(count([typed('one'), reply(9000)], { prompt }, 10 + i), 1, 'not the owner\'s: ' + prompt.slice(0, 20)));
    assert.equal(count([typed('one'), reply(9000)], { prompt: undefined }, 20), 1, 'no prompt in the payload');
  } finally { s.done(); }
});

test('a first prompt, before any transcript, is message one at zero minutes', () => {
  const s = scratch();
  try {
    assert.equal(caption(s.run(null, { prompt: 'Hello' })), `💬[1](${SESSION_PAGE}) · 0m`);
  } finally { s.done(); }
});

test('the context is the last main-conversation response that used any, rounded to the thousand', () => {
  const s = scratch();
  try {
    const context = (entries, i) => caption(s.run(entries, { session_id: 'case-' + i })).split(' · ')[2];
    assert.equal(context([typed('one'), reply(350_400)], 0), '350k');
    assert.equal(context([typed('one'), reply(350_600), reply(900_000, { isSidechain: true })], 1), '351k', 'not a subagent\'s');
    const notice = line({ type: 'assistant', message: { role: 'assistant', model: '<synthetic>',
      content: [{ type: 'text', text: 'You\'ve reached your limit.' }],
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 } } });
    assert.equal(context([typed('one'), reply(350_400), notice], 2), '350k', 'not a notice written in the model\'s place');
    assert.equal(caption(s.run([typed('one')], { session_id: 'case-3' })), `💬[1](${PAGES}session.html#id=case-3) · 5m`,
      'no response yet: the part is left off');
  } finally { s.done(); }
});

test('files are summed over the checkouts under the root, and a zero sum is left off', () => {
  const s = scratch();
  try {
    const entries = [typed('one'), reply(50_000)];
    const files = (payload, env) => caption(s.run(entries, payload, env)).split(' · ')[3];
    mkdirSync(path.join(s.root, 'notes'));
    checkout(s.root, 'quiet');
    assert.equal(files(), undefined, 'nothing changed: no part and no separator');
    const app = checkout(s.root, 'app', { changed: 1 });
    assert.equal(files(), '1 file');
    checkout(s.root, 'lib', { changed: 2 });
    assert.equal(files(), '3 files');
    assert.equal(files({ cwd: app.repo }, { CLAUDE_PROJECT_DIR: app.repo }), '1 file', 'a session rooted in one checkout');
    assert.equal(files({ cwd: path.join(app.repo, 'src') }, { CLAUDE_PROJECT_DIR: '' }), '1 file',
      'with no project root named, the working directory\'s checkout');
  } finally { s.done(); }
});

test('with the archive checked out the count links the session page, wherever the store sits', () => {
  const s = scratch({ archive: false });
  try {
    const entries = [typed('one'), reply(50_000)];
    const app = checkout(s.root, 'app', { changed: 1 });
    assert.match(caption(s.run(entries)), /^🌿/, 'no archive yet');
    // Two folders down from the scratch folder, where the search does not look.
    const far = path.join(s.dir, 'far', 'away');
    assert.match(caption(s.run(entries, {}, { SESSIONS_STORE: path.join(far, 'sessions') })), /^🌿/, 'a named store that is not there');
    store(far);
    assert.match(caption(s.run(entries)), /^🌿/, 'and not found unnamed');
    assert.equal(caption(s.run(entries, {}, { SESSIONS_STORE: path.join(far, 'sessions') })),
      `💬[1](${SESSION_PAGE}) · 5m · 50k · 1 file`, 'named by SESSIONS_STORE');
    store(path.join(s.root, 'private'));
    assert.match(caption(s.run(entries)), /^💬\[1\]\(/, 'a child of the root');
    assert.match(caption(s.run(entries, { cwd: app.repo }, { CLAUDE_PROJECT_DIR: app.repo })), /^💬\[1\]\(/, 'a sibling of the root');
    writeFileSync(path.join(s.root, 'private', 'sessions', 'tools', 'on-stop.sh.off'), '');
    rmSync(path.join(s.root, 'private', 'sessions', 'tools', 'on-stop.sh'));
    assert.match(caption(s.run(entries)), /^🌿/, 'a declared store without its runner is not the archive');
  } finally { s.done(); }
});

test('without the archive the count links the branch page of the current checkout', () => {
  const s = scratch({ archive: false });
  try {
    const entries = [typed('one'), reply(50_000)];
    assert.equal(caption(s.run(entries)), '💬1 · 5m · 50k', 'no checkout either: the count stands alone');
    const app = checkout(s.root, 'app', { changed: 1 });
    const lib = checkout(s.root, 'lib', { changed: 2, branch: 'claude/busy-bell' });
    assert.equal(caption(s.run(entries)),
      `🌿[1](${PAGES}branch.html#gh=acme/lib@claude/busy-bell) · 5m · 50k · 3 files`,
      'from above the checkouts, the one with the most files changed');
    assert.equal(caption(s.run(entries, { cwd: path.join(app.repo, 'src') })),
      `🌿[1](${PAGES}branch.html#gh=acme/app@claude/work) · 5m · 50k · 3 files`, 'the one the working directory is in');
    lib.git('checkout', '-q', '--detach');
    assert.match(caption(s.run(entries)), /^🌿\[1\]\(\S+branch\.html#gh=acme\/lib\) /, 'a detached HEAD names no branch');
  } finally { s.done(); }
});

test('after a Bash call it speaks only when the file count moved, and asks git only when something did', () => {
  const s = scratch();
  try {
    const app = checkout(s.root, 'app', { changed: 1 });
    const bash = (more = {}) => s.run(null, { hook_event_name: 'PostToolUse', tool_name: 'Bash', prompt: undefined, ...more });
    assert.equal(caption(s.run([typed('one'), reply(50_000)], { prompt: 'two' })), `💬[2](${SESSION_PAGE}) · 5m · 50k · 1 file`);
    appendFileSync(s.transcript, typed('two') + '\n' + reply(60_000) + '\n');
    assert.equal(bash(), '', 'nothing moved');

    // Nothing moved, so git is not asked: with the objects gone it would
    // answer differently, and the hook would speak.
    renameSync(path.join(app.repo, '.git', 'objects'), path.join(app.repo, '.git', 'objects.away'));
    assert.equal(bash(), '', 'the stat mark alone decides');
    renameSync(path.join(app.repo, '.git', 'objects.away'), path.join(app.repo, '.git', 'objects'));

    writeFileSync(path.join(app.repo, 'first-0.txt'), 'edited\n');
    app.git('commit', '-q', '-am', 'the same file again');
    assert.equal(bash(), '', 'a commit that leaves the count where it was');

    app.commit('second', 2);
    assert.equal(bash({ agent_id: 'a1' }), '', 'a subagent\'s Bash call is passed over');
    assert.equal(caption(bash(), 'PostToolUse'), `💬[2](${SESSION_PAGE}) · 5m · 60k · 3 files`, 'a commit moved the count');
    assert.equal(bash(), '', 'said once');

    app.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    assert.equal(caption(bash(), 'PostToolUse'), `💬[2](${SESSION_PAGE}) · 5m · 60k`, 'main caught up: the part goes');
    app.git('checkout', '-q', '-b', 'claude/next');
    assert.equal(bash(), '', 'a new branch on the same commit');
  } finally { s.done(); }
});

test('a Bash call with no caption printed yet prints one', () => {
  const s = scratch();
  try {
    checkout(s.root, 'app', { changed: 1 });
    writeFileSync(s.transcript, [typed('one'), reply(50_000)].join('\n') + '\n');
    const bash = () => s.run(null, { hook_event_name: 'PostToolUse', tool_name: 'Bash', prompt: undefined });
    assert.equal(caption(bash(), 'PostToolUse'), `💬[1](${SESSION_PAGE}) · 5m · 50k · 1 file`);
    assert.equal(bash(), '');
  } finally { s.done(); }
});

test('the owner count is kept, and a run reads only what was appended since', () => {
  const s = scratch();
  try {
    const count = (out) => Number(/^💬\[(\d+)\]/.exec(caption(out))[1]);
    const first = typed('one', ago(2 * HOUR + 30 * MIN));
    assert.equal(count(s.run([first, reply(9000), typed('two'), reply(9000)])), 2);

    // The part already read is rewritten in place, same length, so that a
    // second pass over it would count one fewer and lose the first time.
    const kept = readFileSync(s.transcript, 'utf8');
    writeFileSync(s.transcript, kept.replace('"human"', '"robot"'));
    appendFileSync(s.transcript, typed('three') + '\n' + reply(9000) + '\n');
    const out = s.run(null);
    assert.equal(count(out), 3);
    assert.match(caption(out), / · 2h · /, 'the first message\'s time is kept too');

    // A line still being written is left for the run that finds it whole.
    const half = typed('four');
    appendFileSync(s.transcript, half.slice(0, 60));
    assert.equal(count(s.run(null)), 3);
    appendFileSync(s.transcript, half.slice(60) + '\n');
    assert.equal(count(s.run(null)), 4);
    assert.equal(count(s.run(null)), 4, 'and counted once');

    // A transcript shorter than what was read is a different file: start over.
    assert.equal(count(s.run([typed('alone')])), 1);
  } finally { s.done(); }
});

test('each session keeps its own state', () => {
  const s = scratch();
  try {
    const entries = [typed('one'), reply(9000)];
    assert.match(caption(s.run(entries, { session_id: 'sess-a' })), /session\.html#id=sess-a\)/);
    assert.match(caption(s.run(entries, { session_id: 'sess-b' })), /session\.html#id=sess-b\)/);
    assert.equal(JSON.parse(readFileSync(path.join(s.dir, 'session-detail-caption', 'sess-a'), 'utf8')).owner, 1);
  } finally { s.done(); }
});

test('anything it was not aimed at passes silently, and it never fails a turn', () => {
  const s = scratch();
  try {
    assert.equal(caption(s.run(['not json', typed('one'), reply(9000).slice(0, 80)])), `💬[1](${SESSION_PAGE}) · 5m`,
      'lines it cannot read are skipped');
    assert.equal(caption(s.run(null, { transcript_path: path.join(s.dir, 'missing.jsonl'), session_id: 'sess-x' })),
      `💬[0](${PAGES}session.html#id=sess-x)`, 'no transcript and nobody typing: the link alone');
    for (const input of ['not json', '{}', '[1]', JSON.stringify({ transcript_path: s.transcript }),
      JSON.stringify({ transcript_path: s.transcript, session_id: '../etc' })]) {
      assert.equal(execFileSync('python3', [HOOK], { input,
        env: { ...ENV, TMPDIR: s.dir, CLAUDE_PROJECT_DIR: s.root, SESSIONS_STORE: '' },
        encoding: 'utf8' }).trim(), '', `silent on ${input.slice(0, 40)}`);
    }
    writeFileSync(path.join(s.dir, 'session-detail-caption', SESSION), 'not json');
    assert.equal(caption(s.run(null)), `💬[1](${SESSION_PAGE}) · 5m`, 'a state file it cannot read is started again');
  } finally { s.done(); }
});

test('it is registered on both events, through the plugin root', () => {
  const entries = (event) => (HOOKS_JSON.hooks[event] || [])
    .filter(e => e.hooks.some(h => h.command.includes('session-detail-caption.py')));
  const [prompt, ...morePrompt] = entries('UserPromptSubmit');
  const [bash, ...moreBash] = entries('PostToolUse');
  assert.deepEqual([morePrompt, moreBash], [[], []], 'once on each');
  assert.equal(prompt.matcher, '');
  assert.equal(bash.matcher, 'Bash', 'after a Bash call and no other tool');
  for (const entry of [prompt, bash]) assert.match(entry.hooks[0].command, /^python3 "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\//);
});
