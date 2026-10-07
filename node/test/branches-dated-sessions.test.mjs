// gh-fetch.js — branchesDatedSessions(): the dated branch list and the
// authoring session per branch, from ONE walk of one refs connection.
//
// It exists because the activity crawl always wanted both and used to ask
// twice, paying for the same pagination each time. Measured 2026-08-17 off the
// crawl's own call log: 79 GraphQL posts costing 75s of request time across 22
// repos, three per repo, two of them this pair.
//
// So the assertions are that one walk answers both questions, that pagination
// is followed once rather than twice, and that the session is lifted from the
// first commit body in each branch's history that carries the footer.
//
// The stub is a fake graphql(), since what is under test is the walk and the
// shaping, not the transport.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const api = readFileSync(path.join(repoRoot, 'lib/gh-api.js'), 'utf8');
const fetchSrc = readFileSync(path.join(repoRoot, 'lib/gh-fetch.js'), 'utf8');

// gh-api is an ES module; the one export is what gh-fetch extends.
const { default: GH } = await import('../../lib/gh-api.js');
const window = { GH };
new Function('window', fetchSrc)(window);

const SESSION = 'https://claude.ai/code/session_01ABCdef';
const commit = (name, date, bodies) => ({
  name,
  target: { oid: 'sha-' + name, committedDate: date, messageHeadline: 'tip of ' + name,
            history: { nodes: bodies.map(b => ({ messageBody: b })) } },
});

// Two pages, so the walk's pagination is exercised: a single page would pass
// whether or not the cursor is followed.
const PAGES = [
  { nodes: [commit('b-old', '2026-08-01T00:00:00Z', ['no footer here']),
            commit('b-new', '2026-08-16T00:00:00Z', ['first', 'ran under ' + SESSION])],
    pageInfo: { hasNextPage: true, endCursor: 'cur1' } },
  { nodes: [commit('b-mid', '2026-08-10T00:00:00Z', [])],
    pageInfo: { hasNextPage: false, endCursor: null } },
];

const makeGh = () => {
  const gh = new GH({ repo: 'me/home' });
  const calls = [];
  gh.graphql = async (query, vars) => {
    calls.push({ query, vars });
    const page = PAGES[calls.length - 1];
    return { repository: { refs: page } };
  };
  return { gh, calls };
};

test('one walk answers both questions', async () => {
  const { gh, calls } = makeGh();
  const { branches, sessions } = await gh.branchesDatedSessions();
  // Newest first, the same order and shape branchesDated returns.
  assert.deepEqual(branches.map(b => b.name), ['b-new', 'b-mid', 'b-old']);
  assert.equal(branches[0].sha, 'sha-b-new');
  assert.equal(branches[0].subject, 'tip of b-new');
  assert.equal(branches[0].date, '2026-08-16T00:00:00Z');
  // And the sessions, keyed by branch, from the same response.
  assert.deepEqual(sessions, { 'b-new': SESSION });
  // Two pages, two posts. The pair this replaces would have made four.
  assert.equal(calls.length, 2);
  assert.equal(calls[1].vars.cursor, 'cur1', 'the second page follows the cursor');
});

test('the depth rides the query, since the footer may be a few commits back', async () => {
  const { gh, calls } = makeGh();
  await gh.branchesDatedSessions(100, 500, 3);
  assert.equal(calls[0].vars.depth, 3);
  assert.equal(calls[0].vars.per, 100);
});

test('a branch with no footer in reach simply has no session', async () => {
  const { gh } = makeGh();
  const { branches, sessions } = await gh.branchesDatedSessions();
  assert.equal(sessions['b-old'], undefined, 'a human-authored branch has none, honestly');
  assert.equal(branches.find(b => b.name === 'b-old').name, 'b-old', 'and it keeps its row');
});

// ── The order, and what happens when the server will not take it ────────────
//
// GitHub's refs connection defaults to ALPHABETICAL. With a 500 cap and branch
// names shaped `claude/<slug>-<hash>`, that made the walk an arbitrary sample
// that every caller then sorted by date and read as a recency window. Measured
// 2026-09-09: web-tools had 579 branches and home 644, so 79 and 144 were cut
// by name.
//
// The order cannot be exercised against the real API from the Claude Code web
// sandbox, whose proxy serves a pinned set of GraphQL operations. So what is
// tested here is the degradation: an untested query must not be able to break a
// crawl, and it must say which walk the caller actually got.

const orderOf = (calls) => calls.map(c => c.vars.order);
const reset = () => { delete GH._refOrder; };

test('the walk asks for newest-first', async () => {
  reset();
  const { gh, calls } = makeGh();
  const out = await gh.branchesDatedSessions();
  assert.deepEqual(calls[0].vars.order, { field: 'TAG_COMMIT_DATE', direction: 'DESC' });
  assert.match(calls[0].query, /orderBy:\$order/);
  assert.equal(out.ordered, true);
});

test('a server that refuses the order still returns branches, unordered', async () => {
  reset();
  const gh = new GH({ repo: 'me/home' });
  const calls = [];
  gh.graphql = async (query, vars) => {
    calls.push({ query, vars });
    if (vars.order) throw new Error('Argument "orderBy" has invalid value');
    return { repository: { refs: PAGES[calls.filter(c => !c.vars.order).length - 1] } };
  };
  const out = await gh.branchesDatedSessions();
  assert.equal(out.ordered, false, 'and it says the window is not a recency window');
  assert.deepEqual(out.branches.map(b => b.name), ['b-new', 'b-mid', 'b-old'],
                   'the local sort still runs, so the SAMPLE is ordered even when the cut was not');
  assert.equal(orderOf(calls)[0].field, 'TAG_COMMIT_DATE', 'it tried');
  assert.equal(orderOf(calls)[1], null, 'then retried without');
});

test('the refusal is remembered, so the probe is paid once and not per page', async () => {
  reset();
  const gh = new GH({ repo: 'me/home' });
  const calls = [];
  gh.graphql = async (query, vars) => {
    calls.push({ query, vars });
    if (vars.order) throw new Error('nope');
    return { repository: { refs: PAGES[calls.filter(c => !c.vars.order).length - 1] } };
  };
  await gh.branchesDatedSessions();
  const first = calls.length;
  calls.length = 0;
  await gh.branchesDatedSessions();
  assert.ok(!calls.some(c => c.vars.order), 'the second walk never probes again');
  assert.ok(calls.length < first, 'and costs one call fewer than the first');
  reset();
});

test('a failure AFTER the order worked is raised, not retried away', async () => {
  // Once the schema is known to accept it, a refusal is an outage and swallowing
  // it would hide one behind a silently worse walk.
  reset();
  const gh = new GH({ repo: 'me/home' });
  let n = 0;
  gh.graphql = async (query, vars) => {
    if (++n === 1) return { repository: { refs: PAGES[1] } };   // one page, succeeds
    throw new Error('502 upstream');
  };
  await gh.branchesDatedSessions();                              // primes the flag
  await assert.rejects(() => gh.branchesDatedSessions(), /502 upstream/);
  reset();
});

test('capped says whether the cap cut at all', async () => {
  reset();
  const { gh } = makeGh();
  assert.equal((await gh.branchesDatedSessions()).capped, false, 'three branches, no cut');
  const { gh: gh2 } = makeGh();
  assert.equal((await gh2.branchesDatedSessions(100, 2)).capped, true);
});
