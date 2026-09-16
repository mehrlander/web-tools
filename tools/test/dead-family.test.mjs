// scripts/dead-family.py — a daisyUI theme colour in a utility family daisyUI
// does not ship, which compiles to nothing and is dropped silently.
//
// What is pinned here is the CLASSIFIER, not the repo's cleanliness, and the
// distinction is deliberate. A gate on cleanliness was tried on 2026-08-22 and
// abandoned because the classifier could not be built: the attempt probed a
// rendered page, and a Tailwind browser build compiles only the classes it has
// scanned, so an injected control does not resolve either and "this family
// rejects the colour" reads identical to "this class appears nowhere". The
// stylesheet answers what the page cannot, and these assertions hold that
// answer to the three cases the obvious scan gets wrong: a daisyUI COMPONENT
// (btn-primary), a shipped utility (bg-primary), and a stock palette colour
// (divide-slate-300). A scan that flags any of those sends someone to break
// working markup.
//
// It gates the repo's cleanliness too, which it could not until the fix was
// measured. The reference had prescribed swapping to a palette colour or
// restructuring to gap, both of which are design calls; the browser says the
// arbitrary-value form of the SAME utility resolves, so a ring stays a ring and
// takes no layout space, an opacity step rides along, and the colour still
// follows the theme. That made a 36-occurrence sweep mechanical rather than a
// judgment per site, which is what let this become a gate on the same day.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const script = path.join(repoRoot, 'scripts', 'dead-family.py');
const daisy = path.join(repoRoot, 'node_modules', 'daisyui', 'daisyui.css');

function run(args) {
  try {
    return { code: 0, out: execFileSync('python3', [script, ...args], { cwd: repoRoot, encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

function withFile(contents, fn, name = 'probe.html') {
  const dir = mkdtempSync(path.join(tmpdir(), 'dead-family-'));
  const file = path.join(dir, name);
  writeFileSync(file, contents);
  try { return fn(file); } finally { rmSync(dir, { recursive: true, force: true }); }
}

// Without daisyUI on disk the supported set cannot be derived, and a scan that
// cannot classify must not fail a suite. Skipping here rather than asserting a
// stub keeps that behaviour honest in a checkout that never ran npm install.
const installed = existsSync(daisy);

test('the dead family is reported, with what to reach for instead', { skip: !installed && 'daisyUI not installed' }, () => {
  withFile('<div class="divide-y divide-base-200"></div>', (f) => {
    const { out } = run([f]);
    assert.match(out, /divide-base-200 generates no rule/);
    assert.match(out, /divide-\[var\(--color-base-200\)\]/,
      'the fix named is the arbitrary form of the same utility, which measures');
  });
});

test('the three families daisyUI DOES ship are left alone', { skip: !installed && 'daisyUI not installed' }, () => {
  withFile('<div class="bg-base-200 border-base-300 text-base-content bg-primary"></div>', (f) => {
    assert.match(run([f]).out, /dead-family: none/);
  });
});

// THE HALF THE OBVIOUS SCAN GETS WRONG. Each of these is valid markup.
test("a daisyUI component is not a colour utility and is never reported", { skip: !installed && 'daisyUI not installed' }, () => {
  withFile('<button class="btn btn-primary badge-error alert-warning input-success"></button>', (f) => {
    assert.match(run([f]).out, /dead-family: none/);
  });
});

test('a stock palette colour compiles in every family and is never reported', { skip: !installed && 'daisyUI not installed' }, () => {
  withFile('<div class="divide-slate-300 ring-red-500 from-blue-200 fill-black"></div>', (f) => {
    assert.match(run([f]).out, /dead-family: none/);
  });
});

test('an opacity step rides along without hiding the base class', { skip: !installed && 'daisyUI not installed' }, () => {
  withFile('<div class="ring-primary/20 bg-primary/20"></div>', (f) => {
    const { out } = run([f]);
    assert.match(out, /ring-primary generates no rule/, 'the ring is dead with or without the step');
    assert.doesNotMatch(out, /bg-primary generates/, 'the background is not, and dead-opacity.py owns its step');
  });
});

test('a variant prefix rides along too', { skip: !installed && 'daisyUI not installed' }, () => {
  withFile('<div class="hover:ring-primary sm:divide-base-300"></div>', (f) => {
    const { out } = run([f]);
    assert.match(out, /ring-primary generates no rule/);
    assert.match(out, /divide-base-300 generates no rule/);
  });
});

test('a comment naming the trap is documentation, not markup', { skip: !installed && 'daisyUI not installed' }, () => {
  withFile([
    '// divide-base-200 compiles to nothing, which is why this file does not use it',
    '<!-- the same trap waits in ring-primary -->',
    '<!-- a block comment',
    '     mentioning divide-base-300',
    '     across several lines -->',
  ].join('\n'), (f) => {
    assert.match(run([f]).out, /dead-family: none/);
  });
});

test('--check turns the advisory into a gate', { skip: !installed && 'daisyUI not installed' }, () => {
  withFile('<div class="divide-base-200"></div>', (f) => {
    assert.equal(run([f]).code, 0, 'advisory by default');
    assert.equal(run(['--check', f]).code, 1);
  });
});

// The gate. Everything above pins the classifier against a fixture; this is the
// only assertion about the tree, and it is the one that keeps the sweep swept.
test('the repo carries no dead colour utility', { skip: !installed && 'daisyUI not installed' }, () => {
  const { code, out } = run(['--check']);
  assert.equal(code, 0, out);
});

test('the supported set is DERIVED, so it tracks the installed daisyUI', { skip: !installed && 'daisyUI not installed' }, () => {
  const { out } = run(['--check', '/dev/null']);
  const m = out.match(/(\d+) classes shipped by the installed daisyUI across (\d+) families/);
  assert.ok(m, 'the run reports what it derived: ' + out.trim());
  assert.ok(Number(m[1]) > 100, 'a plausible class count, not an empty parse: ' + m[1]);
  assert.ok(Number(m[2]) > 10, 'and a plausible family count: ' + m[2]);
});
