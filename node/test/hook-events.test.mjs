// docs/hook-events.csv: every event Claude Code accepts a hook on, the gate the
// Map view's Automation tab reads to lay out the hooks the plugin registers.
//
// The table is copied from the installed CLI (its /hooks menu), which CI does
// not have, so this cannot prove the table complete. It holds the two things a
// commit here can break: a registration in skills/hooks/hooks.json on an event
// the table lacks, which would draw a hook under no event, and a row whose
// phase is not one the Automation tab lays out.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const read = p => readFileSync(path.join(repoRoot, p), 'utf8');
const rows = parseCsv(read('docs/hook-events.csv'));
const hooks = JSON.parse(read('skills/hooks/hooks.json')).hooks;

test('every event the plugin registers a hook on is a row', () => {
  const events = new Set(rows.map(r => r.event));
  for (const event of Object.keys(hooks))
    assert.ok(events.has(event), `skills/hooks/hooks.json registers on ${event}, which docs/hook-events.csv lacks`);
});

test('each event is one row, with a declared phase and a summary', () => {
  const seen = new Set();
  const phases = parseCsv(read('docs/properties.csv'))
    .find(p => p.registry === 'hook-events' && p.property === 'phase').values.split(';');
  for (const r of rows) {
    assert.ok(!seen.has(r.event), `${r.event} appears twice`);
    seen.add(r.event);
    assert.ok(phases.includes(r.phase), `${r.event} has phase ${r.phase}, not one of ${phases.join(', ')}`);
    assert.ok(r.summary, `${r.event} has no summary`);
  }
});
