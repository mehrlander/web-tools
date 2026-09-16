// alpineComponents/estate.js — checking a to-do off is deliberate, and visible.
//
// Both halves are regressions waiting to happen, because both are absences. The
// row used to be a <label> wrapping its checkbox, so a click anywhere on it
// marked the item done; since a checked item leaves the open list for a done
// pile that is collapsed by default, the row a reader clicked simply vanished
// and nothing said where to. The fix is a row that is not a label plus a pile
// that opens itself on the way in. Nothing about either is self-evident from
// reading the markup later, so it is pinned here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const REGISTRY = 'me/registry';

let FILES = {};
let SAVES = [];

class FakeGH {
  static FRESH = { cache: 'no-store' };
  constructor(c = {}) { this.repo = c.repo || ''; this.ref = c.ref || 'main'; }
  ago() { return 'recently'; }
  async repos() { return []; }
  async ls() { return []; }
  async get(name) {
    if (this.repo === REGISTRY && FILES[name]) return { text: JSON.stringify(FILES[name]) };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req(path) {
    if (typeof path === 'string' && path.startsWith('/repos/'))
      return { default_branch: 'main', description: '', private: true, pushed_at: '' };
    return {};
  }
  async save(path, value, message) { SAVES.push({ path, value, message }); return {}; }
}

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="es" x-data="estate()"></div>
  </body></html>`,
});
window.TOKEN = 'tkn';
window.GH = FakeGH;
window.__shell = {
  REGISTRY_REPO: REGISTRY,
  DEFAULT_REPO: 'me/tools',
  quickLinks: [],
  hasToken: () => true,
  _authState: 'auth',
  refreshConfigCache() {},
  refreshActivity() {},
};

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/surface.js',
  'lib/alpineComponents/estate.js',
]);

const data = Alpine.$data(window.document.getElementById('es'));
const doc = window.document;
const reg = () => new FakeGH({ repo: REGISTRY });
const settle = async () => { await Alpine.nextTick(); await new Promise(r => setTimeout(r, 30)); };

const todoRows = () => [...doc.querySelectorAll('div')].filter(
  el => el.querySelector(':scope > label > input[type="checkbox"].checkbox'));
const rowFor = (text) => todoRows().find(el => el.textContent.includes(text));

async function seed(items) {
  FILES['lists/todo.json'] = { items };
  await data.loadTodos(reg());
  data.todoShowDone = false;
  window.__shell.view = 'todo';
  SAVES = [];
  await settle();
}

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

// ── Deliberate ───────────────────────────────────────────────────────────────

test('the row is not a label, so no click on it can reach the checkbox', async () => {
  await seed([{ id: 't1', text: 'do not vanish', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  const row = rowFor('do not vanish');
  assert.ok(row, 'the row rendered');
  assert.equal(row.tagName, 'DIV',
    'a LABEL here means any click on the row checks the item off again');
});

test('only the checkbox carries a label, and it wraps nothing else', async () => {
  await seed([{ id: 't1', text: 'do not vanish', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  const row = rowFor('do not vanish');
  const labels = [...row.querySelectorAll('label')];
  assert.equal(labels.length, 1, 'exactly one label in the row');
  assert.ok(labels[0].querySelector('input[type="checkbox"]'), 'and it is the checkbox that has it');
  assert.equal(labels[0].textContent.trim(), '',
    'the label holds no text, so no words on the row are a check-off target');
});

test("clicking the row's text leaves the item open and writes nothing", async () => {
  await seed([{ id: 't1', text: 'do not vanish', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  const row = rowFor('do not vanish');
  const label = [...row.querySelectorAll('span')].find(el => el.textContent === 'do not vanish');

  label.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await settle();

  assert.equal(data.todoItems[0].done, false, 'still open');
  assert.equal(SAVES.length, 0, 'and nothing was written');
});

// ── Visible ──────────────────────────────────────────────────────────────────

test('checking off opens the done pile, so the item is seen to land', async () => {
  await seed([{ id: 't1', text: 'watch me land', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  assert.equal(data.todoShowDone, false, 'the pile starts collapsed');

  await data.toggleTodo(data.todoItems[0]);

  assert.equal(data.todoItems[0].done, true);
  assert.equal(data.todoShowDone, true,
    'the pile opened, so the row moved in view rather than vanishing');
  assert.equal(data.todoOpen.length, 0);
  assert.equal(data.todoDone.length, 1, 'and the checkbox that reverses it is now on screen');
});

test('the reversal is the same gesture, and it does not slam the pile shut', async () => {
  await seed([{ id: 't1', text: 'there and back', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  await data.toggleTodo(data.todoItems[0]);
  await data.toggleTodo(data.todoItems[0]);

  assert.equal(data.todoItems[0].done, false, 'reopened');
  assert.equal(data.todoItems[0].done_at, null);
  assert.equal(data.todoShowDone, true,
    'the disclosure stays where the reader left it; only checking off ever opens it');
  assert.equal(data.todoOpen.length, 1, 'and the item is back in the open list');
});

test('a check-off still records both sides in the commit message', async () => {
  await seed([{ id: 't1', text: 'a real item', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  await data.toggleTodo(data.todoItems[0]);
  assert.match(SAVES.at(-1).message, /Check off "a real item"/);
  await data.toggleTodo(data.todoItems[0]);
  assert.match(SAVES.at(-1).message, /Reopen "a real item"/);
});
