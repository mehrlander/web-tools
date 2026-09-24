// Execute the shipped shell against real Alpine selection lookup and the
// correspondence parser. The Overview's receiver (installationView.takeCopy)
// is the boundary here; what it does with a copy is covered by its view tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWindow, captureAlpineErrors, tick } from './bootstrap.mjs';
import { shellScript } from './shell.mjs';

const REPO = 'example/estate', REF = 'review/powershell';
const A = 'projects/wps/app/Forms/Report.ps1', B = 'projects/wps/app/Modules/Utility.psm1';
const X = 'projects/wps/app/Forms/Report.xaml', OUTSIDE = 'projects/elsewhere/Other.ps1';
const text = '\ufeff# @file ' + A + '\r\nfunction Get-Report { "héllo 🌳" }\r\n';
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const plain = text => [{ kind: 'text', type: 'text/plain', text }];
const { window, problems } = makeWindow();
window.TextDecoder = TextDecoder;
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
window.Alpine = Alpine; captureAlpineErrors(Alpine);
for (const name of ['csv', 'file-correspondence', 'repo-address'])
  new window.Function(readFileSync(new URL('../../lib/kits/' + name + '.js', import.meta.url), 'utf8'))();
const correspondence = window.FileCorrespondence, address = window.RepoAddress;
const app = new window.Function(shellScript() + '\nreturn app;')();
Alpine.start();
await tick(2);
let mounted;
test.afterEach(async () => {
  if (mounted) Alpine.mutateDom(() => { Alpine.destroyTree(mounted); mounted.remove(); });
  mounted = null;
  await tick(2);
  assert.deepEqual(problems.splice(0), []);
});

function fixture({ active = A, busy = false } = {}) {
  const received = [], staged = [], comparisons = [], toasts = [], handlers = {};
  const store = { repo: REPO, ref: REF, defaultRef: 'main', stage: [] };
  Alpine.store('browser', store);
  Alpine.store('toast', (icon, message, cls) => toasts.push({ icon, message, cls }));
  const shell = app();
  shell.view = 'project'; shell.projectTab = 'overview'; shell.projectPath = 'projects/wps';
  shell.installationItem = active; shell.syncUrl = () => {};
  Object.defineProperty(shell, 'project', { value: { path: 'projects/wps', installation: 'data/installation.json' } });
  // The Overview's receiver: the shell hands it a copy for the selected file
  // (openCorrespondence -> installationView.takeCopy) and the Overview shows it.
  Alpine.data('installationView', () => ({ busy,
    async takeCopy(target, sourceText, name, source) {
      if (target && (target.repo !== REPO || ![A, B, X].includes(target.path))) return false;
      received.push({ target, text: sourceText, meta: { name, source } });
      return true;
    } }));
  const el = window.document.createElement('div');
  el.setAttribute('x-data', 'installationView()');
  Alpine.mutateDom(() => { window.document.body.appendChild(el); Alpine.initTree(el); });
  mounted = el;
  const workspace = { captures: 0 };
  window.FileCorrespondence = { ...correspondence, open: async opts => {
    comparisons.push(opts); return { record: { observation: 'Compared' }, saved: true };
  } };
  window.RepoAddress = address;
  window.StageIntake = {
    takePaste: async (value, options) => { staged.push({ kind: 'paste', value, options }); return { added: [{ name: 'copy' }] }; },
    takeDrop: async value => { staged.push({ kind: 'drop', value }); return [{ name: 'copy' }]; },
    takeFlavors: async value => { staged.push({ kind: 'flavors', value }); return { added: [{ name: 'copy' }] }; },
    focus: () => {},
  };
  window.io = { pasteItems: async () => plain(text) };
  const originalAdd = window.addEventListener;
  window.addEventListener = (type, handler) => { (handlers[type] ||= []).push(handler); };
  try { shell.wireAppPaste(); shell.wireAppDrop(); } finally { window.addEventListener = originalAdd; }
  const fire = async (type, event) => { for (const handler of handlers[type] || []) await handler(event); };
  return { shell, workspace, store, received, staged, comparisons, toasts, el, fire };
}

function clipboard(source = text, { files = [], items = [], type = 'text/plain' } = {}) {
  return { types: files.length ? ['Files'] : [type], files, items,
    getData: requested => requested === type || (requested === 'text' && type === 'text/plain') ? source : '' };
}
function event(data, { target = { tagName: 'DIV' }, drop = false } = {}) {
  return { target, [drop ? 'dataTransfer' : 'clipboardData']: data, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; } };
}
const file = (name, contents = text) => ({ name, arrayBuffer: async () => new TextEncoder().encode(contents).buffer });

test('desktop paste reaches the Overview for the selected file and preserves exact signed source', async () => {
  const h = fixture();
  const e = event(clipboard());
  await h.fire('paste', e);
  assert.equal(e.defaultPrevented, true);
  assert.equal(h.received.length, 1);
  assert.equal(h.received[0].text, text);
  assert.deepEqual(JSON.parse(JSON.stringify(h.received[0].target)), { repo: REPO, ref: REF, path: A });
  assert.equal(h.received[0].meta.source, 'paste');
  assert.equal(h.shell.view, 'project');
  assert.deepEqual(h.comparisons, []);
  assert.deepEqual(h.staged, []);
});

test('native CodeMirror, textarea, input and contenteditable paste never enters comparison', async () => {
  const h = fixture();
  for (const target of [{ tagName: 'TEXTAREA', className: 'cm-input' }, { tagName: 'INPUT' },
    { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }]) {
    const e = event(clipboard('# @file ' + B + '\nnew source'), { target });
    await h.fire('paste', e);
    assert.equal(e.defaultPrevented, false);
  }
  assert.equal(h.workspace.captures, 0);
  assert.equal(h.shell.correspondencePending, null);
  assert.deepEqual(h.received, []);
  assert.deepEqual(h.staged, []);
});

test('a conflicting file declaration waits for either explicit target choice', async () => {
  const h = fixture();
  const signed = '# @file ' + B + '\r\nWrite-Output "received"\r\n';
  for (const choice of ['declared', 'selected']) {
    await h.shell.takeCorrespondence(signed);
    assert.equal(h.shell.correspondencePending.selected.path, A);
    assert.equal(h.shell.correspondencePending.declared.path, B);
    const previous = h.received.length;
    await h.shell.chooseCorrespondence(choice);
    assert.equal(h.received.length, previous + 1);
    assert.equal(h.received.at(-1).target.path, choice === 'declared' ? B : A);
    assert.equal(h.received.at(-1).text, signed);
  }
  assert.equal(h.shell.correspondencePending, null);
  assert.equal(h.shell.view, 'project');
  assert.deepEqual(h.comparisons, []);
});

test('a selected XAML document accepts exact unsigned XAML through the same intake', async () => {
  const h = fixture({ active: X });
  await h.shell.takeCorrespondence('<Window>\r\n  <Button x:Name="Save" />\r\n</Window>');
  assert.equal(h.received[0].target.path, X);
  assert.match(h.received[0].text, /\r\n/);
});

test('a malformed declaration is reported without taking any source or navigating', async () => {
  const h = fixture();
  await h.shell.takeCorrespondence('# @file C:\\Users\\me\\Report.ps1\ncopy');
  assert.deepEqual(h.received, []);
  assert.deepEqual(h.comparisons, []);
  assert.match(h.toasts.at(-1).message, /repository root/i);
});

test('a declared target outside the manifest uses the existing Stage correspondence fallback', async () => {
  const h = fixture({ active: '' });
  const signed = '# @file ' + OUTSIDE + '\ncopy';
  await h.shell.takeCorrespondence(signed);
  assert.deepEqual(h.received, []);
  assert.equal(h.comparisons[0].target.path, OUTSIDE);
  assert.equal(h.comparisons[0].text, signed);
  assert.equal(h.shell.view, 'stage');
});

test('file picker and desktop file drop share declaration choice and decoded source fidelity', async () => {
  const h = fixture();
  const signed = '# @file ' + B + '\r\nWrite-Output "café"\r\n';
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(signed, 'utf16le')]);
  await h.shell.takeCorrespondenceFile({ name: 'Utility.psm1', arrayBuffer: async () => utf16 }, 'file picker');
  assert.equal(h.shell.correspondencePending.declared.path, B);
  await h.shell.chooseCorrespondence('declared');
  assert.equal(h.received[0].text, signed);
  assert.equal(h.received[0].meta.source, 'file picker');
  assert.equal(h.received[0].meta.name, 'Utility.psm1');
  await h.fire('drop', event(clipboard('', { files: [file('Report.ps1')], items: [{ kind: 'file' }] }), { drop: true }));
  assert.equal(h.received[1].target.path, A);
  assert.equal(h.received[1].meta.source, 'drop');
  assert.equal(h.shell.view, 'project');
});

test('app Paste follows explicit single-line addresses before code intake', async () => {
  const h = fixture();
  const opened = [];
  h.shell.openAddress = async target => { opened.push(target); return true; };
  const destination = REPO + '@' + REF + ':' + B;
  window.io.pasteItems = async () => plain(destination);
  await h.shell.pasteAnywhere();
  await h.fire('paste', event(clipboard(destination)));
  assert.equal(opened.length, 2);
  assert.equal(opened[0].path, B);
  assert.deepEqual(h.received, []);
  assert.deepEqual(h.staged, []);
});

test('screenshots and binary or multiple-file arrivals retain Stage routing with code selected', async () => {
  const h = fixture();
  const screenshot = { name: 'Screenshot.png', arrayBuffer: async () => { assert.fail('binary bytes must not be decoded as code'); } };
  await h.fire('paste', event(clipboard('image caption', { files: [screenshot], items: [{ kind: 'file', type: 'image/png' }] })));
  assert.equal(h.staged.at(-1).kind, 'paste');
  h.shell.view = 'project';
  await h.fire('drop', event(clipboard('', { files: [file('A.ps1'), file('B.ps1')], items: [{ kind: 'file' }, { kind: 'file' }] }), { drop: true }));
  assert.equal(h.staged.at(-1).kind, 'drop');
  h.shell.view = 'project';
  window.io.pasteItems = async () => [...plain(text), { kind: 'blob', type: 'image/png', blob: new Blob([]) }];
  await h.shell.pasteAnywhere();
  assert.equal(h.staged.at(-1).kind, 'flavors');
  assert.deepEqual(h.received, []);
  assert.deepEqual(h.comparisons, []);
});

test('file clipboard items without exposed files do not let accompanying text become code', async () => {
  const h = fixture();
  await h.fire('paste', event(clipboard(text, { items: [{ kind: 'file', type: 'image/png' }] })));
  assert.deepEqual(h.received, []);
  assert.equal(h.staged[0].kind, 'paste');
});

test('an ordinary JSON file stays Stage content instead of replacing the selected code context', async () => {
  const h = fixture();
  const local = file('data.json', '{"color":"blue"}');
  await h.fire('drop', event(clipboard('', { files: [local], items: [{ kind: 'file' }] }), { drop: true }));
  assert.deepEqual(h.received, []);
  assert.deepEqual(h.comparisons, []);
  assert.equal(h.staged[0].kind, 'drop');
});

test('native field drops and already-handled drops remain untouched', async () => {
  const h = fixture();
  const e = event(clipboard(text), { drop: true, target: { tagName: 'TEXTAREA' } });
  await h.fire('drop', e);
  assert.equal(e.defaultPrevented, false);
  const handled = event(clipboard(text), { drop: true }); handled.preventDefault();
  await h.fire('drop', handled);
  assert.equal(h.workspace.captures, 0);
  assert.deepEqual(h.received, []);
  assert.deepEqual(h.staged, []);
});

test('the Overview takes a copy in place, and Files keeps the Stage comparison route', async () => {
  const h = fixture();
  await h.shell.takeCorrespondence('overview copy');
  assert.equal(h.received[0].target.path, A);
  assert.deepEqual(h.comparisons, []);
  h.shell.view = 'search'; h.shell.searchOpenFile = { repo: REPO, ref: REF, path: B };
  await h.shell.takeCorrespondence('search copy');
  assert.equal(h.comparisons[0].target.path, B);
  assert.equal(h.shell.view, 'stage');
  assert.equal(h.received.length, 1);
});
