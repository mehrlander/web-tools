// skills/hooks/ask-question-guard.sh and refresh-plugin.sh: the two pieces of
// the environment setup script that moved into the plugin on 2026-09-27, so
// the script could shrink to installing it. The guard replaces a
// permissions.deny entry a plugin cannot carry; the refresher replaces
// refresh-portable.sh, which lived in ~/.claude/hooks/ where no session could
// read it. Whether PreToolUse fires for AskUserQuestion at all is a harness
// fact this suite cannot settle; what it holds is the hook's own contract.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const GUARD = path.join(repoRoot, 'skills/hooks/ask-question-guard.sh');
const REFRESH = path.join(repoRoot, 'skills/hooks/refresh-plugin.sh');
const HOOKS = JSON.parse(readFileSync(path.join(repoRoot, 'skills/hooks/hooks.json'), 'utf8')).hooks;

const guard = (payload) => execFileSync('bash', [GUARD], { input: payload, encoding: 'utf8' }).trim();

test('the guard denies AskUserQuestion and says what to do instead', () => {
  const d = JSON.parse(guard(JSON.stringify({ tool_name: 'AskUserQuestion', tool_input: {} }))).hookSpecificOutput;
  assert.equal(d.hookEventName, 'PreToolUse');
  assert.equal(d.permissionDecision, 'deny');
  assert.match(d.permissionDecisionReason, /prose/, 'the refusal names the replacement');
});

test('the guard is silent on anything else and never fails a turn', () => {
  for (const payload of ['not json', '{}', JSON.stringify({ tool_name: 'Bash' }),
                         JSON.stringify({ tool_name: 'mcp__x__AskUserQuestion' })]) {
    assert.equal(guard(payload), '', `silent on ${payload.slice(0, 30)}`);
  }
});

test('both hooks are registered once, through the plugin root', () => {
  const find = (event, file) => (HOOKS[event] || []).filter(e => e.hooks.some(h => h.command.includes(file)));
  const g = find('PreToolUse', 'ask-question-guard.sh');
  assert.equal(g.length, 1);
  assert.equal(g[0].matcher, 'AskUserQuestion');
  const r = find('SessionStart', 'refresh-plugin.sh');
  assert.equal(r.length, 1, 'its own entry, so the per-entry output cap is its own');
  assert.equal(r[0].hooks.length, 1);
  assert.equal(r[0].matcher, 'startup|resume', 'resume too: an expired session reopens in a fresh container');
  for (const e of [...g, ...r]) assert.match(e.hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}/);
});

// The refresher drives the claude CLI. A stub on PATH records the calls and
// moves the pin the way a real update would, so the one printed line is tested
// against the file it reads.
test('the refresher updates the plugin, reports a moved pin, and removes retired plugins', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'refresh-plugin-'));
  try {
    const bin = path.join(tmp, 'bin');
    const home = path.join(tmp, 'home');
    mkdirSync(bin);
    mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
    const pins = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
    const write = (v) => writeFileSync(pins, JSON.stringify({ plugins: {
      'portable@web-tools': [{ scope: 'user', version: v }],
      'daisy-alpine@web-tools': [{ scope: 'user', version: 'old' }],
    } }));
    write('aaa');
    const calls = path.join(tmp, 'calls');
    writeFileSync(path.join(bin, 'claude'), `#!/bin/bash
echo "$*" >> ${JSON.stringify(calls)}
case "$*" in
  "plugin update --scope user portable@web-tools")
    python3 -c 'import json,sys; p=sys.argv[1]; d=json.load(open(p)); d["plugins"]["portable@web-tools"][0]["version"]="bbb"; json.dump(d,open(p,"w"))' ${JSON.stringify(pins)} ;;
esac
exit 0
`);
    chmodSync(path.join(bin, 'claude'), 0o755);
    const out = execFileSync('bash', [REFRESH], {
      input: '', encoding: 'utf8',
      env: { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}` },
    });
    assert.match(out, /portable@web-tools refreshed aaa to bbb/);
    assert.match(out, /daisy-alpine@web-tools uninstalled/);
    const log = readFileSync(calls, 'utf8');
    assert.match(log, /plugin marketplace update web-tools/);
    assert.match(log, /plugin uninstall --scope user daisy-alpine@web-tools/);
    assert.doesNotMatch(log, /google-style-clarity/, 'a plugin that is not installed is left alone');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('the refresher exits quietly where there is no claude CLI', () => {
  const out = execFileSync('bash', [REFRESH], {
    input: '', encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin' },
  });
  assert.equal(out.trim(), '');
});
