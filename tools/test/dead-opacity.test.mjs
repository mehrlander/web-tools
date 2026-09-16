// scripts/dead-opacity.py — pages that render a daisyUI theme colour with an
// opacity modifier and never tell Tailwind the name is a colour.
//
// WHAT IS PINNED, in order: the classifier, the REGISTRATION BOUNDARY, and the
// repo's cleanliness. The classifier matters because the obvious version of
// this scan is wrong in a way that reads as a finding: "opacity must be a
// multiple of ten" flags every `bg-red-500/25` in the tree, and every one of
// those is fine. The boundary matters because it is what the scan is now about.
//
// Tailwind writes an opacity modifier by composing a color-mix, which it can
// only do for a name it knows is a colour. A compiled build is told by
// `@plugin "daisyui"`; pages here load daisyUI as a prebuilt stylesheet beside
// Tailwind's browser JIT and were told by nothing. Since 2026-09-16
// lib/gh-boot.js registers the twenty names, so a page that boots through it
// composes every case correctly and a page that does not is where the failures
// survive. The page is therefore the unit, and the page is what the fix changes.
//
// Measured in headless Chromium against this app's own stylesheet, reading
// getComputedStyle either side of a real hover. On an UNREGISTERED page:
//
//     bg-primary/10        static, on daisyUI's ramp    fine, it ships this
//     bg-primary/25        static, off the ramp         DEAD
//     bg-primary/[25%]     the bracket escape           DEAD
//     hover:bg-primary/10  any variant, any step        DEAD
//     bg-red-500/<any>     stock palette                fine throughout
//
// On a REGISTERED page every one of them paints, the bracket escape included.
//
// The script is python3/stdlib, so this drives it the way a person does,
// through the file system, and reads what it prints.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = path.join(repoRoot, 'scripts', 'dead-opacity.py');

// Returns { code, out }. The script exits 1 under --check when it finds
// anything, so a non-zero exit is an outcome here rather than a failure.
function run(args) {
  try {
    const out = execFileSync('python3', [script, ...args], { cwd: repoRoot, encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

function withFile(contents, fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'dead-opacity-'));
  const file = path.join(dir, 'probe.html');
  writeFileSync(file, contents);
  try { return fn(file); } finally { rmSync(dir, { recursive: true, force: true }); }
}

// A page that loads Tailwind and registers nothing: the failing case.
const BARE = '<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>\n';
// The same page, told that the names are colours.
const REGISTERED = BARE +
  '<style type="text/tailwindcss">@theme inline{--color-primary:var(--color-primary);}</style>\n';

test('on an unregistered page, a variant plus an opacity modifier is reported', () => {
  withFile(BARE + '<div class="hover:bg-primary/10"></div>', (f) => {
    const { out } = run([f]);
    assert.match(out, /hover:bg-primary\/10 generates nothing here \(under a variant\)/,
      'the report names the whole class, variant included, or it is not actionable');
  });
});

test('every variant form is caught, not just hover', () => {
  withFile(BARE + [
    '<div class="group-hover:bg-base-200/60"></div>',
    '<div class="focus:text-base-content/70"></div>',
    '<div class="active:border-primary/50"></div>',
  ].join('\n'), (f) => {
    const { out } = run([f]);
    for (const v of ['group-hover', 'focus', 'active']) assert.match(out, new RegExp(v));
  });
});

test('on an unregistered page, a static step off the ramp is still reported', () => {
  withFile(BARE + '<div class="bg-primary/25"></div>', (f) => {
    assert.match(run([f]).out, /bg-primary\/25 generates nothing here \(step is off daisyUI ramp\)/);
  });
});

test('but a static step ON the ramp is fine even unregistered, because daisyUI ships it', () => {
  const ok = [10, 20, 30, 40, 50, 60, 70, 80, 90]
    .map(n => `<div class="bg-primary/${n} text-base-content/${n}"></div>`).join('\n');
  withFile(BARE + ok, (f) => {
    assert.match(run([f]).out, /dead-opacity: none/);
  });
});

test('REGISTERING THE NAMES CLEARS EVERY SHAPE, which is the point of the boundary', () => {
  withFile(REGISTERED + [
    '<div class="hover:bg-primary/10"></div>',
    '<div class="bg-primary/25"></div>',
    '<div class="bg-primary/[25%]"></div>',
    '<div class="group-hover:text-base-content/70"></div>',
  ].join('\n'), (f) => {
    assert.match(run([f]).out, /dead-opacity: none/,
      'these all paint once Tailwind knows the name is a colour; flagging them ' +
      'would send someone to rewrite working markup');
  });
});

test('booting through gh-boot counts as registered, since it injects the block', () => {
  withFile(BARE + '<script type="module" src="../lib/gh-api.js"></script>\n' +
                  '<div class="hover:bg-primary/10"></div>', (f) => {
    assert.match(run([f]).out, /dead-opacity: none/);
  });
});

test('a page that never loads Tailwind is not this scan\'s business', () => {
  withFile('<div class="hover:bg-primary/10"></div>', (f) => {
    assert.match(run([f]).out, /dead-opacity: none/);
  });
});

// THE HALF THE OBVIOUS SCAN GETS WRONG. Each of these is valid and must never
// be reported; a scan that flags them sends someone to "fix" working markup.
test('a stock palette colour takes any step and is never reported', () => {
  withFile(BARE + [
    '<div class="hover:bg-red-500/25"></div>',
    '<div class="text-slate-700/33"></div>',
    '<div class="bg-black/5 bg-white/95"></div>',
  ].join('\n'), (f) => {
    assert.match(run([f]).out, /dead-opacity: none/);
  });
});

test('a fraction is not an opacity modifier', () => {
  withFile(BARE + '<div class="w-1/2 basis-1/3 top-1/2 aspect-16/9"></div>', (f) => {
    assert.match(run([f]).out, /dead-opacity: none/);
  });
});

test('a path that happens to contain a slash is not a class', () => {
  withFile(BARE + '<a href="docs/stage.md">see also lib/kits/text-diff.js</a>', (f) => {
    assert.match(run([f]).out, /dead-opacity: none/);
  });
});

test('the repo is clean, and --check is the gate that keeps it so', () => {
  const { code, out } = run(['--check']);
  assert.equal(code, 0, out);
  assert.match(out, /dead-opacity: none/);
});
