// kits/dictate-record.js: notes kept as records anchored to GitHub's copy, and
// the `dictate/1` record that serializes an edit with its changes and notes.
//
// What is held is the data half of pages/dictate.html's notes: which block or
// card holds a note, where a note goes when a commit replaces GitHub's copy or
// the copy moves on GitHub, and what the record and its markdown say. The units
// come from kits/md-surface.js (unitsOf), the same split into blocks and cards
// the page draws, so a note here is held by what the reader sees there. The
// page's own wiring is held by tools/test/dictate-page.mjs, in a browser.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import jsdomPkg from 'jsdom';
import { marked } from 'marked';
import { repoRoot } from './bootstrap.mjs';

const { JSDOM } = jsdomPkg;
const dom = new JSDOM('<!doctype html><body></body>');
const window = dom.window;
window.mdDoc = { html: (t) => marked.parse(t) };
window.Diff = (await import('diff')).default ?? (await import('diff'));
for (const kit of ['standoff.js', 'md-diff.js', 'md-surface.js', 'dictate-record.js']) {
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits', kit), 'utf8'))(window, window.document);
}
const R = window.DictateRecord, units = (b, t) => window.MdSurface.unitsOf(b, t);
const unitWith = (us, base, text, s) => us.find((u) => (u.o[0] !== u.o[1] ? base.slice(u.o[0], u.o[1]) : text.slice(u.n[0], u.n[1])).includes(s));
const heldText = (n, us, base, text) => { const u = R.place([n], us, text).get(n.id); return u ? (u.card == null ? 'block' : 'card ' + u.card) : null; };

const BASE = '# Title\n\nAlpha para one.\n\nBravo para two.\n\nCharlie para three.\n\nDelta para four.\n';

test('units cover the document: one per unchanged block, one per card, with spans in both texts', () => {
  const same = units(BASE, BASE);
  assert.equal(same.length, 5);
  assert.ok(same.every((u) => u.card == null && BASE.slice(u.o[0], u.o[1]) === BASE.slice(u.n[0], u.n[1])));
  const text = BASE.replace('Bravo para two.', 'Bravo para 2.').replace('Charlie para three.\n\n', '') + '\nEcho para added.\n';
  const us = units(BASE, text);
  const cards = us.filter((u) => u.card != null);
  assert.deepEqual(cards.map((u) => u.card), [0, 1, 2]);
  assert.equal(BASE.slice(cards[0].o[0], cards[0].o[1]).trim(), 'Bravo para two.');
  assert.equal(text.slice(cards[0].n[0], cards[0].n[1]).trim(), 'Bravo para 2.');
  assert.equal(cards[1].n[0], cards[1].n[1], 'a card that only removes has no text now: its n is a point');
  assert.equal(cards[2].o[0], cards[2].o[1], 'a card that only adds has no base text: its o is a point');
  assert.equal(cards[2].o[0], BASE.length, 'standing where the addition goes in, after the last block');
});

test('a note on a paragraph is held by it unchanged, by its card once edited, and through a join', () => {
  const us0 = units(BASE, BASE);
  const n = R.make(unitWith(us0, BASE, BASE, 'Charlie'), BASE, BASE, 'Check this.');
  assert.equal(n.exact, 'Charlie para three.', 'the quote is the block\'s text, its newline left off');
  assert.equal(BASE.slice(n.o, n.e), n.exact);
  assert.equal(heldText(n, us0, BASE, BASE), 'block');
  const edited = BASE.replace('Charlie para three.', 'Charlie para three, edited.');
  assert.equal(heldText(n, units(BASE, edited), BASE, edited), 'card 0', 'its own edit makes it a card, and the note goes with it');
  const elsewhere = BASE.replace('Alpha para one.', 'Alpha para 1.');
  assert.equal(heldText(n, units(BASE, elsewhere), BASE, elsewhere), 'block', 'an edit elsewhere leaves it where it was');
  const joined = BASE.replace('Bravo para two.\n\nCharlie para three.', 'Bravo para two, Charlie para three.');
  const us = units(BASE, joined), u = R.place([n], us, joined).get(n.id);
  assert.ok(u && u.card != null && BASE.slice(u.o[0], u.o[1]).includes('Charlie'),
    'joined to the paragraph above, it is on the card that holds its text');
});

test('a note on an added paragraph is a point, held by that card, and its quote follows the text', () => {
  const text = BASE.replace('Bravo para two.\n\n', 'Bravo para two.\n\nInserted para.\n\nSecond insert.\n\n');
  const us = units(BASE, text);
  const add = us.filter((u) => u.card != null);
  assert.equal(add.length, 2, 'two added paragraphs are two cards at one point');
  const n = R.make(add[1], BASE, text, 'Why two?');
  assert.equal(n.o, n.e);
  assert.equal(n.exact, 'Second insert.');
  assert.equal(heldText(n, us, BASE, text), 'card 1', 'the added text decides between two cards at one point');
  const typed = text.replace('Second insert.', 'Second insert, typed on.');
  const [m] = R.refresh([n], units(BASE, typed), typed);
  assert.equal(m.exact, 'Second insert, typed on.');
});

test('rebase: through a commit, a note moves with its block, lands on an applied change, or is unplaced', () => {
  const us = units(BASE, BASE);
  const on = (s, w) => R.make(unitWith(us, BASE, BASE, s), BASE, BASE, w);
  const notes = [on('Alpha', 'a'), on('Bravo', 'b'), on('Charlie', 'c'), on('Delta', 'd')];
  // The commit: Bravo rewritten, Charlie taken out, a paragraph added at the top.
  const next = BASE.replace('# Title\n\n', '# Title\n\nZulu para new.\n\n').replace('Bravo para two.', 'Bravo para two, now longer.')
    .replace('Charlie para three.\n\n', '');
  const out = R.rebase(notes, BASE, next);
  const by = Object.fromEntries(out.map((n) => [n.text, n]));
  assert.equal(next.slice(by.a.o, by.a.e), 'Alpha para one.', 'an unchanged block moves by what grew above it');
  assert.equal(by.a.exact, 'Alpha para one.');
  assert.equal(next.slice(by.b.o, by.b.e), 'Bravo para two, now longer.', 'a note on an applied change lands on its new text');
  assert.equal(by.b.exact, 'Bravo para two, now longer.', 'and its quote is that text now');
  assert.equal(by.c.o, null, 'a note whose text went out is unplaced');
  assert.equal(by.c.exact, 'Charlie para three.', 'and keeps its quote');
  assert.equal(next.slice(by.d.o, by.d.e), 'Delta para four.');
  assert.ok(by.b.prefix.endsWith('\n\n') && next.slice(by.b.e).startsWith(by.b.suffix), 'the context is refreshed too');
});

test('rebase: a note on an addition becomes a passage once the addition goes in, and stays a point while it waits', () => {
  const text = BASE.replace('Bravo para two.\n\n', 'Bravo para two.\n\nInserted para.\n\n');
  const add = units(BASE, text).find((u) => u.card != null);
  const n = R.make(add, BASE, text, 'Added for clarity.');
  const [inn] = R.rebase([n], BASE, text);
  assert.equal(text.slice(inn.o, inn.e), 'Inserted para.', 'applied: a passage on the text that went in');
  const other = BASE.replace('# Title', '# A Longer Title');
  const [wait] = R.rebase([n], BASE, other);
  assert.equal(wait.o, wait.e, 'not applied: still a point');
  assert.equal(other.slice(0, wait.o).trimEnd().endsWith('Bravo para two.'), true, 'standing after the same paragraph');
  assert.equal(heldText(wait, units(other, other.replace('Bravo para two.\n\n', 'Bravo para two.\n\nInserted para.\n\n')), other, other.replace('Bravo para two.\n\n', 'Bravo para two.\n\nInserted para.\n\n')), 'card 0');
});

test('refind: when GitHub\'s copy moved, a note is found again by its quote, the context breaking ties', () => {
  const doubled = '# Title\n\nSame words.\n\nMiddle.\n\nSame words.\n';
  const us = units(doubled, doubled);
  const second = us.filter((u) => doubled.slice(u.o[0], u.o[1]).includes('Same words'))[1];
  const n = R.make(second, doubled, doubled, 'the second one');
  const moved = '# Title\n\nAn intro paragraph that was not there.\n\n' + doubled.slice('# Title\n\n'.length);
  const [m] = R.refind([n], moved);
  assert.equal(moved.slice(m.o, m.e), 'Same words.');
  assert.ok(moved.slice(0, m.o).includes('Middle.'), 'the occurrence whose context matches, not the first');
  const [gone] = R.refind([n], moved.replace(/Same words\./g, 'Other words.'));
  assert.equal(gone.o, null, 'its text gone, it is unplaced rather than attached to a neighbour');
  const [still] = R.refind([n], doubled);
  assert.deepEqual(still, n, 'a copy that did not move leaves it as it was');
});

test('build: the record carries the file, changes and notes, each list possibly empty', () => {
  const target = { repository: 'mehrlander/web-tools', ref: 'main', path: 'docs/x.md', blob: 'abc1234def' };
  const empty = R.build({ target, at: '2026-10-01T00:00:00Z', base: BASE, text: BASE, units: units(BASE, BASE), notes: [] });
  assert.deepEqual(empty, { kind: 'dictate/1', target, at: '2026-10-01T00:00:00Z', changes: [], notes: [] });
  const text = BASE.replace('Bravo para two.', 'Bravo para 2.').replace('Delta para four.\n', 'Delta para four.\n\nEcho added.\n');
  const us = units(BASE, text);
  const n1 = R.make(unitWith(us, BASE, text, 'Bravo'), BASE, text, 'Numerals read better.');
  const n2 = R.make(unitWith(us, BASE, text, 'Alpha'), BASE, text, 'Is this still true?');
  const gone = { ...R.make(unitWith(us, BASE, text, 'Charlie'), BASE, text, 'Lost one.'), o: null, e: null };
  const rec = R.build({ target, author: 'mehrlander', at: '2026-10-01T00:00:00Z', base: BASE, text, units: us,
    notes: [gone, n1, n2], accepted: new Set([0]) });
  assert.deepEqual(Object.keys(rec), ['kind', 'target', 'at', 'author', 'changes', 'notes']);
  assert.deepEqual(rec.changes, [
    { id: 'c1', lines: { start: 5, end: 5 }, old: 'Bravo para two.', new: 'Bravo para 2.', accepted: true },
    { id: 'c2', after: 9, new: 'Echo added.' },
  ]);
  assert.deepEqual(rec.notes.map((n) => [n.text, n.lines || n.after || (n.unplaced && 'unplaced'), n.change || null]), [
    ['Is this still true?', { start: 3, end: 3 }, null],
    ['Numerals read better.', { start: 5, end: 5 }, 'c1'],
    ['Lost one.', 'unplaced', null],
  ], 'in document order, a note on a change naming it, the unplaced last');
  assert.deepEqual(Object.keys(rec.notes[0]), ['id', 'at', 'lines', 'anchor', 'text']);
  assert.deepEqual(rec.notes[0].anchor, { exact: 'Alpha para one.', prefix: '# Title\n\n', suffix: '\n\nBravo para two.\n\nCharlie para ' });
});

test('markdown: a heading per item, a change as a diff with its notes under it, a lone note quoted', () => {
  const target = { repository: 'mehrlander/web-tools', ref: 'main', path: 'docs/x.md', blob: 'abc1234def' };
  const text = BASE.replace('Bravo para two.', 'Bravo para ```2```.');
  const us = units(BASE, text);
  const notes = [R.make(unitWith(us, BASE, text, 'Bravo'), BASE, text, 'Code it.'), R.make(unitWith(us, BASE, text, 'Delta'), BASE, text, 'Fine.')];
  const md = R.markdown(R.build({ target, at: '2026-10-01T00:00:00Z', base: BASE, text, units: us, notes, accepted: new Set([0]) }));
  assert.equal(md, [
    '# x.md',
    '`mehrlander/web-tools@main:docs/x.md` · blob abc1234 · 2026-10-01',
    '1 change (1 accepted) · 2 notes',
    '',
    '## Change 1 · line 5 · accepted',
    '````diff',
    '- Bravo para two.',
    '+ Bravo para ```2```.',
    '````',
    '',
    '**Note:** Code it.',
    '',
    '## Note · line 9',
    '> Delta para four.',
    '',
    '**Note:** Fine.',
    '',
  ].join('\n'), 'a fence one longer than any run of backticks inside it');
  const notesOnly = R.markdown(R.build({ target, at: '2026-10-01T00:00:00Z', base: BASE, text: BASE, units: units(BASE, BASE),
    notes: [R.make(units(BASE, BASE)[1], BASE, BASE, 'Only a note.')] }));
  assert.ok(notesOnly.includes('No changes · 1 note') && notesOnly.includes('## Note · line 3'), 'a record of one note and nothing else');
  assert.ok(R.prompt(R.build({ target, base: BASE, text: BASE, units: units(BASE, BASE), notes: [] })).startsWith('Here are changes and notes on `docs/x.md`'));
  const wrapped = '# T\n\nLine one of a\nwrapped paragraph that\nends here.\n';
  const reworded = wrapped.replace('wrapped paragraph that', 'hard-wrapped paragraph that');
  const md2 = R.markdown(R.build({ target, at: '2026-10-01T00:00:00Z', base: wrapped, text: reworded, units: units(wrapped, reworded), notes: [] }));
  assert.ok(md2.includes('```diff\n  Line one of a\n- wrapped paragraph that\n+ hard-wrapped paragraph that\n  ends here.\n```'),
    'one line changed in a wrapped paragraph is one line struck and added, the others context');
});

test('a record round-trips: its notes, anchored again from the record, build the same record', () => {
  const target = { repository: 'o/r', ref: 'main', path: 'a.md', blob: 'b' };
  const text = BASE.replace('Delta para four.\n', 'Delta para four.\n\nEcho added.\n');
  const us = units(BASE, text);
  const notes = [
    R.make(unitWith(us, BASE, text, 'Charlie'), BASE, text, 'one'),
    R.make(us.find((u) => u.card != null), BASE, text, 'two'),
    { ...R.make(unitWith(us, BASE, text, 'Alpha'), BASE, text, 'three'), o: null, e: null },
  ];
  const args = { target, at: '2026-10-01T00:00:00Z', base: BASE, text, units: us };
  const rec = JSON.parse(JSON.stringify(R.build({ ...args, notes })));
  const again = R.build({ ...args, notes: R.notesFrom(rec, BASE) });
  assert.deepEqual(again, rec);
});
