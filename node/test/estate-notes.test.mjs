// alpineComponents/estate.js — the Lists view's Note section: load, the about
// field as prefix filter and address, replies nested under their note, the
// note key on a jot row that addresses the next note to that jot, and what the
// tab's list, chips and cards read: a note that answers no other as a list
// item, the kinds of thing the notes are about with their counts, a card's
// thread, and each subject as a link. Driven over a fake GH holding
// notes/notes.jsonl in the registry; no network, no pixels.

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
    if (this.repo === REGISTRY && name === 'lists/jot.json')
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
  listsTab: 'note', goListsTab(tab) { this.listsTab = tab; },
};

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/surface.js',
  'lib/kits/repo-address.js',
  'lib/kits/notes.js',
  'lib/kits/findings.js',
  'lib/kits/lists.js',
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
  data.replyDrafts.nc = 'agreed';
  await data.addReply({ id: 'nc' });
  const last = JSON.parse(FILE.text.trim().split('\n').at(-1));
  assert.equal(last.about, 'note:nc');
  assert.equal(data.replyTo, null);
  assert.equal(data.replyText({ id: 'nc' }), '', 'a sent reply leaves no draft');
});

test('what was typed in reply stays with its note when the form closes, and a refused save puts it back', async () => {
  data.startReply({ id: 'nc' });
  data.replyDrafts.nc = 'half a thought';
  data.startReply({ id: 'nc' });
  assert.equal(data.replyTo, null, 'the control closes the form');
  data.startReply({ id: 'na' });
  data.replyDrafts.na = 'another';
  data.startReply({ id: 'nc' });
  assert.equal(data.replyText({ id: 'nc' }), 'half a thought', 'and the form comes back with its text');
  assert.equal(data.replyText({ id: 'na' }), 'another', 'each note keeps its own');

  const req = FakeGH.prototype.req, lines = FILE.text;
  FakeGH.prototype.req = async function (path, opts) {
    if (opts?.method === 'PUT') throw Object.assign(new Error('500'), { status: 500 });
    return req.call(this, path, opts);
  };
  await data.addReply({ id: 'nc' });
  FakeGH.prototype.req = req;
  assert.equal(FILE.text, lines, 'nothing was written');
  assert.equal(data.replyTo, 'nc');
  assert.equal(data.replyText({ id: 'nc' }), 'half a thought');
  delete data.replyDrafts.nc; delete data.replyDrafts.na; data.replyTo = null;
});

test('a jot row addresses the next note to that jot, and counts what is already there', async () => {
  await data.loadJots(reg());
  const jot = data.jotItems[0];
  data.noteOn(data.JOT_PATH, jot);
  assert.equal(data.noteAbout, 'me/registry:lists/jot.json#j1');
  assert.equal(data.notesOn(data.JOT_PATH, jot), 0);
  data.noteDraft = 'belongs with the branch page work';
  await data.addNote();
  assert.equal(data.notesOn(data.JOT_PATH, jot), 1);
  assert.equal(data.aboutLabel(data.noteAbout), 'jot: an idea');
});

test('an about that is not a locator cannot be submitted', () => {
  data.noteAbout = 'not a locator';
  assert.equal(data.noteAboutOk, false);
  data.noteAbout = 'o/r:docs/X.md#a-slug';
  assert.equal(data.noteAboutOk, true);
});

// The list and its cards. Invented notes, one of each kind of subject.
const KINDS = [
  { id: 'n1', at: '2026-10-01T00:00:00Z', author: 'me', about: 'o/r#12', text: 'Merged cleanly. Nothing else to do.' },
  { id: 'n2', at: '2026-10-02T00:00:00Z', author: 'claude/a-branch', about: 'o/r@claude/a-branch', text: 'branch origin' },
  { id: 'n3', at: '2026-10-03T00:00:00Z', author: 'me', about: 'o/r:docs/X.md#a-heading', text: 'a doc note' },
  { id: 'n4', at: '2026-10-04T00:00:00Z', author: 'me', about: 'o/r', text: 'about the repo' },
  { id: 'n5', at: '2026-10-05T00:00:00Z', author: 'me', about: REGISTRY + ':sessions/2026/10/2026-10-05-4b1d9c3e.json', text: 'a session note' },
  { id: 'n6', at: '2026-10-06T00:00:00Z', author: 'gemini', about: REGISTRY + ':user-calls/7e2c4a19-plain-row-labels.json', text: 'kept as is' },
  { id: 'n7', at: '2026-10-07T00:00:00Z', author: 'me', about: REGISTRY + ':lists/jot.json#j1', text: 'a jot note' },
  { id: 'n8', at: '2026-10-08T00:00:00Z', author: 'me', about: 'o/tools:docs/SNAGS.md#a-slug', text: 'on the old snag address' },
  { id: 'n9', at: '2026-10-09T00:00:00Z', author: 'me', about: 'o/r#14', text: 'second pull request note' },
  { id: 'r1', at: '2026-10-10T00:00:00Z', author: 'me', about: 'note:n1', text: 'replied once' },
  { id: 'r2', at: '2026-10-11T00:00:00Z', author: 'me', about: 'note:r1', text: 'replied twice over' },
  { id: 'f1', at: '2026-10-12T00:00:00Z', author: 'claude/weed', about: 'o/r#12', text: 'Nothing tracks the follow-up.',
    finding: { kind: 'answer', subjects: ['o/r#12', 'o/r@claude/a-branch', REGISTRY + ':lists/snag.json#a-slug', 'o/tools:docs/SNAGS.md#a-slug'],
               why: 'The thread closed with the merge.', next: 'Ask the owner.', evidence: ['one', 'two'] } },
];

async function seedKinds() {
  FILE = { text: KINDS.map(line).join(''), sha: 's' + ++SHA };
  await data.loadNotes(reg());
  data.noteAbout = ''; data.noteKind = '';
  data.snagItems = [{ id: 'a-slug', text: 'a snag title', repo: 'o/tools', seen: ['2026-10-01'] }];
}

test('the list holds the notes that answer no other, newest first, and the tab counts them', async () => {
  await seedKinds();
  assert.equal(data.noteList.map(n => n.id).join(' '), 'f1 n9 n8 n7 n6 n5 n4 n3 n2 n1');
  assert.equal(data.noteRows.length, 12, 'the replies are still notes');
  assert.equal(data.listTabs.find(t => t.key === 'note').count, 10);
  assert.equal(data.noteReplies(data.noteList.at(-1)), 2);
  assert.equal(data.noteTitle(data.noteList.at(-1)), 'Merged cleanly');
});

test('the About chips count the notes by the kind of thing each is about, and one narrows the list', async () => {
  await seedKinds();
  assert.equal(data.noteKinds.map(k => k.label + ' ' + k.n).join(', '),
    'Pull request 3, List item 2, Branch 1, File 1, Repo 1, Session 1, User call 1', 'most first, then by name');
  data.noteKind = 'list';
  assert.equal(data.noteList.map(n => n.id).join(' '), 'n8 n7');
  data.noteAbout = 'o/r';
  assert.equal(data.noteList.length, 0);
  assert.equal(data.noteKinds.map(k => k.key + k.n).join(' '), 'pull3 branch1 file1 repo1 list0', 'the chosen kind keeps its chip at zero');
  data.noteOn(data.JOT_PATH, { id: 'j1' });
  assert.equal(data.noteKind, '', "a row's note button lets the chip go, so its notes are not hidden");
  assert.equal(data.noteList.map(n => n.id).join(' '), 'n7');
  data.noteAbout = '';
});

test("a card reads its note with the thread as rows, and nothing for a note that is gone", async () => {
  await seedKinds();
  const [root] = data.noteFor('n1');
  assert.equal(root.rows.map(n => n.id + n.depth).join(' '), 'n10 r11 r22');
  assert.equal(data.noteFor('no-such-note').length, 0);
});

test('a subject is a link pill that opens where the thing lives', async () => {
  await seedKinds();
  const pill = (about) => { const p = data.aboutPill(about); return [p.icon, p.label, p.href, p.out].join(' | '); };
  assert.equal(pill('o/r#12'), 'ph-git-pull-request | r #12 | https://github.com/o/r/pull/12 | true');
  assert.equal(pill('o/r@claude/a-branch'), 'ph-git-branch | r / a-branch | https://mehrlander.github.io/web-tools/pages/branch.html#gh=o/r@claude/a-branch | true');
  assert.equal(pill('o/r:docs/X.md#a-heading'), 'ph-file-text | r X.md#a-heading | https://github.com/o/r/blob/HEAD/docs/X.md#a-heading | true');
  assert.equal(pill('o/r@feat/x:lib/a.js'), 'ph-file-text | r a.js | https://github.com/o/r/blob/feat/x/lib/a.js | true');
  assert.equal(pill('o/r'), 'ph-folder | r | https://github.com/o/r | true');
  assert.equal(pill(REGISTRY + ':sessions/2026/10/2026-10-05-4b1d9c3e.json'),
    'ph-terminal-window | session 4b1d9c3e | https://mehrlander.github.io/web-tools/pages/session.html#id=4b1d9c3e | true');
  assert.match(pill(REGISTRY + ':user-calls/7e2c4a19-plain-row-labels.json'), /^ph-tray \| call plain-row-labels \| /);
  assert.equal(pill(REGISTRY + ':lists/snag.json#a-slug'), 'ph-list-bullets | snag: a snag title | ?view=lists&tab=snag | false');
  assert.equal(pill('o/tools:docs/SNAGS.md#a-slug'), 'ph-list-bullets | snag: a snag title | ?view=lists&tab=snag | false');
  assert.equal(pill(REGISTRY + ':lists/jot.json#j1'), 'ph-list-bullets | jot: an idea | ?view=lists&tab=jot | false');
  assert.equal(pill('o/r:lists/no-such-list.json#x'), 'ph-list-bullets | o/r:lists/no-such-list.json#x |  | false', 'a list this registry does not hold opens nothing');
});

test('a list item pill opens its Lists tab and picks the snag it names', async () => {
  await seedKinds();
  data.snagDraft = 'filtering'; data.snagOpen = '';
  data.aboutPill('o/tools:docs/SNAGS.md#a-slug').go();
  assert.equal(window.__shell.listsTab, 'snag');
  assert.equal(data.snagOpen, 'a-slug');
  assert.equal(data.snagDraft, '', 'out from under the add box filter');
});

test('a finding is read with its thread, and its card links every subject once', async () => {
  await seedKinds();
  const f1 = data.noteList[0];
  assert.equal(data.findingKind(f1).label + ', ' + data.findingState(f1), 'Decision in Waiting, open');
  assert.equal(data.noteFinding(data.noteList[1]), null, 'a plain note has none');
  assert.equal(data.notePills(f1).map(p => p.label).join(' | '), 'r #12 | r / a-branch | snag: a snag title',
    'the snag named at both of its addresses is one pill');
  assert.equal(data.notePills(data.noteList[1]).map(p => p.label).join(' | '), 'r #14');
  FILE = { text: FILE.text + line({ id: 'f2', at: '2026-10-13T00:00:00Z', author: 'me', about: 'note:f1', text: 'Handled.', finding: { status: 'resolved' } }), sha: 's' + ++SHA };
  await data.loadNotes(reg());
  assert.equal(data.findingState(data.noteList[0]), 'handled');
});

test('a note just added is the picked note when the chosen chip lets it into the list', async () => {
  await seedKinds();
  data.noteOpen = 'n1';
  data.noteAbout = 'o/r#30'; data.noteDraft = 'one more note';
  await data.addNote();
  assert.equal(data.noteItems.find(n => n.id === data.noteOpen)?.text, 'one more note');
  data.noteKind = 'file'; data.noteOpen = 'n3';
  data.noteAbout = 'o/r#31'; data.noteDraft = 'hidden by the chip';
  await data.addNote();
  assert.equal(data.noteOpen, 'n3');
  data.noteAbout = ''; data.noteKind = '';
});
