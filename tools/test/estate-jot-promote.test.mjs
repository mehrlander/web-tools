// alpineComponents/estate.js — moving a jot to the to-do list. The interesting
// half is not the happy path but the ORDER: this is two registry files and two
// writes with no transaction across them, so one can land alone. Written to-do
// first, the survivable failure is a duplicate the reader can see and clear;
// reversed, the same failure deletes the jot and writes nothing. These pin that
// order down, since nothing about the code's appearance would preserve it.
// Driven over a fake GH and a stubbed shell; no network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const REGISTRY = 'me/registry';

let FILES = {};
let SAVES = [];
let FAIL = new Set();   // paths whose save throws, for the half-landed cases

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
  async save(path, value, message) {
    if (FAIL.has(path)) throw new Error('save refused: ' + path);
    SAVES.push({ path, value, message });
    FILES[path] = JSON.parse(JSON.stringify(value));   // the registry now holds it
    return {};
  }
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
const reg = () => new FakeGH({ repo: REGISTRY });

async function seed({ jots = [], todos = [] } = {}) {
  FAIL = new Set();
  FILES = { 'lists/jots.json': { items: jots }, 'lists/todo.json': { items: todos } };
  await data.loadJots(reg());
  await data.loadTodos(reg());
  SAVES = [];
}

const JOT = { id: 'j1', text: 'the combine route serves CJS for alpinejs',
              kind: 'snag', created_at: '2026-08-20T10:00:00Z' };

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

test('a promoted jot arrives as a to-do and leaves the pile', async () => {
  await seed({ jots: [{ ...JOT }] });
  await data.promoteJot(data.jotItems[0]);

  const todos = FILES['lists/todo.json'].items;
  assert.equal(todos.length, 1);
  assert.equal(todos[0].text, 'the combine route serves CJS for alpinejs');
  assert.equal(todos[0].done, false);
  assert.equal(FILES['lists/jots.json'].items.length, 0, 'the jot is gone from the pile');
  assert.equal(data.jotItems.length, 0, 'and gone from the pane');
});

test('the to-do is written BEFORE the jot is removed', async () => {
  await seed({ jots: [{ ...JOT }] });
  await data.promoteJot(data.jotItems[0]);

  assert.deepEqual(Array.from(SAVES, s => s.path), ['lists/todo.json', 'lists/jots.json'],
    'to-do first: a half-landed promotion must duplicate, never delete');
});

test('the kind rides in the commit message and not into the to-do item', async () => {
  await seed({ jots: [{ ...JOT }] });
  await data.promoteJot(data.jotItems[0]);

  const todo = FILES['lists/todo.json'].items[0];
  assert.equal('kind' in todo, false, "a to-do's schema stays the smallest thing that works");
  assert.match(SAVES[0].message, /\[snag\]/, 'the kind is kept where the capture log is read');
  assert.match(SAVES[0].message, /Promote jot/);
});

test('a jot with no kind promotes just the same, with no empty bracket in the message', async () => {
  await seed({ jots: [{ id: 'j2', text: 'a bare idea', created_at: '2026-09-01T10:00:00Z' }] });
  await data.promoteJot(data.jotItems[0]);

  assert.equal(FILES['lists/todo.json'].items[0].text, 'a bare idea');
  assert.doesNotMatch(SAVES[0].message, /\[\]/);
});

test('promotion appends; it does not disturb the to-dos already there', async () => {
  await seed({
    jots: [{ ...JOT }],
    todos: [{ id: 't1', text: 'already here', done: false, urgent: true, created_at: '2026-09-01T10:00:00Z' }],
  });
  await data.promoteJot(data.jotItems[0]);

  const todos = FILES['lists/todo.json'].items;
  assert.equal(todos.length, 2);
  assert.equal(todos[0].text, 'already here');
  assert.equal(todos[0].urgent, true, 'the existing row round-tripped untouched');
});

// ── The half-landed cases, which are the reason for the order ────────────────

test('a refused to-do write leaves the jot alone and adds no to-do anywhere', async () => {
  await seed({ jots: [{ ...JOT }] });
  FAIL.add('lists/todo.json');

  await data.promoteJot(data.jotItems[0]);

  assert.equal(SAVES.length, 0, 'nothing was written at all');
  assert.equal(data.jotItems.length, 1, 'the jot is still in the pile, so nothing was lost');
  assert.equal(data.todoItems.length, 0,
    'and the local push was rolled back, so the pane shows no to-do that is not on disk');
});

test('a refused jot write leaves a visible duplicate, which is the survivable failure', async () => {
  await seed({ jots: [{ ...JOT }] });
  FAIL.add('lists/jots.json');

  await data.promoteJot(data.jotItems[0]);

  assert.equal(FILES['lists/todo.json'].items.length, 1, 'the to-do landed');
  assert.equal(data.jotItems.length, 1,
    'and the jot stayed, so the reader sees both and clears one rather than losing the text');
});

test('an empty or whitespace jot promotes nothing', async () => {
  await seed({ jots: [{ id: 'j3', text: '   ', created_at: '2026-09-01T10:00:00Z' }] });
  await data.promoteJot(data.jotItems[0]);
  assert.equal(SAVES.length, 0);
  assert.equal(data.jotItems.length, 1);
});

test('saveTodos reports whether the write landed, which is what promoteJot reads', async () => {
  await seed({ todos: [] });
  assert.equal(await data.saveTodos('a message'), true);
  FAIL.add('lists/todo.json');
  assert.equal(await data.saveTodos('a message'), false);
});
