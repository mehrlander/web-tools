// kits/git-change.js — pure browser-capable Git bundle & packfile unpacker,
// delta patch resolver, and git-change/1 envelope validator.
//
// Adheres to the repo's code layer rules (docs/code-layers.md):
//   - Lives in lib/kits/
//   - Registers window.GitChange
//   - Uses dynamic lazy import for pako
//   - Self-contained, pure, and testable in both browser and Node realms
//
// Capabilities:
//   - Verify git-change/1 envelopes (SHA-256 integrity, size bounds, schema)
//   - Parse Git bundle v2/v3 headers (prerequisites and references)
//   - Parse standard Git packfiles (PACK v2/v3, object streams)
//   - Inflate object zlib streams and capture exact stream consumption boundaries
//   - Apply Git copy/insert deltas (OBJ_OFS_DELTA and OBJ_REF_DELTA)
//   - Fetch remote base blobs asynchronously when deltas reference base commits
//   - Hash Git objects according to the Git object format (<type> <size>\0<data>)
//   - Reconstruct head commits, trees, and changed files

(() => {
  const SCHEMA = 'git-change/1';
  const MAX_PAYLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
  const MAX_OBJECTS = 10000;
  const MAX_EXPANDED_BYTES = 100 * 1024 * 1024; // 100 MB

  const OBJ_COMMIT = 1;
  const OBJ_TREE = 2;
  const OBJ_BLOB = 3;
  const OBJ_TAG = 4;
  const OBJ_OFS_DELTA = 6;
  const OBJ_REF_DELTA = 7;

  const TYPE_NAMES = {
    [OBJ_COMMIT]: 'commit',
    [OBJ_TREE]: 'tree',
    [OBJ_BLOB]: 'blob',
    [OBJ_TAG]: 'tag',
  };

  let pakoMod;
  const loadPako = async () => {
    if (pakoMod) return pakoMod;
    if (typeof window !== 'undefined' && window.pako) return (pakoMod = window.pako);
    if (typeof globalThis !== 'undefined' && globalThis.pako) return (pakoMod = globalThis.pako);
    if (typeof window !== 'undefined' && window.__testImport) {
      try {
        const mod = await window.__testImport('https://cdn.jsdelivr.net/npm/pako@2.1.0/+esm');
        return (pakoMod = mod?.default ?? mod);
      } catch {}
    }
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/pako@2.1.0/+esm');
      return (pakoMod = mod?.default ?? mod);
    } catch {
      const mod = await import('pako');
      return (pakoMod = mod?.default ?? mod);
    }
  };

  // ── Encoding & Hashing Helpers ──────────────────────────────────────────

  const toHex = (bytes) => {
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      out += bytes[i].toString(16).padStart(2, '0');
    }
    return out;
  };

  const fromHex = (hex) => {
    const clean = hex.trim();
    if (clean.length % 2 !== 0) throw new Error('Invalid hex string length');
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
    }
    return bytes;
  };

  const fromBase64 = (b64) => {
    const clean = String(b64 || '').replace(/[\s\r\n]/g, '');
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  const toBase64 = (bytes) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(bin);
  };

  const getSubtleCrypto = () => {
    if (typeof window !== 'undefined' && window.crypto?.subtle) return window.crypto.subtle;
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) return globalThis.crypto.subtle;
    if (typeof crypto !== 'undefined' && crypto.subtle) return crypto.subtle;
    throw new Error('Web Crypto API (crypto.subtle) is required for hash operations');
  };

  const sha256Hex = async (bytes) => {
    const subtle = getSubtleCrypto();
    const digest = await subtle.digest('SHA-256', bytes);
    return toHex(new Uint8Array(digest));
  };

  const sha1Hex = async (bytes) => {
    const subtle = getSubtleCrypto();
    const digest = await subtle.digest('SHA-1', bytes);
    return toHex(new Uint8Array(digest));
  };

  // Computes Git object SHA-1: "<type> <size>\0<data>"
  const hashGitObject = async (type, data) => {
    const headerStr = `${type} ${data.length}\0`;
    const headerBytes = new TextEncoder().encode(headerStr);
    const combined = new Uint8Array(headerBytes.length + data.length);
    combined.set(headerBytes, 0);
    combined.set(data, headerBytes.length);
    return sha1Hex(combined);
  };

  // ── Envelope Verification ────────────────────────────────────────────────

  const verifyEnvelope = async (envelopeInput) => {
    let envelope;
    if (typeof envelopeInput === 'string') {
      try {
        envelope = JSON.parse(envelopeInput);
      } catch (e) {
        throw new Error('Malformed envelope: not valid JSON (' + e.message + ')');
      }
    } else if (envelopeInput && typeof envelopeInput === 'object') {
      envelope = envelopeInput;
    } else {
      throw new Error('Malformed envelope: expected JSON string or object');
    }

    if (envelope.schema !== SCHEMA) {
      throw new Error(`Unsupported schema: ${envelope.schema || 'missing'} (expected ${SCHEMA})`);
    }

    const requiredFields = ['repository', 'proposed_branch', 'base', 'source_head', 'expected_tree', 'payload'];
    for (const f of requiredFields) {
      if (!envelope[f]) throw new Error(`Envelope missing required field: ${f}`);
    }

    const { payload } = envelope;
    if (payload.format !== 'git-bundle') {
      throw new Error(`Unsupported payload format: ${payload.format} (expected git-bundle)`);
    }
    if (payload.encoding !== 'base64') {
      throw new Error(`Unsupported payload encoding: ${payload.encoding} (expected base64)`);
    }
    if (!payload.data || typeof payload.data !== 'string') {
      throw new Error('Envelope payload contains no data string');
    }

    const bundleBytes = fromBase64(payload.data);
    if (typeof payload.byte_count === 'number' && bundleBytes.length !== payload.byte_count) {
      throw new Error(`Payload byte count mismatch: declared ${payload.byte_count}, decoded ${bundleBytes.length}`);
    }

    if (bundleBytes.length > MAX_PAYLOAD_BYTES) {
      throw new Error(`Payload exceeds maximum allowed size (${bundleBytes.length} > ${MAX_PAYLOAD_BYTES} bytes)`);
    }

    if (payload.sha256) {
      const actualSha256 = await sha256Hex(bundleBytes);
      if (actualSha256.toLowerCase() !== payload.sha256.toLowerCase()) {
        throw new Error(`Payload SHA-256 checksum mismatch: declared ${payload.sha256}, calculated ${actualSha256}`);
      }
    }

    return { valid: true, envelope, bundleBytes };
  };

  // ── Git Bundle Header Parser ─────────────────────────────────────────────

  const parseBundleHeader = (bundleBytes) => {
    let headerText = '';
    let packOffset = -1;

    // The header is ASCII text ending with an empty line before the PACK signature
    for (let i = 0; i < Math.min(bundleBytes.length, 65536); i++) {
      if (bundleBytes[i] === 0x50 && // 'P'
          bundleBytes[i + 1] === 0x41 && // 'A'
          bundleBytes[i + 2] === 0x43 && // 'C'
          bundleBytes[i + 3] === 0x4b) {  // 'K'
        packOffset = i;
        headerText = new TextDecoder('ascii').decode(bundleBytes.subarray(0, i));
        break;
      }
    }

    if (packOffset === -1) {
      throw new Error('Malformed Git bundle: PACK signature not found in bundle');
    }

    const lines = headerText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length || (!lines[0].startsWith('# v2 git bundle') && !lines[0].startsWith('# v3 git bundle'))) {
      throw new Error(`Malformed Git bundle header: invalid header signature "${lines[0] || ''}"`);
    }

    const version = lines[0].startsWith('# v3') ? 3 : 2;
    const prerequisites = [];
    const references = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('-')) {
        // Prerequisite: "-<sha> <comment>"
        const parts = line.slice(1).trim().split(/\s+/);
        prerequisites.push(parts[0]);
      } else {
        // Reference: "<sha> <refname>"
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          references.push({ sha: parts[0], ref: parts[1] });
        }
      }
    }

    return { version, prerequisites, references, packOffset };
  };

  // ── Git Delta Patch Interpreter ──────────────────────────────────────────

  const applyDelta = (baseData, deltaData) => {
    let dPos = 0;
    const dLen = deltaData.length;

    // 1. Read base object size (variable-length LEB128)
    let baseSize = 0;
    let shift = 0;
    let b;
    do {
      if (dPos >= dLen) throw new Error('Truncated delta header: base size');
      b = deltaData[dPos++];
      baseSize |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);

    if (baseSize !== baseData.length) {
      throw new Error(`Delta base size mismatch: base is ${baseData.length} bytes, delta expects ${baseSize} bytes`);
    }

    // 2. Read target object size (variable-length LEB128)
    let targetSize = 0;
    shift = 0;
    do {
      if (dPos >= dLen) throw new Error('Truncated delta header: target size');
      b = deltaData[dPos++];
      targetSize |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);

    if (targetSize > MAX_EXPANDED_BYTES) {
      throw new Error(`Delta target size exceeds safety limit: ${targetSize} bytes`);
    }

    const target = new Uint8Array(targetSize);
    let tPos = 0;

    // 3. Process delta opcodes
    while (dPos < dLen) {
      const op = deltaData[dPos++];
      if (op & 0x80) {
        // Copy opcode
        let cpOff = 0;
        let cpSize = 0;
        if (op & 0x01) cpOff |= deltaData[dPos++];
        if (op & 0x02) cpOff |= deltaData[dPos++] << 8;
        if (op & 0x04) cpOff |= deltaData[dPos++] << 16;
        if (op & 0x08) cpOff |= (deltaData[dPos++] << 24) >>> 0;

        if (op & 0x10) cpSize |= deltaData[dPos++];
        if (op & 0x20) cpSize |= deltaData[dPos++] << 8;
        if (op & 0x40) cpSize |= deltaData[dPos++] << 16;
        if (cpSize === 0) cpSize = 0x10000;

        if (cpOff + cpSize > baseData.length) {
          throw new Error(`Delta copy out of base bounds: offset ${cpOff} + size ${cpSize} > ${baseData.length}`);
        }
        if (tPos + cpSize > targetSize) {
          throw new Error(`Delta copy exceeds target size: pos ${tPos} + size ${cpSize} > ${targetSize}`);
        }

        target.set(baseData.subarray(cpOff, cpOff + cpSize), tPos);
        tPos += cpSize;
      } else if (op > 0) {
        // Insert literal bytes opcode
        if (dPos + op > dLen) {
          throw new Error('Delta insert opcode extends past end of delta stream');
        }
        if (tPos + op > targetSize) {
          throw new Error(`Delta insert exceeds target size: pos ${tPos} + op ${op} > ${targetSize}`);
        }

        target.set(deltaData.subarray(dPos, dPos + op), tPos);
        dPos += op;
        tPos += op;
      } else {
        throw new Error('Invalid delta opcode: 0');
      }
    }

    if (tPos !== targetSize) {
      throw new Error(`Delta application produced ${tPos} bytes, expected ${targetSize}`);
    }

    return target;
  };

  // ── Packfile Decompression & Object Reconstruction ────────────────────────

  const unpackPackfile = async (packBytes, { fetchBaseBlob, onProgress } = {}) => {
    if (packBytes.length < 32) {
      throw new Error('Truncated packfile: shorter than minimum header + trailer size');
    }

    // Verify PACK magic
    if (packBytes[0] !== 0x50 || packBytes[1] !== 0x41 ||
        packBytes[2] !== 0x43 || packBytes[3] !== 0x4b) {
      throw new Error('Invalid packfile header: missing PACK magic bytes');
    }

    const view = new DataView(packBytes.buffer, packBytes.byteOffset, packBytes.byteLength);
    const version = view.getUint32(4, false);
    if (version !== 2 && version !== 3) {
      throw new Error(`Unsupported packfile version: ${version} (expected 2 or 3)`);
    }

    const numObjects = view.getUint32(8, false);
    if (numObjects > MAX_OBJECTS) {
      throw new Error(`Packfile object count ${numObjects} exceeds safety limit ${MAX_OBJECTS}`);
    }

    const pako = await loadPako();
    let offset = 12;

    const rawObjects = [];
    const resolvedObjects = new Map(); // sha -> { type, data, sha }
    const offsetToObject = new Map();  // packOffset -> { type, data, sha }

    // First pass: parse headers and inflate each object stream
    for (let i = 0; i < numObjects; i++) {
      onProgress?.(i, numObjects, 'decompressing');
      const objStartOffset = offset;
      if (offset >= packBytes.length - 20) {
        throw new Error(`Packfile truncated at object ${i} of ${numObjects}`);
      }

      let b = packBytes[offset++];
      const typeNum = (b >> 4) & 0x07;
      let size = b & 0x0f;
      let shift = 4;
      while (b & 0x80) {
        if (offset >= packBytes.length - 20) throw new Error('Truncated object size header');
        b = packBytes[offset++];
        size |= (b & 0x7f) << shift;
        shift += 7;
      }

      let deltaBaseOffset = null;
      let deltaBaseSha = null;

      if (typeNum === OBJ_OFS_DELTA) {
        let c = packBytes[offset++];
        deltaBaseOffset = c & 0x7f;
        while (c & 0x80) {
          if (offset >= packBytes.length - 20) throw new Error('Truncated OFS_DELTA offset');
          c = packBytes[offset++];
          deltaBaseOffset = ((deltaBaseOffset + 1) << 7) | (c & 0x7f);
        }
      } else if (typeNum === OBJ_REF_DELTA) {
        if (offset + 20 > packBytes.length - 20) throw new Error('Truncated REF_DELTA SHA');
        deltaBaseSha = toHex(packBytes.subarray(offset, offset + 20));
        offset += 20;
      }

      // Decompress object stream
      const inf = new pako.Inflate();
      inf.push(packBytes.subarray(offset), false);
      if (inf.error) {
        throw new Error(`Decompression failed for object ${i} at offset ${offset}: ${inf.error}`);
      }

      const decompressedData = inf.result;
      const bytesConsumed = inf.strm.next_in;
      if (!bytesConsumed) {
        throw new Error(`Decompressor consumed 0 bytes at object ${i}`);
      }
      offset += bytesConsumed;

      if (decompressedData.length !== size) {
        throw new Error(`Object ${i} decompressed size ${decompressedData.length} != header size ${size}`);
      }

      const rawEntry = {
        index: i,
        objStartOffset,
        typeNum,
        size,
        deltaBaseOffset,
        deltaBaseSha,
        data: decompressedData,
      };

      rawObjects.push(rawEntry);

      // Non-delta objects are resolved immediately
      if (typeNum in TYPE_NAMES) {
        const typeName = TYPE_NAMES[typeNum];
        const sha = await hashGitObject(typeName, decompressedData);
        const resolved = { type: typeName, data: decompressedData, sha };
        resolvedObjects.set(sha, resolved);
        offsetToObject.set(objStartOffset, resolved);
      }
    }

    // Verify trailing 20-byte pack checksum
    if (offset + 20 > packBytes.length) {
      throw new Error('Packfile missing 20-byte trailer checksum');
    }
    const packChecksum = toHex(packBytes.subarray(offset, offset + 20));

    // Second pass: resolve deltas
    let unresolvedDeltas = rawObjects.filter(o => o.typeNum === OBJ_OFS_DELTA || o.typeNum === OBJ_REF_DELTA);
    let passCount = 0;

    while (unresolvedDeltas.length > 0) {
      passCount++;
      const nextRemaining = [];
      let resolvedInThisPass = 0;

      for (const d of unresolvedDeltas) {
        let baseObj = null;

        if (d.typeNum === OBJ_OFS_DELTA) {
          const targetOffset = d.objStartOffset - d.deltaBaseOffset;
          baseObj = offsetToObject.get(targetOffset);
        } else if (d.typeNum === OBJ_REF_DELTA) {
          baseObj = resolvedObjects.get(d.deltaBaseSha);
          if (!baseObj && fetchBaseBlob) {
            // Fetch missing base object asynchronously from GitHub
            const fetched = await fetchBaseBlob(d.deltaBaseSha);
            if (fetched) {
              const baseBytes = fetched instanceof Uint8Array ? fetched : (fetched.data || fromBase64(fetched.content));
              const baseType = fetched.type || 'blob';
              baseObj = { type: baseType, data: baseBytes, sha: d.deltaBaseSha };
              resolvedObjects.set(d.deltaBaseSha, baseObj);
            }
          }
        }

        if (baseObj) {
          const resultData = applyDelta(baseObj.data, d.data);
          const resultSha = await hashGitObject(baseObj.type, resultData);
          const resolved = { type: baseObj.type, data: resultData, sha: resultSha };
          resolvedObjects.set(resultSha, resolved);
          offsetToObject.set(d.objStartOffset, resolved);
          resolvedInThisPass++;
        } else {
          nextRemaining.push(d);
        }
      }

      if (resolvedInThisPass === 0 && nextRemaining.length > 0) {
        const missing = nextRemaining.map(d =>
          d.typeNum === OBJ_REF_DELTA ? `REF_DELTA(${d.deltaBaseSha})` : `OFS_DELTA(-${d.deltaBaseOffset})`
        ).join(', ');
        throw new Error(`Unresolvable Git deltas in packfile (missing base objects: ${missing})`);
      }

      unresolvedDeltas = nextRemaining;
      if (passCount > 100) throw new Error('Delta resolution cycle or recursion depth exceeded');
    }

    return {
      objects: resolvedObjects,
      packChecksum,
      totalCount: numObjects,
    };
  };

  // ── Git Object Parsers ───────────────────────────────────────────────────

  const parseCommit = (commitData) => {
    const text = new TextDecoder('utf-8').decode(commitData);
    const headerEnd = text.indexOf('\n\n');
    const headerPart = headerEnd >= 0 ? text.slice(0, headerEnd) : text;
    const body = headerEnd >= 0 ? text.slice(headerEnd + 2) : '';

    let treeSha = '';
    const parents = [];
    let author = '';
    let committer = '';

    for (const line of headerPart.split('\n')) {
      if (line.startsWith('tree ')) treeSha = line.slice(5).trim();
      else if (line.startsWith('parent ')) parents.push(line.slice(7).trim());
      else if (line.startsWith('author ')) author = line.slice(7).trim();
      else if (line.startsWith('committer ')) committer = line.slice(10).trim();
    }

    const lines = body.split('\n');
    const subject = lines[0] || '';

    return { treeSha, parents, author, committer, message: body, subject };
  };

  const parseTree = (treeData) => {
    const entries = [];
    let pos = 0;
    const len = treeData.length;

    while (pos < len) {
      const spaceIdx = treeData.indexOf(0x20, pos);
      if (spaceIdx === -1) throw new Error('Malformed tree entry: missing space after mode');
      const nullIdx = treeData.indexOf(0x00, spaceIdx);
      if (nullIdx === -1) throw new Error('Malformed tree entry: missing null byte after name');

      const mode = new TextDecoder('ascii').decode(treeData.subarray(pos, spaceIdx));
      const name = new TextDecoder('utf-8').decode(treeData.subarray(spaceIdx + 1, nullIdx));

      // Guard against path traversal in tree entries
      if (name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
        throw new Error(`Illegal filename in tree entry: "${name}"`);
      }

      pos = nullIdx + 1;
      if (pos + 20 > len) throw new Error('Malformed tree entry: truncated 20-byte SHA');
      const sha = toHex(treeData.subarray(pos, pos + 20));
      pos += 20;

      const isTree = mode.startsWith('4') || mode === '040000';
      const isBlob = mode.startsWith('10') || mode === '100644' || mode === '100755';
      const isSubmodule = mode === '160000';
      const isSymlink = mode === '120000';

      entries.push({ mode: mode.padStart(6, '0'), name, sha, isTree, isBlob, isSubmodule, isSymlink });
    }

    return entries;
  };

  // Recursively traverses tree objects present in the resolved objects map
  const collectTreePaths = (objects, treeSha, currentDir = '', out = new Map()) => {
    const treeObj = objects.get(treeSha);
    if (!treeObj || treeObj.type !== 'tree') return out;

    const entries = parseTree(treeObj.data);
    for (const ent of entries) {
      const fullPath = currentDir ? `${currentDir}/${ent.name}` : ent.name;
      if (ent.isTree) {
        collectTreePaths(objects, ent.sha, fullPath, out);
      } else {
        const blobObj = objects.get(ent.sha);
        out.set(fullPath, {
          path: fullPath,
          mode: ent.mode,
          sha: ent.sha,
          data: blobObj?.data || null,
        });
      }
    }
    return out;
  };

  // ── High-Level Validation & Inspection ────────────────────────────────────

  const inspectChange = async (envelopeInput, { fetchBaseBlob } = {}) => {
    const { envelope, bundleBytes } = await verifyEnvelope(envelopeInput);
    const header = parseBundleHeader(bundleBytes);

    // Verify prerequisites match base
    if (header.prerequisites.length && !header.prerequisites.includes(envelope.base)) {
      throw new Error(`Bundle prerequisite ${header.prerequisites.join(', ')} does not match base commit ${envelope.base}`);
    }

    // Verify references match source_head
    const matchingRef = header.references.find(r => r.sha === envelope.source_head);
    if (!matchingRef && header.references.length > 0) {
      throw new Error(`Bundle references do not contain source_head ${envelope.source_head}`);
    }

    const packBytes = bundleBytes.subarray(header.packOffset);
    const { objects } = await unpackPackfile(packBytes, { fetchBaseBlob });

    // Find and parse head commit
    const headCommitObj = objects.get(envelope.source_head);
    if (!headCommitObj || headCommitObj.type !== 'commit') {
      throw new Error(`Source head commit ${envelope.source_head} not found in unpacked bundle`);
    }

    const commitInfo = parseCommit(headCommitObj.data);

    // Verify head tree SHA matches expected_tree
    if (commitInfo.treeSha.toLowerCase() !== envelope.expected_tree.toLowerCase()) {
      throw new Error(`Tree SHA mismatch: commit tree is ${commitInfo.treeSha}, expected ${envelope.expected_tree}`);
    }

    // Collect reconstructed files
    const changedPathsMap = collectTreePaths(objects, commitInfo.treeSha);
    const changedFiles = Array.from(changedPathsMap.values()).map(f => ({
      path: f.path,
      mode: f.mode,
      sha: f.sha,
      size: f.data ? f.data.length : null,
    }));

    return {
      valid: true,
      envelope,
      commit: commitInfo,
      headTreeSha: commitInfo.treeSha,
      changedFiles,
      objects,
    };
  };

  // ── Registration ─────────────────────────────────────────────────────────

  const exported = {
    SCHEMA,
    toHex,
    fromHex,
    toBase64,
    fromBase64,
    sha1Hex,
    sha256Hex,
    hashGitObject,
    verifyEnvelope,
    parseBundleHeader,
    applyDelta,
    unpackPackfile,
    parseCommit,
    parseTree,
    collectTreePaths,
    inspectChange,
  };

  if (typeof window !== 'undefined') window.GitChange = exported;
  if (typeof globalThis !== 'undefined') globalThis.GitChange = exported;
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
})();
