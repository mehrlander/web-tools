// docs/policies.csv + docs/policy-topics.csv — the policy catalog: distilled operative
// decisions with explicit intentionality attribution (user-mandate, dialogue-ratified,
// model-extrapolated, organic-precedent) and backlinks to canonical docs and session records.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../build/registries-load.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const read = (f) => parseCsv(readFileSync(path.join(repoRoot, 'docs', f), 'utf8'));

const topics = read('policy-topics.csv');
const policies = read('policies.csv');

const VALID_INTENTS = new Set([
  'user-mandate',
  'dialogue-ratified',
  'model-extrapolated',
  'organic-precedent',
]);

const VALID_STATUSES = new Set([
  'active',
  'provisional',
  'stale',
]);

test('policy-topics.csv header and integrity', () => {
  assert.ok(topics.length > 0, 'topics registry has entries');
  const ids = new Set();
  for (const t of topics) {
    assert.ok(t.topic_id, 'topic has topic_id');
    assert.ok(!ids.has(t.topic_id), `topic_id ${t.topic_id} is unique`);
    ids.add(t.topic_id);
    assert.ok(t.domain, `topic ${t.topic_id} has domain`);
    assert.ok(t.title, `topic ${t.topic_id} has title`);
    assert.ok(t.gloss, `topic ${t.topic_id} has gloss`);
  }
});

test('policies.csv header and foreign key integrity', () => {
  assert.ok(policies.length > 0, 'policies registry has entries');
  const topicIds = new Set(topics.map(t => t.topic_id));
  const policyIds = new Set();

  for (const p of policies) {
    assert.ok(p.policy_id, 'policy has policy_id');
    assert.ok(!policyIds.has(p.policy_id), `policy_id ${p.policy_id} is unique`);
    policyIds.add(p.policy_id);

    assert.ok(p.topic_id, `policy ${p.policy_id} has topic_id`);
    assert.ok(topicIds.has(p.topic_id), `policy ${p.policy_id} topic_id '${p.topic_id}' exists in policy-topics.csv`);

    assert.ok(p.statement, `policy ${p.policy_id} has statement`);
    assert.ok(VALID_INTENTS.has(p.intent_class), `policy ${p.policy_id} intent_class '${p.intent_class}' is valid`);
    assert.ok(VALID_STATUSES.has(p.status), `policy ${p.policy_id} status '${p.status}' is valid`);

    assert.ok(p.canonical_doc, `policy ${p.policy_id} has canonical_doc`);
    const docPath = path.join(repoRoot, p.canonical_doc);
    assert.ok(existsSync(docPath), `policy ${p.policy_id} canonical_doc '${p.canonical_doc}' exists on disk`);

    if (p.intent_class === 'user-mandate') {
      assert.ok(p.user_prompt_quote && p.user_prompt_quote.trim().length > 0,
        `user-mandate policy ${p.policy_id} must have user_prompt_quote`);
    }
  }
});
