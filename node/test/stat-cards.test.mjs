// skills/hooks/stat-cards.py: daisyUI stat cards (html-style rule 1), plus the
// guard hook that refuses one at edit time. Pinned here: the classifier (the
// two daisyUI classes, never a plain `stat`, never the word in prose), the
// guard's decision through its stdin contract, and a clean tree. The tree scan
// covers every folder but vendored and archived ones, so a stat card in dump/
// fails the suite the same as one in pages/.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const hooks = path.join(repoRoot, 'skills', 'hooks');
const script = path.join(hooks, 'stat-cards.py');
const guard = path.join(hooks, 'stat-cards-guard.sh');

function run(args) {
  try {
    return { code: 0, out: execFileSync('python3', [script, ...args], { cwd: repoRoot, encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

function withFile(body, fn, ext = '.html') {
  const dir = mkdtempSync(path.join(tmpdir(), 'stat-cards-'));
  const f = path.join(dir, 'page' + ext);
  writeFileSync(f, body);
  try { return fn(f); } finally { rmSync(dir, { recursive: true, force: true }); }
}

function ask(payload) {
  const out = execFileSync('bash', [guard], { input: JSON.stringify(payload), encoding: 'utf8' });
  return out.trim() ? JSON.parse(out).hookSpecificOutput.permissionDecisionReason : '';
}

// stat-card-ok: the fixture this file tests on
const GRID = '<div class="stats shadow"><div class="stat"><div class="stat-value">42</div></div></div>';

test('the daisyUI stats container and stat-value are reported', () => {
  withFile(GRID, f => {
    const { out } = run([f]);
    assert.match(out, /: stats$/m);
    assert.match(out, /: stat-value$/m);
  });
  withFile("el.innerHTML = `<div class=\"stats stats-vertical sm:stats-horizontal\">`", f => {
    assert.match(run([f]).out, /: stats$/m);
  }, '.js');
});

test('a plain stat class, a stats- prefix alone, and the word in prose are not', () => {
  withFile('<span class="stat" id="stat">no selection</span>\n'
         + '<div class="meta-scope-stats">x</div>\n'
         + '<!-- no stats, no stat-value tiles here -->', f => {
    assert.match(run([f]).out, /stat-cards: none/);
  });
});

test('stat-card-ok suppresses the line and the line below it', () => {
  withFile(`${GRID} <!-- stat-card-ok -->`, f => assert.match(run([f]).out, /stat-cards: none/));
  withFile(`<!-- stat-card-ok -->\n${GRID}`, f => assert.match(run([f]).out, /stat-cards: none/));
});

test('--check exits 1 on a finding and 0 when clean', () => {
  withFile(GRID, f => assert.equal(run(['--check', f]).code, 1));
  withFile('<p>x</p>', f => assert.equal(run(['--check', f]).code, 0));
});

test('the guard refuses a Write that adds a stat card and passes a clean one', () => {
  assert.match(ask({ tool_name: 'Write', tool_input: { file_path: '/tmp/x.html', content: GRID } }),
    /daisyUI stat card \(html-style rule 1\)/);
  assert.equal(ask({ tool_name: 'Write', tool_input: { file_path: '/tmp/x.html', content: '<p>x</p>' } }), '');
  assert.equal(ask({ tool_name: 'Write', tool_input: { file_path: '/tmp/x.md', content: GRID } }), '');
});

test('the guard judges the result: an unrelated edit is refused, the fix passes', () => {
  withFile(`<h1>hi</h1>${GRID}`, f => {
    assert.match(ask({ tool_name: 'Edit', tool_input: { file_path: f, old_string: 'hi', new_string: 'hello' } }),
      /would still carry a stat card/);
    assert.equal(ask({ tool_name: 'Edit', tool_input: { file_path: f, old_string: GRID, new_string: '<p>42 rows</p>' } }), '');
  });
});

test('the tree carries no stat card', () => {
  const { code, out } = run(['--check']);
  assert.equal(code, 0, `stat-cards found:\n${out}`);
});
