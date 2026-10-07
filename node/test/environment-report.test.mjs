// .claude/environment-setup.sh and skills/hooks/environment-report.sh: the
// environment's setup script, fetched and run by a single curl line in
// claude.ai's environment settings, and the startup hook that reports which
// version of it built the container. The script's own contract (it records
// itself to ~/.claude/environment-setup.ran) is held by reading it; running it
// would install a plugin. The hook is run against a temporary HOME.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const SCRIPT = path.join(repoRoot, '.claude/environment-setup.sh');
const HOOK = path.join(repoRoot, 'skills/hooks/environment-report.sh');
const HOOKS = JSON.parse(readFileSync(path.join(repoRoot, 'skills/hooks/hooks.json'), 'utf8')).hooks;
const body = readFileSync(SCRIPT, 'utf8');

function withHome(fn) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'env-report-'));
  try { return fn(home); } finally { rmSync(home, { recursive: true, force: true }); }
}
const run = (home) => execFileSync('bash', [HOOK], { input: '{}', encoding: 'utf8', env: { ...process.env, HOME: home } }).trim();
const writeRan = (home, text) => {
  mkdirSync(path.join(home, '.claude'), { recursive: true });
  writeFileSync(path.join(home, '.claude', 'environment-setup.ran'),
    '# ran 2026-09-29T12:00:00Z\n# commit abcdef1234567890\n' + text);
};
const writeCurrent = (home, text) => {
  const dir = path.join(home, '.claude', 'plugins', 'marketplaces', 'web-tools', '.claude');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'environment-setup.sh'), text);
};

test('the setup script installs the plugin and records itself where the hook reads it', () => {
  assert.match(body, /claude plugin install -s user portable@web-tools/);
  assert.match(body, /~\/\.claude\/environment-setup\.ran/);
  assert.match(body, /\.claude\/environment-setup\.sh/, 'it fetches its own path, so the record is its own text');
});

test('the hook is silent when no setup record exists', () => {
  withHome(home => assert.equal(run(home), ''));
});

test('the hook reports the build, and stays at one line while the script is unchanged', () => {
  withHome(home => {
    writeRan(home, body);
    writeCurrent(home, body);
    assert.equal(run(home), 'Environment built 2026-09-29T12:00:00Z from .claude/environment-setup.sh at abcdef1.');
  });
});

test('the hook says to rebuild when the script on main has moved since the build', () => {
  withHome(home => {
    writeRan(home, body);
    writeCurrent(home, body + '# a later change\n');
    const out = run(home).split('\n');
    assert.equal(out.length, 2);
    assert.match(out[1], /changed since; edit the environment settings to rebuild/);
  });
});

test('the hook is registered once at session start, in its own entry', () => {
  const e = (HOOKS.SessionStart || []).filter(x => x.hooks.some(h => h.command.includes('environment-report.sh')));
  assert.equal(e.length, 1);
  assert.equal(e[0].hooks.length, 1);
  assert.equal(e[0].matcher, 'startup|resume');
  assert.match(e[0].hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}/);
});
