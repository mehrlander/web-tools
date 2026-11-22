// skills/hooks/session-detail-caption.py: the hook that prints the line a reply
// closes with. Driven as a subprocess over a scratch transcript in the
// harness's shapes and real git checkouts under a scratch project root, with
// TMPDIR pointed at the scratch folder so each test keeps its own state file.
// The hook's clock is fixed at NOW through SESSION_CAPTION_NOW and its zone
// set through OWNER_TZ, so times are written relative to NOW, half a minute
// clear of each boundary, and every line carries the same STAMP.
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
const MARK = '[`‹⋯›`](https://mehrlander.github.io/web-tools/app/?view=program&program=sessions)';
const SEP = ' \u00a0 ';  // between every two parts
const CLOSE = 'Close the reply with that line, unchanged, as its session detail caption.';
const WAKE = '<task-notification>\n<task-id>a1</task-id>';  // a prompt that is not the owner's, of no kind it names
const MIN = 60_000, HOUR = 60 * MIN;
const NOW = Date.parse('2026-11-14T18:14:00Z');
const STAMP = '11/14 10:14am';  // NOW in America/Los_Angeles
const ago = (ms) => new Date(NOW - ms).toISOString();
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
  // A run passes no prompt unless it gives one, so that it neither counts an
  // owner's message nor names what started a turn.
  const run = (entries, payload = {}, env = {}) => {
    if (entries) writeFileSync(transcript, entries.join('\n') + '\n');
    return execFileSync('python3', [HOOK], {
      input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', transcript_path: transcript,
        session_id: SESSION, cwd: root, ...payload }),
      env: { ...ENV, TMPDIR: dir, CLAUDE_PROJECT_DIR: root, SESSIONS_STORE: '',
        SESSION_CAPTION_NOW: String(NOW / 1000), OWNER_TZ: 'America/Los_Angeles', ...env },
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

// The caption line, with the event and the instruction under it checked, the
// stamp that opens every line and the program link that closes it checked and
// cut off, and the parts between them joined by SEP, returned joined by single
// spaces.
const caption = (out, event = 'UserPromptSubmit') => {
  const d = JSON.parse(out).hookSpecificOutput;
  assert.equal(d.hookEventName, event);
  const [first, second, ...rest] = d.additionalContext.split('\n');
  assert.equal(second, CLOSE);
  assert.deepEqual(rest, []);
  const parts = first.split(SEP);
  assert.equal(parts[0], `\`${STAMP}\``, `the line opens with the stamp: ${first}`);
  assert.equal(parts.at(-1), MARK, `the line closes with the program link: ${first}`);
  const between = parts.slice(1, -1);
  for (const part of between) assert.equal(part, part.trim(), `parts are joined by SEP alone: ${first}`);
  return between.join(' ');
};

test('the line: the count as the session link, then the context, the clock, the age and the waiting docs', () => {
  const s = scratch();
  try {
    checkout(s.root, 'app', { changed: 1 });
    const out = s.run([typed('It is a new day.', ago(26 * HOUR + 30 * MIN)), reply(120_000),
      typed('Ok go ahead.'), reply(815_600)], { prompt: 'What next?' });
    assert.equal(caption(out), `💬[3](${SESSION_PAGE}) \`816k\` \`1d 2h\``, 'changed files that are not docs show nothing');
    doc(checkout(s.root, 'docs-app'), 'docs/guide.md');
    assert.equal(caption(s.run(null, { prompt: 'And now?' })),
      `💬[3](${SESSION_PAGE}) \`816k\` \`1d 2h\` [✍️1](${SESSION_PAGE})`);
  } finally { s.done(); }
});

// A committed change to each of `paths` on the checkout's branch.
function doc(co, ...paths) {
  for (const p of paths) {
    mkdirSync(path.join(co.repo, path.dirname(p)), { recursive: true });
    writeFileSync(path.join(co.repo, p), '# ' + p + '\n');
  }
  co.git('add', '.');
  co.git('commit', '-q', '-m', 'docs');
}

// A user call in the scratch archive, as user-call.py writes one.
function call(root, slug, { kind = 'documentation', file, status = 'open', created, session = 'f701fa79' } = {}) {
  const dir = path.join(root, 'archive', 'user-calls');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${session}-${slug}.json`), JSON.stringify({
    schema: 'user-call/1', id: `${session}-${slug}`, kind, status, session, slug, file,
    created: created || '2026-11-14T10:00:00+00:00' }));
}

test('✍️ counts the changed documents still waiting on the owner\'s sign-off, linked to the call deck', () => {
  const s = scratch();
  try {
    const entries = [typed('one'), reply(50_000)];
    const waiting = (i) => caption(s.run(entries, { prompt: 'p' + i })).match(/\[✍️\d+\]\([^)]*\)/)?.[0];
    const app = checkout(s.root, 'app', { changed: 1 });
    doc(app, 'chron/2026/11/entry.md', 'notes/dump/raw.md');
    assert.equal(waiting(0), undefined, 'no docs: changed files that are not documentation show nothing');

    doc(app, 'docs/guide.md');
    assert.equal(waiting(1), `[✍️1](${SESSION_PAGE})`, 'a doc with no call waits, linked to the session page');

    call(s.root, 'guide-words', { file: 'acme/app@claude/work:docs/guide.md' });
    assert.equal(waiting(2), `[✍️1](${SESSION_PAGE}&user-call=guide-words)`, 'an open call: it waits, linked to the call');

    call(s.root, 'guide-words', { file: 'acme/app@claude/work:docs/guide.md', status: 'closed' });
    assert.equal(waiting(3), undefined, 'a closed call signs it off');

    doc(app, 'README.md', 'docs/other.md', 'skills/x/SKILL.md');
    call(s.root, 'other-old', { file: 'acme/app:docs/other.md', status: 'closed', created: '2026-11-14T09:00:00+00:00' });
    call(s.root, 'other-new', { file: 'acme/app@abc:docs/other.md', created: '2026-11-14T11:00:00+00:00' });
    call(s.root, 'readme-reopened', { file: 'acme/app:README.md', created: '2026-11-14T11:30:00+00:00' });
    call(s.root, 'readme-done', { file: 'acme/app:README.md', status: 'closed', created: '2026-11-14T12:00:00+00:00' });
    call(s.root, 'skill-elsewhere', { file: 'acme/lib:skills/x/SKILL.md', status: 'closed' });
    call(s.root, 'skill-other-session', { file: 'acme/app:skills/x/SKILL.md', status: 'closed', session: 'a0000001' });
    call(s.root, 'merge-1', { kind: 'merge', status: 'open', created: '2026-11-14T01:00:00+00:00' });
    assert.equal(waiting(4), `[✍️2](${SESSION_PAGE}&user-call=other-new)`,
      'mixed: the latest call for a path decides, another repo\'s or session\'s does not cover it, and the link is the first open documentation call');
  } finally { s.done(); }
});

test('✍️ counts an open call on a path the test does not take for documentation, and a copy once', () => {
  const s = scratch();
  try {
    const entries = [typed('one'), reply(50_000)];
    const waiting = (i) => caption(s.run(entries, { prompt: 'q' + i })).match(/\[✍️\d+\]\([^)]*\)/)?.[0];
    const app = checkout(s.root, 'app', { changed: 1 });
    doc(app, 'notes/dump/raw.md');
    call(s.root, 'raw-words', { file: 'acme/other@claude/work:notes/dump/raw.md' });
    assert.equal(waiting(0), `[✍️1](${SESSION_PAGE}&user-call=raw-words)`, 'an open call waits, whatever its path');

    call(s.root, 'raw-words', { file: 'acme/other@claude/work:notes/dump/raw.md', status: 'closed' });
    for (const p of ['docs/guide.md', 'skills/default/guide.md']) {
      mkdirSync(path.join(app.repo, path.dirname(p)), { recursive: true });
      writeFileSync(path.join(app.repo, p), '# the same text\n');
    }
    app.git('add', '.');
    app.git('commit', '-q', '-m', 'a doc and its copy');
    assert.equal(waiting(1), `[✍️1](${SESSION_PAGE})`, 'a doc and a copy of it with the same text wait as one');

    call(s.root, 'guide-words', { file: 'acme/app@claude/work:docs/guide.md', status: 'closed' });
    assert.equal(waiting(2), undefined, 'signing off the source signs off its copy');
  } finally { s.done(); }
});

test('without the archive there is no ✍️', () => {
  const s = scratch({ archive: false });
  try {
    doc(checkout(s.root, 'app'), 'docs/guide.md');
    assert.match(caption(s.run([typed('one'), reply(50_000)])), / `5m`$/);
  } finally { s.done(); }
});

test('the time since the first owner message: minutes, then hours, then days and hours', () => {
  const s = scratch();
  try {
    const cases = [[30_000, '`0m`'], [45 * MIN + 30_000, '`45m`'], [59 * MIN + 30_000, '`59m`'],
      [60 * MIN + 30_000, '`1h`'], [7 * HOUR + 30 * MIN, '`7h`'], [23 * HOUR + 59 * MIN + 30_000, '`23h`'],
      [24 * HOUR + 30_000, '`1d 0h`'], [26 * HOUR + 30 * MIN, '`1d 2h`'], [74 * HOUR + 30 * MIN, '`3d 2h`']];
    cases.forEach(([ms, want], i) => {
      const got = caption(s.run([typed('first', ago(ms)), reply(50_000), typed('later', ago(10_000))],
        { session_id: 'case-' + i }));
      assert.equal(got, `💬[2](${PAGES}session.html#id=case-${i}) \`50k\` ${want}`, `${ms} ms ago`);
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
    assert.equal(caption(out), `💬[3](${SESSION_PAGE}) \`41k\` \`5m\``);
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

// A queued remote notification's envelope, with the summary that names its origins.
const queued = (summary) => '<task-notification>\n<task-type>queued-remote-notifications</task-type>\n<status>pending</status>\n' +
  `<summary>${summary}</summary>\nNotifications are queued for this session (more may arrive before you read them). ` +
  'Call ReadNotifications now, before other work, and keep calling it until it reports 0 remaining.\n</task-notification>';
const SCHEDULED = 'scheduled trigger (the stored prompt of a routine or task on this account)';
const GITHUB = 'GitHub activity on a subscribed PR';

test('a turn the owner did not start names what started it, after the count', () => {
  const s = scratch();
  try {
    const entries = [typed('one'), reply(50_000)];
    const kinds = [
      [queued(`1 unread notification (${SCHEDULED}: 1)`), 'scheduled task'],
      [queued(`1 unread notification (${GITHUB}: 1)`), 'PR event'],
      [queued(`4 unread notifications (${GITHUB}: 4)`), 'PR event'],
      [queued(`2 unread notifications (${SCHEDULED}: 1, ${GITHUB}: 1)`), 'scheduled task, PR event'],
      [queued(`3 unread notifications (${GITHUB}: 2, ${SCHEDULED}: 1)`), 'PR event, scheduled task'],
      [queued('1 unread notification (message from another Claude session: 1)'), 'agent message'],
      ['<agent-message from="a1">\n[Subagent hand-back] The report follows:\n  Done.', 'agent message'],
      ['Another Claude session sent a message:\n<agent-message from="a1">\nreport', 'agent message'],
      ['<task-notification>\n<task-id>a1</task-id>\n<status>completed</status>\n<summary>Agent "Fix the GitHub activity feed" finished</summary>\n</task-notification>',
        'agent message'],
      ['<task-notification>\n<task-id>b1</task-id>\n<summary>Background command "npm test" completed (exit code 0)</summary>\n</task-notification>', 'wake'],
      [queued('1 unread notification (something new: 1)'), 'wake'],
      [WAKE, 'wake'],
      ['[SYSTEM] wake', 'wake'],
      ['<system-reminder>x</system-reminder>', 'wake'],
    ];
    kinds.forEach(([prompt, kind], i) => assert.equal(caption(s.run(entries, { prompt, session_id: 'kind-' + i })),
      `💬[1](${PAGES}session.html#id=kind-${i}) ${kind} \`50k\` \`5m\``, prompt.slice(0, 60)));

    assert.equal(caption(s.run(entries, { prompt: 'What next?', session_id: 'owner' })),
      `💬[2](${PAGES}session.html#id=owner) \`50k\` \`5m\``, 'an owner\'s prompt keeps the line as it was');
    assert.equal(caption(s.run(entries, { session_id: 'none' })), `💬[1](${PAGES}session.html#id=none) \`50k\` \`5m\``,
      'no prompt in the payload names no kind');
    const bash = s.run(entries, { hook_event_name: 'PostToolUse', tool_name: 'Bash', session_id: 'bash',
      prompt: queued(`1 unread notification (${GITHUB}: 1)`) });
    assert.equal(caption(bash, 'PostToolUse'), `💬[1](${PAGES}session.html#id=bash) \`50k\` \`5m\``, 'nor does a Bash call');
  } finally { s.done(); }
});

test('a first prompt, before any transcript, is message one at zero minutes', () => {
  const s = scratch();
  try {
    assert.equal(caption(s.run(null, { prompt: 'Hello' })), `💬[1](${SESSION_PAGE}) \`0m\``);
  } finally { s.done(); }
});

test('the context is the last main-conversation response that used any, rounded to the thousand', () => {
  const s = scratch();
  try {
    const context = (entries, i) => caption(s.run(entries, { session_id: 'case-' + i })).match(/`\d+k`/)?.[0];
    assert.equal(context([typed('one'), reply(350_400)], 0), '`350k`');
    assert.equal(context([typed('one'), reply(350_600), reply(900_000, { isSidechain: true })], 1), '`351k`', 'not a subagent\'s');
    const notice = line({ type: 'assistant', message: { role: 'assistant', model: '<synthetic>',
      content: [{ type: 'text', text: 'You\'ve reached your limit.' }],
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 } } });
    assert.equal(context([typed('one'), reply(350_400), notice], 2), '`350k`', 'not a notice written in the model\'s place');
    assert.equal(caption(s.run([typed('one')], { session_id: 'case-3' })), `💬[1](${PAGES}session.html#id=case-3) \`5m\``,
      'no response yet: the part is left off');
  } finally { s.done(); }
});

test('waiting docs are summed over the checkouts under the root, and a zero sum is left off', () => {
  const s = scratch();
  try {
    const entries = [typed('one'), reply(50_000)];
    const waiting = (payload, env) => caption(s.run(entries, payload, env)).match(/\[✍️\d+\]\([^)]*\)/)?.[0];
    mkdirSync(path.join(s.root, 'notes'));
    checkout(s.root, 'quiet');
    assert.equal(waiting(), undefined, 'nothing changed: no part and no separator');
    const app = checkout(s.root, 'app');
    doc(app, 'docs/a.md');
    assert.equal(waiting(), `[✍️1](${SESSION_PAGE})`);
    doc(checkout(s.root, 'lib'), 'docs/a.md', 'docs/b.md');
    assert.equal(waiting(), `[✍️3](${SESSION_PAGE})`);
    assert.equal(waiting({ cwd: app.repo }, { CLAUDE_PROJECT_DIR: app.repo }), `[✍️1](${SESSION_PAGE})`,
      'a session rooted in one checkout, the archive its sibling');
    store(path.join(app.repo, 'src', 'private'));
    assert.equal(waiting({ cwd: path.join(app.repo, 'src') }, { CLAUDE_PROJECT_DIR: '' }), `[✍️1](${SESSION_PAGE})`,
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
      `💬[1](${SESSION_PAGE}) \`50k\` \`5m\``, 'named by SESSIONS_STORE');
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
    assert.equal(caption(s.run(entries)), `💬1 \`50k\` \`5m\``, 'no checkout either: the count stands alone');
    const app = checkout(s.root, 'app', { changed: 1 });
    const lib = checkout(s.root, 'lib', { changed: 2, branch: 'claude/busy-bell' });
    assert.equal(caption(s.run(entries)),
      `🌿[1](${PAGES}branch.html#gh=acme/lib@claude/busy-bell) \`50k\` \`5m\``,
      'from above the checkouts, the one with the most files changed');
    assert.equal(caption(s.run(entries, { cwd: path.join(app.repo, 'src') })),
      `🌿[1](${PAGES}branch.html#gh=acme/app@claude/work) \`50k\` \`5m\``, 'the one the working directory is in');
    lib.git('checkout', '-q', '--detach');
    assert.match(caption(s.run(entries)), /^🌿\[1\]\(\S+branch\.html#gh=acme\/lib\) /, 'a detached HEAD names no branch');
  } finally { s.done(); }
});

test('after a Bash call it speaks only when the ✍️ count moved, and asks git only when something did', () => {
  const s = scratch();
  try {
    const app = checkout(s.root, 'app');
    doc(app, 'docs/a.md');
    const bash = (more = {}) => s.run(null, { hook_event_name: 'PostToolUse', tool_name: 'Bash', prompt: undefined, ...more });
    assert.equal(caption(s.run([typed('one'), reply(50_000)], { prompt: 'two' })),
      `💬[2](${SESSION_PAGE}) \`50k\` \`5m\` [✍️1](${SESSION_PAGE})`);
    appendFileSync(s.transcript, typed('two') + '\n' + reply(60_000) + '\n');
    assert.equal(bash(), '', 'nothing moved');

    // Nothing moved, so git is not asked: with the objects gone it would
    // answer differently, and the hook would speak.
    renameSync(path.join(app.repo, '.git', 'objects'), path.join(app.repo, '.git', 'objects.away'));
    assert.equal(bash(), '', 'the stat mark alone decides');
    renameSync(path.join(app.repo, '.git', 'objects.away'), path.join(app.repo, '.git', 'objects'));

    app.commit('code', 2);
    assert.equal(bash(), '', 'a commit of files that are not documentation leaves the count where it was');

    doc(app, 'docs/b.md');
    assert.equal(bash({ agent_id: 'a1' }), '', 'a subagent\'s Bash call is passed over');
    assert.equal(caption(bash(), 'PostToolUse'),
      `💬[2](${SESSION_PAGE}) \`60k\` \`5m\` [✍️2](${SESSION_PAGE})`, 'a commit of a doc moved the count');
    assert.equal(bash(), '', 'said once');

    app.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    assert.equal(caption(bash(), 'PostToolUse'), `💬[2](${SESSION_PAGE}) \`60k\` \`5m\``, 'main caught up: the part goes');
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
    assert.equal(caption(bash(), 'PostToolUse'), `💬[1](${SESSION_PAGE}) \`50k\` \`5m\``);
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
    assert.match(caption(out), / `2h`$/, 'the first message\'s time is kept too');

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
    assert.equal(caption(s.run(['not json', typed('one'), reply(9000).slice(0, 80)])), `💬[1](${SESSION_PAGE}) \`5m\``,
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
    assert.equal(caption(s.run(null)), `💬[1](${SESSION_PAGE}) \`5m\``, 'a state file it cannot read is started again');
  } finally { s.done(); }
});

test('the clock: the owner\'s month/day and 12-hour time, or UTC with a Z', () => {
  const s = scratch();
  try {
    const at = (iso, i, zone = 'America/Los_Angeles') => /^`([^`]+)` /.exec(JSON.parse(s.run([typed('one', ago(5 * MIN))],
      { session_id: 'clock-' + i }, { SESSION_CAPTION_NOW: String(Date.parse(iso) / 1000), OWNER_TZ: zone }))
      .hookSpecificOutput.additionalContext)[1];
    const cases = [['2026-11-14T18:14:00Z', '11/14 10:14am'], ['2026-11-14T23:07:00Z', '11/14 3:07pm'],
      ['2026-11-14T20:05:00Z', '11/14 12:05pm', 'noon'], ['2026-11-15T08:05:00Z', '11/15 12:05am', 'midnight'],
      ['2026-07-04T16:30:00Z', '7/4 9:30am', 'one-digit month and day, in daylight time'],
      ['2026-12-01T07:59:00Z', '11/30 11:59pm', 'the day before in the owner\'s zone']];
    cases.forEach(([iso, want, why], i) => assert.equal(at(iso, i), want, why || iso));
    assert.equal(at('2026-11-14T18:14:00Z', 'utc', 'Nowhere/Atlantis'), '11/14 18:14Z', 'a zone that will not load');
    assert.equal(at('2026-11-14T08:04:00Z', 'utc2', 'Nowhere/Atlantis'), '11/14 8:04Z');
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
