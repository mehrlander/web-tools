// The shell answers nothing on load. A read a session files is an errand, and
// it waits on the Stage for a tap like every other (lib/kits/errands.js), so no
// record is answered before a person has seen it.
//
// What breaks without this: a boot-time loop spending the token on records a
// session wrote straight to the registry's main, with nobody watching.

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
