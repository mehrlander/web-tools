// docs/policies.csv + docs/policy-topics.csv: the policy catalog behind Map →
// Docs → Policy. Started as a Gemini prototype (web-tools #850), whose rows
// cited a test that did not exist and a document main had deleted, and nothing
// here noticed: the old test checked that canonical_doc existed and stopped.
//
// So the load-bearing check is the quote. A row that says a document states a
// rule carries the passage, and the passage must be found in that document.
// That is what lets a model fill the catalog (the 2026-10-01 fill was Haiku
// readers over the living docs) without the catalog taking the model's word.
// Markdown emphasis and whitespace are ignored, because a reader copies the
// words and not the asterisks; nothing else is.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const read = (f) => parseCsv(readFileSync(path.join(repoRoot, 'docs', f), 'utf8'));
const topics = read('policy-topics.csv');
const policies = read('policies.csv');
const scripts = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).scripts;
const norm = (t) => t.replace(/[*`]/g, '').replace(/\s+/g, ' ').trim();

const LEVELS = new Set(['principle', 'policy', 'standard']);
const INTENTS = new Set(['user-mandate', 'dialogue-ratified', 'model-extrapolated', 'organic-precedent', 'unknown']);
const STATUSES = new Set(['lead', 'sourced', 'checked']);

test('every topic has an area, a title and a gloss, under a unique id', () => {
  assert.ok(topics.length > 0);
  const ids = topics.map(t => t.topic_id);
  assert.equal(new Set(ids).size, ids.length, 'a topic id appears twice');
  for (const t of topics) {
    assert.match(t.topic_id, /^[a-z]+\/[a-z-]+$/, `${t.topic_id}: an id is area/slug`);
    assert.equal(t.topic_id.split('/')[0], t.domain, `${t.topic_id}: its prefix is its area`);
    assert.ok(t.title && t.gloss, `${t.topic_id}: title and gloss`);
  }
});

test('every rule sits under a declared topic, at a declared level, origin and status', () => {
  const topicIds = new Set(topics.map(t => t.topic_id));
  const ids = policies.map(p => p.policy_id);
  assert.equal(new Set(ids).size, ids.length, 'a policy id appears twice');
  for (const p of policies) {
    assert.ok(p.statement, `${p.policy_id}: no statement`);
    assert.ok(topicIds.has(p.topic_id), `${p.policy_id}: topic ${p.topic_id} is not in policy-topics.csv`);
    assert.ok(LEVELS.has(p.level), `${p.policy_id}: level ${p.level}`);
    assert.ok(INTENTS.has(p.intent_class), `${p.policy_id}: intent_class ${p.intent_class}`);
    assert.ok(STATUSES.has(p.status), `${p.policy_id}: status ${p.status}`);
  }
});

test('a quoted passage is found in the document the row cites', () => {
  const text = {};
  for (const p of policies) {
    if (!p.canonical_doc) {
      assert.ok(!p.quoted, `${p.policy_id}: a quote with no document to find it in`);
      continue;
    }
    const file = path.join(repoRoot, p.canonical_doc);
    assert.ok(existsSync(file), `${p.policy_id}: ${p.canonical_doc} does not exist`);
    if (!p.quoted) continue;
    text[file] ??= norm(readFileSync(file, 'utf8'));
    assert.ok(text[file].includes(norm(p.quoted)),
      `${p.policy_id}: the quoted passage is not in ${p.canonical_doc}: "${p.quoted}"`);
  }
});

test('sourced means the passage was found, and a session quote stays a lead', () => {
  for (const p of policies) {
    if (p.status === 'sourced') assert.ok(p.quoted, `${p.policy_id}: sourced with nothing quoted`);
    // A session quote has no check in this suite (the records are private), so
    // a row carrying one cannot claim more than lead until someone reads it.
    if (p.user_prompt_quote) assert.equal(p.status, 'lead', `${p.policy_id}: an unread session quote`);
    if (p.user_prompt_quote) assert.ok(p.origin_session, `${p.policy_id}: a quote with no session`);
  }
});

test('an enforcement names something that exists', () => {
  for (const p of policies) {
    if (!p.enforcement) continue;
    const npm = p.enforcement.match(/^npm run ([\w:-]+)$/);
    if (npm) assert.ok(scripts[npm[1]], `${p.policy_id}: no npm script ${npm[1]}`);
    else assert.ok(existsSync(path.join(repoRoot, p.enforcement)), `${p.policy_id}: ${p.enforcement} does not exist`);
  }
});
