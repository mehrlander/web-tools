// fab-bindings.test.mjs — every expression binding in the FAB drawer parses.
//
// The drawer's markup is a JavaScript template literal, so an escape inside it
// is spent before Alpine sees the markup: `'page\'s'` in the source reaches
// Alpine as `'page's'`, which fails to parse. Alpine only warns, the binding
// shows nothing, and the drawer otherwise works, so nothing else notices. The
// in-toss banner shipped that way (found on an iPhone console, 2026-09-29).
// This evaluates the template as the page does and parses each value binding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const SRC = readFileSync(path.join(repoRoot, 'lib/alpineComponents/fab.js'), 'utf8');

function drawerTemplate() {
  const start = SRC.indexOf('template: `');
  assert.notEqual(start, -1, 'the drawer template moved');
  let i = start + 'template: `'.length;
  const body = i;
  while (!(SRC[i] === '`' && SRC[i - 1] !== '\\')) i++;
  // The literal as the browser evaluates it: escapes spent, no interpolation.
  return new Function('return `' + SRC.slice(body, i).replace(/\$\{/g, '\\${') + '`;')();
}

test('every value binding in the drawer parses as JavaScript', () => {
  const tpl = drawerTemplate();
  const re = /\s(x-text|x-show|x-if|x-html|:class|:title|:href|:disabled)="([^"]*)"/g;
  let m, n = 0;
  const bad = [];
  while ((m = re.exec(tpl))) {
    n++;
    const expr = m[2].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    try { new Function('return (' + expr + ')'); } catch { bad.push(`${m[1]}="${expr.slice(0, 100)}"`); }
  }
  assert.ok(n > 300, `found only ${n} bindings; the template read is broken`);
  assert.deepEqual(bad, [], 'bindings Alpine cannot parse');
});
