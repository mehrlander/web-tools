// The shell answers nothing on load. It used to fulfil the mailbox's read kinds
// on every page load, with an allowlist guarding the kinds it could not serve;
// the first real ask was eaten on 2026-08-13 before that allowlist existed.
// Since 2026-09-24 a read a session files is an errand like any other, and it
// waits on the Stage for a tap (lib/kits/errands.js), so the whole class of
// "answered before anyone saw it" is closed by there being no loop at all.
//
// What breaks without this: a boot-time loop coming back, spending the token on
// records a session wrote straight to the registry's main, with nobody watching.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { makeShell } from './shell.mjs';

const html = readFileSync(path.join(repoRoot, 'app/index.html'), 'utf8');

test('the shell has no mailbox loop, and fulfils nothing', () => {
  const { shell } = makeShell({ win: {} });
  assert.equal(shell.processMailbox, undefined, 'no boot-time fulfilment');
  assert.doesNotMatch(html, /\.fulfill\(/, 'nothing in the shell answers a request');
});

test('the errands kit is loaded, after the mailbox kit whose read it calls', () => {
  const mailbox = html.indexOf("gh.load('kits/repo-mailbox.js')");
  const errands = html.indexOf("gh.load('kits/errands.js')");
  assert.ok(mailbox > -1 && errands > mailbox);
});
