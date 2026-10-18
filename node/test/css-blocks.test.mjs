// python/css-blocks.py: hand-written CSS, where it is, how much, and whether it
// has a stated reason. Convention 6 of skills/html-style/references/mechanics.md
// forbids it; nothing checked the rule until 2026-10-18, when an audit found
// 1,611 declarations here and 9,614 in mehrlander/home with a scanner nobody
// kept. This file pins the scanner's counting and gates the tree against
// docs/css-baseline.csv, a ratchet: a file may carry no more unexempt CSS than
// its row, a file with no row may carry none, and conversion only lowers rows.
//
// The fixtures pin the cases a naive count gets wrong: a `${...}` inside a
// template-literal stylesheet is JavaScript, not a rule body; a comment that
// names <style> is prose; an interpolated style="" attribute is computed
// geometry; and an exemption must name a kind from the closed list and a reason.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const script = path.join(repoRoot, 'python', 'css-blocks.py');

function run(args, cwd = repoRoot) {
  try {
    return { code: 0, out: execFileSync('python3', [script, ...args], { cwd, encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

function withFile(contents, fn, name = 'probe.html') {
  const dir = mkdtempSync(path.join(tmpdir(), 'css-blocks-'));
  const file = path.join(dir, name);
  writeFileSync(file, contents);
  try { return fn(file, dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

const counts = (out) => {
  const m = out.match(/(\d+) unexempt declarations \(block (\d+), inline (\d+)\).*?; (\d+) exempt/);
  assert.ok(m, 'the run reports its totals: ' + out);
  return { total: +m[1], block: +m[2], inline: +m[3], exempt: +m[4] };
};

test('a <style> block counts its declarations, at-rules and custom properties included', () => {
  withFile('<style>.a{color:red;margin:0}@media (min-width:1024px){.b{display:flex}}:root{--x:1px}</style>', (f) => {
    assert.deepEqual(counts(run([f]).out), { total: 4, block: 4, inline: 0, exempt: 0 });
  });
});

test('a view module stylesheet is found by its name, and ${...} inside it is not a rule', () => {
  withFile('const AL_CSS = `\n.g{color:${c};padding:${p}px ${q}px}\n`;\nconst CSS = `.h{gap:${n ? "1px" : "2px"}}`;\n', (f) => {
    assert.deepEqual(counts(run([f]).out), { total: 3, block: 3, inline: 0, exempt: 0 });
  }, 'view.js');
});

test('a comment that names <style> is prose, not a stylesheet', () => {
  withFile('// A scoped <style> carries the SVG internals\nconst X = 1;\n/* a <style> is mentioned here\n   and closed </style> here */\n', (f) => {
    assert.match(run([f]).out, /0 unexempt declarations/);
  }, 'view.js');
});

test('a static style="" counts; an interpolated one is computed geometry and does not', () => {
  withFile('<div style="width:30%;color:#123456"></div><div style="left:${x}px"></div><div :style="{left: x}"></div>', (f) => {
    assert.deepEqual(counts(run([f]).out), { total: 2, block: 0, inline: 2, exempt: 0 });
  });
});

test('exempt() covers the next rule; exempt-all() covers the rest of the stylesheet', () => {
  withFile([
    '<style>',
    '/* exempt(third-party): daisyUI styles a menu li child through :where() */',
    '.menu template{display:none}',
    '.a{color:red}',
    '/* exempt-all(no-utility): scrollbars have no utility at all */',
    '.e::-webkit-scrollbar{display:none}',
    '.f{width:0}',
    '</style>',
  ].join('\n'), (f) => {
    assert.deepEqual(counts(run([f]).out), { total: 1, block: 1, inline: 0, exempt: 3 });
  });
});

test('an exemption with no reason, or a kind outside the list, is a finding and covers nothing', () => {
  withFile('<style>\n/* exempt(svg): x */\n.c{fill:red}\n/* exempt(easier): it was quicker this way */\n.d{fill:red}\n</style>', (f) => {
    const { code, out } = run(['--check', f]);
    assert.equal(code, 1, 'a malformed exemption fails --check');
    assert.match(out, /:2: exempt\(svg\) states no reason/);
    assert.match(out, /:4: exempt\(easier\) is not a kind/);
    assert.equal(counts(out).total, 2, 'neither rule is exempted');
  });
});

test('hex colours in declarations are counted; a selector that spells hex is not', () => {
  withFile('<style>#face .x{color:#8b98a6;border-color:#8B98A6}</style>', (f) => {
    assert.match(run([f]).out, /1 distinct hex colours, led by #8b98a6 \(2\)/);
  });
});

test('a hex colour moved into an arbitrary-value class is still reported, apart from CSS', () => {
  withFile('<i class="bg-[#fff3ad] [&.on]:outline-[#c77d00] text-base-content/60"></i><a href="#top">x</a>', (f) => {
    const { out } = run([f]);
    assert.match(out, /0 unexempt declarations/);
    assert.match(out, /0 distinct hex colours.*; 2 distinct in arbitrary-value classes, in 1 files/);
  });
});

// The ratchet, driven against a scratch git repo so the walk is the real one.
test('the baseline ratchet: over fails, new fails, under passes and --write only lowers', () => {
  withFile('<style>.a{color:red;margin:0}</style>', (f, dir) => {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    execFileSync('git', ['add', '.'], { cwd: dir });
    const base = path.join(dir, 'base.csv');
    writeFileSync(base, 'path,declarations\nprobe.html,1\n');
    assert.equal(run(['--baseline', base, '--check'], dir).code, 1, 'two declarations against a row of one');
    writeFileSync(base, 'path,declarations\nother.html,1\n');
    assert.match(run(['--baseline', base, '--check'], dir).out, /probe\.html: 2 hand-written declarations in a file the baseline does not list/);
    writeFileSync(base, 'path,declarations\nprobe.html,5\n');
    assert.equal(run(['--baseline', base, '--check'], dir).code, 0, 'under its row passes');
    run(['--baseline', base, '--write'], dir);
    assert.equal(readFileSync(base, 'utf8'), 'path,declarations\nprobe.html,2\n', '--write lowers the row');
    writeFileSync(base, 'path,declarations\nprobe.html,1\n');
    run(['--baseline', base, '--write'], dir);
    assert.equal(readFileSync(base, 'utf8'), 'path,declarations\nprobe.html,1\n', '--write never raises');
    writeFileSync(base, 'path,declarations\nelsewhere.html,7\nprobe.html,9\n');
    run(['probe.html', '--baseline', base, '--write'], dir);
    assert.equal(readFileSync(base, 'utf8'), 'path,declarations\nelsewhere.html,7\nprobe.html,2\n',
      'a narrowed walk lowers only the rows it walked');
  });
});

// The gate. Everything above pins the scanner; this is the one assertion about
// the tree, and it is what keeps the house rule from drifting further.
test('no file carries more hand-written CSS than docs/css-baseline.csv allows', () => {
  const { code, out } = run(['--baseline', 'docs/css-baseline.csv', '--check']);
  assert.equal(code, 0, out);
});
