// Tracked changes under paragraph edits: a matrix of joins, splits and moves
// driven through the real kits, each checked against what every change card
// must satisfy whatever the edit was.
//
// For every card in the Rendered view's tracked render:
//   - the `old` reading is the base's text for the run, and `new` the buffer's;
//   - the marked (`inline`) reading, without its struck words and break marks,
//     reads as `new`, and without its green words reads as `old`: the marks
//     account for every difference and invent none;
//   - every stamped run is the buffer's own text, so a tap lands where it looks.
// And for the document: reverting every card restores the base exactly, and
// one undo restores the text from before the edit.
//
// Paragraph breaks have no words, so a word diff cannot mark them; each
// scenario also states how many closed (struck ¶) and opened (green ¶) breaks
// its cards should show.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import jsdomPkg from 'jsdom';
import { marked } from 'marked';
import { repoRoot } from './bootstrap.mjs';

const { JSDOM } = jsdomPkg;
const dom = new JSDOM('<!doctype html><body><div id="box"><div id="host"></div></div></body>');
const window = dom.window;
window.mdDoc = { html: (t) => marked.parse(t) };
window.GuideRender = { render: (md) => ({ html: marked.parse(md) }) };
window.Range.prototype.getClientRects = () => [];
window.Range.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
window.matchMedia = () => ({ matches: true });
const Diff = (await import('diff')).default ?? (await import('diff'));
window.Diff = Diff;
for (const kit of ['standoff.js', 'md-diff.js', 'md-surface.js', 'dictate.js']) {
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits', kit), 'utf8'))(window, window.document);
}
const host = window.document.getElementById('host');
const box = window.document.getElementById('box');
const M = window.MdSurface, D = window.Dictate, mdDiff = window.mdDiff;

const BASE = [
  '# Title', '',
  'Alpha one. Alpha two. Alpha three.', '',
  'Bravo one. Bravo two.', '',
  'Charlie one.', '',
  '- item one', '- item two', '',
  '## Section', '',
  'Delta one. Delta two.', '',
].join('\n');

const paint = (text) => { host.__mdKey = null; host.__readings = {}; M.paint(host, { text, base: BASE, track: true, overlay: box }); };
const squash = (s) => s.replace(/\s+/g, '');
// A layer's text with some parts left out.
const textWithout = (el, sel) => {
  const c = el.cloneNode(true);
  for (const n of c.querySelectorAll(sel)) n.remove();
  return c.textContent;
};
// The dashed seam traces a break the other reading has, in the readings with
// fewer paragraphs only: a closed break is a seam in `inline` and `new`, an
// opened one a seam in `old`, and no reading marks a break it shows.
const seamProblems = (card, i) => {
  const out = [], n = (sel) => card.querySelectorAll(sel).length;
  const closed = n('[data-md-reading="inline"] [data-md-break="closed"]');
  const opened = n('[data-md-reading="old"] [data-md-break="opened"]');
  for (const m of ['inline', 'new']) {
    if (card.querySelector(`[data-md-reading="${m}"]`) && n(`[data-md-reading="${m}"] [data-md-seam]`) !== closed)
      out.push(`card ${i + 1}: ${m} has ${n(`[data-md-reading="${m}"] [data-md-seam]`)} seams for ${closed} closed breaks`);
  }
  if (card.querySelector('[data-md-reading="inline"]') && card.querySelector('[data-md-reading="old"]')
      && n('[data-md-reading="old"] [data-md-seam]') !== opened)
    out.push(`card ${i + 1}: old has ${n('[data-md-reading="old"] [data-md-seam]')} seams for ${opened} opened breaks`);
  if (n('[data-md-gap]')) out.push(`card ${i + 1}: a gap line`);
  return out;
};
const rendered = (md) => { const d = window.document.createElement('div'); d.innerHTML = marked.parse(md); return d.textContent; };

function check(text, want = {}) {
  paint(text);
  const cards = [...host.querySelectorAll('[data-md-card]')];
  const runs = M.cards(host);
  const problems = [];
  cards.forEach((card, i) => {
    const r = runs[i];
    const oldMd = r.filter((e) => e.oldRange).sort((x, y) => x.oldRange.start - y.oldRange.start).map((e) => e.old).join('\n\n');
    const newMd = r.filter((e) => e.newRange).map((e) => text.slice(e.newRange.start, e.newRange.end)).join('\n\n');
    const L = (m) => card.querySelector(`[data-md-reading="${m}"]`);
    if (L('old') && squash(L('old').textContent) !== squash(rendered(oldMd))) problems.push(`card ${i + 1}: old reading is not the base`);
    if (L('new') && squash(L('new').textContent) !== squash(rendered(newMd))) problems.push(`card ${i + 1}: new reading is not the buffer`);
    const inl = L('inline');
    if (inl && r.some((e) => e.newRange)) {
      const asNew = textWithout(inl, 'del, [data-md-break]');
      if (squash(asNew) !== squash(rendered(newMd))) problems.push(`card ${i + 1}: marked minus struck is not new: "${asNew.trim().slice(0, 80)}"`);
      const asOld = textWithout(inl, '.md-diff-ins, [data-md-break]');
      if (squash(asOld) !== squash(rendered(oldMd))) problems.push(`card ${i + 1}: marked minus green is not old: "${asOld.trim().slice(0, 80)}" vs "${rendered(oldMd).trim().slice(0, 80)}"`);
    }
    problems.push(...seamProblems(card, i));
  });
  for (const sp of host.querySelectorAll('[data-src]')) {
    const s = +sp.dataset.src, t = sp.firstChild.data;
    if (text.slice(s, s + t.length).replace(/\s/g, ' ') !== t.replace(/\s/g, ' ')) problems.push(`run at ${s} is not the buffer's text`);
  }
  let back = text;
  for (let i = runs.length - 1; i >= 0; i--) back = mdDiff.revert(BASE, back, runs[i]);
  if (back !== BASE) problems.push('reverting every card does not restore the base: ' + JSON.stringify(back));
  const closed = host.querySelectorAll('[data-md-break="closed"]').length;
  const opened = host.querySelectorAll('[data-md-break="opened"]').length;
  if (want.cards != null && cards.length !== want.cards) problems.push(`cards ${cards.length}, want ${want.cards}`);
  if (want.closed != null && closed !== want.closed) problems.push(`closed breaks ${closed}, want ${want.closed}`);
  if (want.opened != null && opened !== want.opened) problems.push(`opened breaks ${opened}, want ${want.opened}`);
  return { cards: cards.length, closed, opened, problems };
}

// The edit, and what one undo gives back: the text from before its last step.
const edit = (fn) => {
  const d = D.create({ win: {} });
  d.text = BASE;
  let before = BASE;
  const d2 = new Proxy(d, { get: (o, k) => {
    const v = o[k];
    return typeof v === 'function' && ['join', 'split', 'move', 'backWord', 'type'].includes(k)
      ? (...a) => { before = o.text; return v.apply(o, a); } : (typeof v === 'function' ? v.bind(o) : v);
  } });
  fn(d2, BASE);
  const after = d.text;
  d.undo();
  return { after, undone: d.text, before };
};
const at = (t, s, k = 0) => { const i = t.indexOf(s); if (i < 0) throw new Error('missing ' + s); return i + k; };
const span = (t, s) => [at(t, s), at(t, s) + s.length];

const SCENARIOS = [
  { name: 'join two paragraphs', want: { cards: 1, closed: 1, opened: 0 },
    run: (d, t) => d.join(at(t, 'Bravo one')),
    expect: (x) => x.includes('Alpha three. Bravo one.') },
  { name: 'split a paragraph between sentences', want: { cards: 1, closed: 0, opened: 1 },
    run: (d, t) => d.split(at(t, ' Alpha two')),
    expect: (x) => x.includes('Alpha one.\n\nAlpha two.') },
  { name: 'split, then join the halves back', want: { cards: 0 },
    run: (d, t) => { d.split(at(t, ' Alpha two')); d.join(at(d.text, 'Alpha two')); },
    expect: (x) => x === BASE },
  { name: 'carry a sentence to the end of the next paragraph', want: { cards: 2 },
    run: (d, t) => d.move(...span(t, 'Alpha two.'), at(t, 'Bravo two.', 10)),
    expect: (x) => x.includes('Alpha one. Alpha three.') && x.includes('Bravo two. Alpha two.') },
  { name: 'carry a sentence to the gap below as its own paragraph', want: { cards: 1, opened: 1 },
    run: (d, t) => d.move(...span(t, 'Alpha three.'), at(t, '\n\nBravo'), true),
    expect: (x) => x.includes('Alpha two.\n\nAlpha three.\n\nBravo one.') },
  { name: 'carry a paragraph onto the end of the one above (a join)', want: { cards: 1, closed: 1 },
    run: (d, t) => d.move(...span(t, 'Bravo one. Bravo two.'), at(t, 'Alpha three.', 12)),
    expect: (x) => x.includes('Alpha three. Bravo one. Bravo two.\n\nCharlie') },
  { name: 'carry a paragraph up past another (a reorder)', want: {},
    run: (d, t) => d.move(...span(t, 'Charlie one.'), at(t, '\n\nAlpha'), true),
    expect: (x) => x.includes('# Title\n\nCharlie one.\n\nAlpha one.') && x.includes('Bravo two.\n\n- item one') },
  { name: 'carry a paragraph down to the end of the document', want: {},
    run: (d, t) => d.move(...span(t, 'Bravo one. Bravo two.'), t.length, true),
    expect: (x) => x.endsWith('Delta two.\n\nBravo one. Bravo two.\n') && x.includes('Alpha three.\n\nCharlie one.') },
  { name: 'carry a paragraph across a heading', want: {},
    run: (d, t) => d.move(...span(t, 'Delta one. Delta two.'), at(t, '\n\n## Section'), true),
    expect: (x) => x.includes('- item two\n\nDelta one. Delta two.\n\n## Section') },
  { name: 'carry one word within its paragraph', want: { cards: 1, closed: 0, opened: 0 },
    run: (d, t) => d.move(...span(t, 'two.'), at(t, 'Alpha three.', 12)),
    expect: (x) => x.includes('Alpha one. Alpha Alpha three. two.') },
  { name: 'carry a list item out into a paragraph of its own', want: {},
    run: (d, t) => d.move(...span(t, 'item two'), at(t, '\n\n## Section'), true),
    expect: (x) => x.includes('- item one\n\nitem two\n\n## Section') && !/^-\s*$/m.test(x) },
  { name: 'edit a word, then carry the next paragraph onto it (the reported case)', want: { cards: 1, closed: 1 },
    run: (d, t) => { d.select(...span(t, 'Alpha two. ')); d.backWord(); d.move(...span(d.text, 'Bravo one. Bravo two.'), at(d.text, 'Alpha three.', 12)); },
    expect: (x) => x.includes('Alpha one. Alpha three. Bravo one. Bravo two.\n\nCharlie') },
  { name: 'two separate edits make two cards', want: { cards: 2, closed: 1, opened: 1 },
    run: (d, t) => { d.split(at(t, ' Alpha two')); d.join(at(d.text, 'Delta one')); },
    expect: (x) => x.includes('Alpha one.\n\nAlpha two.') && x.includes('Section Delta one.') },
  { name: 'edit two neighbouring paragraphs apart: a card each', want: { cards: 2, closed: 0, opened: 0 },
    run: (d, t) => { d.select(...span(t, 'Alpha three.')); d.backWord(); d.select(...span(d.text, 'Bravo two.')); d.backWord(); },
    expect: (x) => /Alpha two\.\s*\n\nBravo one\.\s*\n\nCharlie/.test(x) },
  { name: 'join, then edit the paragraph below: the join is one card, the edit another', want: { cards: 2, closed: 1 },
    run: (d, t) => { d.join(at(t, 'Bravo one')); d.select(...span(d.text, 'Charlie one.')); d.backWord(); d.type('Charlie two.'); },
    expect: (x) => x.includes('Alpha three. Bravo one. Bravo two.\n\nCharlie two.') },
  { name: 'split, then edit the paragraph below: the split is one card, the edit another', want: { cards: 2, opened: 1 },
    run: (d, t) => { d.split(at(t, ' Alpha two')); d.select(...span(d.text, 'Bravo two.')); d.backWord(); },
    expect: (x) => /Alpha one\.\n\nAlpha two\. Alpha three\.\n\nBravo one\.\s*\n\nCharlie/.test(x) },
  { name: 'join three paragraphs into one: one card, two seams', want: { cards: 1, closed: 2 },
    run: (d, t) => { d.join(at(t, 'Bravo one')); d.join(at(d.text, 'Charlie one')); },
    expect: (x) => x.includes('Alpha three. Bravo one. Bravo two. Charlie one.\n\n- item') },
  { name: 'join a paragraph to a heading-less neighbour after a list', want: {},
    run: (d, t) => d.join(at(t, 'Bravo one') - 2) || d.join(at(t, 'Charlie')),
    expect: (x) => x !== BASE },
  { name: 'edit two neighbours and swap them: the original reads in its own order', want: { cards: 1 },
    run: (d, t) => {
      d.select(...span(t, 'Alpha three.')); d.backWord();
      d.select(...span(d.text, 'Bravo two.')); d.backWord();
      const x = d.text, b0 = at(x, 'Bravo one.'), b1 = x.indexOf('\n\n', b0);
      d.move(b0, b1, at(x, '\n\nAlpha'), true);
    },
    expect: (x) => /Bravo one\.\s*\n\nAlpha one\. Alpha two\./.test(x) },
  { name: 'carry text into the middle of a sentence elsewhere', want: { },
    run: (d, t) => d.move(...span(t, 'Charlie one.'), at(t, 'Bravo two.')),
    expect: (x) => x.includes('Bravo one. Charlie one. Bravo two.') },
];

// Every scenario runs; the failures are collected by name so one broken case
// does not hide the rest.
test('every edit in the matrix leaves its cards honest, revertible and undoable', () => {
  const failures = [];
  for (const sc of SCENARIOS) {
    const { after, undone, before } = edit(sc.run);
    const problems = [];
    if (!sc.expect(after)) problems.push('the edit itself went wrong');
    if (undone !== before) problems.push('one undo does not take back the last step whole');
    if (!after.endsWith('\n')) problems.push('the file lost its last newline');
    problems.push(...check(after, sc.want).problems);
    if (problems.length) failures.push({ scenario: sc.name, after, problems });
  }
  assert.deepEqual(failures, [], JSON.stringify(failures, null, 1));
});

// ── A seeded walk over real documents ──────────────────────────────────────
// The matrix is the cases thought of; this is the ones that were not. Each
// step applies a random join, split or move (inline or as a paragraph) to a
// repo document and checks the same invariants against that document as its
// base, then reverts one card, the first, and checks again: a host reverts
// one card at a time and re-renders, so the cards left behind have to be
// right too.
const rng = (seed) => () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
function checkAgainst(base, text) {
  host.__mdKey = null; host.__readings = {};
  M.paint(host, { text, base, track: true, overlay: box });
  const out = [];
  const cards = [...host.querySelectorAll('[data-md-card]')], runs = M.cards(host);
  cards.forEach((card, i) => {
    const r = runs[i];
    const oldMd = r.filter((e) => e.oldRange).sort((x, y) => x.oldRange.start - y.oldRange.start).map((e) => e.old).join('\n\n');
    const newMd = r.filter((e) => e.newRange).map((e) => text.slice(e.newRange.start, e.newRange.end)).join('\n\n');
    const oldL = card.querySelector('[data-md-reading="old"]');
    if (oldL && squash(oldL.textContent) !== squash(rendered(oldMd))) out.push(`card ${i + 1}: old reading is not the base, in its order`);
    const inl = card.querySelector('[data-md-reading="inline"]');
    if (inl && r.some((e) => e.newRange) && r.some((e) => e.oldRange)) {
      if (squash(textWithout(inl, 'del, [data-md-break]')) !== squash(rendered(newMd))) out.push(`card ${i + 1}: marked minus struck is not new`);
      if (squash(textWithout(inl, '.md-diff-ins, [data-md-break]')) !== squash(rendered(oldMd))) out.push(`card ${i + 1}: marked minus green is not old`);
    }
    out.push(...seamProblems(card, i));
  });
  for (const sp of host.querySelectorAll('[data-src]')) {
    const s = +sp.dataset.src, t = sp.firstChild.data;
    if (text.slice(s, s + t.length).replace(/\s/g, ' ') !== t.replace(/\s/g, ' ')) { out.push(`run at ${s} is not the buffer's text`); break; }
  }
  let back = text;
  for (let i = runs.length - 1; i >= 0; i--) back = mdDiff.revert(base, back, runs[i]);
  if (back !== base) out.push('reverting every card does not restore the base');
  return { out, runs };
}

const CORPUS = ['skills/skill-prefs/SKILL.md', 'skills/doc-craft/SKILL.md', 'docs/annotation.md', 'docs/QUALIFIED-WRITING.md'];
test('a seeded walk of joins, splits and moves over real documents keeps every card honest', () => {
  const failures = [];
  for (const file of CORPUS) {
    const base = readFileSync(path.join(repoRoot, file), 'utf8');
    const rand = rng(file.length * 7919);
    const pick = (n) => Math.floor(rand() * n);
    for (let step = 0; step < 40 && failures.length < 3; step++) {
      const d = D.create({ win: {} });
      d.text = base;
      const t = base;
      // one to three edits per step, so edits meet cards already there
      const n = 1 + pick(3);
      const did = [], kinds = [];
      let before = base;
      for (let k = 0; k < n; k++) {
        const x = d.text, op = pick(4);
        const was = d.text;
        let done = false;
        // Joins and splits are taken where the page offers them: between two
        // paragraphs of prose, and at a space in prose outside inline code.
        const prose = (line) => /^[A-Za-z*_(\[]/.test(line) && !/^(?:[-*+] |\d+[.)] |---|___|\*\*\*$)/.test(line);
        const lineAt = (i) => x.slice(x.lastIndexOf('\n', i - 1) + 1, (x.indexOf('\n', i) + 1 || x.length + 1) - 1);
        const inCode = (i) => (lineAt(i).slice(0, i - (x.lastIndexOf('\n', i - 1) + 1)).match(/`/g) || []).length % 2 === 1;
        if (op === 0) {
          const breaks = [...x.matchAll(/\S(\n[^\S\n]*\n\s*)(?=[A-Za-z])/g)].map((m) => m.index + 1)
            .filter((i) => prose(lineAt(i - 1)) && prose(lineAt(x.slice(i).search(/\S/) + i)));
          if (breaks.length) { const b = breaks[pick(breaks.length)]; if (d.join(b)) { did.push(`join@${b}`); kinds.push('join'); done = true; } }
        } else if (op === 1) {
          const gaps = [...x.matchAll(/[.!?,;:]? (?=[A-Za-z])|\n(?=[a-z])/g)].map((m) => m.index + (m[0][0] === ' ' || m[0][0] === '\n' ? 0 : 1))
            .filter((i) => prose(lineAt(i)) && !inCode(i));
          if (gaps.length) { const g = gaps[pick(gaps.length)]; if (d.split(g)) { did.push(`split@${g}`); kinds.push('split'); done = true; } }
        } else {
          // A sentence (across a soft wrap too), or a list item's words; with
          // its spaces sometimes; dropped between words, at either end of the
          // file, or onto a break as a paragraph of its own.
          const pool = op === 2
            ? [...x.matchAll(/[A-Z][^.!?`|]{3,120}?[.!?]/g)].filter((m) => !m[0].includes('\n\n'))
            : [...x.matchAll(/^[ \t]*(?:[-*+]|\d{1,3}[.)]) +([^\n`|]{2,60})$/gm)].map((m) => Object.assign([m[1]], { index: m.index + m[0].length - m[1].length }));
          if (pool.length) {
            const m = pool[pick(pool.length)];
            let a = m.index, b = a + m[0].length;
            if (rand() < 0.3 && x[a - 1] === ' ') a--;
            if (rand() < 0.3 && x[b] === ' ') b++;
            const asPara = rand() < 0.5, edge = rand() < 0.15;
            let to;
            if (edge) to = rand() < 0.5 ? 0 : x.length;
            else if (asPara) { const brs = [...x.matchAll(/\n\n/g)].map((q) => q.index); to = brs.length ? brs[pick(brs.length)] : x.length; }
            else { const ws = [...x.matchAll(/ (?=\w)/g)].map((q) => q.index + 1); to = ws.length ? ws[pick(ws.length)] : 0; }
            if (d.move(a, b, to, asPara)) { did.push(`move[${a},${b})->${to}${asPara ? '¶' : ''}`); kinds.push('move'); done = true; }
          }
        }
        if (done) before = was;
      }
      const text = d.text;
      if (text === t) continue;
      const problems = [];
      // The file ends as it did.
      if (/\n$/.test(text) !== /\n$/.test(base) || /\n\n$/.test(text) && !/\n\n$/.test(base)) problems.push('the file no longer ends as it did');
      const r1 = checkAgainst(base, text);
      problems.push(...r1.out);
      // A lone join shows a struck ¶, a lone split a green one: the word
      // checks above cannot see either, since a break has no words.
      if (kinds.length === 1 && kinds[0] === 'join' && !host.querySelector('[data-md-break="closed"]')) problems.push('a join with no seam');
      if (kinds.length === 1 && kinds[0] === 'split' && !host.querySelector('[data-md-break="opened"]')) problems.push('a split with no seam');
      // One undo takes back the last edit whole.
      if (kinds.length) { d.undo(); if (d.text !== before) problems.push('one undo does not take back the last edit'); }
      if (problems.length) { failures.push({ file, step, did, problems }); continue; }
      if (r1.runs.length) {
        const one = mdDiff.revert(base, text, r1.runs[0]);
        const r2 = checkAgainst(base, one);
        if (r2.out.length) failures.push({ file, step, did, after: 'revert card 1', problems: r2.out });
      }
    }
  }
  assert.deepEqual(failures, [], JSON.stringify(failures, null, 1));
});
