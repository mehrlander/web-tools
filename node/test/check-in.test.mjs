// skills/hooks/check-in.py: the check-in a session schedules for itself shortly
// before its prompt cache lapses. One session has run this path live, from
// 2026-11-14, and the session archive recorded the shapes it reads: the wake's
// envelope, the ReadNotifications result with the message under its
// `--- Notification` header, and send_later's result. update_trigger's result
// has no recorded call yet, so its shape here is assumed, and the hook falls
// back to the time it was given.
//
// The rules, arming, moving and the decision on a check-in that was read, are
// called as functions first, a case for each branch. The rest drives the hook
// as a subprocess over a scratch transcript, with TMPDIR pointed at the scratch
// folder so each test keeps its own state file. The hook reads the real clock,
// so times are written relative to it, half a minute clear of each boundary,
// and `later` moves a state file back in time to stand for minutes passing.
// The lines it supplies give the owner's time, with OWNER_TZ set to one zone.
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
// The spellings update_trigger may carry, as send_later does.
const UPDATE_TRIGGER = ['mcp__claude-code-remote__update_trigger', 'mcp__Claude_Code_Remote__update_trigger'];
const TRIG = 'trig_014SNmXPbENApVUhjhYkMZ29';
const MIN = 60_000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const ZONE = 'America/Los_Angeles';
// The owner's time as the hook prints it in a supplied line: 12:15pm.
const clock = (ms) => {
  const part = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hour: 'numeric', minute: '2-digit', hour12: true })
    .formatToParts(new Date(ms)).map(p => [p.type, p.value]));
  return `${part.hour}:${part.minute}${part.dayPeriod.toLowerCase()}`;
};
// The times a supplied line gives, each checked against the clock: the owner's
// time for its offset from when the hook ran, which was a few seconds ago.
function times(text, ...offsets) {
  const found = [...text.matchAll(/\b(\d{1,2}:\d\d[ap]m)\b/g)].map(m => m[1]);
  assert.equal(found.length, offsets.length, 'a time for each offset');
  found.forEach((at, i) => assert.ok([clock(Date.now() + offsets[i]), clock(Date.now() + offsets[i] - 5000)].includes(at),
    `${at} is the owner's time ${offsets[i] / MIN} minutes on`));
  return found;
}

// ── The texts, as the specification gives them ─────────────────────────────
const MSG = (id) => `⏱ check-in ${id}. The check-in hook says what to do with this when it is read; if no such instruction follows, end the turn with no text.`;
const ARM = (id) => `No check-in is pending for this session. Before this reply ends, call the send_later tool with delay_minutes 55 and exactly this message: «${MSG(id)}». Do it once; the check-in hook tracks it from here. If the session has no send_later tool, ignore this.`;
const MOVE = (trigger, at) => `A check-in is pending for this session, as trigger ${trigger}. Move it to 55 minutes from now: call the update_trigger tool with trigger_id ${trigger} and run_once_at ${at}, sent in the same response as this turn's first other tool call and not in a response of its own. If the turn makes no tool call, skip it.`;
const DUPLICATE = 'This check-in is a duplicate of one armed later. End the turn with no text.';
const EARLY = (n, d, id, at) => `This check-in is early: the session's last response was ${n} minutes ago. Call send_later with delay_minutes ${d} and exactly this message: «${MSG(id)}». Then reply with exactly this line, below any reply that other work in this turn calls for, with no caption and no closing state: «Cache check-in fired while we were talking; moved to ${at}.»`;
const FIRST = (n, id, at, then) => [
  `Check-in, first of two. The session has been idle for ${n} minutes and its prompt cache lapses at 60. This turn is automatic: the owner has not written. Spend at most four model calls on it.`,
  '1. If the session\'s work is closed (its last reply closed on ⚫, ⚪, 🟣 or 🔴), close the session out now: unsubscribe from every pull request this session is subscribed to, arm no further check-in, and reply with one line saying so. Steps 2 to 4 then do not apply.',
  '2. Do work that needs no directional commitment, meaning no choice that is the owner\'s to make, such as the tend skill\'s Prod list. Hand anything longer than two calls to a subagent. Where there is no such work, do none.',
  `3. Arm the second check-in: call send_later with delay_minutes 55 and exactly this message: «${MSG(id)}».`,
  `4. Reply with exactly this line, with no caption and no closing state: «Quiet check-in at ${at}: the cache is warm, and a recap follows at ${then} if the session stays idle.»`,
].join('\n');
const SECOND = [
  'Check-in, second of two, and the last. The owner has not written since the first. This turn is automatic. Spend at most four model calls on it.',
  '1. Write a recap for a reader coming back cold: what the session is for, what waits on the owner as one question per decision, and where to pick up.',
  '2. Close the session out: write a pick-up point wherever one is missing, such as an open pull request\'s guide; unsubscribe from every pull request this session is subscribed to; and arm no further check-in.',
  '3. Close with the caption and one closing state, and say that this is the second and last check-in.',
].join('\n');
// The first check-in as the hook wrote it a few seconds ago, its times checked.
const firstOf = (text, n) => FIRST(n, idOf(text), ...times(text, 0, 55 * MIN));
const earlyOf = (text, n, d) => EARLY(n, d, idOf(text), ...times(text, d * MIN));
// The prompts that are not the owner's, as session-detail-caption.py tells them.
const WAKES = ['<task-notification>\n<task-type>queued-remote-notifications</task-type>',
  '<agent-message from="a1">\nreport', '[SYSTEM] wake', '<system-reminder>x</system-reminder>',
  'Another Claude session sent a message'];

// The message an instruction quotes, and the id a message carries.
const quoted = (text) => /«(.*?)»/s.exec(text)[1];
const idOf = (text) => /⏱ check-in ([\w:-]+)\./.exec(text)[1];

// ── The rules, called as functions: one Python process answers the list ────
function rules(calls) {
  return JSON.parse(execFileSync('python3', ['-c', `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("check_in", sys.argv[1])
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)
print(json.dumps([getattr(hook, name)(*args) for name, args in json.loads(sys.argv[2])]))
`, HOOK, JSON.stringify(calls)], { encoding: 'utf8', env: { ...process.env, OWNER_TZ: ZONE } }));
}

test('the arming rule: an owner\'s prompt in a cloud session, nothing pending, and a context at or over the floor', () => {
  const arming = (prompt, pending, context, remote = true) => ['arming', [prompt, remote, pending, context, 'ID']];
  const [at, over, under, none, zero, pending, local, image, ...wakes] = rules([
    arming('What next?', false, 150_000), arming('What next?', false, 815_600),
    arming('What next?', false, 149_999), arming('What next?', false, null),
    arming('What next?', false, 0), arming('What next?', true, 815_600),
    arming('What next?', false, 815_600, false),
    arming(null, false, 815_600), ...WAKES.map(wake => arming(wake, false, 815_600)),
  ]);
  assert.equal(at, ARM('ID'), 'at the floor');
  assert.equal(over, ARM('ID'));
  assert.equal(under, null, 'one token under the floor');
  assert.equal(none, null, 'before any response the context is unknown');
  assert.equal(zero, null);
  assert.equal(pending, null, 'one is pending');
  assert.equal(local, null, 'not a cloud session, so it has no send_later');
  assert.equal(image, null, 'no prompt in the payload');
  wakes.forEach((said, i) => assert.equal(said, null, 'a wake: ' + WAKES[i].slice(0, 24)));
  const told = (environ) => ['cloud', [environ]];
  assert.deepEqual(rules([told({ CLAUDE_CODE_REMOTE: 'true' }), told({}), told({ CLAUDE_CODE_REMOTE: 'false' }),
    told({ CLAUDE_CODE_REMOTE: '1' }), told({ CLAUDE_CODE_REMOTE: '' }), told({ CLAUDE_CODE_REMOTE_SESSION_ID: 'cse_01' })]),
    [true, false, false, false, false, false], 'a cloud session is CLAUDE_CODE_REMOTE=true and nothing else');
});

test('the decision on a check-in that was read: duplicate, early, first or second', () => {
  const A = '20261113T100000Z', B = '20261113T105500Z';
  // Read at 12:15pm in the owner's zone.
  const NOW = Date.parse('2026-11-16T20:15:00Z') / 1000;
  const decide = (read, latest, minutes, ran) => ['decide', [read, latest, minutes, ran, 'NEW', NOW]];
  const first = (n) => ['first', FIRST(n, 'NEW', '12:15pm', '1:10pm')];
  const cases = [
    [decide(A, B, 55, 0), ['duplicate', DUPLICATE], 'the state holds a later id'],
    [decide(A, B, 5, 1), ['duplicate', DUPLICATE], 'a duplicate whatever the idleness or the count'],
    [decide(A, A + '-1', 55, 0), ['duplicate', DUPLICATE], 'an id with a suffix is later than the id it extends'],
    [decide(B, B, 55, 0), first(55), 'the latest id itself'],
    [decide(B, A, 55, 0), first(55), 'an id later than any the state holds'],
    [decide(A, null, 55, 0), first(55), 'a state that holds no id, as in a new container'],
    [decide(A + '-1', A, 55, 0), first(55)],
    [decide(A, A, 0, 0), ['early', EARLY(0, 55, 'NEW', '1:10pm')], 'the session answered this minute'],
    [decide(A, A, 20, 0), ['early', EARLY(20, 35, 'NEW', '12:50pm')]],
    [decide(A, A, 49, 0), ['early', EARLY(49, 6, 'NEW', '12:21pm')], 'the last early minute'],
    [decide(A, A, 20, 1), ['early', EARLY(20, 35, 'NEW', '12:50pm')], 'early after the first has run, too'],
    [decide(A, A, -3, 0), ['early', EARLY(0, 55, 'NEW', '1:10pm')], 'a transcript clock ahead of this one'],
    [decide(A, A, 50, 0), first(50), 'due from the fiftieth minute'],
    [decide(A, A, 75, 0), first(75), 'delivered late'],
    [decide(A, A, 55, 1), ['second', SECOND], 'the first has run since the owner last typed'],
    [decide(A, A, 55, 2), ['second', SECOND]],
  ];
  rules(cases.map(([call]) => call)).forEach((got, i) => {
    assert.deepEqual(got, cases[i][1], cases[i][2]);
    assert.doesNotMatch(got[1], /[{}]/, 'no placeholder is left unfilled');
    assert.doesNotMatch(got[1], /\bnothing\b/, 'and no instruction leans on the word');
  });
  const [[, one]] = rules([decide(A, A, 1, 0)]);
  assert.match(one, /last response was 1 minute ago\. Call send_later with delay_minutes 54 /, 'one minute is singular');
  assert.match(one, /moved to 1:09pm\.»$/);

  // The supplied lines, word for word as the owner reads them.
  const line = (text) => /«([^«»]*)»$/.exec(text)[1];
  assert.equal(line(EARLY(20, 35, 'NEW', '12:50pm')), 'Cache check-in fired while we were talking; moved to 12:50pm.');
  assert.equal(line(first(55)[1]), 'Quiet check-in at 12:15pm: the cache is warm, and a recap follows at 1:10pm if the session stays idle.');

  // Where the caption hook's clock cannot load the zone, the times are UTC with a Z.
  const utc = JSON.parse(execFileSync('python3', ['-c', `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("check_in", sys.argv[1])
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)
print(json.dumps(hook.decide("A", "A", 55, 0, "NEW", float(sys.argv[2]))))
`, HOOK, String(NOW)], { encoding: 'utf8', env: { ...process.env, OWNER_TZ: 'Nowhere/Atlantis' } }));
  assert.equal(utc[1], FIRST(55, 'NEW', '20:15Z', '21:10Z'));
});

test('the moving rule: a pending check-in whose trigger is known and whose time is still ahead', () => {
  const NOW = Date.parse('2026-11-16T20:15:00Z') / 1000;
  const moving = (trigger, due) => ['moving', [trigger, due, NOW]];
  const [ahead, soon, past, now, none, odd, noTime] = rules([
    moving('trig_01VShaFEkBEEiJzCVXgGAnBn', NOW + 40 * 60), moving('trig_01', NOW + 1), moving('trig_01', NOW - 60),
    moving('trig_01', NOW), moving(null, NOW + 60), moving('trig 01; rm', NOW + 60), moving('trig_01', null),
  ]);
  assert.equal(ahead, MOVE('trig_01VShaFEkBEEiJzCVXgGAnBn', '2026-11-16T21:10:00Z'), '55 minutes from now, in UTC');
  assert.equal(soon, MOVE('trig_01', '2026-11-16T21:10:00Z'), 'however close its time');
  assert.equal(past, null, 'its time has passed: it has fired, or is about to, and moving it could fire it twice');
  assert.equal(now, null);
  assert.equal(none, null, 'no trigger_id to move');
  assert.equal(odd, null, 'a trigger_id that is not one');
  assert.equal(noTime, null, 'no time to judge it by');
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
  // `entries` rewrites the transcript whole; null leaves it as it stands. The
  // run is a cloud session's unless `remote` gives the variable another value,
  // or null for unset, whatever machine the suite itself runs on.
  const run = (entries, payload, remote = 'true') => {
    if (entries) writeFileSync(transcript, entries.join('\n') + '\n');
    const env = { ...process.env, TMPDIR: dir, CLAUDE_CODE_REMOTE: remote, OWNER_TZ: ZONE };
    if (remote === null) delete env.CLAUDE_CODE_REMOTE;
    const done = spawnSync('python3', [HOOK], {
      input: JSON.stringify({ transcript_path: transcript, session_id: SESSION, ...payload }), env, encoding: 'utf8' });
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
    tool_response: [{ type: 'text', text: `{"fire_at":"${ago(-55 * MIN)}","now":"${ago(0)}","trigger_id":"${TRIG}"}` }], ...more });
  // update_trigger moving `trigger` to `at`, with a result in the shape get_trigger describes.
  const moved = (trigger, at, more = {}) => run(null, { hook_event_name: 'PostToolUse', tool_name: UPDATE_TRIGGER[0],
    tool_input: { trigger_id: trigger, run_once_at: at },
    tool_response: [{ type: 'text', text: JSON.stringify({ trigger: { id: trigger, name: 'check-in', enabled: true,
      run_once_at: at, next_run_at: at, created_at: ago(30 * MIN) } }) }], ...more });
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
  return { dir, transcript, file, run, prompt, sent, moved, read, state, later, armed,
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
    assert.equal(s.state().trigger, TRIG, 'and the trigger_id the result gave');
    assert.match(s.prompt(null, 'And then?'), /^A check-in is pending for this session/, 'one is pending: it is moved, not armed again');
    assert.equal(s.state().latest, id);
  } finally { s.done(); }
});

test('at an owner\'s prompt with a check-in pending, it asks for the check-in to be moved 55 minutes on', () => {
  const s = scratch();
  try {
    const id = s.armed();
    const asked = s.prompt(null, 'And then?');
    const at = /run_once_at (\S+),/.exec(asked)[1];
    assert.equal(asked, MOVE(TRIG, at));
    assert.match(at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/, 'RFC3339, in UTC');
    assert.ok(Math.abs(Date.parse(at) - (Date.now() + 55 * MIN)) < 10_000, '55 minutes from the prompt');
    assert.deepEqual(Object.keys(s.state()).sort(), ['due', 'latest', 'pending', 'trigger'], 'asking changes no state');
    assert.notEqual(s.prompt(null, 'And after that?'), '', 'asked again at each prompt');

    // A wake, a subagent, or a session that is not a cloud one is not asked.
    WAKES.forEach(wake => assert.equal(s.prompt(null, wake), '', 'a wake: ' + wake.slice(0, 24)));
    assert.equal(s.prompt(null, 'What next?', { agent_id: 'a1' }), '', 'a subagent\'s prompt');
    assert.equal(s.run(null, { hook_event_name: 'UserPromptSubmit', prompt: 'What next?' }, null), '', 'outside a cloud session');
    assert.equal(s.state().latest, id);

    // A send_later result that gave no trigger_id leaves no trigger to move.
    rmSync(s.file());
    assert.equal(s.sent(MSG(id), { tool_response: `{"fire_at":"${ago(-55 * MIN)}"}` }), '');
    assert.equal(s.state().trigger, undefined);
    assert.equal(s.prompt(null, 'And then?'), '', 'no trigger_id: no move, and none armed while one is pending');

    // Its time has passed but it is unread: it has fired, so it is not moved.
    assert.equal(s.sent(MSG(id), { tool_response: `{"fire_at":"${ago(2 * MIN)}","trigger_id":"${TRIG}"}` }), '');
    assert.equal(s.prompt(null, 'And then?'), '', 'two minutes past its time');

    // With none pending, the prompt arms one as before.
    rmSync(s.file());
    const armedNow = s.prompt([typed('one'), reply(ago(MIN))]);
    assert.equal(armedNow, ARM(idOf(armedNow)));
  } finally { s.done(); }
});

test('after an update_trigger on the pending check-in, it records when the check-in now fires', () => {
  const s = scratch();
  try {
    // A check-in due in 30 minutes, so that moving it to 55 sets it later.
    const id = idOf(quoted(s.prompt([typed('one'), reply(ago(MIN))])));
    assert.equal(s.sent(MSG(id), { tool_response: `{"fire_at":"${ago(-30 * MIN)}","trigger_id":"${TRIG}"}` }), '');
    const was = s.state().due;
    const at = /run_once_at (\S+),/.exec(s.prompt(null, 'And then?'))[1];
    for (const name of UPDATE_TRIGGER) {
      writeFileSync(s.file(), JSON.stringify({ ...s.state(), due: was }));
      assert.equal(s.run(null, { hook_event_name: 'PostToolUse', tool_name: name, tool_input: { trigger_id: TRIG, run_once_at: at },
        tool_response: [{ type: 'text', text: `{"trigger":{"id":"${TRIG}","next_run_at":"${at}"}}` }] }), '');
      assert.equal(s.state().due, Date.parse(at) / 1000, 'next_run_at in the result, under ' + name);
    }
    assert.ok(s.state().due > was);
    assert.deepEqual([s.state().latest, s.state().pending, s.state().trigger], [id, true, TRIG], 'the rest stands');

    const due = () => s.state().due;
    const later = new Date(Date.now() + 70 * MIN).toISOString().replace(/\.\d+Z$/, 'Z');
    assert.equal(s.moved('trig_01Other', later), '');
    assert.equal(due(), Date.parse(at) / 1000, 'another trigger is not the check-in');
    assert.equal(s.moved(TRIG, later, { tool_response: { is_error: true, content: 'not found' } }), '');
    assert.equal(due(), Date.parse(at) / 1000, 'a call that failed');
    assert.equal(s.moved(TRIG, later, { agent_id: 'a1' }), '');
    assert.equal(due(), Date.parse(at) / 1000, 'a subagent\'s call');
    assert.equal(s.moved(TRIG, later, { tool_input: { trigger_id: TRIG, run_once_at: later }, tool_response: 'updated' }), '');
    assert.equal(due(), Date.parse(later) / 1000, 'no time in the result: the run_once_at it was given');
    assert.equal(s.moved(TRIG, '2026-11-16T09:00:00[America/Los_Angeles]', { tool_response: 'updated' }), '');
    assert.equal(due(), Date.parse(later) / 1000, 'a local time is not read as UTC');
    assert.equal(s.moved(TRIG, later, { tool_response: `{"run_once_at":"${at}"}` }), '');
    assert.equal(due(), Date.parse(at) / 1000, 'run_once_at in the result before the one it was given');

    // Once the check-in is read, the trigger is settled with it.
    const first = s.read(idle(55 * MIN + 30_000), batch(scheduled(MSG(id))));
    assert.match(first, /^Check-in, first of two\./);
    assert.equal(s.state().trigger, undefined);
    assert.equal(s.moved(TRIG, later), '');
    assert.equal(s.state().due, undefined, 'and an update_trigger on it afterwards is passed over');
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

test('outside a cloud session it does not ask, and everything else it does stays as it is', () => {
  const s = scratch();
  try {
    const big = [typed('one'), reply(ago(MIN), 815_600)];
    const ask = { hook_event_name: 'UserPromptSubmit', prompt: 'What next?' };
    for (const remote of [null, 'false', '1', '']) {
      assert.equal(s.run(big, ask, remote), '', `CLAUDE_CODE_REMOTE=${remote}`);
    }
    assert.ok(!existsSync(s.file()), 'and it writes no state for a prompt it does not answer');
    const asked = s.run(big, ask);
    assert.equal(asked, ARM(idOf(asked)), 'the same prompt in a cloud session');

    // The variable gates the asking alone: a message sent is tracked, a
    // check-in read is judged, and an owner's prompt still starts the count again.
    const one = '20261113T100000Z';
    const sending = { hook_event_name: 'PostToolUse', tool_name: SEND_LATER[0], tool_input: { delay_minutes: 55, message: MSG(one) },
      tool_response: `{"fire_at":"${ago(-55 * MIN)}"}` };
    assert.equal(s.run(null, sending, null), '');
    assert.equal(s.state().pending, true);
    assert.equal(s.state().latest, one);
    const first = s.run(idle(55 * MIN + 30_000),
      { hook_event_name: 'PostToolUse', tool_name: 'ReadNotifications', tool_response: batch(scheduled(MSG(one))) }, null);
    assert.equal(first, firstOf(first, 55));
    assert.equal(s.state().ran, 1);
    assert.equal(s.run(null, ask, null), '', 'one is not asked for here');
    assert.equal(s.state().ran, 0);
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
    assert.equal(first, firstOf(first, 55));
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
    assert.equal(early, earlyOf(early, 20, 35));
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
    assert.equal(due, firstOf(due, 55), 'idle since the response before the early check-in');
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
    assert.equal(again, earlyOf(again, 25, 30));

    // The owner wrote two minutes after an early check-in and was answered at
    // once, inside the slack.
    rmSync(s.file());
    early = s.read(idle(20 * MIN + 30_000), batch(scheduled(MSG(s.armed()))));
    assert.equal(s.sent(quoted(early)), '');
    assert.ok(s.state().quiet, 'the time of the response before the early check-in is kept');
    assert.match(s.prompt(null, 'One more thing.'), /^A check-in is pending/, 'one is pending, and is asked to move');
    assert.equal(s.state().quiet, undefined, 'and dropped when the owner types');
    s.later(35 * MIN);
    const answered = [...woken(35 * MIN + 4000), reply(ago(35 * MIN - 5000)),
      typed('One more thing.', ago(33 * MIN + 40_000)), reply(ago(33 * MIN + 30_000))];
    again = s.read(idle(55 * MIN + 30_000, answered), batch(scheduled(MSG(idOf(early)))));
    assert.equal(again, earlyOf(again, 33, 22));
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
    assert.equal(first, firstOf(first, 65));

    // In one batch, the newest id is the one judged.
    rmSync(s.file());
    const both = s.read(idle(55 * MIN + 30_000), batch(scheduled(MSG(one)), scheduled(MSG(two))));
    assert.equal(both, firstOf(both, 55));
    assert.ok(two < idOf(both));
  } finally { s.done(); }
});

test('a prompt from the owner starts the count again, typed between turns or mid-turn', () => {
  const s = scratch();
  try {
    // Between turns: UserPromptSubmit sets the count back.
    let first = s.read(idle(55 * MIN + 30_000), batch(scheduled(MSG(s.armed()))));
    assert.equal(s.sent(quoted(first)), '');
    assert.match(s.prompt(null, 'Thanks, carry on.'), /^A check-in is pending/, 'one is pending, so it asks to move it, not to arm one');
    assert.equal(s.state().ran, 0);
    assert.equal(s.state().mark, undefined);
    let next = s.read(idle(55 * MIN + 30_000), batch(scheduled(MSG(idOf(first)))));
    assert.equal(next, firstOf(next, 55), 'the first of two again');

    // Mid-turn: no UserPromptSubmit fires, and the transcript holds the message.
    rmSync(s.file());
    first = s.read(idle(55 * MIN + 30_000), batch(scheduled(MSG(s.armed()))));
    assert.equal(s.sent(quoted(first)), '');
    appendFileSync(s.transcript, [queued('<task-notification>\n<task-id>a1</task-id>', { kind: 'task-notification' }),
      queued('Could we say less?', { kind: 'human' }), reply(ago(55 * MIN + 30_000)), ...woken()].join('\n') + '\n');
    next = s.read(null, batch(scheduled(MSG(idOf(first)))));
    assert.equal(next, firstOf(next, 55), 'the owner wrote mid-turn');

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
    assert.match(s.read(idle(20 * MIN + 30_000), work, { session_id: 'case-1' }),
      /below any reply that other work in this turn calls for, .*moved to \d{1,2}:\d\d[ap]m\.»$/);
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
    assert.match(s.prompt(big, 'What next?', { session_id: 'sess-a' }), /^A check-in is pending/);
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

test('it is registered on its four entries, each of its own, through the plugin root', () => {
  const entries = (event) => (HOOKS_JSON.hooks[event] || [])
    .filter(e => e.hooks.some(h => h.command.includes('check-in.py')));
  const everywhere = Object.keys(HOOKS_JSON.hooks).flatMap(entries);
  assert.equal(everywhere.length, 4, 'four entries, and no fifth on another event');
  assert.match(readFileSync(HOOK, 'utf8'), /Removing this script's four entries from hooks\.json ends the\s+practice\./,
    'the header names the off switch, and its count is the count registered');
  for (const entry of everywhere) {
    assert.equal(entry.hooks.length, 1, 'an entry of its own, so that removing it removes nothing else');
    assert.match(entry.hooks[0].command, /^python3 "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/check-in\.py"$/);
  }
  assert.deepEqual(entries('UserPromptSubmit').map(e => e.matcher), ['']);
  const [reads, sends, moves] = entries('PostToolUse').sort((a, b) => a.matcher < b.matcher ? -1 : 1);
  assert.equal(reads.matcher, 'ReadNotifications');
  const sending = new RegExp(`^(?:${sends.matcher})$`);
  for (const name of SEND_LATER) assert.ok(sending.test(name), `${sends.matcher} matches ${name}`);
  assert.ok(!sending.test('mcp__claude-code-remote__create_trigger'));
  // The guard and the tracker answer the same calls.
  const guard = HOOKS_JSON.hooks.PreToolUse.find(e => e.hooks.some(h => h.command.includes('send-later-guard.sh')));
  assert.equal(sends.matcher, guard.matcher);
  const moving = new RegExp(`^(?:${moves.matcher})$`);
  for (const name of UPDATE_TRIGGER) assert.ok(moving.test(name), `${moves.matcher} matches ${name}`);
  assert.ok(!moving.test('mcp__claude-code-remote__create_trigger') && !moving.test(SEND_LATER[0]));

  // No guard stands before update_trigger: the one PreToolUse entry that
  // matches it is the turn reporter, which never refuses, and the send-later
  // guard stays silent when handed one.
  const before = HOOKS_JSON.hooks.PreToolUse.filter(e => new RegExp(`^(?:${e.matcher})$`).test(UPDATE_TRIGGER[0]));
  assert.deepEqual(before.flatMap(e => e.hooks.map(h => path.basename(h.command.split('"')[1] || h.command))), ['session-activity.py']);
  assert.equal(execFileSync('bash', [GUARD], { input: JSON.stringify({ tool_name: UPDATE_TRIGGER[0],
    tool_input: { trigger_id: TRIG, run_once_at: '2026-11-16T21:10:00Z' } }), encoding: 'utf8' }).trim(), '');
});
