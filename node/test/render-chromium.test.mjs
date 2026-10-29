// node/render/chromium.mjs: a render tool's launch falls back to the image's
// browser only when the pinned Playwright build is missing. On 2026-10-25 the
// sandbox image shipped Chromium build 1243 while package.json's playwright
// wanted 1194, and every npm run shot failed with "Executable doesn't exist".
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { imageBrowser, launch } from '../render/chromium.mjs';

const browsers = mkdtempSync(path.join(tmpdir(), 'pw-browsers-'));
writeFileSync(path.join(browsers, 'chromium'), '');
const env = { PLAYWRIGHT_BROWSERS_PATH: browsers };

// A browser type whose pinned build is missing until an executablePath is given.
const missingPin = () => {
  const calls = [];
  return { calls, async launch(o) {
    calls.push(o);
    if (!o.executablePath) throw new Error("browserType.launch: Executable doesn't exist at /x/chromium_headless_shell-1194");
    return { launched: o.executablePath };
  } };
};

test('a missing pinned build launches the image browser, keeping the caller options', async () => {
  const bt = missingPin(), notes = [];
  const b = await launch({ args: ['--no-sandbox'] }, { browserType: bt, env, log: m => notes.push(m) });
  assert.equal(b.launched, path.join(browsers, 'chromium'));
  assert.deepEqual(bt.calls[1], { args: ['--no-sandbox'], executablePath: path.join(browsers, 'chromium') });
  assert.match(notes[0], /pinned Playwright build is not installed/);
});

test('an installed pinned build, another error, or no image browser leaves the launch alone', async () => {
  const ok = { async launch(o) { return { o }; } };
  assert.deepEqual((await launch({ a: 1 }, { browserType: ok, env })).o, { a: 1 });

  const other = { async launch() { throw new Error('Target page, context or browser has been closed'); } };
  await assert.rejects(launch({}, { browserType: other, env, log() {} }), /has been closed/);

  await assert.rejects(launch({}, { browserType: missingPin(), env: {}, log() {} }), /Executable doesn't exist/);
  assert.equal(imageBrowser({}), null);
  assert.equal(imageBrowser({ PLAYWRIGHT_BROWSERS_PATH: path.join(browsers, 'absent') }), null);
});
