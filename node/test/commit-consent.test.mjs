// skills/hooks/commit-consent.py — the consent gate, which had no test
// at all until this file.
//
// It refuses a commit, so every one of its answers costs a session a cycle, and
// the expensive answer is the WRONG REFUSAL: a gate that stops a generator is
// the fastest way to teach a session that the answer is --no-verify, which the
// engine's own comment says. Three such refusals have been found by running it,
// each on a file nobody authored: a new contract written to spec, a regenerated
// index, and a vendored copy. The first two were designed out; the third is the
// `is_copy` rule below, and this file is what stops a fourth arriving unseen.
//
// Each case is a throwaway git repository, because the gate reads the INDEX
// (`git show :path`) and the head, not the working tree, so nothing short of a
// real repository exercises what it actually does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const GATE = join(repoRoot, 'skills/hooks/commit-consent.py');

function git(cwd, ...args) {
  return spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
}

function write(root, rel, body) {
  mkdirSync(join(root, dirname(rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
}

/** A repo with `seed` committed on main, then `stage` staged on top, on
 *  `branch` when one is named. Returns the gate's exit status and stderr for
 *  `msg`. */
function gate(seed, stage, msg, branch) {
  const root = mkdtempSync(join(tmpdir(), 'consent-'));
  try {
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'config', 'user.email', 't@e.st');
    git(root, 'config', 'user.name', 'T');
    for (const [rel, body] of Object.entries(seed)) write(root, rel, body);
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'seed');
    if (branch === 'detached') git(root, 'checkout', '-q', '--detach');
    else if (branch) git(root, 'checkout', '-q', '-b', branch);
    for (const [rel, body] of Object.entries(stage)) write(root, rel, body);
    git(root, 'add', '-A');
    const file = join(root, 'MSG');
    writeFileSync(file, msg);
    const r = spawnSync('python3', [GATE, file], { cwd: root, encoding: 'utf8' });
    return { status: r.status, err: (r.stderr || '').trim() };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const DOC = 'docs/thing.md';

test('a modified documentation file is refused without a trailer, and passes with one', () => {
  const seed = { [DOC]: '# Thing\n\nOne.\n' };
  const stage = { [DOC]: '# Thing\n\nTwo.\n' };
  const no = gate(seed, stage, 'Revise the thing\n');
  assert.equal(no.status, 1);
  assert.match(no.err, /documentation changed: docs\/thing\.md/);
  assert.match(no.err, /Doc-change-approved/, 'the prompt names the field to add');

  const yes = gate(seed, stage, 'Revise the thing\n\nDoc-change-approved: "yes, reword it" -> docs/thing.md\n');
  assert.equal(yes.status, 0, yes.err);
});

test('on a branch, a modified document passes, with a reminder that the merge waits on approval', () => {
  // The owner reviews wording as a commit and approves it before the merge, so
  // the commit itself is not where the gate stands.
  const seed = { [DOC]: '# Thing\n\nOne.\n' };
  const stage = { [DOC]: '# Thing\n\nTwo.\n' };
  const out = gate(seed, stage, 'Revise the thing\n', 'claude/revise-thing');
  assert.equal(out.status, 0, out.err);
  assert.match(out.err, /documentation changed: docs\/thing\.md/);
  assert.match(out.err, /doc-craft/);
  assert.match(out.err, /merge only after they approve/);

  // A detached HEAD can be pushed straight to main, so it is held as main is.
  const loose = gate(seed, stage, 'Revise the thing\n', 'detached');
  assert.equal(loose.status, 1, 'a detached HEAD needs the approval on the commit');
});

test('a NEW documentation file is not refused: it retracts nothing', () => {
  // The first false positive, on a contract written to spec by the session that
  // had just been asked to write it. There is no prior claim for a go-ahead to
  // have been stretched over, so the trigger is modified-only.
  const out = gate({ 'README.md': 'x\n' }, { [DOC]: '# Thing\n' }, 'Add the thing\n');
  assert.equal(out.status, 0, out.err);
});

test('a generated file is not authored language, and says so in its banner', () => {
  // The second false positive: a docs index the commit hook had rewritten from
  // a CSV three lines earlier.
  const banner = '# Index\n\n_Generated from docs.csv. Do not hand-edit._\n';
  const out = gate({ [DOC]: banner + 'One.\n' }, { [DOC]: banner + 'Two.\n' }, 'Regenerate\n');
  assert.equal(out.status, 0, out.err);
});

test('a vendored copy is not authored language, and cannot say so', () => {
  // The third, and the one this repo hit: three docs ship inside a plugin skill
  // by being copied from docs/, main revised one, and the commit re-running the
  // copier was refused. A banner is not available here, because byte-equality
  // with the source is the whole point and the check that holds the copy in
  // place compares bytes.
  const body = '# Surfacing\n\nOne.\n';
  const next = '# Surfacing\n\nTwo.\n';
  const copy = 'skills/default/Surfacing.md';
  const out = gate({ 'docs/Surfacing.md': next, [copy]: body },
                   { [copy]: next }, 'Re-vendor\n');
  assert.equal(out.status, 0, out.err);
});

test('a copy that has drifted from its source is authored again, and is caught again', () => {
  // The boundary the rule needs, or `is_copy` would excuse every edit to a file
  // that merely shares a name with another. Same name, different bytes, so the
  // twin is not a twin.
  const copy = 'skills/default/Surfacing.md';
  const out = gate({ 'docs/Surfacing.md': '# Surfacing\n\nSource.\n', [copy]: '# Surfacing\n\nSource.\n' },
                   { [copy]: '# Surfacing\n\nDrifted on its own.\n' }, 'Edit the copy\n');
  assert.equal(out.status, 1, 'a drifted copy is an authored change');
  assert.match(out.err, /documentation changed/);
});

test('research the repo declares is not documentation, and a sentence in the file does not make it so', () => {
  // A dated log of what was tried and what came back is research, filed
  // outside documentation (docs/CONSTELLATION.md) and declared in
  // .web-tools.json. The declaration is the one statement: a declared file is
  // exempt, and so is the folder of a declared README.md.
  const manifest = JSON.stringify({ research: [{ path: 'docs/lab/findings.md', kind: 'probe' },
                                               { path: 'docs/probes/README.md', kind: 'probe' }] });
  const seed = { '.web-tools.json': manifest, 'docs/lab/findings.md': '# Findings\n\nOne.\n',
                 'docs/probes/2026-10-20-run.md': '# A run\n\nOne.\n', [DOC]: 'One.\n' };
  const file = gate(seed, { 'docs/lab/findings.md': '# Findings\n\nTwo.\n' }, 'Log a finding\n');
  assert.equal(file.status, 0, file.err);
  const folder = gate(seed, { 'docs/probes/2026-10-20-run.md': '# A run\n\nTwo.\n' }, 'Add to a run\n');
  assert.equal(folder.status, 0, folder.err);

  // Everything else stays documentation, including a file that asks in its own
  // words not to be gated: the in-document sentence was retired for the declaration.
  const other = gate(seed, { [DOC]: 'Two.\n' }, 'Revise\n');
  assert.equal(other.status, 1, 'an undeclared document is still gated');
  const said = '# Notes\n\nA log. Do not ask anyone to approve these.\n\n';
  const sentence = gate({ [DOC]: said + 'One.\n' }, { [DOC]: said + 'Two.\n' }, 'Revise\n');
  assert.equal(sentence.status, 1, 'a sentence in the document is not a declaration');
});

test('a new task file is refused without the field naming who asked for it', () => {
  const out = gate({ 'README.md': 'x\n' },
                   { 'tracker/tasks/do-a-thing-abc123.md': '# Do a thing\n' },
                   'File a task\n');
  assert.equal(out.status, 1);
  assert.match(out.err, /Task-named-by-user/);

  const ok = gate({ 'README.md': 'x\n' },
                  { 'tracker/tasks/do-a-thing-abc123.md': '# Do a thing\n' },
                  'File a task\n\nTask-named-by-user: "put that on the board" -> Do a thing\n');
  assert.equal(ok.status, 0, ok.err);
});

test('a merge or revert message is skipped, and so is the running log', () => {
  const seed = { [DOC]: 'One.\n' };
  const merge = gate(seed, { [DOC]: 'Two.\n' }, "Merge branch 'main'\n");
  assert.equal(merge.status, 0, merge.err);

  // chron/, blog/ and dump/ are exempt by name: a dated entry in a running log
  // is not a claim anyone approved the language of.
  const log = gate({ 'chron/2026/09/a.md': 'One.\n' },
                   { 'chron/2026/09/a.md': 'Two.\n' }, 'Log it\n');
  assert.equal(log.status, 0, log.err);
});

test('a root-level glob stays at the root: a README in a subfolder is not documentation', () => {
  // The fallback registry's `*.md` names the repo root. fnmatch let `*` cross
  // `/`, so it claimed every Markdown file, archive/**/README.md included.
  const nested = gate({ 'archive/x/README.md': '# X\n\nOld.\n' }, { 'archive/x/README.md': '# X\n\nNew.\n' }, 'Revise a nested readme\n');
  assert.equal(nested.status, 0, nested.err);
  const root = gate({ 'README.md': '# R\n\nOld.\n' }, { 'README.md': '# R\n\nNew.\n' }, 'Revise the root readme\n');
  assert.notEqual(root.status, 0);
  assert.match(root.err, /documentation changed: README\.md/);
});

