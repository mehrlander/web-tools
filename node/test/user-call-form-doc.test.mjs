// alpineComponents/user-call-form.js — a documentation call answered on its own
// form (owner, 2026-10-29: "It should just be the call, and that's the form",
// not Dictate's machinery). The form reads the call's file, stages each edit
// through kits/call-answer.js, and records one answer line for the whole call
// once every staged edit is kept or discarded.
//
// Driven over a fake GH holding the document and the call. md-diff's inline
// reading and MdSurface's patch are stubbed: their own suites hold them, and
// what is held here is the decisions and the line they write.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const STORE = 'me/private';
const DOC = 'One.\n\nTwo.\n\nThree.\n\nFour.\n';
const CALL = { id: 'c0ffee01-doc', session: 'c0ffee01', kind: 'documentation', question: 'Apply 4 edits to docs/x.md?',
  brief: 'Tidy the doc.', file: 'me/widget@main:docs/x.md', recommend: 'Apply all three',
  edits: [{ from: 'One.', to: 'First.', why: 'clearer', notes: [{ kind: 'clarify', text: 'reads poorly' }] }, { from: 'Two.', to: 'Second.', background: 'Two reads as a count on 2026-10-29.', proposal: 'Names the **order** with `Second`.' }, { from: 'Gone.', to: 'Nothing.' },
          { from: 'Three.\n\nFour.', to: 'Third.\n\nFourth.', notes: [{ kind: 'clarify', text: 'reads poorly' }, { kind: 'correct', text: 'says the wrong count' }] }] };
const puts = [];
class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; }
  async get(p) {
    if (this.repo === 'me/widget' && p === 'docs/x.md') return { text: DOC };
    if (this.repo === STORE && p === 'user-calls/c0ffee01-doc.json') return { text: JSON.stringify(CALL) };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req(p, o = {}) {
    if (p === '/user') return { login: 'owner' };
    if (o.method === 'PUT') { puts.push({ repo: this.repo, path: p, body: JSON.parse(o.body) }); return {}; }
    return {};
  }
  static FRESH = { cache: 'no-store' };
  static toBase64 = (s) => Buffer.from(s, 'utf8').toString('base64');
}

const { window, problems } = makeWindow({ html: `<!doctype html><html><body>
  <div id="form" x-data="userCallForm(window.__form)"></div></body></html>` });
window.GH = FakeGH;
// jsdom has no layout: a scroll is recorded, by the element it would bring into view.
const scrolled = [];
window.Element.prototype.scrollIntoView = function () { scrolled.push(this); };
window.TOKEN = 'tkn';
window.gh = { load: async () => {} };
// The marks are the shared kit's, so the form draws what every call draws.
window.eval(readFileSync(new URL('../../lib/kits/call-marks.js', import.meta.url), 'utf8'));
window.AssistantMark = { shortBranch: (b) => String(b || '') };
// md-diff's own suite holds its drawing; here it draws one container per
// changed block, with the host's actions as buttons, as the real one does.
const drawn = [];
window.mdDiff = { render: async (host, a, b, opts) => {
  drawn.push({ a, b });
  const A = a.split('\n\n'), B = b.split('\n\n');
  A.forEach((old, k) => {
    if (old === B[k]) return;
    const box = window.document.createElement('section');
    box.dataset.mdDiffChange = String(k);
    box.dataset.pair = old + '>' + B[k];
    for (const act of opts.actions({ kind: 'changed', old, new: B[k] }, k) || []) {
      const btn = window.document.createElement('button');
      btn.textContent = act.label; btn.dataset.act = act.label;
      btn.addEventListener('click', () => act.run());
      box.append(btn);
    }
    host.append(box);
  });
  // md-diff's selection, as the kit keeps it: md-diff:here sets it, the
  // container carries data-md-diff-here, and each mover hears the move.
  const movers = [];
  const mark = (at) => {
    for (const b of host.querySelectorAll('[data-md-diff-change]')) b.toggleAttribute('data-md-diff-here', +b.dataset.mdDiffChange === at);
    movers.forEach((cb) => cb({ at }));
  };
  host.addEventListener('md-diff:here', (e) => mark(e.detail.at));
  return { onMove: (cb) => { movers.push(cb); cb({ at: -1 }); } };
} };
window.Diff = {};
window.MdSurface = { patch: (p, a, b) => 'PATCH ' + p + ' ' + JSON.stringify(b) };
const heads = [];
window.__form = { src: STORE + ':user-calls/c0ffee01-doc.json', onHead: (hd) => heads.push(hd) };

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
for (const k of ['lib/kits/repo-address.js', 'lib/kits/call-answer.js']) {
  new window.Function('window', readFileSync(path.join(repoRoot, k), 'utf8'))(window);
}
for (const p of ['lib/vanilla-bundle.js', 'lib/alpine-bundle.js', 'lib/alpineComponents/user-call-form.js']) {
  new window.Function(readFileSync(path.join(repoRoot, p), 'utf8'))();
}
Alpine.start();
const root = () => window.document.getElementById('form');
const data = () => Alpine.$data(root());
const until = async (ok) => { for (let i = 0; i < 80 && !ok(); i++) await tick(2); return ok(); };
await until(() => data().doc.ready && root().querySelectorAll('[data-md-diff-change]').length === 4);
const box = (n) => root().querySelector(`[data-doc-mark][data-doc-edit="${n}"]`)?.closest('[data-md-diff-change]');
const act = (n, a) => box(n).querySelector(`[data-act="${a}"]`).click();
const mark = (n) => root().querySelector(`[data-doc-mark][data-doc-edit="${n}"]`);
const send = () => root().querySelector('[data-doc-send]');

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('the document is drawn whole, its edits staged, under a head naming the file', () => {
  assert.deepEqual(drawn[0], { a: DOC, b: 'First.\n\nSecond.\n\nThird.\n\nFourth.\n' }, 'the file as it stands against the file with every edit in it');
  assert.equal(box(1).dataset.pair, 'One.>First.');
  const shown = (el) => el && el.style.display !== 'none';
  assert.ok(![...root().querySelectorAll('[data-doc-head] > span')].some((el) => shown(el) && /docs\/x\.md|edits/.test(el.textContent)),
    'in the deck the header names the file and the list counts the edits, so the head repeats neither');
  assert.equal(data().docCount, '4 edits · 0 of 3 decided', 'the count is still worked out');
  assert.equal(root().querySelector('[data-dictate-link]'), null, 'no way out to Dictate');
});

test('a deck header names the document, not the kind of call', () => {
  assert.ok(heads.length, 'the form reported a header');
  assert.equal(heads.at(-1).title, 'docs/x.md');
  assert.equal(heads.at(-1).icon, 'ph-pencil-line', 'the kind is the icon\'s to say');
  assert.equal(heads.at(-1).action, null, 'no record circle in the header: the Record row under the document records');
});

test('in the deck a documentation call shows its brief, not its question or a recommendation', () => {
  assert.equal(root().querySelector('[data-call-question]').style.display, 'none', 'the deck header names the document');
  assert.equal(root().querySelector('[data-call-recommend]').style.display, 'none');
});

test('a documentation call shows no PR readiness, even when the PR has conflicts', async () => {
  data().facts = { state: 'open', mergeable: 'dirty' };
  await tick(2);
  assert.equal(data().blocker, 'This PR has merge conflicts.');
  assert.equal(root().querySelector('[data-call-blocker]').style.display, 'none');
  data().facts = null;
});

test('the edits are listed at the top, each with its summary, and a tap scrolls the document to it', async () => {
  const rows = [...root().querySelectorAll('[data-doc-row]')];
  assert.equal(rows.length, 4, 'one row per edit');
  const line = (r) => r.querySelector('[data-doc-row-n]').parentElement.textContent.replace(/\s+/g, ' ').trim();
  assert.match(line(rows[0]), /^1 clearer$/, 'its number, then its why when it has no proposal');
  assert.match(rows[0].querySelector('[data-doc-row-n]').className, /bg-primary\/15 text-primary/, 'the number a tinted chip, so the list reads as a count');
  const lead = rows[0].querySelector('[data-doc-kind]'), num = rows[0].querySelector('[data-doc-row-n]');
  assert.equal(lead.dataset.docKind, 'clarify');
  assert.ok(lead.compareDocumentPosition(num) & window.Node.DOCUMENT_POSITION_FOLLOWING, 'the kind icon leads the line, before the number');
  assert.equal(lead.dataset.titleTip, 'Clarification', 'and names itself in a tip');
  assert.equal(rows[0].dataset.titleTipTap, 'none', 'which a tap on a phone does not open: the tap jumps');
  const kinds = (n) => [...rows[n - 1].querySelectorAll('[data-doc-kind]')].map((k) => k.dataset.docKind);
  assert.deepEqual(kinds(1), ['clarify']);
  assert.deepEqual(kinds(4), ['correct', 'clarify'], 'each kind once, corrections first');
  assert.deepEqual(kinds(2), [], 'an edit with no notes has no pill');
  assert.match(rows[1].textContent, /Names the order with Second\./, 'its proposal, marks stripped');
  assert.match(rows[3].textContent, /Third\./, 'else the text it puts in');
  scrolled.length = 0;
  rows[1].click();
  await tick(2);
  assert.equal(scrolled.at(-1), box(2), 'the document scrolls to the edit');
  assert.equal(data().docActive, 1);
  assert.match(rows[1].className, /bg-primary\/10/, 'and its row is marked by its background (owner, 2026-11-14)');
  assert.doesNotMatch(rows[1].className, /inset_3px/, 'with no bar at its edge');
  assert.ok(box(2).hasAttribute('data-md-diff-here'), 'its container is selected in md-diff, so the tap shows even with the edit in view');
  assert.equal(root().querySelectorAll('[data-md-diff-here]').length, 1, 'and only it');
  assert.match(rows[1].querySelector('[data-doc-row-n]').className, /bg-primary\/15 text-primary/, 'its number keeps its tint');
  assert.doesNotMatch(rows[1].querySelector('[data-doc-row-n]').className, /border/, 'and takes no outline');
  assert.match(mark(2).className, /border-\[var\(--color-primary\)\] bg-base-100/, 'and so does its label on the container');
  rows[1].click();
  await tick(2);
  assert.equal(root().querySelector('[data-md-diff-here]'), null, 'a second tap on the selected row lets it go');
  assert.doesNotMatch(rows[1].className, /bg-primary\/10/, 'its wash goes');
  assert.match(rows[1].className, /bg-base-200(?!\/)/, 'and its row stays grey, as the edit in view');
  rows[1].click();
  await tick(2);
  rows[2].click();
  await tick(2);
  assert.equal(scrolled.at(-1), root().querySelector('[data-doc-unplaced="3"]'), 'an edit the file cannot place scrolls to its line');
  assert.equal(root().querySelector('[data-md-diff-here]'), null, 'and selects nothing, having no container');
});

test('each row ends with the words its edit adds and removes, green and red (owner, 2026-11-14)', () => {
  const rows = [...root().querySelectorAll('[data-doc-row]')];
  const shown = (el) => el && el.style.display !== 'none';
  const words = (r) => [r.querySelector('[data-doc-words-add]'), r.querySelector('[data-doc-words-del]')].map((el) => (shown(el) ? el.textContent : ''));
  assert.deepEqual(words(rows[0]), ['+1', '−1'], 'One. to First.: a word out, a word in');
  assert.deepEqual(words(rows[3]), ['+2', '−2'], 'two paragraphs, a word each');
  assert.match(rows[0].querySelector('[data-doc-words-add]').className, /bg-success\/15/, 'added words in green');
  assert.match(rows[0].querySelector('[data-doc-words-del]').className, /bg-error\/15/, 'removed words in red');
  assert.equal(rows[0].querySelector('[data-doc-words]').dataset.titleTip, '1 word added, 1 word removed', 'and the counts say so in a tip');
  const n = (from, to) => { const { add, del } = data().docWords({ from, to }); return [add, del]; };
  assert.deepEqual(n('one two three', 'one three four'), [1, 1], 'matched by the longest run of shared words');
  assert.deepEqual(n('a  b\nc', 'a b c'), [0, 0], 'spacing and line breaks are not words');
  assert.deepEqual(n('see [the file](a.md)', 'see [the file](b.md)'), [0, 0], 'nor is a link\'s target');
  assert.equal(data().docWordsTip({ from: 'a\nb', to: 'a b' }), 'No words change');
  const total = root().querySelector('[data-doc-words-total]');
  assert.equal(total.textContent.replace(/\s+/g, ' ').trim(), 'words +5 −5', 'the call\'s total names the unit once, its label to the left');
  const line = total.parentElement;
  assert.equal(line.dataset.docControlsRow, '', 'on the line of the document\'s controls, at every width');
  assert.equal(line.lastElementChild, total, 'which it ends, over the rows\' counts');
  assert.equal(line.firstElementChild.dataset.docControls, '', 'the controls keeping an element of their own');
  assert.equal(total.dataset.titleTip, '5 words added, 5 removed, across 4 edits');
});

test('scrolling the document keeps the edit in view on screen in the list (owner, 2026-11-14)', () => {
  const list = root().querySelector('[data-doc-list]'), row = list.querySelector('[data-doc-row="4"]');
  const rect = (top, height) => () => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0 });
  const was = [list.getBoundingClientRect, row.getBoundingClientRect, list.scrollTo];
  const to = [];
  list.getBoundingClientRect = rect(100, 80);
  list.scrollTo = (o) => to.push({ ...o });
  row.getBoundingClientRect = rect(200, 20);
  data().docKeepRow(3);
  assert.deepEqual(to.at(-1), { top: 55, behavior: 'smooth' }, 'a row 40px below the list scrolls it 40px, and three quarters of a row past');
  list.scrollTop = 55;
  row.getBoundingClientRect = rect(130, 20);
  to.length = 0;
  data().docKeepRow(3);
  assert.equal(to.length, 0, 'a row already in sight moves nothing');
  list.scrollTop = 135;
  row.getBoundingClientRect = rect(60, 20);
  data().docKeepRow(3);
  assert.deepEqual(to.at(-1), { top: 80, behavior: 'smooth' }, 'a row above it scrolls the list down to it');
  [list.getBoundingClientRect, row.getBoundingClientRect, list.scrollTo] = was;
  list.scrollTop = 0;
});

test('the list shows in Changes only, the one view that draws the edits', async () => {
  // x-show applies on the next frame, so each check waits for it.
  const list = () => root().querySelector('[data-doc-list]');
  root().querySelector('[data-doc-view="old"]').click();
  assert.ok(await until(() => list().style.display === 'none'), 'hidden in Old');
  root().querySelector('[data-doc-view="changes"]').click();
  assert.ok(await until(() => box(1) && list().style.display !== 'none'), 'back in Changes');
});

test('an edit md-diff draws as several changes marks each, under the one decision', async () => {
  const marks = () => [...root().querySelectorAll('[data-doc-mark][data-doc-edit="4"]')];
  assert.equal(marks().length, 2, 'a two-block edit is two containers');
  assert.deepEqual(marks().map((m) => m.textContent), ['Edit 4', ''], 'named once, on its first container');
  act(4, 'Discard');
  await tick(2);
  assert.deepEqual(marks().map((m) => m.dataset.decision), ['discarded', 'discarded'], 'both containers show the decision');
  assert.deepEqual(marks().map((m) => m.textContent), ['Edit 4 · discarded', 'discarded']);
  act(4, 'Discard');
  await tick(2);
});

test('an edit the file cannot place says why, under the document, with no container', () => {
  assert.deepEqual(Array.from(data().doc.status), ['staged', 'staged', 'stale', 'staged']);
  assert.equal(mark(3), null);
  assert.match(root().querySelector('[data-doc-unplaced="3"]').textContent, /no longer holds/);
});

test('nothing records until every staged edit is decided, and a decision stays marked', async () => {
  assert.equal(send().disabled, true);
  assert.match(send().textContent, /3 to decide/);
  act(1, 'Keep');
  await tick(2);
  assert.match(send().textContent, /2 to decide/);
  assert.equal(mark(1).dataset.decision, 'confirmed');
  assert.match(mark(1).textContent, /kept/);
  assert.equal(mark(1).dataset.titleTip, 'clearer', 'the reason is a title-tip on the mark, not a line under the edit');
  act(1, 'Keep');
  await tick(2);
  assert.equal(mark(1).dataset.decision, 'open', 'a second tap lets it go');
});

test('Old and New draw the whole file as it stands and as proposed; Changes keeps its decisions', async () => {
  act(1, 'Keep');
  await tick(2);
  const view = (v) => root().querySelector(`[data-doc-view="${v}"]`).click();
  view('old');
  await until(() => drawn.length >= 2);
  assert.deepEqual(drawn.at(-1), { a: DOC, b: DOC }, 'the file as it stands');
  view('new');
  await until(() => drawn.length >= 3);
  assert.deepEqual(drawn.at(-1), { a: 'First.\n\nSecond.\n\nThird.\n\nFourth.\n', b: 'First.\n\nSecond.\n\nThird.\n\nFourth.\n' }, 'the file with every edit');
  view('changes');
  await until(() => mark(1));
  assert.equal(mark(1).dataset.decision, 'confirmed', 'a decision survives the switch');
  act(1, 'Keep');
  await tick(2);
  assert.equal(root().querySelector('[data-doc-file]'), null, 'no link out to the file');
});

test("an edit's label carries a book for its background, and no bulb anywhere", async () => {
  const m = mark(2);
  assert.equal(m.dataset.titleTip, undefined, 'its mark speaks for it');
  assert.deepEqual([...m.querySelectorAll('[data-doc-tip]')].map((b) => b.dataset.docTip), ['background'], 'a book, no bulb');
  assert.ok([...m.querySelectorAll('[data-doc-tip]')].every((b) => b.querySelector('svg')), 'the mark is drawn');
  assert.ok([...m.querySelectorAll('[data-doc-tip]')].every((b) => !b.dataset.titleTip), 'no label tip over the blurb');
  const panel = () => box(2).querySelector('[data-doc-tip-panel]');
  m.querySelector('[data-doc-tip="background"]').click();
  await tick(2);
  assert.equal(panel()?.dataset.docTipPanel, 'background');
  assert.equal(panel().querySelector('.whitespace-nowrap')?.textContent, '2026-10-29', 'a date stays on one line');
  m.querySelector('[data-doc-tip="background"]').click();
  await tick(2);
  assert.equal(panel(), null, 'a second tap on its mark closes it');
  m.querySelector('[data-doc-tip="background"]').click();
  await tick(2);
  panel().click();
  await tick(2);
  assert.equal(panel(), null, 'and so does a tap on the tip');
  assert.equal(mark(1).querySelector('[data-doc-tip]'), null, 'an edit without a background keeps its why');
  assert.equal(root().querySelector('[data-doc-row-bulb]'), null, 'the list carries no bulb (owner, 2026-11-07)');
});

test('a note sends back while edits are still open, with no patch, and the call stays answerable', async () => {
  assert.equal(send().disabled, true, 'nothing typed, nothing to send');
  data().doc.note = 'remove this passage rather than reverse it';
  await tick(2);
  assert.equal(send().disabled, false);
  assert.match(send().textContent, /Send notes/);
  send().click();
  await until(() => puts.length);
  const line = JSON.parse(Buffer.from(puts[0].body.content, 'base64').toString('utf8').trim().split('\n').pop());
  assert.equal(line.answer, '3 open, 1 stale');
  assert.equal(line.note, 'remove this passage rather than reverse it');
  assert.equal(line.patch, undefined, 'an open edit is not taken out of the branch as though discarded');
  await until(() => !data().busy);
  assert.equal(data().done, '', 'notes sent back are not the answer');
  assert.match(root().querySelector('[data-doc-sent]').textContent, /Notes sent; 3 still to decide/);
  await tick(2);
  assert.equal(send().disabled, true, 'the same notes cannot be sent twice');
  assert.match(send().textContent, /Notes sent/);
  data().doc.note = 'remove this passage rather than reverse it, please';
  await tick(2);
  assert.equal(send().disabled, false, 'a changed note can be sent');
  data().doc.note = '';
  puts.length = 0;
  await tick(2);
  assert.equal(send().disabled, true);
});

test('the answer line is the one Dictate and the Docs tab write, with the kept edits as a patch', async () => {
  act(1, 'Keep');
  act(2, 'Discard');
  act(4, 'Keep');
  act(2, 'Note');
  await tick(2);
  const note = root().querySelector('[data-doc-note="2"]');
  note.value = 'keep the number';
  note.dispatchEvent(new window.Event('input'));
  assert.equal(send().disabled, false);
  send().click();
  await until(() => puts.length);
  const put = puts[0], line = JSON.parse(Buffer.from(put.body.content, 'base64').toString('utf8').trim());
  assert.equal(put.repo, STORE);
  assert.equal(put.path, 'contents/user-calls/c0ffee01-doc.answers.jsonl');
  assert.equal(line.answer, '2 confirmed, 1 discarded, 1 stale');
  assert.deepEqual(line.decisions, [{ edit: 1, decision: 'confirmed' }, { edit: 2, decision: 'discarded', note: 'keep the number' },
                                    { edit: 3, decision: 'stale' }, { edit: 4, decision: 'confirmed' }]);
  assert.equal(line.call, STORE + ':user-calls/c0ffee01-doc.json');
  assert.equal(line.file, 'me/widget:docs/x.md');
  assert.equal(line.apply, 'session');
  assert.equal(line.patch, 'PATCH docs/x.md ' + JSON.stringify('First.\n\nTwo.\n\nThird.\n\nFourth.\n'), 'only the kept edits are in the patch');
  await until(() => data().done);
  assert.equal(data().done, line.answer, 'the form reads as answered');
});
