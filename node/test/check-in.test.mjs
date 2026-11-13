// skills/hooks/check-in.py: the check-in a session schedules for itself shortly
// before its prompt cache lapses. No session has run this path live: the last
// scheduled message any archived session read was on 2026-10-13. So this file
// stands in for a live run, over the shapes the session archive recorded: the
// wake's envelope, the ReadNotifications result with the message under its
// `--- Notification` header, and send_later's result.
//
// The two rules, arming and the decision on a check-in that was read, are
// called as functions first, a case for each branch. The rest drives the hook
// as a subprocess over a scratch transcript, with TMPDIR pointed at the scratch
// folder so each test keeps its own state file. The hook reads the real clock,
// so times are written relative to it, half a minute clear of each boundary,
// and `later` moves a state file back in time to stand for minutes passing.
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, appendFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const HOOK = path.join(repoRoot, 'skills/hooks/check-in.py');
const GUARD = path.join(repoRoot, 'skills/hooks/send-later-guard.sh');
const QUIET_HINT = path.join(repoRoot, 'skills/hooks/wake-quiet-hint.sh');
const HOOKS_JSON = JSON.parse(
  readFileSync(path.join(repoRoot, 'skills/hooks/hooks.json'), 'utf8'));
const SESSION = 'f701fa79-e1c0-5997-b6c3-709182f8e137';
// The three spellings of the tool the session archive carries.
const SEND_LATER = [
  'mcp__claude-code-remote__send_later',
  'mcp__Claude_Code_Remote__send_later',
  'mcp__bf7c680d-5fdc-5ef4-b4a0-abadb619bf0a__send_later',
];
const MIN = 60_000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();

// ── The texts, as the specification gives them ─────────────────────────────
const MSG = (id) => `⏱ check-in ${id}. The check-in hook says what to do with this when it is read; if no such instruction follows, end the turn with no text.`;
const ARM = (id) => `No check-in is pending for this session. Before this reply ends, call the send_later tool with delay_minutes 55 and exactly this message: «${MSG(id)}». Do it once; the check-in hook tracks it from here. If the session has no send_later tool, ignore this.`;
const DUPLICATE = 'This check-in is a duplicate of one armed later. End the turn with no text.';
const EARLY = (n, d, id) => `This check-in is early: the session's last response was ${n} minutes ago. Call send_later with delay_minutes ${d} and exactly this message: «${MSG(id)}». Then end the turn with no text.`;
const FIRST = (n, id) => [
  `Check-in, first of two. The session has been idle for ${n} minutes and its prompt cache lapses at 60. This turn is automatic: the owner has not written. Spend at most four model calls on it.`,
  '1. If the session\'s work is closed (its last reply closed on ⚫, ⚪, 🟣 or 🔴), close the session out now: unsubscribe from every pull request this session is subscribed to, arm nothing, and reply with one line saying so.',
  '2. Otherwise write a recap for a reader coming back cold: what the session is for, what waits on the owner as one question per decision, and where to pick up.',
  '3. Do work that needs no directional commitment, meaning no choice that is the owner\'s to make. Hand anything longer than two calls to a subagent. If there is no such work, say so in one line.',
  `4. Arm the second check-in: call send_later with delay_minutes 55 and exactly this message: «${MSG(id)}».`,
  'Close with the caption and one closing state, and say that this is the first of two check-ins.',
].join('\n');
const SECOND = 'Check-in, second of two. The owner has not written since the first. Close the session out in at most three model calls: write a pick-up point wherever one is missing (an open pull request\'s guide, or the recap in the last reply), unsubscribe from every pull request this session is subscribed to, and arm nothing further. Reply with one line: that the session is closed out, and where its pick-up point is.';
// The prompts that are not the owner's, as session-detail-caption.py tells them.
const WAKES = ['<task-notification>\n<task-type>queued-remote-notifications</task-type>',
  '<agent-message from="a1">\nreport', '[SYSTEM] wake', '<system-reminder>x</system-reminder>',
  'Another Claude session sent a message'];

// The message an instruction quotes, and the id a message carries.
const quoted = (text) => /«(.*?)»/s.exec(text)[1];
const idOf = (text) => /⏱ check-in ([\w:-]+)\./.exec(text)[1];

// ── The two rules, called as functions: one Python process answers the list ─
function rules(calls) {
  return JSON.parse(execFileSync('python3', ['-c', `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("check_in", sys.argv[1])
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)
print(json.dumps([getattr(hook, name)(*args) for name, args in json.loads(sys.argv[2])]))
`, HOOK, JSON.stringify(calls)], { encoding: 'utf8' }));
}

test('the arming rule: an owner\'s prompt, nothing pending, and a context at or over the floor', () => {
  const arming = (prompt, pending, context) => ['arming', [prompt, pending, context, 'ID']];
  const [at, over, under, none, zero, pending, image, ...wakes] = rules([
    arming('What next?', false, 150_000), arming('What next?', false, 815_600),
    arming('What next?', false, 149_999), arming('What next?', false, null),
    arming('What next?', false, 0), arming('What next?', true, 815_600),
    arming(null, false, 815_600), ...WAKES.map(wake => arming(wake, false, 815_600)),
  ]);
  assert.equal(at, ARM('ID'), 'at the floor');
  assert.equal(over, ARM('ID'));
  assert.equal(under, null, 'one token under the floor');
  assert.equal(none, null, 'before any response the context is unknown');
  assert.equal(zero, null);
  assert.equal(pending, null, 'one is pending');
  assert.equal(image, null, 'no prompt in the payload');
  wakes.forEach((said, i) => assert.equal(said, null, 'a wake: ' + WAKES[i].slice(0, 24)));
});

test('the decision on a check-in that was read: duplicate, early, first or second', () => {
  const A = '20261113T100000Z', B = '20261113T105500Z';
  const decide = (read, latest, minutes, ran) => ['decide', [read, latest, minutes, ran, 'NEW']];
  const cases = [
    [decide(A, B, 55, 0), ['duplicate', DUPLICATE], 'the state holds a later id'],
    [decide(A, B, 5, 1), ['duplicate', DUPLICATE], 'a duplicate whatever the idleness or the count'],
    [decide(A, A + '-1', 55, 0), ['duplicate', DUPLICATE], 'an id with a suffix is later than the id it extends'],
    [decide(B, B, 55, 0), ['first', FIRST(55, 'NEW')], 'the latest id itself'],
    [decide(B, A, 55, 0), ['first', FIRST(55, 'NEW')], 'an id later than any the state holds'],
    [decide(A, null, 55, 0), ['first', FIRST(55, 'NEW')], 'a state that holds no id, as in a new container'],
    [decide(A + '-1', A, 55, 0), ['first', FIRST(55, 'NEW')]],
    [decide(A, A, 0, 0), ['early', EARLY(0, 55, 'NEW')], 'the session answered this minute'],
    [decide(A, A, 20, 0), ['early', EARLY(20, 35, 'NEW')]],
    [decide(A, A, 49, 0), ['early', EARLY(49, 6, 'NEW')], 'the last early minute'],
    [decide(A, A, 20, 1), ['early', EARLY(20, 35, 'NEW')], 'early after the first has run, too'],
    [decide(A, A, -3, 0), ['early', EARLY(0, 55, 'NEW')], 'a transcript clock ahead of this one'],
    [decide(A, A, 50, 0), ['first', FIRST(50, 'NEW')], 'due from the fiftieth minute'],
    [decide(A, A, 75, 0), ['first', FIRST(75, 'NEW')], 'delivered late'],
    [decide(A, A, 55, 1), ['second', SECOND], 'the first has run since the owner last typed'],
    [decide(A, A, 55, 2), ['second', SECOND]],
  ];
  rules(cases.map(([call]) => call)).forEach((got, i) => {
    assert.deepEqual(got, cases[i][1], cases[i][2]);
    assert.doesNotMatch(got[1], /[{}]/, 'no placeholder is left unfilled');
  });
  const [[, one]] = rules([decide(A, A, 1, 0)]);
  assert.match(one, /last response was 1 minute ago\. Call send_later with delay_minutes 54 /, 'one minute is singular');
});

test('an id is the UTC time it was written, and always sorts after the id it follows', () => {
  const [epoch, same, again, next, message] = rules([
    ['new_id', [0]], ['new_id', [0, '19700101T000000Z']], ['new_id', [0, '19700101T000000Z-1']],
    ['new_id', [5, '19700101T000000Z-1']], ['message', ['19700101T000000Z']],
  ]);
  assert.equal(epoch, '19700101T000000Z');
  assert.equal(same, '19700101T000000Z-1', 'written in the same second as the id it follows');
  assert.equal(again, '19700101T000000Z-1-1');
  assert.equal(next, '19700101T000005Z');
  assert.ok(epoch < same && same < again && again < next, 'in the order they were written');
  assert.equal(message, MSG('19700101T000000Z'));
});

// ── Transcript entries, in the shapes the harness writes ───────────────────
const line = (entry) => JSON.stringify({ isSidechain: false, ...entry });
const usage = (tokens) => ({ input_tokens: 2, cache_creation_input_tokens: 1000, cache_read_input_tokens: tokens - 1002, output_tokens: 50 });
const typed = (text, at = ago(70 * MIN)) =>
  line({ type: 'user', origin: { kind: 'human' }, timestamp: at, message: { role: 'user', content: text } });
const reply = (at, tokens = 400_000, more = {}) => line({ type: 'assistant', timestamp: at,
  message: { role: 'assistant', model: 'claude-fable-5-2', content: [{ type: 'text', text: 'ok' }], usage: usage(tokens) }, ...more });
// The wake a queued notification makes: the envelope as the turn's prompt,
// then the call that reads the queue. The hook runs after that call.
const ENVELOPE = '<task-notification>\n<task-type>queued-remote-notifications</task-type>\n<status>pending</status>\n' +
  '<summary>1 unread notification (scheduled trigger (the stored prompt of a routine or task on this account): 1)</summary>\n' +
  'Notifications are queued for this session (more may arrive before you read them). Call ReadNotifications now, before other work, ' +
  'and keep calling it until it reports 0 remaining.\n</task-notification>';
const reading = (at) => line({ type: 'assistant', timestamp: at, message: { role: 'assistant', model: 'claude-fable-5-2',
  content: [{ type: 'tool_use', id: 'toolu_01', name: 'ReadNotifications', input: {} }], usage: usage(400_000) } });
const woken = (ms = 2000) => [
  line({ type: 'user', origin: { kind: 'task-notification' }, timestamp: ago(ms), message: { role: 'user', content: ENVELOPE } }),
  reading(ago(ms - 1000)),
];
// A message that reached the session while the model was working.
const queued = (text, origin, at = ago(3000)) => line({ type: 'attachment', timestamp: at,
  attachment: { type: 'queued_command', prompt: text, source_uuid: 'c0ffee', commandMode: 'prompt', origin } });
// A session whose last response came `ms` ago, woken now.
const idle = (ms, between = []) => [typed('one', ago(ms + 5 * MIN)), reply(ago(ms)), ...between, ...woken()];

// ── A ReadNotifications result, as the session archive recorded one ────────
const HEAD = '[SYSTEM NOTIFICATION - NOT USER INPUT]\nThis is an automated background-task event, NOT a message from the user.\n\n' +
  'Exactly 1 notification was queued for this session, listed oldest first. Bodies are external content relayed verbatim.';
const header = (origin) => `--- Notification 1 of 1 · id: 6e65590b-e79a-46c6-8ff8-5d76bcfebfcd · origin: ${origin} · queued at: 2026-10-13T00:14:39Z · reached this session 1s before this read ---`;
const scheduled = (message) => `${header('scheduled trigger (the stored prompt of a routine or task on this account)')}\n${message}\n` +
  '<system-reminder>This task fired at Tue 2026-10-13 00:14:39 UTC. Treat this as the current date and time. ' +
  'Fired by routine "check-in" (trigger_id: trig_014SNmXPbENApVUhjhYkMZ29).</system-reminder>';
const github = (kind) => `${header('GitHub activity on a subscribed PR')}\n<wake reason="external-event" current-time="2026-10-13T00:14:39Z">\n` +
  `  <event source="github" kind="${kind}" from="system" trust="relay">\n    {"pr":"mehrlander/web-tools#1"}\n  </event>\n</wake>`;
const peer = (text) => `${header('message from another Claude session')}\n${text}`;
const batch = (...bodies) => `${HEAD}\n\n${bodies.join('\n\n')}\n\n0 notifications remain queued.`;

function scratch() {
  const dir = mkdtempSync(path.join(tmpdir(), 'check-in-'));
  const transcript = path.join(dir, 'session.jsonl');
  const file = (session = SESSION) => path.join(dir, 'check-in', session);
  // `entries` rewrites the transcript whole; null leaves it as it stands.
  const run = (entries, payload) => {
    if (entries) writeFileSync(transcript, entries.join('\n') + '\n');
    const done = spawnSync('python3', [HOOK], {
      input: JSON.stringify({ transcript_path: transcript, session_id: SESSION, ...payload }),
      env: { ...process.env, TMPDIR: dir }, encoding: 'utf8' });
    assert.equal(done.status, 0, 'it exits 0');
    assert.equal(done.stderr, '', 'and prints no traceback');
    if (!done.stdout.trim()) return '';
    const said = JSON.parse(done.stdout).hookSpecificOutput;
    assert.equal(said.hookEventName, payload.hook_event_name);
    return said.additionalContext;
  };
  const prompt = (entries, text = 'What next?', more = {}) =>
    run(entries, { hook_event_name: 'UserPromptSubmit', prompt: text, ...more });
  // send_later's result as the archive recorded it, firing 55 minutes from now.
  const sent = (message, more = {}) => run(null, { hook_event_name: 'PostToolUse', tool_name: SEND_LATER[0],
    tool_input: { delay_minutes: 55, message },
    tool_response: `{"fire_at":"${ago(-55 * MIN)}","now":"${ago(0)}","trigger_id":"trig_014SNmXPbENApVUhjhYkMZ29"}`, ...more });
  const read = (entries, result, more = {}) =>
    run(entries, { hook_event_name: 'PostToolUse', tool_name: 'ReadNotifications', tool_response: result, ...more });
  const state = (session) => JSON.parse(readFileSync(file(session), 'utf8'));
  // The state as it would stand `ms` later: every time it holds, `ms` earlier.
  const later = (ms) => {
    const kept = state();
    if (typeof kept.due === 'number') kept.due -= ms / 1000;
    if (kept.quiet) { kept.quiet.until -= ms / 1000; kept.quiet.since -= ms / 1000; }
    writeFileSync(file(), JSON.stringify(kept));
  };
  // Ask at an owner's prompt and send what was asked for: the id now pending.
  const armed = () => {
    const message = quoted(prompt([typed('one'), reply(ago(MIN))]));
    assert.equal(sent(message), '');
    return idOf(message);
  };
  return { dir, transcript, file, run, prompt, sent, read, state, later, armed,
    done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('at an owner\'s prompt it asks for the message, and stops asking once the message is sent', () => {
  const s = scratch();
  try {
    const asked = s.prompt([typed('one'), reply(ago(MIN), 815_600)]);
    const message = quoted(asked), id = idOf(message);
    assert.equal(asked, ARM(id));
    assert.match(id, /^\d{8}T\d{6}Z$/);
    const written = Date.UTC(+id.slice(0, 4), +id.slice(4, 6) - 1, +id.slice(6, 8), +id.slice(9, 11), +id.slice(11, 13), +id.slice(13, 15));
    assert.ok(Math.abs(Date.now() - written) < 10_000, 'the id is the UTC time the hook wrote it');
    assert.deepEqual(s.state(), { latest: id, pending: false }, 'asked for, and not yet pending');

    // What the hook wrote is what the guard lets through and what the hook tracks.
    for (const tool_name of SEND_LATER) {
      assert.equal(execFileSync('bash', [GUARD], { input: JSON.stringify({ tool_name, tool_input: { delay_minutes: 55, message } }), encoding: 'utf8' }).trim(),
        '', 'the guard lets the message through as ' + tool_name);
    }
    assert.equal(s.sent(message), '');
    assert.equal(s.state().latest, id);
    assert.equal(s.state().pending, true);
    assert.equal(s.prompt(null, 'And then?'), '', 'one is pending');
    assert.equal(s.prompt(null, 'And after that?'), '');
  } finally { s.done(); }
});

test('it says nothing under the floor, on a wake, or to a subagent', () => {
  const s = scratch();
  try {
    const at = (entries, i, more) => s.prompt(entries, 'What next?', { session_id: 'case-' + i, ...more });
    assert.equal(at([typed('one'), reply(ago(MIN), 149_999)], 0), '', 'one token under the floor');
    assert.notEqual(at([typed('one'), reply(ago(MIN), 150_000)], 1), '', 'at the floor');
    assert.equal(at([typed('one')], 2), '', 'no response yet');
    assert.equal(at([typed('one'), reply(ago(2 * MIN), 149_000), reply(ago(MIN), 900_000, { isSidechain: true })], 3), '',
      'a subagent\'s context is not the session\'s');
    const notice = line({ type: 'assistant', message: { role: 'assistant', model: '<synthetic>',
      content: [{ type: 'text', text: 'You\'ve reached your limit.' }],
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 } } });
    assert.notEqual(at([typed('one'), reply(ago(MIN), 400_000), notice], 4), '', 'a notice written in the model\'s place is passed over');
    assert.equal(at(null, 5, { transcript_path: path.join(s.dir, 'missing.jsonl') }), '', 'no transcript');

    const big = [typed('one'), reply(ago(MIN), 815_600)];
    WAKES.forEach((wake, i) => assert.equal(s.prompt(big, wake, { session_id: 'wake-' + i }), '', 'a wake: ' + wake.slice(0, 24)));
    assert.equal(s.run(big, { hook_event_name: 'UserPromptSubmit', session_id: 'wake-none' }), '', 'no prompt in the payload');
    assert.equal(s.prompt(big, 'What next?', { session_id: 'agent', agent_id: 'a1' }), '', 'a subagent\'s prompt');
    assert.ok(!existsSync(s.file('wake-0')) && !existsSync(s.file('agent')), 'and a wake writes no state');
  } finally { s.done(); }
});

test('it asks again at each prompt until a message is sent, each time under a later id', () => {
  const s = scratch();
  try {
    const big = [typed('one'), reply(ago(MIN))];
    const first = idOf(s.prompt(big)), second = idOf(s.prompt(big)), third = idOf(s.prompt(big));
    assert.ok(first < second && second < third, `${first} < ${second} < ${third}`);
    assert.equal(s.state().latest, third);

    // Only a message that opens as the hook's does is tracked: the mark, an id
    // and its full stop, which is what a read looks for.
    assert.equal(s.sent('Re-check PR 12, then ⏱ check-in 99999999T999999Z. as before'), '');
    assert.equal(s.sent('⏱ check-in on PR 12: re-check CI and review threads'), '', 'the mark alone passes the guard and is not a check-in');
    assert.equal(s.sent('⏱ check-in 29991231T235959Z The check-in hook says'), '', 'the full stop dropped');
    assert.equal(s.sent(undefined), '');
    assert.equal(s.sent(MSG('29991231T235959Z'), { tool_response: { is_error: true, content: 'trigger limit reached' } }), '', 'a send that failed');
    assert.equal(s.sent(MSG('29991231T235959Z'), { agent_id: 'a1' }), '', 'a subagent\'s send');
    assert.deepEqual(s.state(), { latest: third, pending: false });
    const fourth = idOf(s.prompt(big));
    assert.ok(third < fourth, 'so it still asks');

    assert.equal(s.sent('⏱️ check-in ' + fourth + '. The check-in hook says'), '', 'the mark with a variation selector');
    assert.equal(s.state().pending, true);
    assert.equal(s.state().latest, fourth);
  } finally { s.done(); }
});

test('a check-in still unread ten minutes after its time counts as lost', () => {
  const s = scratch();
  try {
    const big = [typed('one'), reply(ago(MIN))];
    const fired = (ms) => `{"fire_at":"${ago(ms)}","now":"${ago(ms + 55 * MIN)}","trigger_id":"trig_01"}`;
    assert.equal(s.sent(MSG('20261113T100000Z'), { tool_response: fired(9 * MIN + 30_000) }), '');
    assert.equal(s.prompt(big), '', 'nine minutes past its time: still to come');
    assert.equal(s.sent(MSG('20261113T100001Z'), { tool_response: [{ type: 'text', text: fired(10 * MIN + 30_000) }] }), '');
    const asked = s.prompt(big);
    assert.notEqual(asked, '', 'ten minutes past: lost, so it asks again');
    assert.deepEqual(s.state(), { latest: idOf(asked), pending: false });

    // Without fire_at in the result, the time is now plus the delay asked for.
    assert.equal(s.sent(MSG(idOf(asked)), { tool_input: { delay_minutes: 35, message: MSG(idOf(asked)) }, tool_response: 'ok' }), '');
    assert.ok(Math.abs(s.state().due - (Date.now() / 1000 + 35 * 60)) < 10);
    assert.equal(s.sent(MSG(idOf(asked)), { tool_input: { at: '2026-11-14T09:00:00[America/Los_Angeles]', message: MSG(idOf(asked)) }, tool_response: null }), '');
    assert.ok(Math.abs(s.state().due - (Date.now() / 1000 + 55 * 60)) < 10, 'and 55 minutes where no delay was given');
  } finally { s.done(); }
});

test('read after 55 idle minutes a check-in is the first of two, and the one it arms is the second', () => {
  const s = scratch();
  try {
    const one = s.armed();
    const first = s.read(idle(55 * MIN + 30_000), batch(scheduled(MSG(one))));
    const two = idOf(first);
    assert.equal(first, FIRST(55, two));
    assert.ok(one < two, 'the second check-in carries a later id');
    assert.deepEqual(s.state(), { latest: two, pending: false, ran: 1, mark: readFileSync(s.transcript).length });

    assert.equal(s.sent(quoted(first)), '');
    assert.equal(s.state().pending, true);
    // 55 minutes on: the first check-in's reply is the session's last response.
    const second = s.read(idle(55 * MIN + 30_000), batch(scheduled(MSG(two))));
    assert.equal(second, SECOND);
    assert.equal(s.state().pending, false, 'afterwards nothing is pending');
    assert.equal(s.state().ran, 2);

    const asked = s.prompt([typed('one'), reply(ago(MIN))], 'I am back.');
    assert.equal(asked, ARM(idOf(asked)), 'so the owner\'s next prompt arms one');
    assert.equal(s.state().ran, 0);
  } finally { s.done(); }
});

test('an early check-in is sent again for the minutes that remain, and then comes due', () => {
  const s = scratch();
  try {
    const one = s.armed();
    // The owner kept the session busy until 20 minutes ago.
    const early = s.read(idle(20 * MIN + 30_000), batch(scheduled(MSG(one))));
    const two = idOf(early);
    assert.equal(early, EARLY(20, 35, two));
    assert.ok(one < two);
    assert.equal(s.state().pending, false);
    assert.equal(s.state().ran, undefined, 'an early check-in is not one that ran');
    assert.equal(s.sent(quoted(early)), '');

    // 35 minutes on. The turn that sent the message again made responses of its
    // own, 35 minutes ago; counted, they would make this check-in early too,
    // and every one after it.
    s.later(35 * MIN);
    const handling = [...woken(35 * MIN + 4000), reply(ago(35 * MIN - 5000)), reply(ago(35 * MIN - 9000))];
    const due = s.read(idle(55 * MIN + 30_000, handling), batch(scheduled(MSG(two))));
    assert.equal(due, FIRST(55, idOf(due)), 'idle since the response before the early check-in');
    assert.equal(s.state().quiet, undefined);
  } finally { s.done(); }
});

test('work in the turn of an early check-in, or a prompt after it, counts as a response', () => {
  const s = scratch();
  try {
    // The turn that sent the message again worked on for ten minutes, past the slack.
    let early = s.read(idle(20 * MIN + 30_000), batch(scheduled(MSG(s.armed()))));
    assert.equal(s.sent(quoted(early)), '');
    s.later(35 * MIN);
    const worked = [...woken(35 * MIN + 4000), reply(ago(35 * MIN - 5000)), reply(ago(25 * MIN + 30_000))];
    let again = s.read(idle(55 * MIN + 30_000, worked), batch(scheduled(MSG(idOf(early)))));
    assert.equal(again, EARLY(25, 30, idOf(again)));

    // The owner wrote two minutes after an early check-in and was answered at
    // once, inside the slack.
    rmSync(s.file());
    early = s.read(idle(20 * MIN + 30_000), batch(scheduled(MSG(s.armed()))));
    assert.equal(s.sent(quoted(early)), '');
    assert.ok(s.state().quiet, 'the time of the response before the early check-in is kept');
    assert.equal(s.prompt(null, 'One more thing.'), '', 'one is pending');
    assert.equal(s.state().quiet, undefined, 'and dropped when the owner types');
    s.later(35 * MIN);
    const answered = [...woken(35 * MIN + 4000), reply(ago(35 * MIN - 5000)),
      typed('One more thing.', ago(33 * MIN + 40_000)), reply(ago(33 * MIN + 30_000))];
    again = s.read(idle(55 * MIN + 30_000, answered), batch(scheduled(MSG(idOf(early)))));
    assert.equal(again, EARLY(33, 22, idOf(again)));
  } finally { s.done(); }
});

test('a check-in older than the latest id is a duplicate, and gives way to the later one', () => {
  const s = scratch();
  try {
    const big = [typed('one'), reply(ago(MIN))];
    const one = idOf(s.prompt(big)), two = idOf(s.prompt(big));
    assert.equal(s.sent(MSG(two)), '');
    assert.equal(s.read(idle(55 * MIN + 30_000), batch(scheduled(MSG(one)))), DUPLICATE);
    assert.equal(s.state().pending, true, 'the later one is still to come');
    assert.equal(s.state().latest, two);
    assert.equal(s.read(null, batch(scheduled(MSG(one))), { transcript_path: path.join(s.dir, 'missing.jsonl') }), DUPLICATE,
      'told from the state alone');

    // The duplicate's turn made a response; the later check-in is not early for it.
    s.later(10 * MIN);
    const handling = [...woken(10 * MIN + 4000), reply(ago(10 * MIN - 5000))];
    const first = s.read(idle(65 * MIN + 30_000, handling), batch(scheduled(MSG(two))));
    assert.equal(first, FIRST(65, idOf(first)));

    // In one batch, the newest id is the one judged.
    rmSync(s.file());
    const both = s.read(idle(55 * MIN + 30_000), batch(scheduled(MSG(one)), scheduled(MSG(two))));
    assert.equal(both, FIRST(55, idOf(both)));
    assert.ok(two < idOf(both));
  } finally { s.done(); }
});

test('a prompt from the owner starts the count again, typed between turns or mid-turn', () => {
  const s = scratch();
  try {
    // Between turns: UserPromptSubmit sets the count back.
    let first = s.read(idle(55 * MIN + 30_000), batch(scheduled(MSG(s.armed()))));
    assert.equal(s.sent(quoted(first)), '');
    assert.equal(s.prompt(null, 'Thanks, carry on.'), '', 'one is pending, so it does not ask');
    assert.equal(s.state().ran, 0);
    assert.equal(s.state().mark, undefined);
    let next = s.read(idle(55 * MIN + 30_000), batch(scheduled(MSG(idOf(first)))));
    assert.equal(next, FIRST(55, idOf(next)), 'the first of two again');

    // Mid-turn: no UserPromptSubmit fires, and the transcript holds the message.
    rmSync(s.file());
    first = s.read(idle(55 * MIN + 30_000), batch(scheduled(MSG(s.armed()))));
    assert.equal(s.sent(quoted(first)), '');
    appendFileSync(s.transcript, [queued('<task-notification>\n<task-id>a1</task-id>', { kind: 'task-notification' }),
      queued('Could we say less?', { kind: 'human' }), reply(ago(55 * MIN + 30_000)), ...woken()].join('\n') + '\n');
    next = s.read(null, batch(scheduled(MSG(idOf(first)))));
    assert.equal(next, FIRST(55, idOf(next)), 'the owner wrote mid-turn');

    // A message queued by anything but the owner leaves the count where it was.
    assert.equal(s.sent(quoted(next)), '');
    appendFileSync(s.transcript, [queued('<agent-message from="a1">\nreport', { kind: 'peer', from: 'a1' }),
      reply(ago(55 * MIN + 30_000)), ...woken()].join('\n') + '\n');
    assert.equal(s.read(null, batch(scheduled(MSG(idOf(next))))), SECOND);
  } finally { s.done(); }
});

test('the last response is the main conversation\'s, before the wake that brought the check-in', () => {
  const s = scratch();
  try {
    const one = '20261113T100000Z';
    const judged = (entries, i) => s.read(entries, batch(scheduled(MSG(one))), { session_id: 'case-' + i });
    const sidechain = reply(ago(MIN), 900_000, { isSidechain: true });
    assert.match(judged(idle(55 * MIN + 30_000, [sidechain]), 0), /^Check-in, first of two\. The session has been idle for 55 minutes/,
      'a subagent\'s response is not the session\'s');
    const notice = line({ type: 'assistant', timestamp: ago(MIN), message: { role: 'assistant', model: '<synthetic>',
      content: [{ type: 'text', text: 'You\'ve reached your limit.' }], usage: { input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 } } });
    assert.match(judged(idle(55 * MIN + 30_000, [notice]), 1), /^Check-in, first of two\./, 'nor is a notice written in the model\'s place');

    // Queued into a turn the model was working in: the session answered seconds ago.
    const working = [typed('one', ago(90 * MIN)), reply(ago(80 * MIN)), typed('two', ago(12 * MIN)), reply(ago(5000)),
      queued(ENVELOPE, { kind: 'task-notification' }), reading(ago(1000))];
    assert.match(judged(working, 2), /^This check-in is early: the session's last response was 0 minutes ago\. Call send_later with delay_minutes 55 /);
    // The call that read the queue is not the response before the wake, even
    // when a text block came with it.
    assert.match(judged([...idle(55 * MIN + 30_000), reply(ago(500))], 3), /^Check-in, first of two\./);

    assert.equal(judged([...woken()], 4), '', 'no response before the wake: it says nothing');
    assert.equal(judged(['not json', reply(ago(55 * MIN + 30_000)).slice(0, 90), ...woken()], 5), '', 'nor over lines it cannot read');
    assert.equal(s.read(null, batch(scheduled(MSG(one))), { session_id: 'case-6', transcript_path: path.join(s.dir, 'missing.jsonl') }), '',
      'nor without a transcript');
    assert.ok(!existsSync(s.file('case-4')), 'and it writes no state then');
  } finally { s.done(); }
});

test('the message is read in either shape of the result, and only at the start of its line', () => {
  const s = scratch();
  try {
    const one = '20261113T100000Z';
    const judged = (result, i) => s.read(idle(55 * MIN + 30_000), result, { session_id: 'case-' + i });
    const body = MSG(one) + '\n<system-reminder>This task fired at Tue 2026-10-13 00:14:39 UTC.</system-reminder>';
    assert.match(judged({ notifications: [{ notification_id: '6e65', origin: 'scheduled_trigger', queued_at: '2026-10-13T00:14:39Z', content: body }],
      remaining: 0, read_at: '2026-10-13T00:14:41Z' }, 0), /^Check-in, first of two\./, 'the result as an object');
    assert.match(judged([{ type: 'text', text: batch(scheduled(MSG(one))) }], 1), /^Check-in, first of two\./, 'as content blocks');
    assert.match(judged({ content: batch(scheduled(MSG(one))), structuredContent: { notifications: [{ content: body }] } }, 2),
      /^Check-in, first of two\./, 'in both at once');
    assert.match(judged(batch(scheduled('⏱️ check-in ' + one + '. The check-in hook says what to do')), 3), /^Check-in, first of two\./,
      'with a variation selector on the mark');

    assert.equal(judged(batch(peer('The hook wrote «' + MSG(one) + '» for me to send.')), 4), '', 'quoted inside another message');
    assert.equal(judged(batch(peer('Re: ⏱ check-in ' + one + '. Is that yours?')), 5), '');
    assert.equal(judged(batch(scheduled('⏱ check-in. Is anything waiting?')), 6), '', 'the mark with no id');
    assert.equal(judged(batch(github('check_suite.completed')), 7), '', 'a batch with no check-in');
    assert.equal(judged('0 notifications remain queued.', 8), '');
    assert.equal(judged(null, 9), '');
    assert.equal(s.read(idle(55 * MIN + 30_000), batch(scheduled(MSG(one))), { session_id: 'case-10', agent_id: 'a1' }), '', 'a subagent\'s read');
  } finally { s.done(); }
});

test('with PR events in the same batch, the two hooks after ReadNotifications do not contradict each other', () => {
  const s = scratch();
  try {
    const one = '20261113T100000Z';
    const quietHint = (result) => {
      const out = execFileSync('bash', [QUIET_HINT], { input: JSON.stringify({ tool_name: 'ReadNotifications', tool_response: result }), encoding: 'utf8' }).trim();
      return out ? JSON.parse(out).hookSpecificOutput.additionalContext : '';
    };
    // Green rollups and a due check-in: one hook would end the turn silent, the other asks for a recap.
    const quiet = batch(github('check_suite.completed'), scheduled(MSG(one)));
    assert.match(s.read(idle(55 * MIN + 30_000), quiet, { session_id: 'case-0' }), /^Check-in, first of two\./);
    assert.match(quietHint(quiet), /^PR events read: check_suite\.completed\./);
    assert.match(quietHint(quiet), /the check-in hook's instruction decides how the turn ends/);
    assert.doesNotMatch(quietHint(quiet), /Otherwise end the turn with no text|one line naming the events/);

    // A failing check and an early check-in: one hook has work, the other ends the turn silent.
    const work = batch(github('check_run.completed'), scheduled(MSG(one)));
    assert.match(s.read(idle(20 * MIN + 30_000), work, { session_id: 'case-1' }), /Then end the turn with no text\.$/);
    assert.match(quietHint(work), /Work: a failing check\. Act on it/);
    assert.match(quietHint(work), /this work and its reply stand even where that instruction ends the turn with no text/);

    assert.equal(quietHint(batch(scheduled(MSG(one)))), '', 'a check-in alone is the check-in hook\'s');
    assert.match(quietHint(batch(github('check_suite.completed'))), /Otherwise end the turn with no text/, 'and PR events alone are as before');
  } finally { s.done(); }
});

test('the state is saved before it speaks, so where it cannot be saved it says nothing', () => {
  const s = scratch();
  try {
    writeFileSync(path.join(s.dir, 'check-in'), 'a file where the state folder would be');
    assert.equal(s.prompt([typed('one'), reply(ago(MIN))]), '');
    assert.equal(s.sent(MSG('20261113T100000Z')), '');
    assert.equal(s.read(idle(55 * MIN + 30_000), batch(scheduled(MSG('20261113T100000Z')))), '');
  } finally { s.done(); }
});

test('each session keeps its own state', () => {
  const s = scratch();
  try {
    const big = [typed('one'), reply(ago(MIN))];
    const a = quoted(s.prompt(big, 'What next?', { session_id: 'sess-a' }));
    assert.equal(s.sent(a, { session_id: 'sess-a' }), '');
    assert.equal(s.prompt(big, 'What next?', { session_id: 'sess-a' }), '');
    assert.notEqual(s.prompt(big, 'What next?', { session_id: 'sess-b' }), '', 'another session is asked for its own');
    assert.equal(s.state('sess-a').pending, true);
    assert.equal(s.state('sess-b').pending, false);
  } finally { s.done(); }
});

test('anything it was not aimed at passes silently, and it never fails a turn', () => {
  const s = scratch();
  try {
    const big = [typed('one'), reply(ago(MIN))];
    const due = batch(scheduled(MSG('20261113T100000Z')));
    writeFileSync(s.transcript, big.join('\n') + '\n');
    for (const payload of [
      { hook_event_name: 'Stop' }, { hook_event_name: 'PreToolUse', tool_name: SEND_LATER[0], tool_input: { message: MSG('1') } },
      { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_response: due },
      { hook_event_name: 'PostToolUse', tool_name: 'mcp__claude-code-remote__create_trigger', tool_input: { prompt: MSG('1') } },
      { hook_event_name: 'PostToolUseFailure', tool_name: 'ReadNotifications', tool_response: due },
      { prompt: 'What next?' },
      { hook_event_name: 'UserPromptSubmit', prompt: 'What next?', session_id: '../etc' },
      { hook_event_name: 'UserPromptSubmit', prompt: 'What next?', session_id: undefined },
    ]) assert.equal(s.run(null, payload), '', 'silent on ' + JSON.stringify(payload).slice(0, 60));
    for (const input of ['not json', '', '{}', '[1]', '"UserPromptSubmit"']) {
      const done = spawnSync('python3', [HOOK], { input, env: { ...process.env, TMPDIR: s.dir }, encoding: 'utf8' });
      assert.deepEqual([done.status, done.stdout, done.stderr], [0, '', ''], `silent on ${input}`);
    }
    assert.ok(!existsSync(s.file()), 'and none of it wrote a state file');

    assert.notEqual(s.prompt(big), '');
    writeFileSync(s.file(), 'not json');
    assert.notEqual(s.prompt(big), '', 'a state file it cannot read is started again');
  } finally { s.done(); }
});

test('it is registered on its three events, each in an entry of its own, through the plugin root', () => {
  const entries = (event) => (HOOKS_JSON.hooks[event] || [])
    .filter(e => e.hooks.some(h => h.command.includes('check-in.py')));
  const everywhere = Object.keys(HOOKS_JSON.hooks).flatMap(entries);
  assert.equal(everywhere.length, 3, 'three entries, and no fourth on another event');
  assert.match(readFileSync(HOOK, 'utf8'), /Removing this script's three entries from hooks\.json ends the\s+practice\./,
    'the header names the off switch, and its count is the count registered');
  for (const entry of everywhere) {
    assert.equal(entry.hooks.length, 1, 'an entry of its own, so that removing it removes nothing else');
    assert.match(entry.hooks[0].command, /^python3 "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/check-in\.py"$/);
  }
  assert.deepEqual(entries('UserPromptSubmit').map(e => e.matcher), ['']);
  const [reads, sends] = entries('PostToolUse').sort((a, b) => a.matcher < b.matcher ? -1 : 1);
  assert.equal(reads.matcher, 'ReadNotifications');
  const sending = new RegExp(`^(?:${sends.matcher})$`);
  for (const name of SEND_LATER) assert.ok(sending.test(name), `${sends.matcher} matches ${name}`);
  assert.ok(!sending.test('mcp__claude-code-remote__create_trigger'));
  // The guard and the tracker answer the same calls.
  const guard = HOOKS_JSON.hooks.PreToolUse.find(e => e.hooks.some(h => h.command.includes('send-later-guard.sh')));
  assert.equal(sends.matcher, guard.matcher);
});
