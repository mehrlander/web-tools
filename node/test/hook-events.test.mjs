// docs/hook-events.csv: every event Claude Code accepts a hook on, the gate the
// Map view's Automation tab reads to lay out the hooks the plugin registers.
//
// The table is copied from the installed CLI (its /hooks menu), which CI does
// not have, so this cannot prove the table complete. It holds the two things a
// commit here can break: a registration in skills/hooks/hooks.json on an event
// the table lacks, which would draw a hook under no event, and a row whose
// phase is not one the Automation tab lays out. It also holds the shape of the
// release columns, which the Events tab shows beside each event.

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

// The release columns are copied by hand from the changelog and npm, so the
// test holds their shape, not their truth: one date per release, and a basis
// the properties registry declares.
test('each event names the release that added it, with its date and basis', () => {
  const bases = parseCsv(read('docs/properties.csv'))
    .find(p => p.registry === 'hook-events' && p.property === 'basis').values.split(';');
  const dates = new Map();
  for (const r of rows) {
    assert.match(r.version, /^\d+\.\d+\.\d+$/, `${r.event} has version ${r.version}`);
    assert.match(r.released, /^\d{4}-\d{2}-\d{2}$/, `${r.event} has release date ${r.released}`);
    assert.ok(bases.includes(r.basis), `${r.event} has basis ${r.basis}, not one of ${bases.join(', ')}`);
    assert.equal(dates.get(r.version) ?? r.released, r.released, `${r.version} carries two dates`);
    dates.set(r.version, r.released);
  }
});
