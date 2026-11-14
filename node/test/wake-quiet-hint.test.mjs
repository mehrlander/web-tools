// skills/hooks/wake-quiet-hint.sh: the PostToolUse reminder after ReadNotifications.
// Both directions are asserted: echoes and green rollups are told to stay silent,
// and a failing check or unknown kind never is. A batch that also holds a
// check-in is the one case where a second hook, check-in.py, speaks after the
// same read, so the hint is held to leaving the turn's ending to that hook.
// Driven as a subprocess: hook JSON on stdin, context on stdout, always exit 0.
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const HOOK = path.join(repoRoot, 'skills/hooks/wake-quiet-hint.sh');
const HOOKS_JSON = JSON.parse(
  readFileSync(path.join(repoRoot, 'skills/hooks/hooks.json'), 'utf8'));

const ev = (kind, body = '{"pr":"mehrlander/web-tools#1"}') =>
  `<event source="github" kind="${kind}" from="system" trust="relay">\n` +
  `  <!-- harness guidance -->\n  ${body}\n</event>`;
const wake = (...events) =>
  `[SYSTEM NOTIFICATION - NOT USER INPUT]\n<wake reason="external-event">\n${events.join('\n')}\n</wake>\n0 notifications remain queued.`;

function run(payload) {
  return execFileSync('bash', [HOOK], { input: payload, encoding: 'utf8' }).trim();
}
const context = (tool_response) => {
  const out = run(JSON.stringify({ tool_name: 'ReadNotifications', tool_response }));
  const d = JSON.parse(out).hookSpecificOutput;
  assert.equal(d.hookEventName, 'PostToolUse');
  return d.additionalContext;
};

test('a batch of echoes and green rollups is told to end the turn with no text', () => {
  const msg = context(wake(ev('check_suite.completed'), ev('check_suite.completed'),
    ev('subscription.created'), ev('pull_request.ready_for_review', '{"actor":"x","pr":"o/r#1"}')));
  assert.match(msg, /check_suite\.completed x2/, 'the kinds are tallied, so the reader of the hook sees what arrived');
    assert.match(msg, /end the turn with no text/i);
  assert.match(msg, /one line naming the events/, 'says what to send when the harness forces output');
  assert.match(msg, /status checklist/, 'disambiguates the platform phrase that collides with the closing state');
});

test('the two exceptions survive: an awaited green, and an unreported merge', () => {
  const msg = context(wake(ev('pull_request.closed', '{"outcome":"merged","pr":"o/r#1"}')));
  assert.match(msg, /passing check the user said to wait for/);
  assert.match(msg, /merge or close not yet reported/);
});

test('a failing check is work, and is never told to stay silent', () => {
  const msg = context(wake(ev('check_suite.completed'),
    ev('check_run.completed', '{"check":"test","conclusion":"failure","pr":"o/r#1"}')));
  assert.match(msg, /Work: a failing check/);
  assert.doesNotMatch(msg, /end the turn with no text/i);
});

test('an unknown kind, such as a review, is treated as work rather than an echo', () => {
  const msg = context(wake(ev('pull_request_review.submitted')));
  assert.match(msg, /Work: pull_request_review\.submitted/);
  assert.doesNotMatch(msg, /end the turn with no text/i);
});

test('with a check-in in the batch, the turn\'s ending is left to the check-in hook', () => {
  const checkIn = '--- Notification 2 of 2 · id: 6e65590b · origin: scheduled trigger (a check-in you or your owner scheduled) · queued at: 2026-10-13T00:14:39Z ---\n' +
    '⏱ check-in 20261113T221500Z. The check-in hook says what to do with this when it is read; if no such instruction follows, end the turn with no text.';
  const quiet = context(wake(ev('check_suite.completed'), ev('pull_request.closed', '{"outcome":"merged","pr":"o/r#1"}')) + '\n\n' + checkIn);
  assert.match(quiet, /^PR events read: check_suite\.completed, pull_request\.closed\./);
  assert.match(quiet, /merge or close not yet reported/, 'the two exceptions survive');
  assert.match(quiet, /passing check the user said to wait for/);
  assert.match(quiet, /the check-in hook's instruction decides how the turn ends/);
  assert.match(quiet, /Such a report or act stands even where that instruction ends the turn with no text/);
  assert.doesNotMatch(quiet, /Otherwise end the turn with no text/, 'it does not end a turn the check-in may give a recap to');
  assert.doesNotMatch(quiet, /one line naming the events/);
  assert.match(quiet, /status checklist/);

  const work = context(wake(ev('check_run.completed', '{"check":"test","conclusion":"failure","pr":"o/r#1"}')) + '\n\n' + checkIn);
  assert.match(work, /Work: a failing check\. Act on it/);
  assert.match(work, /follow the check-in hook's instruction as well/);
  assert.match(work, /this work and its reply stand even where that instruction ends the turn with no text/);

  // The mark is a check-in only at the start of its line, as check-in.py reads it.
  const mention = context(wake(ev('check_suite.completed', '{"note":"after ⏱ check-in 20261113T221500Z. fired"}')));
  assert.match(mention, /Otherwise end the turn with no text/);
  assert.equal(run(JSON.stringify({ tool_name: 'ReadNotifications', tool_response: checkIn })), '',
    'a check-in with no PR event beside it gets nothing from this hook');
});

test('the response shape is not trusted: nested content is searched too', () => {
  const msg = context({ content: [{ type: 'text', text: wake(ev('subscription.created')) }] });
  assert.match(msg, /subscription\.created/);
});

test('anything it was not aimed at passes silently, and it never fails a turn', () => {
  for (const payload of ['not json', '{}', JSON.stringify({ tool_name: 'Bash', tool_response: wake(ev('check_suite.completed')) }),
                         JSON.stringify({ tool_name: 'ReadNotifications', tool_response: '0 notifications remain queued.' })]) {
    assert.equal(run(payload), '', `silent on ${payload.slice(0, 40)}`);
  }
});

test('it is registered once, after ReadNotifications, through the plugin root', () => {
  const entries = (HOOKS_JSON.hooks.PostToolUse || [])
    .filter(e => e.hooks.some(h => h.command.includes('wake-quiet-hint.sh')));
  assert.equal(entries.length, 1);
  const [{ matcher, hooks }] = entries;
  assert.match(hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}/);
  const re = new RegExp(`^(?:${matcher})$`);
  assert.ok(re.test('ReadNotifications'));
  assert.ok(!re.test('mcp__Claude_Code_Remote__subscribe_pr_activity'));
});
