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
// A linear history: each body's first parent is the next one down.
const commit = (name, date, bodies) => ({
  name,
  target: { oid: 'sha-' + name, committedDate: date, messageHeadline: 'tip of ' + name,
            history: { nodes: bodies.map((b, i) => ({
              oid: `${name}-${i}`, messageBody: b, parents: { nodes: [{ oid: `${name}-${i + 1}` }] },
            })) } },
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

// ── Whose session: the branch's own line, not its whole history ─────────────
//
// `history` is git log order, every ancestor across both parents of each
// merge, so the first trailer in it can belong to any branch main has merged.
// The walk follows first parents instead. Both fixtures are real web-tools
// branches as of 2026-10-07: the eight nodes GitHub returns, newest first,
// oids shortened to seven characters.

const SESS = id => `https://claude.ai/code/session_${id}`;
const node = (oid, parents, body) => ({ oid, messageBody: body, parents: { nodes: parents.map(p => ({ oid: p })) } });
const oneBranch = (name, nodes) => async () => ({ repository: { refs: {
  pageInfo: { hasNextPage: false, endCursor: null },
  nodes: [{ name, target: { oid: nodes[0].oid, committedDate: '2026-10-07T20:29:30Z',
                            messageHeadline: nodes[0].messageBody, history: { nodes } } }],
} } });

test("a branch cut from main after a merge does not take the merged side's session", async () => {
  // gemini/repo-view-presentation: three commits of its own, none with a
  // trailer, on top of main's #902 merge. That merge's second parent carries
  // session_013LbCHB's trailer, and the old walk took it, which put a session
  // idle for nearly eight hours at the top of the Activity Sessions list.
  reset();
  const name = 'gemini/repo-view-presentation';
  const nodes = [
    node('3ef6891', ['0fbc86e'], 'fix(shell): use ph-folder-simple fallback for repo glyph to satisfy phosphor font'),
    node('0fbc86e', ['276a681'], 'fix(registry): keep landing unaliased for ui-units coverage and describe shell-repos in tests.csv'),
    node('276a681', ['1486d7d'], 'feat: elevate repo front page presentation with masthead, tabs and switcher'),
    node('1486d7d', ['c4123e4', 'a323b6d'], 'Merge pull request #902: dead-links reports a portable skill the manifest lacks'),
    node('a323b6d', ['ae7e6b6'], `dead-links: report a portable skill an instruction file names and the manifest lacks\n\nClaude-Session: ${SESS('013LbCHBfPqJKsZ6dioCN9Lu')}`),
    node('c4123e4', ['ae7e6b6'], 'fix(build): quote-aware stripComments and align capabilities context pointer (#899)'),
    node('ae7e6b6', ['d64bdae', '37ed34a'], 'Merge pull request #874 from mehrlander/codex/session-review-screenshots'),
    node('37ed34a', ['d4e6caa'], `Untrack screenshot logs swept in by mistake\n\nClaude-Session: ${SESS('01KnAaYdfnzbezrRz9p1y8x1')}`),
  ];
  const gh = new GH({ repo: 'mehrlander/web-tools' });
  gh.graphql = oneBranch(name, nodes);
  assert.equal((await gh.branchesDatedSessions()).sessions[name], undefined, 'no commit of its own names a session');
  gh.graphql = oneBranch(name, nodes);
  assert.deepEqual(await gh.branchSessions(), {}, "and the fab's walk agrees");
  reset();
});

test('a branch whose tip merged main in keeps its own session', async () => {
  // claude/relaxed-dirac-vlpusa: the tip merges main, so main's #896 merge
  // sorts ahead of the branch's own commit. A walk that stopped on reaching
  // main would read this branch as blank; the first parent reaches its own
  // trailer one step down, and never the merged side's session_01K8wz3Y.
  reset();
  const name = 'claude/relaxed-dirac-vlpusa';
  const nodes = [
    node('a612b1e', ['c0fbf4f', 'e78f5e6'], "Merge remote-tracking branch 'origin/main' into claude/relaxed-dirac-vlpusa"),
    node('e78f5e6', ['18f8272', '4fe124b'], 'Merge pull request #896 from mehrlander/claude/node-python-folders'),
    node('c0fbf4f', ['18f8272'], `ui-units test: say what it checks instead of "census"\n\nClaude-Session: ${SESS('011JKNtBXapiLmbAr9wJ2iEh')}`),
    node('4fe124b', ['e063c3f'], `Remove the rename script from the tree; it stays in history at e063c3ff\n\nClaude-Session: ${SESS('01K8wz3YwDAZoXHNefxqRXXy')}`),
    node('e063c3f', ['b0500e1'], `Carry the re-runnable rename script in history\n\nClaude-Session: ${SESS('01K8wz3YwDAZoXHNefxqRXXy')}`),
    node('b0500e1', ['18f8272'], `Rename the code folders by language: tools/ to node/, scripts/ to python/\n\nClaude-Session: ${SESS('01K8wz3YwDAZoXHNefxqRXXy')}`),
    node('18f8272', ['6919398', 'b6ea154'], 'Merge pull request #898 from mehrlander/claude/dictate-one-note'),
    node('b6ea154', ['eb13015', '6919398'], "Merge remote-tracking branch 'origin/main' into claude/dictate-one-note"),
  ];
  const gh = new GH({ repo: 'mehrlander/web-tools' });
  gh.graphql = oneBranch(name, nodes);
  assert.equal((await gh.branchesDatedSessions()).sessions[name], SESS('011JKNtBXapiLmbAr9wJ2iEh'));
  reset();
});
