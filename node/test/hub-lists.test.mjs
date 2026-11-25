// lists/*.json in web-tools: the house policies and the peeves, kept as Lists
// view files so the h and portable plugins deliver them from the public hub.
// What breaks without these: a file the Lists kit does not read as a list, so
// it vanishes from the view; two items claiming one id, so an h: slug or a P
// number names two entries; and a header that stops saying changes are
// proposed, so the governing-docs test stops counting the file.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const win = { GH: { FRESH: { cache: 'no-store' } } };
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/lists.js'), 'utf8'))(win);
const L = win.Lists;

const DIR = path.join(repoRoot, 'lists');
const files = Object.fromEntries(readdirSync(DIR).filter(f => f.endsWith('.json'))
  .map(f => ['lists/' + f, readFileSync(path.join(DIR, f), 'utf8')]));

const hub = {
  async get(p) { if (!(p in files)) throw Object.assign(new Error('404'), { status: 404 }); return { text: files[p] }; },
  async req(p) {
    assert.equal(p, 'contents/lists');
    return Object.keys(files).map(f => ({ type: 'file', name: f.slice('lists/'.length), path: f }));
  },
};

test('the hub\'s lists parse in the Lists kit\'s shape, with unique ids and a proposed-edit header', async () => {
  const found = await L.discover(hub);
  assert.deepEqual(found.map(l => l.path).sort(), ['lists/house-policies.json', 'lists/peeves.json']);
  for (const l of found) {
    assert.ok(L.isList({ ...l.header, items: l.items }), l.path + ' is a list');
    assert.equal(l.header.edit, 'propose', l.path + ' says its changes are proposed');
    assert.equal(l.icon, l.header.icon, l.path + ' names an icon the kit keeps');
    const ids = l.items.map(it => it.id);
    assert.equal(new Set(ids).size, ids.length, l.path + ' has unique ids');
    for (const it of l.items) {
      assert.equal(typeof it.text, 'string', l.path + ' ' + it.id + ' has a text');
      assert.ok(it.text.trim() && typeof it.note === 'string' && it.note.trim(), l.path + ' ' + it.id + ' has a text and a note');
    }
  }
  const policies = found.find(l => l.path === 'lists/house-policies.json');
  assert.ok(policies.items.every(it => /^[a-z0-9-]+$/.test(it.id) && it.group), 'a policy id is an h: slug and sits in a group');
  const peeves = found.find(l => l.path === 'lists/peeves.json');
  assert.ok(peeves.items.every(it => /^P\d{2,}$/.test(it.id)), 'a peeve id is a P number');
});
