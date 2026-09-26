// alpineComponents/estate.js — the Lists view's Note section: load, the about
// field as prefix filter and address, replies nested under their note, and the
// note key on a jot row that addresses the next note to that jot. Driven over a
// fake GH holding notes/notes.jsonl in the registry; no network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const REGISTRY = 'me/registry';
const NOTES = 'notes/notes.jsonl';
let FILE = null;   // { text, sha }
let SHA = 0;

const line = (o) => JSON.stringify(o) + '\n';
const seed = [
  { id: 'na', at: '2026-09-01T00:00:00Z', author: 'claude/x', about: 'o/r@claude/b', text: 'branch origin' },
  { id: 'nb', at: '2026-09-02T00:00:00Z', author: 'me', about: 'note:na', text: 'a reply' },
  { id: 'nc', at: '2026-09-03T00:00:00Z', author: 'me', about: 'other/repo', text: 'elsewhere' },
];

class FakeGH {
  static FRESH = { cache: 'no-store' };
  static toBase64 = (s) => Buffer.from(s).toString('base64');
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  ago() { return 'recently'; }
  async repos() { return []; }
  async ls() { return []; }
  async get(name) {
    if (this.repo === REGISTRY && name === NOTES && FILE) return { ...FILE };
    if (this.repo === REGISTRY && name === 'lists/jots.json')
      return { text: JSON.stringify({ items: [{ id: 'j1', text: 'an idea', created_at: '2026-09-01T00:00:00Z' }] }) };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req(path, opts) {
    if (path === '/user') return { login: 'me' };
    if (path === 'contents/' + NOTES && opts?.method === 'PUT') {
      const body = JSON.parse(opts.body);
      if ((body.sha || null) !== (FILE?.sha || null)) throw Object.assign(new Error('409'), { status: 409 });
      FILE = { text: Buffer.from(body.content, 'base64').toString(), sha: 's' + ++SHA };
      return { content: { sha: FILE.sha } };
    }
    if (typeof path === 'string' && path.startsWith('/repos/'))
      return { default_branch: 'main', description: '', private: true, pushed_at: '' };
    return {};
  }
  async save() { return {}; }
}

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body><div id="es" x-data="estate()"></div></body></html>`,
});
window.TOKEN = 'tkn';
window.GH = FakeGH;
window.__shell = {
  REGISTRY_REPO: REGISTRY, DEFAULT_REPO: 'me/tools', quickLinks: [],
  hasToken: () => true, _authState: 'auth', refreshConfigCache() {}, refreshActivity() {},
};

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/surface.js',
  'lib/kits/repo-address.js',
  'lib/kits/notes.js',
  'lib/alpineComponents/estate.js',
]);
const data = Alpine.$data(window.document.getElementById('es'));
const reg = () => new FakeGH({ repo: REGISTRY });

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

test('a missing store is an empty list, not an error', async () => {
  FILE = null;
  await data.loadNotes(reg());
  assert.equal(data.noteRows.length, 0);
  assert.equal(data.noteErr, '');
});

test('a reply sits under its note, and the about field filters by prefix', async () => {
  FILE = { text: seed.map(line).join(''), sha: 's0' };
  await data.loadNotes(reg());
  data.noteAbout = '';
  assert.equal(data.noteRows.map(n => n.id + n.depth).join(' '), 'nc0 na0 nb1');
  data.noteAbout = 'o/r';
  assert.equal(data.noteRows.map(n => n.id).join(' '), 'na nb');
});

test('adding a note appends one line signed by the login, addressed by the about field', async () => {
  data.noteAbout = 'o/r#12';
  data.noteDraft = 'merged cleanly';
  await data.addNote();
  const last = JSON.parse(FILE.text.trim().split('\n').at(-1));
  assert.equal(last.about, 'o/r#12');
  assert.equal(last.author, 'me');
  assert.equal(FILE.text.trim().split('\n').length, 4, 'the three notes before it are kept');
  assert.equal(data.noteDraft, '');
});

test('a reply is a note about the note', async () => {
  data.noteAbout = '';
  data.startReply({ id: 'nc' });
  data.replyDraft = 'agreed';
  await data.addReply({ id: 'nc' });
  const last = JSON.parse(FILE.text.trim().split('\n').at(-1));
  assert.equal(last.about, 'note:nc');
  assert.equal(data.replyTo, null);
});

test('a jot row addresses the next note to that jot, and counts what is already there', async () => {
  await data.loadJots(reg());
  const jot = data.jotItems[0];
  data.noteOn(data.JOTS_PATH, jot);
  assert.equal(data.noteAbout, 'me/registry:lists/jots.json#j1');
  assert.equal(data.notesOn(data.JOTS_PATH, jot), 0);
  data.noteDraft = 'belongs with the branch page work';
  await data.addNote();
  assert.equal(data.notesOn(data.JOTS_PATH, jot), 1);
  assert.equal(data.aboutLabel(data.noteAbout), 'jot: an idea');
});

test('an about that is not a locator cannot be submitted', () => {
  data.noteAbout = 'not a locator';
  assert.equal(data.noteAboutOk, false);
  data.noteAbout = 'o/r:docs/X.md#a-slug';
  assert.equal(data.noteAboutOk, true);
});
