// tools/test/git-change.test.mjs — tests for lib/kits/git-change.js:
//   - envelope validation and SHA-256 verification
//   - bundle header parsing (prerequisites, references)
//   - Git delta application (copy/insert opcodes)
//   - packfile decompression and object reconstruction
//   - thin bundle unpack with external base blob resolution (REF_DELTA)
//   - real Git bundle generation and round-trip verification
//   - safety bounds: corruption, truncation, path traversal, hash mismatch

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadKit } from './bootstrap.mjs';

const { GitChange } = loadKit('git-change');

// Helper to create a temporary git repo with commits and generate a thin bundle
function createTempGitBundle(t) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'git-change-test-'));
  const git = (args) => execFileSync('git', args.split(' '), { cwd: tempDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

  git('init --initial-branch=main');
  git('config user.name Test');
  git('config user.email test@example.com');

  // Commit 1: Base
  writeFileSync(path.join(tempDir, 'file1.txt'), 'Hello Base World!\nLine 2 Base\nLine 3 Base\n');
  writeFileSync(path.join(tempDir, 'large.txt'), 'A'.repeat(5000) + '\n');
  git('add file1.txt large.txt');
  git('commit -m Base-commit');
  const baseSha = git('rev-parse HEAD').trim();
  const baseTreeSha = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: tempDir, encoding: 'utf8' }).trim();

  // Commit 2: Head (adds file2, modifies large.txt slightly so it deltas against base)
  writeFileSync(path.join(tempDir, 'file2.txt'), 'New File in Head\n');
  writeFileSync(path.join(tempDir, 'large.txt'), 'A'.repeat(2500) + 'MODIFIED' + 'A'.repeat(2500) + '\n');
  git('add file2.txt large.txt');
  execFileSync('git', ['commit', '-m', 'Head commit with delta\n\nCo-Authored-By: Codex <codex@openai.com>'], { cwd: tempDir, encoding: 'utf8' });
  const headSha = git('rev-parse HEAD').trim();
  const headTreeSha = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: tempDir, encoding: 'utf8' }).trim();
  const headMessage = execFileSync('git', ['log', '-1', '--format=%B', 'HEAD'], { cwd: tempDir, encoding: 'utf8' }).trim();

  // Create thin bundle: base..head
  const bundlePath = path.join(tempDir, 'change.bundle');
  execFileSync('git', ['bundle', 'create', bundlePath, 'HEAD', `^${baseSha}`], { cwd: tempDir, encoding: 'utf8' });
  const bundleBytes = new Uint8Array(readFileSync(bundlePath));

  const cleanup = () => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  };

  return {
    tempDir,
    baseSha,
    baseTreeSha,
    headSha,
    headTreeSha,
    headMessage,
    bundleBytes,
    cleanup,
  };
}

// ── Delta Application ────────────────────────────────────────────────────────

test('applyDelta: reproduces exact target bytes from base and copy/insert opcodes', () => {
  const baseText = 'The quick brown fox jumps over the lazy dog.';
  const base = new TextEncoder().encode(baseText);

  // Delta:
  // Base size: 44 (0x2c)
  // Target size: 50 (0x32)
  // Copy "The quick " (offset 0, size 10) -> 0x80 | 0x01 | 0x10 = 0x91, offset=0, size=10
  // Insert "super " (size 6) -> 0x06, "super "
  // Copy "brown fox jumps over the lazy dog." (offset 10, size 34) -> 0x91, offset=10, size=34
  const insertText = 'super ';
  const insertBytes = new TextEncoder().encode(insertText);

  const delta = new Uint8Array([
    44, // base size
    50, // target size
    // Copy 10 bytes from 0:
    0x80 | 0x01 | 0x10, 0, 10,
    // Insert "super ":
    6, ...insertBytes,
    // Copy 34 bytes from 10:
    0x80 | 0x01 | 0x10, 10, 34,
  ]);

  const result = GitChange.applyDelta(base, delta);
  const resultText = new TextDecoder().decode(result);
  assert.equal(resultText, 'The quick super brown fox jumps over the lazy dog.');
});

test('applyDelta: throws on base size mismatch or bounds violations', () => {
  const base = new Uint8Array([1, 2, 3]);
  const badBaseSizeDelta = new Uint8Array([5, 3, 1, 99]);
  assert.throws(() => GitChange.applyDelta(base, badBaseSizeDelta), /Delta base size mismatch/);

  const outOfBoundsCopy = new Uint8Array([3, 10, 0x91, 0, 20]);
  assert.throws(() => GitChange.applyDelta(base, outOfBoundsCopy), /out of base bounds/);
});

// ── Git Object Hashing ─────────────────────────────────────────────────────

test('hashGitObject: matches standard Git SHA-1 hashing', async () => {
  // "hello world\n" blob in git: echo "hello world" | git hash-object --stdin -> 3b18e512dba79e4c8300dd08aeb37f8e728b8dad
  const data = new TextEncoder().encode('hello world\n');
  const sha = await GitChange.hashGitObject('blob', data);
  assert.equal(sha, '3b18e512dba79e4c8300dd08aeb37f8e728b8dad');
});

// ── Envelope Verification ──────────────────────────────────────────────────

test('verifyEnvelope: validates schema, size, and SHA-256 integrity', async () => {
  const bundlePayload = new Uint8Array([1, 2, 3, 4, 5]);
  const b64 = GitChange.toBase64(bundlePayload);
  const sha256 = await GitChange.sha256Hex(bundlePayload);

  const validEnvelope = {
    schema: 'git-change/1',
    repository: 'mehrlander/web-tools',
    proposed_branch: 'codex/test-branch',
    base: '0123456789abcdef0123456789abcdef01234567',
    source_head: 'abcdef0123456789abcdef0123456789abcdef01',
    expected_tree: 'fedcba9876543210fedcba9876543210fedcba98',
    payload: {
      format: 'git-bundle',
      encoding: 'base64',
      byte_count: 5,
      sha256,
      data: b64,
    },
  };

  const verified = await GitChange.verifyEnvelope(JSON.stringify(validEnvelope));
  assert.equal(verified.bundleBytes.length, 5);
  assert.deepEqual(verified.bundleBytes, bundlePayload);

  // Checksum failure
  const corruptedEnvelope = JSON.parse(JSON.stringify(validEnvelope));
  corruptedEnvelope.payload.sha256 = '0000000000000000000000000000000000000000000000000000000000000000';
  await assert.rejects(() => GitChange.verifyEnvelope(corruptedEnvelope), /SHA-256 checksum mismatch/);

  // Unknown schema
  const badSchema = JSON.parse(JSON.stringify(validEnvelope));
  badSchema.schema = 'git-change/99';
  await assert.rejects(() => GitChange.verifyEnvelope(badSchema), /Unsupported schema/);

  // Byte count mismatch
  const badByteCount = JSON.parse(JSON.stringify(validEnvelope));
  badByteCount.payload.byte_count = 100;
  await assert.rejects(() => GitChange.verifyEnvelope(badByteCount), /byte count mismatch/);
});

// ── Real Git Bundle Unpack & Delta Resolution ──────────────────────────────

test('unpackPackfile & inspectChange: round-trips a real Git thin bundle with deltas', async () => {
  const fixture = createTempGitBundle();
  try {
    const { baseSha, headSha, headTreeSha, bundleBytes } = fixture;

    // 1. Bundle header parsing
    const header = GitChange.parseBundleHeader(bundleBytes);
    assert.equal(header.version, 2);
    assert.deepEqual(header.prerequisites, [baseSha]);
    assert.equal(header.references.length, 1);
    assert.equal(header.references[0].sha, headSha);
    assert.ok(header.packOffset > 0);

    // 2. Base blob fetcher mock for thin pack deltas
    // In our test, large.txt in HEAD was deltified against large.txt in BASE.
    // The base blob is not in the pack (thin bundle), so unpackPackfile calls fetchBaseBlob!
    const baseLargeBlobSha = execFileSync('git', ['rev-parse', `${baseSha}:large.txt`], { cwd: fixture.tempDir, encoding: 'utf8' }).trim();
    const baseLargeText = 'A'.repeat(5000) + '\n';
    const baseLargeBytes = new TextEncoder().encode(baseLargeText);

    let fetchCalled = false;
    const fetchBaseBlob = async (sha) => {
      if (sha === baseLargeBlobSha) {
        fetchCalled = true;
        return { type: 'blob', data: baseLargeBytes, sha };
      }
      return null;
    };

    const sha256 = await GitChange.sha256Hex(bundleBytes);
    const envelope = {
      schema: 'git-change/1',
      repository: 'test/repo',
      proposed_branch: 'codex/test-branch',
      base: baseSha,
      source_head: headSha,
      expected_tree: headTreeSha,
      commit: {
        subject: 'Head commit with delta',
        message: fixture.headMessage,
      },
      payload: {
        format: 'git-bundle',
        encoding: 'base64',
        byte_count: bundleBytes.length,
        sha256,
        data: GitChange.toBase64(bundleBytes),
      },
    };

    const inspected = await GitChange.inspectChange(envelope, { fetchBaseBlob });
    assert.ok(inspected.valid);
    assert.equal(inspected.headTreeSha, headTreeSha);
    assert.equal(inspected.commit.subject, 'Head commit with delta');
    assert.ok(fetchCalled, 'fetchBaseBlob should have been called to resolve the thin delta');

    // Check changed files list
    const paths = inspected.changedFiles.map(f => f.path).sort();
    assert.ok(paths.includes('file2.txt'));
    assert.ok(paths.includes('large.txt'));

    // Check content of large.txt matches expected modified text
    const largeObj = inspected.objects.get(inspected.changedFiles.find(f => f.path === 'large.txt').sha);
    assert.ok(largeObj);
    const expectedLargeText = 'A'.repeat(2500) + 'MODIFIED' + 'A'.repeat(2500) + '\n';
    assert.equal(new TextDecoder().decode(largeObj.data), expectedLargeText);
  } finally {
    fixture.cleanup();
  }
});

// ── Security & Edge Cases ──────────────────────────────────────────────────

test('parseTree: rejects illegal path names and directory traversal', () => {
  // Tree entry: mode name\0<20-byte-sha>
  const shaBytes = new Uint8Array(20).fill(1);
  const maliciousEntry = new Uint8Array([
    ...new TextEncoder().encode('100644 ../etc/passwd\0'),
    ...shaBytes,
  ]);
  assert.throws(() => GitChange.parseTree(maliciousEntry), /Illegal filename in tree entry/);

  const dotDotEntry = new Uint8Array([
    ...new TextEncoder().encode('100644 ..\0'),
    ...shaBytes,
  ]);
  assert.throws(() => GitChange.parseTree(dotDotEntry), /Illegal filename in tree entry/);
});

test('inspectChange: rejects mismatch between commit tree and expected_tree', async () => {
  const fixture = createTempGitBundle();
  try {
    const { baseSha, headSha, headTreeSha, bundleBytes } = fixture;
    const sha256 = await GitChange.sha256Hex(bundleBytes);

    const baseLargeBlobSha = execFileSync('git', ['rev-parse', `${baseSha}:large.txt`], { cwd: fixture.tempDir, encoding: 'utf8' }).trim();
    const baseLargeBytes = new TextEncoder().encode('A'.repeat(5000) + '\n');
    const fetchBaseBlob = async (sha) => sha === baseLargeBlobSha ? { type: 'blob', data: baseLargeBytes, sha } : null;

    const envelope = {
      schema: 'git-change/1',
      repository: 'test/repo',
      proposed_branch: 'codex/test-branch',
      base: baseSha,
      source_head: headSha,
      expected_tree: '0000000000000000000000000000000000000000', // incorrect tree
      payload: {
        format: 'git-bundle',
        encoding: 'base64',
        byte_count: bundleBytes.length,
        sha256,
        data: GitChange.toBase64(bundleBytes),
      },
    };

    await assert.rejects(() => GitChange.inspectChange(envelope, { fetchBaseBlob }), /Tree SHA mismatch/);
  } finally {
    fixture.cleanup();
  }
});

// ── Creation Helper CLI (scripts/git-change.mjs) ───────────────────────────

test('scripts/git-change.mjs: generates a valid envelope and Web Tools Stage link', () => {
  const fixture = createTempGitBundle();
  try {
    const { baseSha, headSha, tempDir } = fixture;
    const scriptPath = path.resolve('scripts/git-change.mjs');
    const outFile = path.join(tempDir, 'output.git-change.json');

    const stdout = execFileSync('node', [
      scriptPath,
      '--base', baseSha,
      '--head', headSha,
      '--branch', 'codex/test-cli-branch',
      '--out', outFile,
      '--repo', 'mehrlander/web-tools',
      '--pr-base', 'main',
      '--pr-title', 'Test PR Title',
    ], { cwd: tempDir, encoding: 'utf8' });

    assert.ok(stdout.includes('Created Git change package:'));
    assert.ok(stdout.includes('Web Tools Stage Link:'));
    assert.ok(stdout.includes('#gz='));

    const content = readFileSync(outFile, 'utf8');
    const parsed = JSON.parse(content);
    assert.equal(parsed.schema, 'git-change/1');
    assert.equal(parsed.repository, 'mehrlander/web-tools');
    assert.equal(parsed.proposed_branch, 'codex/test-cli-branch');
    assert.equal(parsed.base, baseSha);
    assert.equal(parsed.source_head, headSha);
    assert.equal(parsed.draft_pr?.title, 'Test PR Title');
    assert.equal(parsed.payload.format, 'git-bundle');
    assert.ok(parsed.payload.data.length > 0);
  } finally {
    fixture.cleanup();
  }
});

