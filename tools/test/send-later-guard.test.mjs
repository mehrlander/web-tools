// .claude/skills/hooks/send-later-guard.sh — the PreToolUse refusal that stops a
// session scheduling its own PR check-in.
//
// The failure has both halves, the way the conventions nudge does. A guard that
// never fires leaves the check-in loop running, and that loop is measured rather
// than suspected: 268 send_later calls across 65 session records on 2026-09-13,
// every retained one a PR or CI check-in, one pull request drawing fourteen. A
// guard that fires too widely is worse, because it would take away the escape
// hatch the refusal itself points at: create_trigger, which carries the weekday
// morning brief and any reminder the reader actually asked for. So silence and
// speech are both asserted.
//
// The matcher is asserted against the two REAL tool names, not against one. The
// same server appears in the records as Claude_Code_Remote and as its connector
// UUID, and the UUID spelling was 45 of those 268 calls. That is the whole
// reason this is a hook with a regex rather than literals in permissions.deny,
// so a later edit narrowing the pattern has to fail here.
//
// Driven as a subprocess: the contract is (hook JSON on stdin, decision on
// stdout, always exit 0), and stubbing its input would test a different program.
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const HOOK = path.join(repoRoot, '.claude/skills/hooks/send-later-guard.sh');
const HOOKS_JSON = JSON.parse(
  readFileSync(path.join(repoRoot, '.claude/skills/hooks/hooks.json'), 'utf8'));

// Both spellings observed in mehrlander/web-tools-private sessions/ on 2026-09-13.
const NAMES = [
  'mcp__Claude_Code_Remote__send_later',
  'mcp__bf7c680d-5fdc-5ef4-b4a0-abadb619bf0a__send_later',
];

function run(payload) {
  return execFileSync('bash', [HOOK], { input: payload, encoding: 'utf8' }).trim();
}

test('it refuses send_later under every spelling the records carry', () => {
  for (const tool_name of NAMES) {
    const out = JSON.parse(run(JSON.stringify({ tool_name, tool_input: { message: 'x' } })));
    const d = out.hookSpecificOutput;
    assert.equal(d.hookEventName, 'PreToolUse');
    assert.equal(d.permissionDecision, 'deny', `${tool_name} is denied`);
    assert.match(d.permissionDecisionReason, /create_trigger/,
      'the refusal names the tool that is still open, so a session is not left guessing');
  }
});

test('it leaves create_trigger alone, which is the escape hatch on purpose', () => {
  assert.equal(run(JSON.stringify({ tool_name: 'mcp__Claude_Code_Remote__create_trigger' })), '',
    'a deliberate Routine is still one call away');
});

test('anything it was not aimed at passes silently, and it never fails a turn', () => {
  for (const payload of ['not json', '{}', JSON.stringify({ tool_name: 'Bash' }),
                         JSON.stringify({ tool_name: 'mcp__Gmail__send_message' })]) {
    assert.equal(run(payload), '', `silent on ${payload.slice(0, 28)}`);
  }
});

test('the registered matcher catches both spellings, which literals would not', () => {
  const entries = (HOOKS_JSON.hooks.PreToolUse || [])
    .filter(e => e.hooks.some(h => h.command.includes('send-later-guard.sh')));
  assert.equal(entries.length, 1, 'registered exactly once');
  const [{ matcher, hooks }] = entries;
  assert.match(hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}/,
    'addressed through the plugin root, like its siblings');
  const re = new RegExp(`^(?:${matcher})$`);
  for (const n of NAMES) assert.ok(re.test(n), `${matcher} matches ${n}`);
  assert.ok(!re.test('mcp__Claude_Code_Remote__create_trigger'),
    'and does not reach the tool the refusal recommends');
});
