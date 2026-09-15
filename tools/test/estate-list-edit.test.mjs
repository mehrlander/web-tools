// alpineComponents/estate.js — editing a Lists item in place. Every row in that
// view could be added and deleted and nothing else until 2026-09-15, so these
// cover the commits that close the gap and, more importantly, the three shared
// rules a reader is entitled to rely on across all three lists: an empty draft
// cancels rather than deletes, an unchanged draft writes nothing at all, and an
// optional field that is cleared is DELETED from the item rather than stored
// empty. Driven over a fake GH and a stubbed shell; no network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const REGISTRY = 'me/registry';

let FILES = {};
let SAVES = [];

class FakeGH {
  static FRESH = { cache: 'no-store' };
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
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
const reg = () => new FakeGH({ repo: REGISTRY });
const saved = (path) => SAVES.filter(s => s.path === path).at(-1)?.value;

async function seedTodos(items) {
  FILES['lists/todo.json'] = { items };
  await data.loadTodos(reg());
  SAVES = [];
}
async function seedJots(items) {
  FILES['lists/jots.json'] = { items };
  await data.loadJots(reg());
  SAVES = [];
}
async function seedPins(items) {
  FILES['lists/pins.json'] = { items };
  await data.loadPins(reg());
  SAVES = [];
}

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

// ── One slot, shared ─────────────────────────────────────────────────────────

test('one editId serves all three lists, so opening an edit closes the other', async () => {
  await seedJots([{ id: 'j1', text: 'an idea', created_at: '2026-09-01T10:00:00Z' }]);
  await seedPins([{ id: 'p1', target: 'me/tools:docs/a.md', title: 'A', created_at: '2026-09-01T10:00:00Z' }]);

  data.startJotEdit(data.jotItems[0]);
  assert.equal(data.editId, 'j1');
  data.startPinEdit(data.pinItems[0]);
  assert.equal(data.editId, 'p1', 'the jot edit closed when the pin edit opened');
});

// ── To-do ────────────────────────────────────────────────────────────────────

test('commitTodoEdit rewrites the text and names both sides in the commit message', async () => {
  await seedTodos([{ id: 't1', text: 'Re-date the enviroment notes', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  const it = data.todoItems[0];

  data.startTodoEdit(it);
  assert.equal(data.editDraft, 'Re-date the enviroment notes', 'the draft opens on the current text');
  data.editDraft = 'Re-date the environment notes';
  await data.commitTodoEdit(it);

  assert.equal(data.editId, null, 'the slot closes on commit');
  assert.equal(saved('lists/todo.json').items[0].text, 'Re-date the environment notes');
  const msg = SAVES.at(-1).message;
  assert.match(msg, /enviroment/, 'the old text says which item moved');
  assert.match(msg, /environment notes/, 'the new text says what it became');
});

test('an empty draft cancels the edit; it never deletes the item', async () => {
  await seedTodos([{ id: 't1', text: 'keep me', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  const it = data.todoItems[0];

  data.startTodoEdit(it);
  data.editDraft = '   ';
  await data.commitTodoEdit(it);

  assert.equal(SAVES.length, 0, 'nothing was written');
  assert.equal(data.todoItems.length, 1, 'the item is still here');
  assert.equal(data.todoItems[0].text, 'keep me', 'and unchanged');
  assert.equal(data.editId, null);
});

test('an unchanged draft writes nothing, so an opened-and-closed edit leaves no commit', async () => {
  await seedTodos([{ id: 't1', text: 'as it was', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  const it = data.todoItems[0];

  data.startTodoEdit(it);
  await data.commitTodoEdit(it);
  assert.equal(SAVES.length, 0);

  // Whitespace either side is not a change either.
  data.startTodoEdit(it);
  data.editDraft = '  as it was  ';
  await data.commitTodoEdit(it);
  assert.equal(SAVES.length, 0);
});

test('cancelEdit leaves the item untouched however far the draft got', async () => {
  await seedTodos([{ id: 't1', text: 'original', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  const it = data.todoItems[0];

  data.startTodoEdit(it);
  data.editDraft = 'half-typed replacement';
  data.cancelEdit();

  assert.equal(data.editId, null);
  assert.equal(data.todoItems[0].text, 'original');
  assert.equal(SAVES.length, 0);
});

test('a commit landing on an already-closed slot is a no-op', async () => {
  await seedTodos([{ id: 't1', text: 'one write only', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  const it = data.todoItems[0];

  data.startTodoEdit(it);
  data.editDraft = 'edited once';
  await data.commitTodoEdit(it);
  assert.equal(SAVES.length, 1);

  await data.commitTodoEdit(it);   // the check, tapped after Enter already saved
  assert.equal(SAVES.length, 1, 'the second event wrote nothing');
});

// ── Jot ──────────────────────────────────────────────────────────────────────

test('commitJotEdit rewrites text and kind together, slugging the kind through KIND', async () => {
  await seedJots([{ id: 'j1', text: 'combine serves cjs', created_at: '2026-09-01T10:00:00Z' }]);
  const it = data.jotItems[0];

  data.startJotEdit(it);
  data.editDraft = 'the combine route serves CJS for alpinejs';
  data.editNote = 'Doc Failure';
  await data.commitJotEdit(it);

  const item = saved('lists/jots.json').items[0];
  assert.equal(item.text, 'the combine route serves CJS for alpinejs');
  assert.equal(item.kind, 'doc-failure', 'lowercased and hyphenated, as the add form would have');
});

test('clearing a jot kind DELETES the key rather than storing an empty one', async () => {
  await seedJots([{ id: 'j1', text: 'an idea', kind: 'snag', created_at: '2026-09-01T10:00:00Z' }]);
  const it = data.jotItems[0];

  data.startJotEdit(it);
  assert.equal(data.editNote, 'snag', 'the draft opens on the current kind');
  data.editNote = '';
  await data.commitJotEdit(it);

  const item = saved('lists/jots.json').items[0];
  assert.equal('kind' in item, false,
    'a jot whose kind was cleared must read identically to one that never had a kind');
  assert.equal(item.text, 'an idea');
});

test('changing only the kind is a change, and changing neither is not', async () => {
  await seedJots([{ id: 'j1', text: 'an idea', kind: 'snag', created_at: '2026-09-01T10:00:00Z' }]);
  const it = data.jotItems[0];

  data.startJotEdit(it);
  await data.commitJotEdit(it);
  assert.equal(SAVES.length, 0, 'nothing touched, nothing written');

  data.startJotEdit(it);
  data.editNote = 'idea';
  await data.commitJotEdit(it);
  assert.equal(saved('lists/jots.json').items[0].kind, 'idea');
});

test('editing one jot leaves every other jot in the file alone', async () => {
  await seedJots([
    { id: 'j1', text: 'first', created_at: '2026-09-01T10:00:00Z' },
    { id: 'j2', text: 'second', kind: 'snag', created_at: '2026-09-02T10:00:00Z' },
    { id: 'j3', text: 'third', created_at: '2026-09-03T10:00:00Z' },
  ]);
  const it = data.jotItems[1];

  data.startJotEdit(it);
  data.editDraft = 'second, corrected';
  await data.commitJotEdit(it);

  const items = saved('lists/jots.json').items;
  assert.equal(items.length, 3);
  // Array.from rebuilds the list in THIS realm. items comes back through the
  // jsdom window, so its prototype is that realm's Array and deepStrictEqual
  // rejects it on the prototype check alone, with the contents identical.
  assert.deepEqual(Array.from(items, i => i.text), ['first', 'second, corrected', 'third']);
  assert.equal(items[1].kind, 'snag', 'the untouched field survived the rewrite');
});

// ── Pin ──────────────────────────────────────────────────────────────────────

test('commitPinEdit writes the three authored fields, note and group included', async () => {
  await seedPins([{ id: 'p1', target: 'me/tools:docs/showing.md', title: 'showing.md',
                    created_at: '2026-09-01T10:00:00Z' }]);
  const it = data.pinItems[0];

  data.startPinEdit(it);
  data.editDraft = 'Showing: which link shows what';
  data.editNote = 'the frame and the record';
  data.editGroup = 'docs';
  await data.commitPinEdit(it);

  const item = saved('lists/pins.json').items[0];
  assert.equal(item.title, 'Showing: which link shows what');
  assert.equal(item.note, 'the frame and the record');
  assert.equal(item.group, 'docs');
});

test('a pin edit never re-aims the pin: target survives untouched', async () => {
  await seedPins([{ id: 'p1', target: 'me/tools@main:docs/showing.md', title: 'old',
                    created_at: '2026-09-01T10:00:00Z' }]);
  const it = data.pinItems[0];

  data.startPinEdit(it);
  data.editDraft = 'new title';
  await data.commitPinEdit(it);

  assert.equal(saved('lists/pins.json').items[0].target, 'me/tools@main:docs/showing.md');
});

test('clearing a pin note or group DELETES the key, matching the jot kind rule', async () => {
  await seedPins([{ id: 'p1', target: 'me/tools:docs/a.md', title: 'A',
                    note: 'a note', group: 'docs', created_at: '2026-09-01T10:00:00Z' }]);
  const it = data.pinItems[0];

  data.startPinEdit(it);
  assert.equal(data.editNote, 'a note');
  assert.equal(data.editGroup, 'docs');
  data.editNote = '';
  data.editGroup = '';
  await data.commitPinEdit(it);

  const item = saved('lists/pins.json').items[0];
  assert.equal('note' in item, false);
  assert.equal('group' in item, false);
  assert.equal(item.title, 'A', 'the required field is untouched');
});

test('an empty pin title cancels rather than falling back to the raw address', async () => {
  await seedPins([{ id: 'p1', target: 'me/tools:docs/a.md', title: 'A readable title',
                    created_at: '2026-09-01T10:00:00Z' }]);
  const it = data.pinItems[0];

  data.startPinEdit(it);
  data.editDraft = '  ';
  await data.commitPinEdit(it);

  assert.equal(SAVES.length, 0);
  assert.equal(data.pinItems[0].title, 'A readable title');
});

test('a pin edit that changes nothing writes nothing', async () => {
  await seedPins([{ id: 'p1', target: 'me/tools:docs/a.md', title: 'A', note: 'n', group: 'g',
                    created_at: '2026-09-01T10:00:00Z' }]);
  const it = data.pinItems[0];

  data.startPinEdit(it);
  await data.commitPinEdit(it);
  assert.equal(SAVES.length, 0);
});

// ── The markup, not just the logic ───────────────────────────────────────────
// estate() writes its own template into its host element (this.$el.innerHTML =
// this.template), so the rows are real DOM here and Alpine drives them. These
// cover what a screenshot of a hand-built harness cannot prove: that the field
// actually swaps in, that the row's other controls stand down while it is open,
// and that only ONE row opens at a time.

const doc = window.document;
// A to-do row is a DIV holding a label that holds the checkbox. It was a label
// wrapping the whole row until 2026-09-15, when a click anywhere on it checked
// the item off; see estate-todo-checkoff.test.mjs for why that changed.
const todoRows = () => [...doc.querySelectorAll('div')].filter(
  el => el.querySelector(':scope > label > input[type="checkbox"].checkbox'));
// The edit controls sit in a wrapper inside the row (it is what @click.outside
// attaches to), so this reaches one level in. The field is a textarea, not an
// input: a to-do is one sentence that has to WRAP rather than scroll sideways.
const FIELD = 'textarea.textarea';
const openFields = () => todoRows().map(r => r.querySelector(FIELD)).filter(Boolean);
const shown = (el) => !!el && !el.hasAttribute('hidden') && el.style.display !== 'none';

// AWAIT A FRAME, NOT ONLY A TICK. x-show is asymmetric: hiding sets
// display:none straight away, while showing goes through
// toggleAndCascadeWithTransitions, which defers to requestAnimationFrame. So
// Alpine.nextTick() alone flushes the reactive queue and returns BEFORE the
// element is visible again, and a test written on nextTick sees every hide and
// misses every show. Measured here on 2026-09-15: the same assertion read
// display:none after nextTick and '' after one timer turn. Verified in
// Chromium too, where both directions land within a frame.
const settle = async () => { await Alpine.nextTick(); await new Promise(r => setTimeout(r, 30)); };

test('the pencil swaps the row text for a field, and swaps it back on cancel', async () => {
  await seedTodos([{ id: 't1', text: 'a typo to fix', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  window.__shell.view = 'todo';   // `tab` is a getter over the shell's view
  await settle();

  const row = todoRows().find(el => el.textContent.includes('a typo to fix'));
  assert.ok(row, 'the to-do row rendered');
  assert.equal(row.querySelector(FIELD), null, 'no field before the pencil is tapped');

  data.startTodoEdit(data.todoItems[0]);
  await settle();

  const field = row.querySelector(FIELD);
  assert.ok(field, 'the field mounted into the row');
  assert.equal(field.value, 'a typo to fix', 'seeded with the current text');

  data.cancelEdit();
  await settle();
  assert.equal(row.querySelector(FIELD), null, 'and unmounted again on cancel');
});

test('the row stands its other controls down while the field is open', async () => {
  await seedTodos([{ id: 't1', text: 'editing me', done: false, urgent: true,
                     created_at: '2026-09-01T10:00:00Z' }]);
  window.__shell.view = 'todo';   // `tab` is a getter over the shell's view
  data.editId = null;
  await settle();

  const row = todoRows().find(el => el.textContent.includes('editing me'));
  const trash = row.querySelector('i.ph-trash')?.closest('button');
  const pencil = row.querySelector('i.ph-pencil-simple')?.closest('button');
  assert.ok(trash && pencil, 'both row verbs are present at rest');

  data.startTodoEdit(data.todoItems[0]);
  await settle();
  assert.equal(shown(trash), false, 'the trash steps aside mid-edit');
  assert.equal(shown(pencil), false, 'and so does the pencil that opened it');

  data.cancelEdit();
  await settle();
  assert.equal(shown(trash), true, 'both come back');
  assert.equal(shown(pencil), true);
});

test('only one row is ever open, across the whole view', async () => {
  await seedTodos([
    { id: 't1', text: 'first to-do', done: false, created_at: '2026-09-01T10:00:00Z' },
    { id: 't2', text: 'second to-do', done: false, created_at: '2026-09-02T10:00:00Z' },
  ]);
  window.__shell.view = 'todo';   // `tab` is a getter over the shell's view
  await settle();

  data.startTodoEdit(data.todoItems[0]);
  await settle();
  assert.equal(openFields().length, 1);

  data.startTodoEdit(data.todoItems[1]);
  await settle();
  const open = openFields();
  assert.equal(open.length, 1, 'opening the second row closed the first');
  assert.equal(open[0].value, 'second to-do');

  data.cancelEdit();
  await settle();
});

// ── Undo, and the implicit save that makes it necessary ──────────────────────
// An edit commits on a click anywhere else now, so a save can happen because
// the reader looked away. These cover the way back: that it is offered, that
// it restores the prior value, that it is spent once, and that the writes
// which already had a visible reversal do not offer a second one.

const toasts = () => Alpine.store('toasts') || [];
const lastToast = () => toasts().at(-1);

test('an edit offers an undo that puts the old text back', async () => {
  await seedTodos([{ id: 't1', text: 'the original', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  const it = data.todoItems[0];

  data.startTodoEdit(it);
  data.editDraft = 'the replacement';
  await data.commitTodoEdit(it);
  assert.equal(data.todoItems[0].text, 'the replacement');

  const t = lastToast();
  assert.ok(t?.action, 'the toast carries an action');
  assert.equal(t.action.label, 'Undo');
  assert.match(t.msg, /the original/, 'and names what it would put back');

  await data.takeUndo();
  assert.equal(data.todoItems[0].text, 'the original');
  assert.match(SAVES.at(-1).message, /Undo/, 'the reversal is its own commit, not a silent rewrite');
});

test('a delete offers an undo that gives back the same item, not a copy', async () => {
  await seedTodos([
    { id: 't1', text: 'keep', done: false, created_at: '2026-09-01T10:00:00Z' },
    { id: 't2', text: 'remove me', done: false, urgent: true, due: '2026-09-20', created_at: '2026-09-02T10:00:00Z' },
  ]);
  const doomed = data.todoItems[1];

  await data.deleteTodo(doomed);
  assert.equal(data.todoItems.length, 1);

  await data.takeUndo();
  assert.equal(data.todoItems.length, 2);
  const back = data.todoItems.find(x => x.id === 't2');
  assert.equal(back.text, 'remove me');
  assert.equal(back.urgent, true, 'every field came back, not just the text');
  assert.equal(back.due, '2026-09-20');
});

test('the offer is spent once, so a second undo cannot walk further back', async () => {
  await seedTodos([{ id: 't1', text: 'one', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  await data.deleteTodo(data.todoItems[0]);
  await data.takeUndo();
  const writes = SAVES.length;

  await data.takeUndo();
  assert.equal(SAVES.length, writes, 'the second call wrote nothing');
  assert.equal(data.undoOffer, null);
});

test('the newest write owns the offer, and undoing it does not resurrect the older one', async () => {
  await seedTodos([
    { id: 't1', text: 'first', done: false, created_at: '2026-09-01T10:00:00Z' },
    { id: 't2', text: 'second', done: false, created_at: '2026-09-02T10:00:00Z' },
  ]);
  await data.deleteTodo(data.todoItems.find(x => x.id === 't1'));
  await data.deleteTodo(data.todoItems.find(x => x.id === 't2'));
  assert.equal(data.todoItems.length, 0);

  await data.takeUndo();
  assert.deepEqual(Array.from(data.todoItems, x => x.id), ['t2'],
    'the snapshot was taken after the first delete, so only the second comes back');
});

test('an unchanged edit offers nothing, since nothing happened to undo', async () => {
  await seedTodos([{ id: 't1', text: 'untouched', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  data.undoOffer = null;
  data.startTodoEdit(data.todoItems[0]);
  await data.commitTodoEdit(data.todoItems[0]);
  assert.equal(data.undoOffer, null);
});

test('checking off offers no undo, because the done pile already is one', async () => {
  await seedTodos([{ id: 't1', text: 'a task', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  data.undoOffer = null;
  await data.toggleTodo(data.todoItems[0]);
  assert.equal(data.undoOffer, null,
    'the reversal is the same checkbox, now visible in the pile toggleTodo opened');
  assert.equal(data.todoShowDone, true);
});

test('a jot edit and a jot delete each offer a way back', async () => {
  await seedJots([{ id: 'j1', text: 'an idea', kind: 'snag', created_at: '2026-09-01T10:00:00Z' }]);

  data.startJotEdit(data.jotItems[0]);
  data.editDraft = 'a better idea';
  await data.commitJotEdit(data.jotItems[0]);
  assert.equal(data.jotItems[0].text, 'a better idea');
  await data.takeUndo();
  assert.equal(data.jotItems[0].text, 'an idea');
  assert.equal(data.jotItems[0].kind, 'snag', 'the kind came back with it');

  await data.deleteJot(data.jotItems[0]);
  assert.equal(data.jotItems.length, 0);
  await data.takeUndo();
  assert.equal(data.jotItems.length, 1);
});

test('a pin edit undo restores every field, including one that was cleared', async () => {
  await seedPins([{ id: 'p1', target: 'me/tools:docs/a.md', title: 'A', note: 'the note',
                    group: 'docs', created_at: '2026-09-01T10:00:00Z' }]);
  const it = data.pinItems[0];

  data.startPinEdit(it);
  data.editDraft = 'B';
  data.editNote = '';
  data.editGroup = '';
  await data.commitPinEdit(it);
  assert.equal('note' in data.pinItems[0], false);

  await data.takeUndo();
  assert.equal(data.pinItems[0].title, 'A');
  assert.equal(data.pinItems[0].note, 'the note', 'a cleared field is not lost by the clearing');
  assert.equal(data.pinItems[0].group, 'docs');
});

test('opening a second row commits the first rather than dropping its typing', async () => {
  await seedTodos([
    { id: 't1', text: 'first', done: false, created_at: '2026-09-01T10:00:00Z' },
    { id: 't2', text: 'second', done: false, created_at: '2026-09-02T10:00:00Z' },
  ]);
  const a = data.todoItems[0], b = data.todoItems[1];

  data.startTodoEdit(a);
  data.editDraft = 'first, edited';
  data.startTodoEdit(b);              // the reader moves on without saving

  assert.equal(data.editId, 't2', 'the slot moved');
  assert.equal(data.editDraft, 'second', 'and the draft is the new row, not a leftover');
  assert.equal(a.text, 'first, edited', "the first row's typing was committed, not discarded");
  assert.match(SAVES.at(-1).message, /first, edited/);
});

test('the outside-click commit is disarmed until the opening click is over', async () => {
  await seedTodos([{ id: 't1', text: 'a row', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  data.startTodoEdit(data.todoItems[0]);
  assert.equal(data.outsideArmed, false,
    'a click still propagating must not reach the handler it just mounted');
  await new Promise(r => setTimeout(r, 5));
  assert.equal(data.outsideArmed, true, 'and it arms on the next task');
});

test('the editor is a textarea, so a long item wraps instead of scrolling sideways', async () => {
  await seedTodos([{ id: 't1', done: false, created_at: '2026-09-01T10:00:00Z',
    text: 'Check the CEM survey, which came on August 19 last year and wants an answer before the allotment closes' }]);
  window.__shell.view = 'todo';
  data.editId = null;          // a prior test may have left a row open
  await settle();

  // Grab the row BEFORE the edit: once it is open the text lives in a field's
  // value rather than its textContent, so it cannot be found by its words.
  const row = todoRows().find(el => el.textContent.includes('CEM survey'));
  assert.ok(row, 'the row rendered');

  data.startTodoEdit(data.todoItems[0]);
  await settle();

  assert.ok(row.querySelector('textarea.textarea'), 'a textarea, not a single-line input');
  assert.equal(row.querySelector('input.input'), null, 'and no input left behind');
  data.cancelEdit();
  await settle();
});

test('the display text mounts and unmounts rather than being hidden', async () => {
  await seedTodos([{ id: 't1', text: 'here and gone', done: false, created_at: '2026-09-01T10:00:00Z' }]);
  window.__shell.view = 'todo';
  data.editId = null;
  await settle();

  const textOf = () => [...doc.querySelectorAll('span')].find(el => el.textContent === 'here and gone');
  assert.ok(textOf(), 'present at rest');

  data.startTodoEdit(data.todoItems[0]);
  await settle();
  assert.equal(textOf(), undefined,
    'gone from the DOM while editing, not merely display:none, which is what keeps the ' +
    'commit from leaving the row blank for two frames on the way back');

  data.cancelEdit();
  await settle();
  assert.ok(textOf(), 'back again');
});
