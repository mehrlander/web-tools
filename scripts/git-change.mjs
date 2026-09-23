#!/usr/bin/env node
// scripts/git-change.mjs — create a canonical git-change/1 envelope from a committed local change.
//
// Usage:
//   node scripts/git-change.mjs [options]
//
// Options:
//   --repo <owner/repo>      Target repository (default: read from origin remote)
//   --base <ref|sha>         Base commit / ref (e.g. origin/main) (required)
//   --head <ref|sha>         Head commit / ref (default: HEAD)
//   --branch <name>          Proposed branch name (default: current git branch)
//   --out <filename>         Output filename (default: <branch-leaf>.git-change.json)
//   --app-url <url>          Base Web Tools app URL (default: https://mehrlander.github.io/web-tools/app/)
//   --pr-base <branch>       Optional base branch for draft PR (e.g. main)
//   --pr-title <title>       Optional draft PR title (default: commit subject)
//   --pr-body <body>         Optional draft PR body
//   --allow-dirty            Proceed even if local working tree has uncommitted changes
//   --help, -h               Show this help message

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const GZ_MAX = 24 * 1024; // 24,576 chars, existing Stage fragment budget

function parseArgs(args) {
  const opts = {
    repo: '',
    base: '',
    head: 'HEAD',
    branch: '',
    out: '',
    appUrl: 'https://mehrlander.github.io/web-tools/app/',
    prBase: '',
    prTitle: '',
    prBody: '',
    allowDirty: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') {
      opts.help = true;
    } else if (a === '--repo' && i + 1 < args.length) {
      opts.repo = args[++i];
    } else if (a === '--base' && i + 1 < args.length) {
      opts.base = args[++i];
    } else if (a === '--head' && i + 1 < args.length) {
      opts.head = args[++i];
    } else if (a === '--branch' && i + 1 < args.length) {
      opts.branch = args[++i];
    } else if (a === '--out' && i + 1 < args.length) {
      opts.out = args[++i];
    } else if (a === '--app-url' && i + 1 < args.length) {
      opts.appUrl = args[++i];
    } else if (a === '--pr-base' && i + 1 < args.length) {
      opts.prBase = args[++i];
    } else if (a === '--pr-title' && i + 1 < args.length) {
      opts.prTitle = args[++i];
    } else if (a === '--pr-body' && i + 1 < args.length) {
      opts.prBody = args[++i];
    } else if (a === '--allow-dirty') {
      opts.allowDirty = true;
    }
  }

  return opts;
}

function git(args, opts = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString().trim() : e.message;
    throw new Error(`git ${args.join(' ')} failed: ${stderr}`);
  }
}

// Gzip compress string using Node's CompressionStream
async function gzipString(text) {
  const stream = new Blob([new TextEncoder().encode(text)]).stream()
    .pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Convert bytes to base64url string without padding
function b64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help || !opts.base) {
    console.log(`
Usage: node scripts/git-change.mjs --base <base-ref> [options]

Required:
  --base <ref|sha>         Base commit / ref (e.g. origin/main)

Options:
  --repo <owner/repo>      Target repository (default: auto-detected from origin remote)
  --head <ref|sha>         Head commit / ref (default: HEAD)
  --branch <name>          Proposed branch name (default: current git branch)
  --out <filename>         Output filename (default: <slug>.git-change.json)
  --app-url <url>          Base Web Tools app URL (default: https://mehrlander.github.io/web-tools/app/)
  --pr-base <branch>       Optional base branch for draft PR
  --pr-title <title>       Optional draft PR title (default: commit subject)
  --pr-body <body>         Optional draft PR body
  --allow-dirty            Allow running with uncommitted working-tree changes
`);
    process.exit(opts.help ? 0 : 1);
  }

  // 1. Check for uncommitted tracked changes if not explicitly allowed
  if (!opts.allowDirty) {
    const status = git(['status', '--porcelain', '-uno']);
    if (status) {
      console.error('Error: Working tree has uncommitted changes. Commit your changes first or pass --allow-dirty.');
      process.exit(1);
    }
  }

  // 2. Resolve commit SHAs and head tree SHA
  const baseSha = git(['rev-parse', opts.base]);
  const headSha = git(['rev-parse', opts.head]);
  const expectedTree = git(['rev-parse', `${opts.head}^{tree}`]);

  if (baseSha === headSha) {
    console.error(`Error: Base commit (${baseSha.slice(0, 7)}) and Head commit (${headSha.slice(0, 7)}) are identical. Nothing to package.`);
    process.exit(1);
  }

  // 3. Resolve repo
  let repo = opts.repo;
  if (!repo) {
    try {
      const remoteUrl = git(['remote', 'get-url', 'origin']);
      const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/i);
      if (match) repo = match[1];
    } catch {}
  }
  if (!repo) repo = 'mehrlander/web-tools';

  // 4. Resolve proposed branch
  let branch = opts.branch;
  if (!branch) {
    try {
      branch = git(['rev-parse', '--abbrev-ref', opts.head]);
      if (branch === 'HEAD') branch = '';
    } catch {}
  }
  if (!branch) branch = 'codex/git-change-handoff';

  // 5. Commit metadata
  const commitSubject = git(['log', '-1', '--format=%s', headSha]);
  const commitMessage = git(['log', '-1', '--format=%B', headSha]);

  // 6. Changed files manifest
  const diffOutput = git(['diff', '--name-status', `${baseSha}..${headSha}`]);
  const changedFiles = [];
  if (diffOutput) {
    for (const line of diffOutput.split('\n')) {
      const parts = line.trim().split(/\t+/);
      if (parts.length >= 2) {
        const status = parts[0];
        const filePath = parts[parts.length - 1]; // handles renames R100 old new
        changedFiles.push({ path: filePath, status });
      }
    }
  }

  // 7. Create thin Git bundle
  const tempDir = mkdtempSync(path.join(tmpdir(), 'git-change-'));
  const tempBundlePath = path.join(tempDir, 'payload.bundle');
  const tempRef = `refs/heads/${branch}`;
  let createdTempRef = false;

  try {
    const existingRefSha = (() => {
      try { return git(['rev-parse', tempRef]); } catch { return null; }
    })();
    if (existingRefSha !== headSha) {
      git(['update-ref', tempRef, headSha]);
      createdTempRef = !existingRefSha;
    }

    git(['bundle', 'create', tempBundlePath, tempRef, `^${baseSha}`]);
    const bundleBytes = readFileSync(tempBundlePath);
    const bundleByteCount = bundleBytes.length;
    const bundleSha256 = createHash('sha256').update(bundleBytes).digest('hex');
    const bundleBase64 = bundleBytes.toString('base64');

    // 8. Output filename
    let outFilename = opts.out;
    if (!outFilename) {
      const slug = branch.replace(/^[^/]+\//, '').replace(/[^a-zA-Z0-9._-]/g, '-');
      outFilename = `${slug || 'change'}.git-change.json`;
    }

    // 9. Draft PR intent (optional)
    let draftPr = null;
    if (opts.prBase || opts.prTitle || opts.prBody) {
      draftPr = {
        base: opts.prBase || 'main',
        title: opts.prTitle || commitSubject,
        body: opts.prBody || '',
        draft: true,
      };
    }

    // 10. Assemble canonical envelope
    const envelope = {
      schema: 'git-change/1',
      repository: repo,
      proposed_branch: branch,
      base: baseSha,
      source_head: headSha,
      expected_tree: expectedTree,
      commit: {
        subject: commitSubject,
        message: commitMessage,
      },
      changed_files: changedFiles,
      ...(draftPr ? { draft_pr: draftPr } : {}),
      payload: {
        format: 'git-bundle',
        encoding: 'base64',
        byte_count: bundleByteCount,
        sha256: bundleSha256,
        data: bundleBase64,
      },
    };

    const envelopeJson = JSON.stringify(envelope, null, 2);
    writeFileSync(outFilename, envelopeJson, 'utf8');
    const envelopeStat = statSync(outFilename);

    console.log(`\nCreated Git change package:`);
    console.log(`  File:            ${outFilename} (${envelopeStat.size.toLocaleString()} bytes)`);
    console.log(`  Repository:      ${repo}`);
    console.log(`  Proposed Branch: ${branch}`);
    console.log(`  Base Commit:     ${baseSha.slice(0, 7)}`);
    console.log(`  Source Head:     ${headSha.slice(0, 7)}`);
    console.log(`  Expected Tree:   ${expectedTree.slice(0, 7)}`);
    console.log(`  Bundle Size:     ${bundleByteCount.toLocaleString()} bytes (SHA-256: ${bundleSha256.slice(0, 16)}...)`);
    console.log(`  Changed Files:   ${changedFiles.length}`);

    // 11. Encode into Web Tools Stage #gz= format
    // Stage encodes: [{ name: outFilename, text: envelopeJson }] -> gzip -> base64url
    const localItems = [{ name: path.basename(outFilename), text: envelopeJson }];
    const gzipped = await gzipString(JSON.stringify(localItems));
    const gzPayload = b64url(gzipped);

    console.log(`\nStage Link Assessment:`);
    console.log(`  Encoded Fragment Length: ${gzPayload.length.toLocaleString()} characters (budget: ${GZ_MAX.toLocaleString()})`);

    // Keep the query: `?use=<sha>` is how a link reaches a branch's lib before merge.
    const appUrl = new URL(opts.appUrl);
    appUrl.hash = '';
    if (!appUrl.pathname.endsWith('/') && !/\.html?$/.test(appUrl.pathname)) appUrl.pathname += '/';
    const cleanAppBase = appUrl.href;

    if (gzPayload.length <= GZ_MAX) {
      const link = `${cleanAppBase}#gz=${gzPayload}`;
      console.log(`  Status: Fits within fragment budget!`);
      console.log(`\nWeb Tools Stage Link:\n${link}\n`);
    } else {
      console.log(`  Status: EXCEEDS fragment budget (${(gzPayload.length - GZ_MAX).toLocaleString()} characters over limit).`);
      console.log(`  The link cannot carry this package directly.`);
      console.log(`  Use the durable artifact instead: drop or upload '${outFilename}' into Web Tools Stage.\n`);
    }

  } finally {
    if (createdTempRef) {
      try { git(['update-ref', '-d', tempRef]); } catch {}
    }
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
