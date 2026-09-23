// Field paths must preserve JSON meaning across heterogeneous rows and unusual keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const source = readFileSync(join(repoRoot, 'pages/json-viewers/field-model.js'), 'utf8');
const { collectFields, projectFields, kindOf, tableColumns } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const id = (...segments) => JSON.stringify(segments);

test('JSON kinds distinguish arrays and null from objects', () => {
  assert.deepEqual([null, [], {}, '', 0, false].map(kindOf), ['null', 'array', 'object', 'string', 'number', 'boolean']);
});

test('table columns align shuffled and missing fields in first-seen order', () => {
  const rows = Object.freeze([
    Object.freeze({ name: 'First', active: false, count: 0 }),
    Object.freeze({ count: 'unknown', name: 'Second', metadata: null }),
    Object.freeze({ metadata: { orbit: 'LEO' }, active: true, payloads: [] }),
  ]);
  assert.deepEqual(tableColumns(rows), [
    { key: 'name', types: ['string'] },
    { key: 'active', types: ['boolean'] },
    { key: 'count', types: ['number', 'string'] },
    { key: 'metadata', types: ['null', 'object'] },
    { key: 'payloads', types: ['array'] },
  ]);
  assert.deepEqual(tableColumns([{}, {}]), []);
});

test('table schema reads beyond the first hundred rows and rejects a late nonobject row', () => {
  const rows = Array.from({ length: 125 }, (_, index) => ({ name: `Row ${index}` }));
  rows.push({ name: null, late: false });
  assert.deepEqual(tableColumns(rows), [
    { key: 'name', types: ['null', 'string'] },
    { key: 'late', types: ['boolean'] },
  ]);
  assert.equal(tableColumns([...rows, null]), null);
});

test('table column keys preserve literal dots and prototype names as ordinary own keys', () => {
  const rows = [
    JSON.parse('{"__proto__":false,"a.b":0,"items[]":null,"constructor":"first"}'),
    Object.assign(Object.create(null), { constructor: 0, 'a.b': 'later', '': true }),
  ];
  assert.deepEqual(tableColumns(rows), [
    { key: '__proto__', types: ['boolean'] },
    { key: 'a.b', types: ['number', 'string'] },
    { key: 'items[]', types: ['null'] },
    { key: 'constructor', types: ['number', 'string'] },
    { key: '', types: ['boolean'] },
  ]);
  assert.equal({}.polluted, undefined);
});

test('table columns fall back for nonarrays, empty arrays, and mixed or nonplain rows', () => {
  for (const value of [null, {}, 0, false, 'text', [], [null], [[]], [1], [{}, false], [{}, []], [new Date(0)], [new Map()], [new (class Record {})()]]) {
    assert.equal(tableColumns(value), null);
  }
});

test('fields union every row and remain stable when sibling keys or rows are reordered', () => {
  const rows = [
    { rocket: { name: 'Falcon', active: true }, mass: 0 },
    { mass: 'unknown', rocket: { name: null }, extra: '' },
  ];
  const reordered = [
    { extra: '', rocket: { name: null }, mass: 'unknown' },
    { mass: 0, rocket: { active: true, name: 'Falcon' } },
  ];
  const fields = collectFields(rows);
  assert.deepEqual(fields, collectFields(reordered));
  assert.deepEqual(fields.find(field => field.id === id(null, 'rocket', 'name')), {
    id: id(null, 'rocket', 'name'), label: 'rocket.name', segments: [null, 'rocket', 'name'], types: ['null', 'string'],
  });
  assert.deepEqual(fields.find(field => field.id === id(null, 'mass')).types, ['number', 'string']);
  assert.ok(fields.some(field => field.id === id(null, 'extra')));
  assert.deepEqual(projectFields(rows, [id(null, 'mass')]), [{ mass: 0 }, { mass: 'unknown' }]);
});

test('nested arrays expose containers and normalize every index to a wildcard', () => {
  const input = [{ payloads: [{ mass_kg: 0 }, { name: 'B' }], matrix: [[{ value: 1 }], [{ value: false }]] }];
  const fields = collectFields(input);
  for (const [segments, label, types] of [
    [[null, 'payloads'], 'payloads', ['array']],
    [[null, 'payloads', null], 'payloads[]', ['object']],
    [[null, 'payloads', null, 'mass_kg'], 'payloads[].mass_kg', ['number']],
    [[null, 'matrix', null, null, 'value'], 'matrix[][].value', ['boolean', 'number']],
  ]) {
    assert.deepEqual(fields.find(field => field.id === JSON.stringify(segments)), { id: JSON.stringify(segments), label, segments, types });
  }
  assert.deepEqual(projectFields(input, [id(null, 'matrix', null, null, 'value')]), [{ matrix: [[{ value: 1 }], [{ value: false }]] }]);
});

test('projection keeps falsy values, missing fields, ancestors, and heterogeneous array positions', () => {
  const input = [
    { details: { zero: 0, empty: '', enabled: false, unknown: null, discard: 7 } },
    { details: { discard: 1 } },
    {}, false, null, 0, '', [{ details: { zero: 5 } }, 9],
  ];
  const selected = ['zero', 'empty', 'enabled', 'unknown'].map(key => id(null, 'details', key));
  assert.deepEqual(projectFields(input, selected), [
    { details: { zero: 0, empty: '', enabled: false, unknown: null } },
    { details: {} }, {}, null, null, null, null, [{}, null],
  ]);
  const nested = { payloads: [{ mass_kg: 0, other: 1 }, {}, null, false, [{ mass_kg: 8 }]] };
  assert.deepEqual(projectFields(nested, [id('payloads', null, 'mass_kg')]), {
    payloads: [{ mass_kg: 0 }, {}, null, null, [{}]],
  });
});

test('selecting a parent includes its full subtree and selecting no fields includes all data', () => {
  const input = { payloads: [{ mass_kg: 0, metadata: { active: false } }], unrelated: true };
  assert.deepEqual(projectFields(input, [id('payloads'), id('payloads', null, 'mass_kg')]), { payloads: input.payloads });
  assert.deepEqual(projectFields(input, []), input);
  assert.deepEqual(projectFields(input, [id()]), input);
});

test('literal dots, brackets, quotes, empty names, and prototype keys stay distinct', () => {
  const input = JSON.parse('{"a.b":0,"a":{"b":1},"items[]":false,"items":[{"v":2}],"quote\\\"key":"x","":"empty","__proto__":{"polluted":true},"constructor":{"prototype":"safe"}}');
  const labels = new Map(collectFields(input).map(field => [field.id, field.label]));
  assert.equal(labels.get(id('a.b')), '["a.b"]');
  assert.equal(labels.get(id('a', 'b')), 'a.b');
  assert.equal(labels.get(id('items[]')), '["items[]"]');
  assert.equal(labels.get(id('items', null, 'v')), 'items[].v');
  assert.equal(labels.get(id('quote"key')), '["quote\\"key"]');
  assert.equal(labels.get(id('')), '[""]');
  const projected = projectFields(input, [id('a.b'), id('items[]'), id('__proto__', 'polluted'), id('constructor', 'prototype')]);
  assert.deepEqual(projected, JSON.parse('{"a.b":0,"items[]":false,"__proto__":{"polluted":true},"constructor":{"prototype":"safe"}}'));
  assert.equal(Object.getPrototypeOf(projected), Object.prototype);
  assert.equal(Object.hasOwn(projected, '__proto__'), true);
  assert.equal({}.polluted, undefined);
});

test('primitive and empty roots remain selectable and preserve their values', () => {
  for (const value of [null, false, 0, '', 'text', [], {}]) {
    assert.deepEqual(collectFields(value), [{ id: '[]', label: 'Value', segments: [], types: [kindOf(value)] }]);
    assert.deepEqual(projectFields(value, ['[]']), value);
  }
  assert.deepEqual(collectFields([false, 0, '', null]), [{ id: '[null]', label: 'Value', segments: [null], types: ['boolean', 'null', 'number', 'string'] }]);
  assert.deepEqual(projectFields([false, 0, '', null], ['[null]']), [false, 0, '', null]);
});

test('collecting and projecting do not mutate or share containers with the input', () => {
  const input = { rocket: { name: 'Falcon', payloads: [{ mass: 0 }] }, other: false };
  const before = JSON.stringify(input);
  collectFields(input);
  for (const selected of [[], [id('rocket')], [id('rocket', 'payloads', null, 'mass')]]) {
    const result = projectFields(input, selected);
    assert.notEqual(result, input);
    assert.notEqual(result.rocket, input.rocket);
    assert.notEqual(result.rocket.payloads, input.rocket.payloads);
    result.rocket.payloads[0].mass = 100;
    assert.equal(JSON.stringify(input), before);
  }
});

test('unknown fields do not invent properties and malformed field IDs are rejected', () => {
  assert.deepEqual(projectFields([{ found: 1 }, null, [2, 3]], [id(null, 'missing')]), [{}, null, [null, null]]);
  for (const value of ['invalid', '{}', 'null', '[0]', '[true]', '[{}]']) {
    assert.throws(() => projectFields({}, [value]), /field ID must encode an array/);
  }
});
