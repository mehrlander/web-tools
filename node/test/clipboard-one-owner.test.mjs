// ONE OWNER FOR THE CLIPBOARD WRITE, held here because the duplication came
// back by copy-paste rather than by decision. Four kits carried the same
// textarea fallback: chat-render and vanilla-demo byte-identical, session-export
// the same idea returning a boolean, md-doc already delegating. The block is not
// boilerplate but the iOS recipe kits/io.js documents at length, so four copies
// were four places for it to drift, and three had already drifted on what they
// returned.
//
// The gate is deliberately about the FALLBACK, not about `navigator.clipboard`:
// a kit may reach the modern API directly as its no-io.js degradation, and the
// delegates do exactly that. What no kit may re-implement is the legacy path.
//
// THE RECIPE MOVED DOWN A LAYER on 2026-10-20, to vanilla-bundle.js as
// window.copy.legacy. Outside the kits the same textarea write had four more
// copies (window.copy's own fallback, the Alpine $clip magic, the transform
// workbench, and the shorter and chat-results pages), and io.js could not be
// their owner: it is fetched by the kits that copy, while vanilla-bundle loads
// first on every page. io.copy keeps the focus wait and the modern API, and
// falls back through window.copy.legacy like everything else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { getEventListeners } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const KITS = 'lib/kits';

const ALLOWED = new Set([
  // The owner.
  'lib/vanilla-bundle.js',
  // annotate.js's exception is earned: the card mounts into ARBITRARY
  // documents, including a page running inside a toss frame, so its fallback
  // selects into `S.doc` rather than the top-level `document`, and marks its
  // textarea so its own observer ignores it.
  'lib/kits/annotate.js',
  // A drop page that loads no library.
  'pages/drop/live-docs-concept.html',
]);

test('only vanilla-bundle.js (and the annotator) implement the legacy clipboard write', () => {
  const files = execFileSync('git', ['ls-files', 'lib', 'pages', 'app', 'popups'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(js|html)$/.test(f) && !f.startsWith('pages/scratch/') && !ALLOWED.has(f));
  const offenders = files.filter((f) => /execCommand\(\s*['"]copy['"]\s*\)/.test(readFileSync(join(repoRoot, f), 'utf8')));
  assert.deepEqual(offenders, [],
    'these re-implement the legacy copy; delegate to window.copy.legacy (or io.copy) instead');
});

test('every kit that copies delegates to io.copy and fetches it at load time', () => {
  // Fetched when the kit loads, never inside the click: a write has to run in
  // the gesture that asked for it, and an await before it can spend the user
  // activation Safari counts.
  // session-export.js was here and is not: it stopped copying on 2026-09-06,
  // so the delegate and the load-time fetch went with the button. A kit that
  // does not copy is not exempt from this rule, it is outside it.
  const consumers = ['chat-render.js', 'vanilla-demo.js', 'md-doc.js', 'row-menu.js', 'json-explorer.js'];
  for (const name of consumers) {
    const src = readFileSync(join(KITS, name), 'utf8');
    assert.match(src, /window\.io\.copy\(text\)/, name + ' delegates the write');
    assert.match(src, /ghRef\.load\('kits\/io\.js'\)/, name + ' fetches io.js at load time');
    assert.doesNotMatch(src, /ghRef\.load\('kits\/io\.js'\)[\s\S]{0,80}await/,
      name + ' does not await io.js inside a handler');
  }
});

test('a kit that does not copy carries no clipboard machinery', () => {
  // The list above is a membership claim in one direction only. This is the
  // other: session-export draws the session outline and has no copy control, so
  // an io.js fetch sitting in it would be a load nothing spends.
  const src = readFileSync(join(KITS, 'session-export.js'), 'utf8');
  assert.doesNotMatch(src, /window\.io\.copy/, 'no clipboard delegate');
  assert.doesNotMatch(src, /kits\/io\.js/, 'and nothing fetches io.js for it');
});

const IO_SOURCE = readFileSync(join(repoRoot, KITS, 'io.js'), 'utf8');

function clipboardPage({ focused = false, secure = true, clipboard = {}, copyResult = true,
                         pasteText = '', pasteError } = {}) {
  const timers = [], textareas = [], copies = [], listenerErrors = [];
  let inClick = false;
  class ClipboardDocument extends EventTarget {
    hasFocus() { return focused; }
    // Catch returned listener promises so a broken deferred operation can be
    // observed as unsettled without also causing an unhandled rejection.
    addEventListener(type, listener, options) {
      super.addEventListener(type, event => {
        const result = listener(event);
        result?.catch?.(error => listenerErrors.push(error));
      }, options);
    }
    createElement(tag) {
      assert.equal(tag, 'textarea');
      const ta = { value: '', style: {}, setAttribute() {}, focus() {},
                   remove() { textareas.splice(textareas.indexOf(ta), 1); } };
      return ta;
    }
    execCommand(command) {
      assert.equal(command, 'paste');
      if (pasteError) throw pasteError;
      textareas.at(-1).value = pasteText;
      return false; // iOS can populate the textarea while returning false.
    }
  }
  const document = new ClipboardDocument();
  document.body = { appendChild: ta => textareas.push(ta) };
  const window = { isSecureContext: secure, copy: { legacy(text) {
    copies.push({ text, inClick });
    return copyResult;
  } } };
  new Function('window', 'document', 'navigator', 'AbortController', 'DOMException', 'setTimeout', 'console', IO_SOURCE)(
    window, document, { clipboard }, AbortController, DOMException,
    (run, ms) => timers.push({ run, ms }), { log() {}, error() {} });
  return {
    io: window.io, copies, textareas, listenerErrors,
    get inClick() { return inClick; },
    get clicks() { return getEventListeners(document, 'click').length; },
    focus() { focused = true; },
    click() {
      focused = true; inClick = true;
      try { document.dispatchEvent(new Event('click')); } finally { inClick = false; }
    },
    runTimers() {
      let count = 0;
      while (timers.length) {
        assert.ok(++count <= 4, 'the clipboard fallback schedules a bounded number of timers');
        timers.shift().run();
      }
    },
    clean() {
      assert.equal(getEventListeners(document, 'click').length, 0, 'no deferred click remains');
      assert.equal(timers.length, 0, 'no fallback timer remains');
      assert.equal(textareas.length, 0, 'the fallback textarea was removed');
      assert.deepEqual(listenerErrors, [], 'the click handler left no rejected promise behind');
    },
  };
}

function observe(promise) {
  const state = { status: 'pending' };
  promise.then(value => Object.assign(state, { status: 'fulfilled', value }),
               error => Object.assign(state, { status: 'rejected', error }));
  return state;
}

const microtasks = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };

test('a deferred modern copy returns success and starts writing in the click', async () => {
  const writes = [];
  const page = clipboardPage({ clipboard: { writeText: text => {
    writes.push({ text, inClick: page.inClick });
    return Promise.resolve();
  } } });
  const state = observe(page.io.copy('held text'));
  assert.deepEqual(writes, [], 'an unfocused call waits');
  assert.equal(page.clicks, 1);
  page.click();
  assert.deepEqual(writes, [{ text: 'held text', inClick: true }], 'writing starts before the click returns');
  await microtasks();
  assert.deepEqual(state, { status: 'fulfilled', value: true });
  page.clean();
});

for (const answer of [true, false]) {
  test('a deferred legacy copy returns ' + answer, async () => {
    const page = clipboardPage({ secure: false, copyResult: answer });
    const state = observe(page.io.copy('legacy text'));
    page.click();
    assert.deepEqual(page.copies, [{ text: 'legacy text', inClick: true }]);
    await microtasks();
    assert.deepEqual(state, { status: 'fulfilled', value: answer });
    page.clean();
  });
}

test('a deferred modern paste returns text and starts reading in the click', async () => {
  const reads = [];
  const page = clipboardPage({ clipboard: { readText: () => {
    reads.push(page.inClick);
    return Promise.resolve('clipboard text');
  } } });
  const state = observe(page.io.paste());
  assert.deepEqual(reads, []);
  page.click();
  assert.deepEqual(reads, [true], 'reading starts before the click returns');
  await microtasks();
  assert.deepEqual(state, { status: 'fulfilled', value: 'clipboard text' });
  page.clean();
});

for (const focused of [false, true]) {
  test('a newer ' + (focused ? 'focused' : 'unfocused') + ' copy settles the older caller and wins', async () => {
    const writes = [];
    const page = clipboardPage({ clipboard: { writeText: text => {
      writes.push(text);
      return Promise.resolve();
    } } });
    const older = observe(page.io.copy('older'));
    if (focused) page.focus();
    const newer = observe(page.io.copy('newer'));
    await microtasks();
    assert.deepEqual(older, { status: 'fulfilled', value: false });
    assert.equal(page.clicks, focused ? 0 : 1);
    page.click();
    await microtasks();
    assert.deepEqual(newer, { status: 'fulfilled', value: true });
    assert.deepEqual(writes, ['newer'], 'the stale copy cannot overwrite the newer text on a later click');
    page.click();
    assert.deepEqual(writes, ['newer'], 'the deferred write runs once');
    page.clean();
  });

  test('a newer ' + (focused ? 'focused' : 'unfocused') + ' paste cancels the older caller', async () => {
    let reads = 0;
    const page = clipboardPage({ clipboard: { readText: () => {
      reads++;
      return Promise.resolve('latest text');
    } } });
    const older = observe(page.io.paste());
    if (focused) page.focus();
    const newer = observe(page.io.paste());
    await microtasks();
    assert.equal(older.status, 'rejected');
    assert.equal(older.error.name, 'AbortError', 'supersession is cancellation, not empty clipboard text');
    assert.equal(page.clicks, focused ? 0 : 1);
    page.click();
    await microtasks();
    assert.deepEqual(newer, { status: 'fulfilled', value: 'latest text' });
    assert.equal(reads, 1, 'only the latest request reads');
    page.click();
    assert.equal(reads, 1);
    page.clean();
  });
}

for (const method of ['paste', 'pasteItems']) {
  test('a rich clipboard read cancels an older ' + method + ' focus wait', async () => {
    let textReads = 0, richReads = 0;
    const clipboard = { readText: async () => { textReads++; return 'stale text'; } };
    const page = clipboardPage({ clipboard });
    const older = observe(page.io[method]());
    assert.equal(page.clicks, 1, 'the older read is waiting for focus');
    const html = '<p>new clipboard text</p>';
    clipboard.read = async () => {
      richReads++;
      return [{ types: ['text/html'], getType: async () => new Blob([html], { type: 'text/html' }) }];
    };
    const latest = await page.io.pasteItems();
    await microtasks();
    assert.equal(older.status, 'rejected');
    assert.equal(older.error.name, 'AbortError');
    assert.deepEqual(latest, [{ kind: 'text', type: 'text/html', text: html, size: html.length }]);
    assert.equal(richReads, 1);
    assert.equal(page.clicks, 0, 'the rich read removes the older text-read listener');
    page.click();
    await microtasks();
    assert.equal(textReads, 0, 'a later click cannot run the superseded read');
    assert.equal(richReads, 1);
    page.clean();
  });
}

test('a deferred paste rejects when modern and legacy reads cannot supply text', async () => {
  const page = clipboardPage({ clipboard: { readText: async () => { throw new Error('Permission denied'); } } });
  const state = observe(page.io.paste());
  page.click();
  await microtasks();
  assert.equal(page.textareas.length, 1, 'a refused modern read reaches the legacy fallback');
  page.runTimers();
  await microtasks();
  assert.equal(state.status, 'rejected', 'the waiting caller settles instead of hanging');
  assert.match(state.error.message, /Paste unavailable/);
  page.clean();
});

test('a deferred legacy paste reads the textarea even when execCommand returns false', async () => {
  const page = clipboardPage({ secure: false, pasteText: 'iOS pasted text' });
  const state = observe(page.io.paste());
  page.click();
  page.runTimers();
  await microtasks();
  assert.deepEqual(state, { status: 'fulfilled', value: 'iOS pasted text' });
  page.clean();
});

for (const focused of [false, true]) {
  test('a throwing legacy paste cleans up and rejects its ' + (focused ? 'focused' : 'deferred') + ' caller', async () => {
    const error = new Error('Paste command blocked');
    const page = clipboardPage({ focused, secure: false, pasteError: error });
    const state = observe(page.io.paste());
    if (!focused) page.click();
    assert.doesNotThrow(() => page.runTimers(), 'the timer routes the error to the clipboard caller');
    await microtasks();
    assert.equal(state.status, 'rejected');
    assert.equal(state.error, error);
    page.clean();
  });
}
