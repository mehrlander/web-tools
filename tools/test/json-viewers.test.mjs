// Preserve the archived experiments while adapting their previews to local JSON.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Script, createContext, runInContext } from 'node:vm';
import { repoRoot } from '../repo-root.mjs';

const archive = join(repoRoot, 'archive/websim-json');
const provenance = JSON.parse(readFileSync(join(archive, 'provenance.json'), 'utf8'));
// Match the gallery's independent module loading without importing the app bundle.
const adapterSource = readFileSync(join(repoRoot, 'pages/json-viewers/adapters.js'), 'utf8');
const { prepareExample } = await import(`data:text/javascript;base64,${Buffer.from(adapterSource).toString('base64')}`);
const sources = new Map(provenance.examples.map(example => [
  example.id, readFileSync(join(archive, example.file), 'utf8'),
]));
const scriptsIn = html => [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)]
  .map(match => match[1]).filter(script => script.trim());
const launchSample = [{
  name: 'Atlas', date_utc: '2025-01-10T12:00:00Z', success: true,
  payloads: [{ name: 'Research', mass_kg: 240 }], links: { webcast: null },
}];
const hostileText = '</script><script>globalThis.injected = true</script><img src=x onerror="alert(1)"> & \' " \u2028\u2029';
const hostileSample = [{ ...launchSample[0], name: hostileText, [hostileText]: hostileText }];

function inspectPreview(id, sample) {
  const html = prepareExample(id, sources.get(id), sample);
  const scripts = scriptsIn(html);
  assert.ok(scripts.length > 1, `${id}: expected the bootstrap and archived implementation`);
  for (const [index, script] of scripts.entries()) {
    assert.doesNotThrow(() => new Script(script), `${id}: inline script ${index} must parse`);
  }
  const bootstrap = scripts.find(script => script.includes('const __gallerySample ='));
  assert.ok(bootstrap, `${id}: the local sample bootstrap is present`);
  const context = createContext({});
  runInContext(bootstrap, context);
  assert.equal(runInContext('JSON.stringify(__gallerySample)', context), JSON.stringify(sample),
    `${id}: serialization must preserve every JSON value`);
  assert.equal(context.injected, undefined, `${id}: sample text must not become executable code`);
  return { html, scripts, context };
}

test('archived HTML bytes match their recorded SHA256 and byte counts', () => {
  assert.equal(provenance.archive.repository, 'mehrlander/home');
  assert.equal(provenance.archive.path, 'chron/2026/07/2026-07-06-websim-account-export.zip');
  assert.equal(provenance.archive.gitBlobSha, '80281b29a268d97662af09c7a11fcf02747a02ae');
  assert.match(provenance.archive.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual([...sources.keys()].sort(), [
    'folding-editor', 'launch-paths', 'multi-view', 'object-tree', 'preview-tree', 'svg-explorer',
  ]);
  for (const example of provenance.examples) {
    const bytes = readFileSync(join(archive, example.file));
    assert.equal(bytes.length, example.sourceBytes, `${example.id}: archived size changed`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), example.sourceSha256,
      `${example.id}: archived bytes changed; adaptations belong in adapters.js`);
    assert.equal(example.archiveFile, `${example.archiveFolder}/index.html`);
    assert.ok(example.manifestMatch.candidates.length, `${example.id}: missing manifest provenance`);
    for (const candidate of example.manifestMatch.candidates) {
      assert.equal(candidate.title, example.title);
      assert.equal(typeof candidate.id, 'string');
      assert.ok(Number.isInteger(candidate.version));
    }
  }
});

test('duplicate manifest titles remain explicitly unresolved', () => {
  const ambiguousCounts = new Map([['preview-tree', 5], ['svg-explorer', 2]]);
  for (const example of provenance.examples) {
    const count = ambiguousCounts.get(example.id) ?? 1;
    assert.equal(example.manifestMatch.status, count > 1 ? 'ambiguous-title-match' : 'unique-title-match');
    assert.equal(example.manifestMatch.candidates.length, count);
  }
});

for (const id of sources.keys()) {
  test(`${id}: hostile JSON stays data and every inline script parses`, () => {
    const clean = inspectPreview(id, launchSample);
    const hostile = inspectPreview(id, hostileSample);
    assert.equal(hostile.scripts.length, clean.scripts.length,
      'A closing script tag in JSON must not add a script element');
    assert.ok(!hostile.html.includes(hostileText), 'Raw HTML from the JSON must not enter srcdoc');
    assert.equal(runInContext('__galleryEscape(__gallerySample[0].name)', hostile.context),
      hostileText.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#39;'));
  });
}

test('previews contain no startup API request or retired API selector', () => {
  for (const id of sources.keys()) {
    const { html } = inspectPreview(id, launchSample);
    assert.doesNotMatch(html, /\bfetch\s*\(|\$\.(?:ajax|getJSON)\s*\(/, id);
    assert.doesNotMatch(html, /id=["']api-select["']/, id);
  }
});

test('general JSON previews preserve null, empty containers, and primitive roots', () => {
  for (const id of [...sources.keys()].filter(id => id !== 'launch-paths')) {
    for (const value of [null, [], {}, false, 0, '', 'plain text', [null, false, 0, '']]) {
      inspectPreview(id, value);
    }
  }
});

test('launch paths accepts an empty list and rejects incompatible records', () => {
  inspectPreview('launch-paths', []);
  for (const value of [null, {}, false, 0, '', [null], [1], [[]], [{}], [{ name: 'Atlas' }], [{ date_utc: '2025-01-10' }]]) {
    assert.throws(() => prepareExample('launch-paths', sources.get('launch-paths'), value),
      /array of objects with name and date_utc fields/);
  }
});

test('SVG explorer loads local JSON and escapes the selected-node details', () => {
  const source = sources.get('svg-explorer');
  assert.match(source, /await fetch\(apiUrl\)/);
  for (const sample of [null, [], {}, false, 0, '', hostileSample]) {
    const { scripts, context } = inspectPreview('svg-explorer', sample);
    const loading = { style: {} };
    const rows = [];
    const selectedNodesList = { innerHTML: '', appendChild: row => rows.push(row) };
    context.document = {
      getElementById: id => id === 'loading' ? loading : selectedNodesList,
      createElement: () => ({}),
    };
    context.d3 = { hierarchy: data => ({ data }) };
    const implementation = scripts.at(-1).replace(/\s*fetchLaunchData\(\);\s*$/, '\n');
    runInContext(implementation, context);
    runInContext('renderTree = node => { globalThis.rendered = node; }; fetchLaunchData();', context);
    assert.equal(loading.style.display, 'none');
    assert.equal(context.rendered.data.name, 'root');
    if (sample === null || typeof sample !== 'object') {
      assert.equal(context.rendered.data.value, String(sample));
    } else {
      assert.equal(context.rendered.data.children.length, Object.keys(sample).length);
    }
    context.selectedNode = { id: 1, data: { name: hostileText, value: hostileText, selected: true } };
    runInContext('root = { descendants: () => [selectedNode] }; updateSelectedNodesList();', context);
    assert.equal(rows.length, 1);
    assert.ok(!rows[0].innerHTML.includes(hostileText));
    assert.match(rows[0].innerHTML, /&lt;\/script&gt;/);
    assert.doesNotMatch(rows[0].innerHTML, /<script>|<img/);
  }
});

test('preview repairs leave their archived source evidence intact', () => {
  const objectSource = sources.get('object-tree');
  assert.match(objectSource, /In this updated version/);
  assert.doesNotMatch(prepareExample('object-tree', objectSource, null), /In this updated version/);
  const treeSource = sources.get('multi-view');
  assert.match(treeSource, /tree\.fancytree\("destroy"\)/);
  const repaired = prepareExample('multi-view', treeSource, []);
  assert.doesNotMatch(repaired, /tree\.fancytree\("destroy"\)/);
  assert.match(repaired, /\$\("#tree"\)\.fancytree\("destroy"\)/);
  assert.match(sources.get('launch-paths'), /fetch\('https:\/\/api.spacexdata.com/);
  for (const example of provenance.examples) {
    assert.equal(readFileSync(join(archive, example.file), 'utf8'), sources.get(example.id));
  }
});

test('unknown examples and changed startup code fail instead of fetching an API', () => {
  assert.throws(() => prepareExample('missing', '', null), /Unknown JSON example/);
  const changed = sources.get('preview-tree').replace('DOMContentLoaded', 'source-changed');
  assert.throws(() => prepareExample('preview-tree', changed, []), /no longer matches its preview adapter/);
  const extraRequest = sources.get('object-tree').replace('</body>', '<script>fetch("https://example.com")</script></body>');
  assert.throws(() => prepareExample('object-tree', extraRequest, null), /still contains an API request/);
});
