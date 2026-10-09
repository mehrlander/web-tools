// The Map view's Lifetimes tab (lib/alpineComponents/map.js) and its data,
// docs/environment/lifetimes.json.
//
// The tab draws what docs/environment/container.md establishes: the layers a
// web session runs on and what each event does to each of them. The facts are
// owned there, not here, so the data cites a passage for every effect and this
// check holds three things a reader of the tab cannot see for themselves:
//
//   every citation lands on a heading that exists, so a renamed section in
//   container.md breaks this rather than leaving the tab pointing at nothing;
//   the effect table is complete, one effect per event per layer and per copy,
//   so a new layer or event cannot ship half-drawn;
//   every state the data names is one the tab knows how to colour, since an
//   unknown state renders as a band with no tone and no error.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA_PATH = 'docs/environment/lifetimes.json';
const VIEW_PATH = 'lib/alpineComponents/map.js';
const data = JSON.parse(readFileSync(path.join(ROOT, DATA_PATH), 'utf8'));
const view = readFileSync(path.join(ROOT, VIEW_PATH), 'utf8');

const STATES = ['kept', 'partial', 'lost', 'new', 'used', 'untouched'];
const layerIds = data.layers.map(l => l.id);
const eventIds = data.events.map(e => e.id);

// GitHub's heading anchor: lower-case, punctuation dropped, spaces to hyphens.
const slug = h => h.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
const anchorsOf = file => {
  const out = new Set();
  let fence = false;
  for (const line of readFileSync(path.join(ROOT, file), 'utf8').split('\n')) {
    if (/^\s*```/.test(line)) fence = !fence;
    const m = !fence && line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (m) out.add(slug(m[1]));
  }
  return out;
};

const checkCited = (where, e) => {
  if (!e.evidence) return;
  assert.ok(data.evidence[e.evidence], `${where}: unknown evidence kind ${e.evidence}`);
  assert.ok(data.sources[e.source], `${where}: evidence without a known source (${e.source})`);
};

test('the tab reads this data file and colours every state it names', () => {
  assert.ok(view.includes(`const LT_DATA = '${DATA_PATH}'`), `${VIEW_PATH} no longer reads ${DATA_PATH}`);
  for (const st of STATES) {
    assert.match(view, new RegExp(`\\b${st}:\\s*\\{ icon:`), `${VIEW_PATH} has no LT_STATE entry for ${st}`);
  }
});

test('every source exists, and every anchor is a real heading', () => {
  for (const [id, s] of Object.entries(data.sources)) {
    assert.ok(existsSync(path.join(ROOT, s.path)), `source ${id}: ${s.path} does not exist`);
    if (s.anchor) {
      assert.ok(anchorsOf(s.path).has(s.anchor), `source ${id}: ${s.path} has no heading #${s.anchor}`);
    }
  }
});

test('each event has exactly one effect per layer, each a known state', () => {
  assert.equal(new Set(layerIds).size, layerIds.length, 'duplicate layer id');
  assert.equal(new Set(eventIds).size, eventIds.length, 'duplicate event id');
  for (const ev of data.events) {
    assert.deepEqual(Object.keys(ev.effects).sort(), [...layerIds].sort(), `event ${ev.id}: effects do not cover the layers`);
    for (const [layer, e] of Object.entries(ev.effects)) {
      assert.ok(STATES.includes(e.state), `${ev.id}/${layer}: unknown state ${e.state}`);
      assert.ok(e.label, `${ev.id}/${layer}: no label`);
      checkCited(`${ev.id}/${layer}`, e);
    }
  }
});

test('lifetime spans and ticks are well formed', () => {
  for (const l of data.layers) {
    for (const s of l.span) {
      assert.ok(['solid', 'dashed', 'fade'].includes(s.style), `${l.id}: span style ${s.style}`);
      assert.ok(s.to === 'lasting' || s.to > s.from, `${l.id}: span ends before it starts`);
    }
    for (const t of l.ticks) checkCited(`${l.id} tick ${t.label}`, t);
  }
});

test('each item names its layer, kind and origin, says where it comes from, and answers every event', () => {
  const ids = data.items.map(it => it.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate item id');
  for (const L of data.layers) assert.ok(data.items.some(it => it.layer === L.id), `${L.id}: holds no items`);
  for (const it of data.items) {
    assert.ok(layerIds.includes(it.layer), `${it.id}: unknown layer ${it.layer}`);
    assert.ok(data.kinds.includes(it.kind), `${it.id}: unknown kind ${it.kind}`);
    assert.ok(data.origins[it.origin], `${it.id}: unknown origin ${it.origin}`);
    assert.ok(it.name && it.gloss, `${it.id}: needs a name and a gloss`);
    if (it.origin === 'source') assert.ok(it.by, `${it.id}: a source names who writes it`);
    if (it.origin === 'copy') assert.ok(it.from && it.by && it.when, `${it.id}: a copy names its source, its maker and when`);
    if (it.origin === 'output') assert.ok('out' in it || it.held, `${it.id}: session output says what copies it out (null for nothing) or who holds it`);
    assert.deepEqual(Object.keys(it.effects).sort(), [...eventIds].sort(), `${it.id}: effects do not cover the events`);
    for (const e of Object.values(it.effects)) assert.ok(STATES.includes(e.state) && e.label, `${it.id}: an effect needs a known state and a label`);
  }
});

test('each copy lives in a layer and answers every event', () => {
  for (const c of data.copies) {
    assert.ok(layerIds.includes(c.layer), `copy ${c.id}: unknown layer ${c.layer}`);
    assert.deepEqual(Object.keys(c.effects).sort(), [...eventIds].sort(), `copy ${c.id}: effects do not cover the events`);
    for (const e of Object.values(c.effects)) assert.ok(STATES.includes(e.state), `copy ${c.id}: unknown state ${e.state}`);
    if (c.source) assert.ok(data.sources[c.source], `copy ${c.id}: unknown source ${c.source}`);
  }
  for (const v of data.levers) assert.ok(layerIds.includes(v.layer), `lever "${v.goal}": unknown layer ${v.layer}`);
});

test('the week draws only lanes and events that exist', () => {
  const lanes = new Set(data.week.lanes.map(l => l.id));
  const all = [
    ...data.week.bars.map(b => ['bar', b.lane, b]),
    ...data.week.marks.map(m => ['mark', m.lane, m]),
    ...data.week.links.flatMap(l => [['link', l.from, l], ['link', l.to, l]]),
  ];
  for (const [kind, lane, el] of all) {
    assert.ok(lanes.has(lane), `${kind} on unknown lane ${lane}`);
    for (const [ev, st] of Object.entries(el.ev || {})) {
      assert.ok(eventIds.includes(ev), `${kind} on ${lane}: unknown event ${ev}`);
      assert.ok(STATES.includes(st), `${kind} on ${lane}: unknown state ${st}`);
    }
  }
});
