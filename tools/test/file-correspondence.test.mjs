import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, webcrypto } from 'node:crypto';
import { repoRoot } from './bootstrap.mjs';
import { makeShell } from './shell.mjs';

const source = readFileSync(path.join(repoRoot, 'lib/kits/file-correspondence.js'), 'utf8');
const target = { repo: 'mehrlander/home', ref: 'main', path: 'projects/wps/app/Modules/Forms/Forms.psm1' };
const other = 'projects/wps/app/Modules/ISE/ISE.psm1';
const form = { ...target, path: 'projects/wps/app/Forms/Bookmarks/Bookmarks.xaml' };

function harness(storage = new Map()) {
  for (const name of ['checks', 'pending']) {
    const key = 'wpsCorrespondence.' + name;
    if (!storage.has(key)) storage.set(key, []);
  }
  const saved = storage.get('wpsCorrespondence.checks');
  const unfinished = storage.get('wpsCorrespondence.pending');
  const calls = [];
  const browserStore = { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main', stage: [] };
  const { shell, win, toasts } = makeShell({ browserStore });
  win.crypto = webcrypto;
  win.Alpine = { store: name => name === 'browser' ? browserStore : (...args) => toasts.push(args) };
  let failLookup = false;
  let repositoryText = 'same\n';
  win.GH = class {
    constructor(opts) { this.repo = opts.repo; calls.push(['repo', opts.repo]); }
    async req(p) { calls.push(['commits', p]); return [{ sha: 'a'.repeat(40) }]; }
    async get(p) {
      calls.push(['get', p, this.ref]);
      if (failLookup) throw new Error('Repository file lookup failed');
      return { text: repositoryText, sha: 'b'.repeat(40) };
    }
  };
  win.persistence = { collection: name => ({
    put: async r => {
      const rows = storage.get(name);
      const v = { ...r, id: r.id || String(rows.length + 1) };
      const i = rows.findIndex(row => row.id === v.id);
      if (i < 0) rows.push(v); else rows[i] = v;
      return v;
    },
    find: async pred => storage.get(name).filter(pred),
    delete: async id => {
      const rows = storage.get(name);
      const i = rows.findIndex(row => row.id === id);
      if (i >= 0) rows.splice(i, 1);
    },
  }) };
  let localId = 0;
  win.StageIntake = {
    textItem: (name, text) => ({ local: true, id: ++localId, name, text, isText: true }),
    keyOf: it => it.local ? 'local:' + it.id : it.repo + '@' + it.ref + ':' + it.path,
    takePaste: async () => ({ added: [] }),
    takeDrop: async () => [],
    takeFlavors: async () => ({ added: [] }),
  };
  new Function('window', source)(win);
  shell.syncUrl = () => {};
  return { shell, win, saved, unfinished, calls, browserStore, toasts,
    setLookupFailure: value => { failLookup = value; },
    setRepositoryText: value => { repositoryText = value; }, storage };
}

test('declaration accepts repository-relative PowerShell paths and rejects local paths', () => {
  const { win } = harness();
  const K = win.FileCorrespondence;
  assert.equal(K.declaration('function F {}\n# @file ' + target.path + '\n'), target.path);
  assert.equal(K.declaration('function F {}'), '');
  assert.equal(K.applies(form), true, 'a selected XAML form can be compared');
  assert.equal(K.declaration('<Window></Window>'), '', 'XAML needs selected-file context');
  for (const path of ['C:\\Users\\me\\Forms.psm1', '/Users/me/F.ps1', '../F.ps1',
                      'mehrlander/home:Forms.psm1', 'projects/wps/app/readme.md']) {
    assert.throws(() => K.declaration('# @file ' + path), /repository root/);
  }
});

test('declaration recognizes BOM-prefixed, LF, CRLF and CR-only PowerShell source', () => {
  const { win } = harness();
  const K = win.FileCorrespondence;
  for (const ending of ['\n', '\r\n', '\r']) {
    for (const bom of ['', '\ufeff']) {
      const first = bom + '# @file ' + target.path + ending + 'function Get-Form {}' + ending;
      const later = bom + '# PowerShell module' + ending + '# @file ' + target.path + ending + 'function Get-Form {}';
      assert.equal(K.declaration(first), target.path);
      assert.equal(K.declaration(later), target.path);
    }
  }
});

test('multiple declarations require one exact repository file identity', () => {
  const { win } = harness();
  const K = win.FileCorrespondence;
  assert.equal(K.declaration('# @file ' + target.path + '\r# @FILE ' + target.path + '\r'), target.path,
    'repeating the same repository identity is unambiguous');
  for (const second of [other, target.path.replace('Forms.psm1', 'forms.psm1')]) {
    assert.throws(() => K.declaration('# @file ' + target.path + '\n# @file ' + second), /conflicting # @file/,
      'GitHub paths remain case-sensitive');
  }
  for (const second of ['C:\\Users\\me\\Forms.psm1', '../Forms.psm1', '']) {
    assert.throws(() => K.declaration('# @file ' + target.path + '\n# @file ' + second), /repository root/,
      'a valid first declaration cannot hide an invalid later one');
  }
});

test('conflicting signatures stop app intake before selecting a repository target', async () => {
  const { shell, saved, unfinished, calls, browserStore, toasts } = harness();
  shell.view = 'search'; shell.searchOpenFile = target;
  await shell.takeCorrespondence('# @file ' + target.path + '\n# @file ' + other + '\nfunction F {}');
  assert.equal(saved.length, 0);
  assert.equal(unfinished.length, 0);
  assert.equal(calls.length, 0);
  assert.equal(browserStore.stage.length, 0);
  assert.ok(toasts.some(t => /conflicting # @file/.test(t.msg || t[1] || '')));
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
  assert.equal(saved[0].lineEndingsOnly, false);
  assert.equal(saved[0].observation, 'Submitted text matched this repository revision exactly.');
  assert.match(saved[0].installation, /not inspected/);
  assert.match(saved[0].checkedAt, /^\d{4}-\d\d-\d\dT/);
  assert.equal(saved[0].incomingSha256.length, 64);
  assert.deepEqual(calls.at(-1), ['get', target.path, 'a'.repeat(40)]);
  assert.equal(browserStore.stage[0].text, 'same\n');
  assert.equal(browserStore.stage[1].correspondenceText, 'same\n');
  assert.equal(browserStore.stageFocus, '', 'successful intake goes straight to the comparison');
  assert.deepEqual(browserStore.stageCompare, { a: 'mehrlander/home@' + 'a'.repeat(40) + ':' + target.path, b: 'local:1' });
  const before = saved.length;
  await win.FileCorrespondence.reopen(saved[0]);
  assert.equal(saved.length, before, 'reopening a saved check does not create a new dated check');
  assert.equal(browserStore.stage.filter(it => !it.local).length, 1, 'reopening reuses the repository item');
});

test('PowerShell check distinguishes CRLF-only changes without altering submitted text or its hash', async () => {
  const { win, saved, browserStore, setRepositoryText } = harness();
  const repository = 'function Get-Thing {\n  "é"\n}\n';
  const submitted = repository.replace(/\n/g, '\r\n');
  setRepositoryText(repository);
  await win.FileCorrespondence.open({ target, text: submitted, name: 'Forms.psm1' });
  assert.equal(saved[0].exact, false);
  assert.equal(saved[0].lineEndingsOnly, true);
  assert.equal(saved[0].observation, 'Submitted text differed only in line endings from this repository revision.');
  assert.equal(saved[0].content, submitted);
  assert.equal(saved[0].incomingSha256, createHash('sha256').update(submitted, 'utf8').digest('hex'));
  assert.notEqual(saved[0].incomingSha256, createHash('sha256').update(repository, 'utf8').digest('hex'));
  assert.equal(browserStore.stage.find(it => it.local).text, submitted);
  assert.equal(browserStore.stage.find(it => !it.local).correspondenceText, repository);
  assert.equal((await win.FileCorrespondence.history(target))[0].lineEndingsOnly, true);
});

test('XAML check recognizes CR-only line endings, while changed markup still differs', async () => {
  const { win, saved, setRepositoryText } = harness();
  const repository = '<Window>\r\n  <TextBlock />\r\n</Window>\r\n';
  const submitted = repository.replace(/\r\n/g, '\r');
  setRepositoryText(repository);
  await win.FileCorrespondence.open({ target: form, text: submitted, name: 'Bookmarks.xaml' });
  assert.equal(saved[0].exact, false);
  assert.equal(saved[0].lineEndingsOnly, true);
  assert.equal(saved[0].content, submitted);
  assert.equal(saved[0].incomingSha256, createHash('sha256').update(submitted, 'utf8').digest('hex'));
  await win.FileCorrespondence.open({ target: form, text: submitted.replace('TextBlock', 'Button'), name: 'changed.xaml' });
  assert.equal(saved[1].exact, false);
  assert.equal(saved[1].lineEndingsOnly, false);
  assert.equal(saved[1].observation, 'Submitted text differed from this repository revision.');
});

test('repeated checks reuse one staged repository key and keep distinct submitted copies and dates', async () => {
  const { win, saved, browserStore } = harness();
  await win.FileCorrespondence.open({ target, text: 'same\n', name: 'first.psm1' });
  await win.FileCorrespondence.open({ target, text: 'changed\n', name: 'second.psm1' });
  assert.equal(saved.length, 2);
  assert.equal(saved[0].exact, true);
  assert.equal(saved[1].exact, false);
  assert.match(saved[0].checkedAt, /^\d{4}-/);
  assert.match(saved[1].checkedAt, /^\d{4}-/);
  assert.equal(browserStore.stage.filter(it => !it.local).length, 1);
  assert.deepEqual(browserStore.stage.filter(it => it.local).map(it => it.text), ['same\n', 'changed\n']);
  assert.equal(browserStore.stageCompare.b, 'local:2');
  assert.equal((await win.FileCorrespondence.history(target)).length, 2);
  await win.FileCorrespondence.reopen(saved[0]);
  assert.equal(saved.length, 2);
  assert.equal(browserStore.stage.filter(it => !it.local).length, 1);
  assert.equal(browserStore.stageCompare.b, 'local:3');
});

test('UTF-16LE BOM saved-file bytes compare through the file picker; alternate encodings are explicit', async () => {
  const { shell, win, saved, toasts } = harness();
  shell.view = 'search'; shell.searchOpenFile = target;
  const dir = mkdtempSync(path.join(os.tmpdir(), 'wps-intake-'));
  try {
    const filePath = path.join(dir, 'Forms.psm1');
    const text = 'function Test { "é" }\r\n';
    writeFileSync(filePath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]));
    const bytes = readFileSync(filePath);
    const file = { name: 'Forms.psm1', arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    assert.equal(await shell.takeCorrespondenceFile(file, 'file picker'), true);
    assert.equal(saved[0].content, text);
    assert.equal(saved[0].source, 'file picker');
    assert.equal(shell.view, 'stage');
    const ansi = Uint8Array.from([0x66, 0x6f, 0x6f, 0xe9]);
    assert.throws(() => win.FileCorrespondence.decodeBytes(ansi), /Choose its encoding/);
    assert.equal(win.FileCorrespondence.decodeBytes(ansi, 'windows-1252'), 'fooé');
    assert.equal(win.FileCorrespondence.decodeBytes(Uint8Array.from([0xfe, 0xff, 0x00, 0x41])), 'A');
    assert.throws(() => win.FileCorrespondence.decodeBytes(new Uint8Array()), /empty/);
    shell.view = 'search';
    const bad = { name: 'Forms.psm1', arrayBuffer: async () => ansi.buffer };
    assert.equal(await shell.takeCorrespondenceFile(bad, 'file picker'), true);
    assert.equal(saved.length, 1, 'undecodable bytes do not silently produce a check');
    assert.match(shell.correspondenceFileError, /Choose its encoding/);
    assert.ok(toasts.some(t => /Could not read comparison file/.test(t.msg || t[1] || '')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lookup failure retains an app-wide submission across reload for retry or reassociation', async () => {
  const first = harness();
  first.setLookupFailure(true);
  first.shell.view = 'stage';
  const submitted = '# @file ' + target.path + '\nwork content\n';
  assert.equal(await first.shell.takeCorrespondence(submitted), true);
  assert.equal(first.saved.length, 0);
  assert.equal(first.unfinished.length, 1);
  assert.equal(first.unfinished[0].content, submitted);
  assert.equal(first.unfinished[0].path, target.path);
  assert.match(first.unfinished[0].lastError, /lookup failed/);
  assert.equal(first.browserStore.stage[0].text, submitted);
  assert.equal(first.browserStore.stageFocus, 'local:1', 'failed lookup opens the retained copy');
  assert.equal(first.shell.view, 'stage');
  assert.ok(first.toasts.some(t => /unfinished submissions/.test(t.msg || t[1] || '')));
  const second = harness(first.storage);
  const retained = (await second.win.FileCorrespondence.pending(target.repo))[0];
  const result = await second.win.FileCorrespondence.retry(retained, form);
  assert.equal(result.saved, true);
  assert.equal(second.saved.length, 1);
  assert.equal(second.saved[0].path, form.path);
  assert.equal(second.saved[0].content, submitted);
  assert.equal(second.unfinished.length, 0);
  assert.equal(second.browserStore.stage.filter(it => it.local).length, 1);
});

test('retrying the original address reuses its staged submission and clears pending on a saved check', async () => {
  const { win, saved, unfinished, browserStore, setLookupFailure } = harness();
  setLookupFailure(true);
  await assert.rejects(win.FileCorrespondence.open({ target, text: 'copy\n' }), /lookup failed/);
  assert.equal(browserStore.stage.length, 1);
  setLookupFailure(false);
  await win.FileCorrespondence.retry((await win.FileCorrespondence.pending(target.repo))[0]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].path, target.path);
  assert.equal(unfinished.length, 0);
  assert.equal(browserStore.stage.filter(it => it.local).length, 1);
  assert.equal(browserStore.stage.filter(it => !it.local).length, 1);
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
