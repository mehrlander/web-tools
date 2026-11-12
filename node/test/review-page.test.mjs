// The standalone page hosts the same file comparison as branch detail.
// Exercise its real markup and navigation with renderer outputs stubbed;
// these cases concern the selected file, base and controls, not pixel layout.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as Diff from 'diff';
import { marked } from 'marked';
import { makeWindow, tick, repoRoot, captureAlpineErrors, withBase64 } from './bootstrap.mjs';

const page = readFileSync(path.join(repoRoot, 'pages/review.html'), 'utf8');
const script = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(m => m[1]).find(s => s.includes('function reviewApp()'));
assert.ok(script, 'the page defines its application');
const body = page.match(/<body\b[^>]*>[\s\S]*?<\/body>/i)?.[0]
  .replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/g, '');
const { window, problems } = makeWindow({
  html: '<!doctype html><html>' + body + '</html>',
  url: 'https://mehrlander.github.io/web-tools/pages/review.html',
});
window.__depsReady = Promise.resolve();
window.reviewApp = new window.Function(script + '\nreturn reviewApp;')();
window.ghAuth = { prompt() {} };

const fetched = [];
const suspendedReads = new Map();
window.GH = withBase64(class {
  constructor({ repo = '', ref = '' } = {}) { this.repo = repo; this.ref = ref; }
  async get(file) {
    fetched.push({ repo: this.repo, ref: this.ref, path: file });
    if (suspendedReads.has(this.ref)) await new Promise(resolve => suspendedReads.get(this.ref).push(resolve));
    return { text: /\.(md|markdown)$/i.test(file)
      ? `# ${file}\n\nDocument at ${this.ref}.\n`
      : `export const revision = ${JSON.stringify(this.ref)};\n`, size: 50 };
  }
  async req(p) {
    return p === '' || p.startsWith('/repos/') ? { default_branch: 'main' } : [];
  }
  async compare() {
    return { status: 'ahead', ahead_by: 1, behind_by: 0, commits: [], files: [
      { filename: 'docs/readme.md', status: 'modified', patch: '@@ -1 +1 @@\n-old\n+new' },
      { filename: 'lib/main.js', status: 'modified', patch: '@@ -1 +1 @@\n-old\n+new' },
    ] };
  }
});
window.TOKEN = 'test';
window.gh = { async load(name) { throw new Error('Unexpected dependency: ' + name); } };
window.marked = marked;
window.srcDoc = {};
window.mdDoc = { enhance() {} };
const renderedPairs = [];
window.mdDiff = {
  async needDiff() { return Diff; },
  async render(host, oldText, newText) {
    renderedPairs.push({ oldText, newText });
    host.classList.add('md-diff-doc');
    const p = window.document.createElement('p');
    p.textContent = newText;
    host.replaceChildren(p);
    return { count: 1 };
  },
};
const renderSource = async (host, text) => {
  const node = window.document.createElement('div');
  node.className = 'cm-editor';
  node.textContent = text;
  host.replaceChildren(node);
  return { destroy() { node.remove(); } };
};
window.cm6Merge = {
  langFor: () => null,
  unified: (host, o) => renderSource(host, o.doc),
  split: (host, o) => renderSource(host, o.a + '\n' + o.b),
};

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
const { default: collapse } = await import('@alpinejs/collapse/dist/module.esm.js');
window.Alpine = Alpine;
captureAlpineErrors(Alpine);
Alpine.plugin(collapse);
Alpine.data('reviewApp', window.reviewApp);
for (const file of ['lib/vanilla-bundle.js', 'lib/kits/repo-address.js',
                    'lib/kits/guide-render.js', 'lib/kits/source-peek.js', 'lib/kits/review-target.js',
                    'lib/alpineComponents/file-review.js']) {
  new window.Function(readFileSync(path.join(repoRoot, file), 'utf8'))();
}
Alpine.start();
await tick(5);
const app = () => Alpine.$data(window.document.body);
const cardElement = () => window.document.querySelector('[x-data="fileReview(f)"]');
const card = () => cardElement()?._x_dataStack ? Alpine.$data(cardElement()) : null;
const visible = node => {
  for (let p = node; p; p = p.parentElement) {
    if (window.getComputedStyle(p).display === 'none') return false;
  }
  return !!node;
};
const headerButtons = () => [...window.document.querySelectorAll('header button')].filter(visible);
const modeButton = key => {
  const mode = card()?.viewModes.find(m => m.key === key);
  return mode && headerButtons().find(b => b.getAttribute('aria-label') === mode.label);
};
async function until(check, message) {
  const end = Date.now() + 2500;
  while (Date.now() < end) {
    if (check()) return;
    await tick(2);
  }
  assert.fail(message);
}
const DOC = { repo: 'acme/tools', ref: 'feature', base: 'main', path: 'docs/readme.md' };
async function navigate(target) {
  app().setHash(target);
  await until(() => app().repo === target.repo && app().head === target.ref
    && app().path === (target.path || '') && !app().loading
    && (target.path ? card()?.loaded && card().path === target.path && card().ref === target.ref
      && card().base === target.base : app().mode === 'changeset' && app().files.length === 2),
  'the requested page target settled');
  await tick(4);
}

after(async () => {
  Alpine.destroyTree(window.document.body);
  await tick(3);
  window.close();
});

test('Markdown opens on a rendered comparison with the controls in the page header', async () => {
  await navigate(DOC);
  assert.equal(card().tab, 'mddiff');
  assert.ok(renderedPairs.some(p => p.oldText.includes('main') && p.newText.includes('feature')));
  const button = modeButton('rendered');
  assert.ok(button, 'the shared rendered comparison mode is available in the header');
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(visible(cardElement().querySelector('[role="tablist"]')), false,
    'the inner source-tab strip does not duplicate the host controls');
  assert.equal([...cardElement().querySelectorAll('button')]
    .filter(b => b.getAttribute('@click') === 'toggle()').some(visible), false,
  'the hosted file has no visible collapse control');
});

test('header mode choices drive the shared card and keep their selected state', async () => {
  modeButton('file').click();
  await until(() => card().tab === 'read', 'the document reading opened');
  assert.equal(modeButton('file').getAttribute('aria-pressed'), 'true');
  modeButton('unified').click();
  await until(() => card().tab === 'diff' && card().view === 'unified', 'the inline source comparison opened');
  assert.equal(modeButton('unified').getAttribute('aria-pressed'), 'true');
  modeButton('rendered').click();
  await until(() => card().tab === 'mddiff', 'the rendered comparison reopened');
  assert.equal(modeButton('rendered').getAttribute('aria-pressed'), 'true');
});

test('turning comparison off from rendered prose shows the document and can recover', async () => {
  const pickComparison = async label => {
    const menu = window.document.querySelector('header [aria-label="Compare against"]').parentElement;
    menu.open = true;
    await tick(2);
    const choice = [...menu.querySelectorAll('button')].find(b => b.textContent.trim() === label);
    assert.ok(choice, 'the comparison choice is offered');
    choice.click();
  };
  await pickComparison('No comparison');
  await until(() => card().compareOff && card().tab === 'read'
    && visible(cardElement().querySelector('[x-ref="readBox"]')),
  'the document replaced the disabled comparison');
  assert.equal(modeButton('rendered'), undefined);
  assert.ok(visible(cardElement().querySelector('[x-ref="readBox"]')));
  await pickComparison('main');
  await until(() => !card().compareOff && !!modeButton('rendered'), 'comparison modes became available again');
  modeButton('rendered').click();
  await until(() => card().tab === 'mddiff' && cardElement().querySelector('[x-ref="mdDiffHost"]').children.length,
    'rendered changes returned');
});

test('code opens on a source comparison and does not offer a prose comparison', async () => {
  await navigate({ ...DOC, path: 'lib/main.js' });
  assert.equal(card().tab, 'diff');
  assert.equal(card().viewModes.some(m => m.key === 'rendered'), false);
  assert.ok(modeButton('unified'), 'source comparison remains available');
  assert.ok(cardElement().querySelector('.cm-editor'));
});

test('a changeset round trip remounts the same file with its standalone comparison', async () => {
  await navigate(DOC);
  await navigate({ repo: DOC.repo, ref: DOC.ref, base: DOC.base });
  const listCard = cardElement();
  assert.equal(Alpine.$data(listCard).hosted, false);
  assert.equal(Alpine.$data(listCard).open, false);
  await navigate(DOC);
  assert.notEqual(cardElement(), listCard, 'the closed changeset row is replaced');
  assert.equal(card().tab, 'mddiff');
  assert.equal(card().open, true);
  assert.equal(modeButton('rendered').getAttribute('aria-pressed'), 'true');
});

test('an explicit URL base overrides stale comparison state for the same file', async () => {
  window.__compareRef = { repo: DOC.repo, ref: DOC.ref, off: true };
  await navigate({ ...DOC, base: 'release' });
  assert.equal(card().compareOff, false);
  assert.equal(card().base, 'release');
  assert.equal(card().tab, 'mddiff');
  window.__compareRef = { repo: DOC.repo, ref: DOC.ref, base: 'old-selection' };
  const firstNewRead = fetched.length;
  await navigate(DOC);
  assert.equal(card().base, 'main');
  assert.equal(card().compareOff, false);
  assert.equal(fetched.slice(firstNewRead).some(f => f.ref === 'old-selection'), false,
    'the new card never fetches the stale base');
});

test('the header follows a new Markdown target after a source comparison', async () => {
  modeButton('unified').click();
  await until(() => card().tab === 'diff', 'the source comparison opened');
  await navigate({ ...DOC, ref: 'next-feature', path: 'docs/other.markdown' });
  assert.equal(card().tab, 'mddiff');
  assert.equal(app().card.path, 'docs/other.markdown');
  assert.equal(app().card.ref, 'next-feature');
  assert.equal(modeButton('rendered').getAttribute('aria-pressed'), 'true');
  assert.ok(renderedPairs.at(-1).newText.includes('next-feature'));
});

test('a late response for a file already left cannot replace the current file or header', async () => {
  const waiting = [];
  suspendedReads.set('slow-feature', waiting);
  try {
    app().setHash({ ...DOC, ref: 'slow-feature' });
    await until(() => waiting.length && card()?.ref === 'slow-feature' && card().loading,
      'the first file is waiting for its response');
    await navigate({ ...DOC, ref: 'current-feature', path: 'docs/current.md' });
    const currentNode = cardElement();
    suspendedReads.delete('slow-feature');
    for (const resolve of waiting) resolve();
    await tick(12);
    assert.equal(cardElement(), currentNode);
    assert.equal(app().card.ref, 'current-feature');
    assert.equal(app().card.path, 'docs/current.md');
    assert.equal(modeButton('rendered').getAttribute('aria-pressed'), 'true');
    assert.ok(cardElement().querySelector('[x-ref="mdDiffHost"]').textContent.includes('current-feature'));
  } finally {
    suspendedReads.delete('slow-feature');
    for (const resolve of waiting) resolve();
  }
});

test('page initialization and navigation produce no Alpine expression errors', async () => {
  await tick(4);
  assert.deepEqual(problems, []);
});
