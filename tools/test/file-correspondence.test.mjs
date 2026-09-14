import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { repoRoot } from './bootstrap.mjs';
import { makeShell } from './shell.mjs';

const source = readFileSync(path.join(repoRoot, 'lib/kits/file-correspondence.js'), 'utf8');
const target = { repo: 'mehrlander/home', ref: 'main', path: 'projects/wps/app/Modules/Forms/Forms.psm1' };
const other = 'projects/wps/app/Modules/ISE/ISE.psm1';

function harness() {
  const saved = [];
  const calls = [];
  const browserStore = { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main', stage: [] };
  const { shell, win, toasts } = makeShell({ browserStore });
  win.crypto = webcrypto;
  win.Alpine = { store: name => name === 'browser' ? browserStore : (...args) => toasts.push(args) };
  win.GH = class {
    constructor(opts) { this.repo = opts.repo; calls.push(['repo', opts.repo]); }
    async req(p) { calls.push(['commits', p]); return [{ sha: 'a'.repeat(40) }]; }
    async get(p) { calls.push(['get', p, this.ref]); return { text: 'same\n', sha: 'b'.repeat(40) }; }
  };
  win.persistence = { collection: () => ({
    put: async r => { const v = { ...r, id: String(saved.length + 1) }; saved.push(v); return v; },
    find: async pred => saved.filter(pred),
  }) };
  let localId = 0;
  win.StageIntake = {
    textItem: (name, text) => ({ local: true, id: ++localId, name, text, isText: true }),
    keyOf: it => it.local ? 'local:' + it.id : it.repo + '@' + it.ref + ':' + it.path,
    textFromBytes: (_name, bytes) => new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    takePaste: async () => ({ added: [] }),
    takeDrop: async () => [],
    takeFlavors: async () => ({ added: [] }),
  };
  new Function('window', source)(win);
  shell.syncUrl = () => {};
  return { shell, win, saved, calls, browserStore, toasts };
}

test('declaration accepts repository-relative PowerShell paths and rejects local paths', () => {
  const { win } = harness();
  const K = win.FileCorrespondence;
  assert.equal(K.declaration('function F {}\n# @file ' + target.path + '\n'), target.path);
  assert.equal(K.declaration('function F {}'), '');
  for (const path of ['C:\\Users\\me\\Forms.psm1', '/Users/me/F.ps1', '../F.ps1',
                      'mehrlander/home:Forms.psm1', 'projects/wps/app/readme.md']) {
    assert.throws(() => K.declaration('# @file ' + path), /repository root/);
  }
});

test('a check pins the revision, holds exact incoming text, and persists an honest observation', async () => {
  const { win, saved, calls, browserStore } = harness();
  const result = await win.FileCorrespondence.open({ target, text: 'same\n', name: 'work.psm1' });
  assert.equal(result.saved, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].revision, 'a'.repeat(40));
  assert.equal(saved[0].branch, 'main');
  assert.equal(saved[0].blobSha, 'b'.repeat(40));
  assert.equal(saved[0].content, 'same\n');
  assert.equal(saved[0].exact, true);
  assert.match(saved[0].installation, /not inspected/);
  assert.match(saved[0].checkedAt, /^\d{4}-\d\d-\d\dT/);
  assert.equal(saved[0].incomingSha256.length, 64);
  assert.deepEqual(calls.at(-1), ['get', target.path, 'a'.repeat(40)]);
  assert.equal(browserStore.stage[0].correspondenceText, 'same\n');
  assert.equal(browserStore.stage[1].text, 'same\n');
  assert.deepEqual(browserStore.stageCompare, { a: 'mehrlander/home@' + 'a'.repeat(40) + ':' + target.path, b: 'local:1' });
  const before = saved.length;
  await win.FileCorrespondence.reopen(saved[0]);
  assert.equal(saved.length, before, 'reopening a saved check does not create a new dated check');
});

test('a selected Files result supplies context for paste and drop; a conflicting declaration asks', async () => {
  const { shell, win, saved, browserStore } = harness();
  shell.view = 'search';
  shell.searchOpenFile = target;
  const cd = text => ({ items: [], files: [], getData: () => text });
  await shell.takeCorrespondence('same\n');
  assert.equal(shell.view, 'stage');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].path, target.path);
  shell.view = 'search';
  await shell.takeCorrespondence('# @file ' + other + '\nsame\n');
  assert.equal(saved.length, 1);
  assert.equal(shell.correspondencePending.declared.path, other);
  await shell.chooseCorrespondence('declared');
  assert.equal(saved[1].path, other);
  assert.equal(saved[1].content, '# @file ' + other + '\nsame\n');
  assert.equal(shell.view, 'stage');
  const field = { target: { tagName: 'TEXTAREA' }, clipboardData: cd('# @file ' + other), preventDefault() { this.prevented = true; } };
  const handlers = {};
  const { shell: fieldShell, win: fieldWin } = makeShell({ browserStore, win: { addEventListener: (type, fn) => { handlers[type] = fn; } } });
  fieldWin.StageIntake = win.StageIntake;
  fieldWin.FileCorrespondence = win.FileCorrespondence;
  fieldShell.view = 'search'; fieldShell.searchOpenFile = target;
  fieldShell.wireAppPaste();
  await handlers.paste(field);
  assert.equal(field.prevented, undefined);
  assert.equal(saved.length, 2);
});

test('app-wide desktop drop and phone tap both open the comparison', async () => {
  const { shell, win, saved } = harness();
  const handlers = {};
  win.addEventListener = (type, fn) => { handlers[type] = fn; };
  shell.view = 'search'; shell.searchOpenFile = target;
  shell.wireAppDrop();
  const file = { name: 'Forms.psm1', arrayBuffer: async () => new TextEncoder().encode('same\n').buffer };
  const drop = { target: { tagName: 'DIV' }, defaultPrevented: false,
    dataTransfer: { types: ['Files'], files: [file], items: [{ kind: 'file', type: 'text/plain' }] },
    preventDefault() { this.defaultPrevented = true; } };
  await handlers.drop(drop);
  assert.equal(drop.defaultPrevented, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].source, 'drop');
  shell.view = 'search';
  win.io = { pasteItems: async () => [{ kind: 'text', type: 'text/plain', text: 'same\n' }] };
  await shell.pasteAnywhere();
  assert.equal(saved.length, 2);
  assert.equal(saved[1].source, 'clipboard');
  assert.equal(shell.view, 'stage');
});
