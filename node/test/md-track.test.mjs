// kits/md-track.js: typing over a rendered markdown document makes a tracked
// change. What is held here is the edit one input makes to the markdown
// string, since that is the whole model: the redline is only ever drawn from
// it. A wrong rule here edits the file in a way the reader did not see coming,
// such as a bold's markers left orphaned, a heading's hashes kept on a line
// the reader turned into prose, or a word deleted out of the wrong block.
// The address a copied path carries and the errand record are held too.
//
// Where the caret lands and what the redline shows is layout, and
// node/render/scenarios/md-track.mjs drives it in a browser.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot, makeWindow } from './bootstrap.mjs';
import * as Diff from 'diff';

const { window } = makeWindow();
window.Diff = Diff;
for (const kit of ['md-surface.js', 'md-track.js', 'repo-address.js', 'errands.js']) {
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits', kit), 'utf8'))(window, window.document);
}
const T = window.mdTrack, E = window.Errands;
const at = (a, b = a) => ({ a, b });

test('typing over a selection replaces exactly the selected source', () => {
  const md = 'The quick brown fox.';
  assert.deepEqual(T.edit(md, at(4, 9), { type: 'insert', data: 's' }), { text: 'The s brown fox.', caret: 5 });
  assert.deepEqual(T.edit(md, at(4), { type: 'insert', data: 'very ' }), { text: 'The very quick brown fox.', caret: 9 });
  assert.equal(T.edit(md, at(4), { type: 'insert', data: '' }), null, 'an empty insertion at a caret is no edit');
});

test('deleting a selection takes the selection, and a wrapper goes with its last character', () => {
  assert.deepEqual(T.edit('a **bold** word', at(4, 8), { type: 'backward' }), { text: 'a  word', caret: 2 },
                   'the markers of a bold emptied by the deletion leave with it');
  assert.deepEqual(T.edit('a **bold** word', at(4, 6), { type: 'forward' }), { text: 'a **ld** word', caret: 4 },
                   'while a character of the bold stands, its markers stay');
});

test('a collapsed backspace: a line marker goes first, then a block joins the one above', () => {
  assert.deepEqual(T.edit('## Title\n\nBody', at(3), { type: 'backward' }), { text: 'Title\n\nBody', caret: 0 },
                   "backspace at a heading's first word drops its hashes");
  assert.deepEqual(T.edit('One.\n\nTwo.', at(6), { type: 'backward' }), { text: 'One. Two.', caret: 5 },
                   'at a paragraph start it joins the paragraph above with a space');
  // The block rule wins over a platform range, which would span the gap and the markers.
  assert.deepEqual(T.edit('One.\n\n## Two', at(9), { type: 'backward', target: at(4, 9) }), { text: 'One.\n\nTwo', caret: 6 });
});

test('a collapsed deletion takes the platform range when there is one, else one character', () => {
  // The caret after a bold's last word: the DOM's previous character is the
  // word's last letter, not the closing marker.
  assert.deepEqual(T.edit('a **bold** b', at(10), { type: 'backward', target: at(7, 8) }), { text: 'a **bol** b', caret: 7 });
  assert.deepEqual(T.edit('abc', at(2), { type: 'backward' }), { text: 'ac', caret: 1 });
  assert.deepEqual(T.edit('abc', at(1), { type: 'forward' }), { text: 'ac', caret: 1 });
  assert.equal(T.edit('abc', at(0), { type: 'backward' }), null, 'nothing before the start');
  assert.equal(T.edit('abc', at(3), { type: 'forward' }), null, 'nothing after the end');
  assert.deepEqual(T.edit('a😀b', at(3), { type: 'backward' }), { text: 'ab', caret: 1 }, 'an emoji goes whole');
});

test('Enter makes a paragraph, or the next list item', () => {
  assert.deepEqual(T.edit('One two', at(3), { type: 'paragraph' }), { text: 'One\n\n two', caret: 5 });
  assert.deepEqual(T.edit('- one', at(5), { type: 'paragraph' }), { text: '- one\n- ', caret: 8 });
  assert.equal(T.edit('x', at(0), { type: 'formatBold' }), null, 'formatting input is ignored: markdown is typed');
});

test("the patch and the address are the file's, frontmatter included", () => {
  const fm = '---\ntitle: t\n---\n', base = '# Doc\n\nOne.\n\nTwo.\n';
  const file = { repo: 'me/r', ref: 'main', path: 'docs/a.md', full: fm + base };
  const [o, n] = T.full(file, base, base.replace('Two.', 'Three.'));
  assert.equal(o, fm + base);
  assert.equal(n, fm + '# Doc\n\nOne.\n\nThree.\n');
  assert.equal(T.where(file, o, n), 'me/r@main:docs/a.md (line 8)', 'the base line, counted in the whole file');
  const [o2, n2] = T.full(file, base, base.replace('One.', 'Uno.').replace('Two.', 'Dos.'));
  assert.equal(T.where(file, o2, n2), 'me/r@main:docs/a.md (lines 6, 8)');
  assert.equal(T.where(file, o, o), 'me/r@main:docs/a.md', 'no change, no lines');
  assert.match(T.prompt(file, 'PATCH'), /`docs\/a\.md` in me\/r \(branch main\)[\s\S]*git apply[\s\S]*```diff\nPATCH\n```$/);
});

test('claudeRequest writes the record agent_errand.py files for --agent claude', () => {
  const r = E.claudeRequest({ title: 'Apply an edit to  docs/a.md', prompt: 'do it', registry: 'me/reg', now: '2026-11-24T23:00:00.500Z' });
  assert.match(r.id, /^claude-2026-11-24-[a-z0-9]+$/);
  assert.match(r.id, /^[a-z0-9][a-z0-9.-]{0,95}$/, "the daemon's id rule");
  assert.equal(r.title, 'Apply an edit to docs/a.md');
  assert.deepEqual(r.run, { method: 'claude-errand', venue: 'anthropic-cloud',
                            script: 'mehrlander/web-tools-private@main:sessions/tools/agent_errand.py', args: { prompt: 'do it' } });
  assert.equal(r.dest, 'me/reg@background:errands/results');
  assert.equal(r.createdAt, '2026-11-24T23:00:00Z');
  assert.equal(E.validate(E.normalize(r)).ok, true);
  assert.throws(() => E.claudeRequest({ title: 't', prompt: ' ' }), /needs a prompt/);
  assert.throws(() => E.claudeRequest({ title: 't', prompt: 'p', venue: 'work-machine' }), /runs on/);
});
