import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { Parser, Language } from 'web-tree-sitter';
import { repoRoot } from '../repo-root.mjs';
await Parser.init();
const parser = new Parser();
parser.setLanguage(await Language.load(new URL('../../node_modules/tree-sitter-powershell/tree-sitter-powershell.wasm', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')));
const context = { window: {} }; vm.runInNewContext(readFileSync(repoRoot + '/lib/kits/powershell-units.js', 'utf8'), context);
const K = context.window.PowerShellUnits, options = { parser };
const plain = value => JSON.parse(JSON.stringify(value));
test.after(() => parser.delete());

test('AST rules keep nested helpers, here-strings, comments and complete registrations', async () => {
  const text = `# help for Get-A\nfunction Get-A { function Inside { 1 }; @'\nfunction Fake { }\n'@\n}\n$Wrapper | Add-Member -MemberType ScriptMethod -Name Load -Value { 1 }\n$Wrapper.On('btnCopy', 'Click', { 2 })\n$timer.Add_Tick({ 2 }.GetNewClosure())\n$script:Save_Click = { 2 }\nclass Item { [int] Value() { return 1 } }\nenum Mode { First; Second }\nImport-Module X\n`;
  const inventory = await K.inventory(text, options);
  assert.deepEqual(plain(inventory.units.map(u => [u.kind, u.name])), [
    ['Function', 'Get-A'], ['ScriptMethod', '$Wrapper.Load'], ['Event', '$Wrapper.On(btnCopy, Click)'],
    ['Event', '$timer.Add_Tick'], ['Scriptblock', '$script:Save_Click'], ['Class', 'Item'], ['Enum', 'Mode'], ['Other', 'Other changes'],
  ]);
  assert.equal(inventory.units.map(u => u.text).join(''), text);
  assert.match(inventory.units[0].text, /^# help/);
});
test('one function changes while an unchecked local function, BOM, Unicode and CRLF stay exact', async () => {
  const before = '\uFEFF# 🙂 help\r\nfunction A { "local" }\r\nfunction B { 1 }\r\n';
  const after = '\uFEFF# 🙂 help\r\nfunction A { "repo" }\r\nfunction B { 2 }\r\n';
  const review = await K.compare(before, after, options);
  assert.equal(review.units.length, 2);
  const b = review.units.find(u => u.name === 'B');
  const prepared = await K.prepare(review, [b.id], options);
  assert.equal(prepared.text, before.replace('B { 1 }', 'B { 2 }'));
  assert.equal(K.apply(review, []), before);
  assert.equal(K.apply(review, review.units.map(u => u.id)), after);
  assert.throws(() => K.apply(review, [b.id], before + ' '), /work copy changed/);
});
test('all bytes including setup, additions, removals and trailing comments are accounted for', async () => {
  const cases = [
    ['Import-Module A\nfunction X { 1 }\n', 'Import-Module B\nfunction Y { 2 }\nfunction X { 3 }\n# end\n'],
    ['function A {}\nfunction B {}\n', 'function B {}\nfunction A {}\n'],
    ['', '# New\nfunction A {}\nfunction B {}\n'],
    ['function A {}\nfunction B {}\n', ''],
    ['function A {}\nfunction A {}\n', 'function A { 1 }\nfunction A { 2 }\n'],
    ['# comment\n', '# new comment\n'],
  ];
  for (const [before, after] of cases) {
    const review = await K.compare(before, after, options);
    assert.equal(K.apply(review, review.units.map(u => u.id)), after);
    assert.equal(K.apply(review, []), before);
    assert.ok(review.units.every(u => before.slice(u.start, u.end) === u.before));
  }
});
test('direct calls pull in changed helpers; unselected changes stay out', async () => {
  const before = 'function Helper { 1 }\nfunction Caller { 0 }\nfunction Other { 0 }\n';
  const after = 'function Helper { 2 }\nfunction Caller { Helper }\nfunction Other { 3 }\n';
  const review = await K.compare(before, after, options), caller = review.units.find(u => u.name === 'Caller');
  const result = await K.prepare(review, [caller.id], options);
  assert.equal(result.ids.length, 2);
  assert.equal(result.text, before.replace('Helper { 1 }', 'Helper { 2 }').replace('Caller { 0 }', 'Caller { Helper }'));
});
test('parse errors and selections that leave duplicate functions fail closed', async () => {
  await assert.rejects(K.compare('function A {', 'function A {}', options), /parser could not read/);
  const review = await K.compare('function A {}\nfunction B {}\n', 'function B {}\nfunction A {}\n', options);
  const addition = review.units.find(u => u.action === 'Add');
  await assert.rejects(K.prepare(review, [addition.id], options), /repeated names/);
});

test('grammar limitations stay visible and blocked while a clean sibling remains selectable', async () => {
  const before = 'function Broken { $a = [Type]::new(1, [Flag]::A -bor [Flag]::B) }\nfunction Clean { 1 }\n';
  const after = before.replace('Clean { 1 }', 'Clean { 2 }');
  const review = await K.compare(before, after, { ...options, tolerant: true });
  const clean = review.units.find(u => u.name === 'Clean');
  assert.equal((await K.prepare(review, [clean.id], { ...options, tolerant: true })).text, after);
  // An actually malformed region is retained as evidence and never selected.
  const malformed = await K.compare('function A {', 'function A {}', { ...options, tolerant: true });
  assert.ok(malformed.units.some(u => u.blocked));
  await assert.rejects(K.prepare(malformed, malformed.units.map(u => u.id), { ...options, tolerant: true }), /parser could not read/);
});
test('line-ending-only changes are distinguishable without altering unchecked content', async () => {
  const review = await K.compare('function A {\r\n 1 }\r\nfunction B { 1 }\r\n', 'function A {\n 1 }\nfunction B { 2 }\n', options);
  assert.equal(review.units.find(u => u.name === 'A').formatOnly, true);
  const b = review.units.find(u => u.name === 'B');
  const prepared = await K.prepare(review, [b.id], options);
  assert.match(prepared.text, /^function A \{\r\n 1 \}/);
  assert.equal(review.units.find(u => u.name === 'B').formatOnly, false);
});

test('registrations inside a handler never rename its enclosing review unit', async () => {
  const text = "$Wrapper.On('btnGo', 'Click', { $x | Add-Member -MemberType ScriptMethod -Name Inner -Value { 1 } })\n"
    + "$script:Click = { $x | Add-Member -MemberType ScriptMethod -Name Inner -Value { 2 } }\n"
    + 'class Compact{}\n';
  const stage = await K.inventory(text, options);
  assert.deepEqual(plain(stage.units.map(u => [u.kind, u.name])), [
    ['Event', '$Wrapper.On(btnGo, Click)'], ['Scriptblock', '$script:Click'], ['Class', 'Compact'],
  ]);
});

test('a statement the grammar cannot fully read is selectable when both its edges are top-level', async () => {
  // Comma-separated command arguments and `2 * 1KB` break the grammar; both are everyday 5.1.
  const before = 'function Open-X {\n  Add-Type -AssemblyName A, B\n  $max = 2 * 1KB\n}\nfunction Keep { 1 }\n';
  const after = before.replace('$max = 2 * 1KB', '$max = 4 * 1KB');
  const review = await K.compare(before, after, { ...options, tolerant: true });
  const change = review.units.find(u => u.name === 'Open-X');
  assert.equal(change.rough, true, 'the grammar could not read it');
  assert.equal(change.blocked, false, 'but its edges are clear');
  assert.equal((await K.prepare(review, [change.id], { ...options, tolerant: true })).text, after);
});

test('edges sit outside strings, comments, here-strings and brackets, never mid-word or after a continuation', () => {
  // ¦ marks the offset under test; it is removed before scanning.
  const cases = [
    ['$a = "{"¦\n', 1], ['$a = "¦{"\n', 0], ["$a = '}'¦\n", 1], ['# { comment¦\n$b\n', 1],
    ['<# { #>¦\n', 1], ["@'\n{\n'@¦\n", 1], ["@'\n{¦\n'@\n", 0], ['"$(if ($x) { "}" })"¦\n', 1],
    ['"$(if ($x) {¦ "}" })"\n', 0], ['function A {¦\n}\n', 0], ['function A { }¦\n', 1],
    ['function Show-¦Tree { }\n', 0], ['Get-X |¦\n  Sort\n', 0], ['Get-X |\n¦  Sort\n', 0], ['$a = 1;¦$b = 2\n', 1],
  ];
  for (const [marked, expected] of cases) {
    const k = marked.indexOf('\u00a6'), text = marked.replace('\u00a6', '');
    assert.equal(K.edges(text)[k], expected, JSON.stringify(marked));
  }
  assert.equal(K.edges('function A {\n')['function A {\n'.length], 0, 'an unclosed brace leaves no edge at the end');
});

test('versions reads a pasted copy block by block against GitHub and the earlier version', async () => {
  const earlier = 'function A { 1 }\nfunction B { 1 }\nfunction C { 1 }\nfunction Gone { 1 }\nImport-Module X\n';
  const github = 'function A { 2 }\nfunction B { 2 }\nfunction C { 1 }\nfunction New { 1 }\nImport-Module X\n';
  const copy = 'function A { 2 }\r\nfunction B { 1 }  \r\nfunction C { 9 }\r\nfunction Gone { 1 }\r\nfunction Mine { 1 }\r\nImport-Module X\r\n';
  const v = await K.versions({ copy, github, earlier }, options);
  const by = Object.fromEntries(v.rows.map(r => [r.name, r.status]));
  assert.deepEqual(by, { A: 'updated', B: 'behind', C: 'local', New: 'new', Gone: 'removed', Mine: 'extra' });
  assert.equal(v.outside, 'same');
  assert.equal(v.fragment, false);
  const plainRead = await K.versions({ copy: 'function A { 9 }\n', github }, options);
  assert.deepEqual(plain(plainRead.rows.map(r => [r.name, r.status])), [['A', 'differs'], ['B', 'missing'], ['C', 'missing'], ['New', 'missing']]);
  assert.equal(plainRead.fragment, true, 'one block of four is a fragment, not the file');
});
