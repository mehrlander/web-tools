// kits/text-proposals.js: browser projection of retained, attributed proposals.
//
// The private text project keeps its generated collection out of Git. This kit
// reconstructs the proposal portion from the committed sources named by
// projects/text/current-sources.json: phrase reviews, the document-audit
// packet, and (when present) the web-tools paragraph drafts inventory. It does
// not claim to expose the full text collection or to recommend applying an
// earlier edit in a new occurrence.
(() => {
  const SCHEMA = 'text-browser-proposals/v1';
  const SOURCE_SCHEMA = 'text-current-sources/v1';
  const PACKET_SCHEMA = 'review-packet/v1';
  const DEFAULT_SPEC = 'projects/text/current-sources.json';
  const AUTHOR_PHRASE = 'imported scare-quote run; original rater attribution not inferred';
  const AUTHOR_AUDIT = 'imported document-audit packet; original rater attribution not inferred';
  const LANE_PHRASE = 'phrase-reviews';
  const LANE_AUDIT = 'audit-packet';
  const LANE_WEB_TOOLS = 'web-tools-paragraphs';
  const LANE_LOCAL = 'local-proposals';
  const ACTION_HALF_LENGTH = 'half-length';
  const SCOPE_WARNING = 'Imported proposals are source-occurrence work, not automatic recommendations for this selection.';
  const loads = new Map();
  const authScopes = new Map();
  let nextAuthScope = 1;

  // The projection can contain private source text. Share work for the same
  // credential without putting that credential in a cache key, and never let
  // two explicit GH clients for different accounts receive one shared index.
  const authorizationOf = (gh) => {
    const headers = gh?.headers || {};
    if (typeof headers.get === 'function') return headers.get('authorization') || '';
    return headers.Authorization || headers.authorization || '';
  };
  const authScope = (authorization) => {
    if (!authorization) return 'anon';
    if (!authScopes.has(authorization)) authScopes.set(authorization, `auth-${nextAuthScope++}`);
    return authScopes.get(authorization);
  };

  // Python str.strip() follows Unicode White_Space and also treats four
  // information-separator controls as whitespace. JavaScript trim() includes
  // U+FEFF instead, so native trim would create different text identities at
  // those edges.
  const PY_EDGE = /^(?:\p{White_Space}|[\u001c-\u001f])+|(?:\p{White_Space}|[\u001c-\u001f])+$/gu;
  const edgeTrim = value => String(value ?? '').replace(PY_EDGE, '');

  const encoder = () => {
    const Encoder = window.TextEncoder || globalThis.TextEncoder;
    if (!Encoder) throw new Error('TextProposals requires TextEncoder');
    return new Encoder();
  };

  async function sha256(value) {
    const crypt = window.crypto?.subtle ? window.crypto : globalThis.crypto;
    if (!crypt?.subtle) throw new Error('TextProposals requires Web Crypto');
    const digest = await crypt.subtle.digest('SHA-256', encoder().encode(value));
    return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
  }

  // Python json.dumps(..., ensure_ascii=False, sort_keys=True) uses a space
  // after each comma and colon. Proposal IDs hash that exact representation.
  function pythonJson(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return '[' + value.map(pythonJson).join(', ') + ']';
    if (typeof value === 'object') {
      return '{' + Object.keys(value).sort()
        .map(key => `${JSON.stringify(key)}: ${pythonJson(value[key])}`)
        .join(', ') + '}';
    }
    const out = JSON.stringify(value);
    if (out === undefined) throw new Error('TextProposals cannot hash undefined');
    return out;
  }

  const blobUrl = (repo, ref, path) => {
    const encodedPath = String(path).split('/').map(encodeURIComponent).join('/');
    return `https://github.com/${repo}/blob/${encodeURIComponent(ref)}/${encodedPath}`;
  };

  const bytesOf = text => encoder().encode(String(text ?? '')).byteLength;

  function artifact(repo, ref, path, meta = {}, text = '') {
    const sha = String(meta.sha || '');
    if (!sha) throw new Error(`TextProposals source has no Git blob SHA: ${path}`);
    return {
      repo,
      ref,
      path,
      sha,
      size: Number.isFinite(meta.size) ? meta.size : bytesOf(text),
      // The contents API hands back a blob/<ref>/<path> address, which moves
      // when the branch does, while `sha` identifies the exact blob this row
      // was built from. A surface showing both was promising a permalink it
      // did not have, so `pinned` says plainly that it is not one. GitHub
      // resolves a blob SHA in a /blob/ URL only for a commit, so there is no
      // pinned address to offer without a second read.
      url: meta.url || blobUrl(repo, ref, path),
      pinned: false,
      source_id: `${path}@${sha}`,
    };
  }

  function bodyOf(files, role, path) {
    const value = files?.[role] ?? files?.[path];
    if (typeof value === 'string') return value;
    if (value && typeof value.text === 'string') return value.text;
    throw new Error(`TextProposals is missing ${role}: ${path}`);
  }

  function metaOf(files, metadata, role, path) {
    const value = metadata?.[role] ?? metadata?.[path]
      ?? (files?.[role] && typeof files[role] === 'object' ? files[role] : null)
      ?? (files?.[path] && typeof files[path] === 'object' ? files[path] : null);
    return value || {};
  }

  function requireCsv() {
    if (!window.Csv?.rows || !window.Csv?.parseLine) {
      throw new Error('TextProposals requires kits/csv.js');
    }
    return window.Csv;
  }

  function csvRows(text, required) {
    const Csv = requireCsv();
    const first = String(text || '').split(/\r?\n/).find(line => line.trim()) || '';
    const headers = new Set(Csv.parseLine(first).map(value => value.trim()));
    const missing = required.filter(name => !headers.has(name));
    if (missing.length) throw new Error(`Phrase reviews are missing columns: ${missing.join(', ')}`);
    return Csv.rows(text);
  }

  function parsePassages(markdown) {
    const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
    const contexts = {};
    const heading = /^###\s+([AB]\d+)\s+\((\d{4}-\d{2}-\d{2})\s+([^)]+)\)\s*$/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(heading);
      if (!match) continue;
      const section = match[1];
      if (contexts[section]) throw new Error(`Duplicate phrase context section: ${section}`);
      let end = i + 1;
      while (end < lines.length && !/^#{2,3}\s+/.test(lines[end])) end++;
      contexts[section] = {
        section,
        date: match[2],
        session_id_prefix: match[3].trim(),
        markdown: lines.slice(i + 1, end).join('\n').trim(),
      };
      i = end - 1;
    }
    return contexts;
  }

  function parseJson(text, label) {
    try { return JSON.parse(text); }
    catch (error) { throw new Error(`${label} is not valid JSON: ${error.message || error}`); }
  }

  function parseJsonl(text, label) {
    const rows = [];
    const lines = String(text || '').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      try { rows.push(JSON.parse(line)); }
      catch (error) {
        throw new Error(`${label} line ${i + 1} is not valid JSON: ${error.message || error}`);
      }
    }
    return rows;
  }

  // Inventory / drafts payloads are committed gzip. gh.get UTF-8-decodes bytes
  // and would corrupt them; callers pass the undecoded bytes from gh.bytes.
  async function gunzipUtf8(bytes, label) {
    const Decomp = window.DecompressionStream || globalThis.DecompressionStream;
    if (!Decomp) throw new Error(`TextProposals requires DecompressionStream for ${label}`);
    const stream = new Blob([bytes]).stream().pipeThrough(new Decomp('gzip'));
    const buffer = await new Response(stream).arrayBuffer();
    return new TextDecoder().decode(buffer);
  }

  function webToolsPayloadPath(spec) {
    const wt = spec?.web_tools_paragraphs;
    if (!wt || typeof wt !== 'object' || Array.isArray(wt)) return null;
    if (typeof wt.drafts_inventory === 'string' && wt.drafts_inventory) return wt.drafts_inventory;
    if (typeof wt.inventory === 'string' && wt.inventory) return wt.inventory;
    return null;
  }

  function validatePhraseRows(rows, contexts) {
    const seen = new Set();
    const verdicts = new Set(['leave', 'qualify', 'rephrase']);
    for (const row of rows) {
      const para = edgeTrim(row.para);
      const phrase = edgeTrim(row.phrase);
      if (!para || !phrase) throw new Error('Every phrase review must name para and phrase');
      const key = `${para}\u0000${phrase}`;
      if (seen.has(key)) throw new Error(`Duplicate phrase review occurrence: ${para} / ${phrase}`);
      seen.add(key);
      if (!contexts[para]) throw new Error(`Phrase review context does not exist: ${para}`);
      if (!verdicts.has(row.verdict)) throw new Error(`Unsupported phrase verdict: ${row.verdict}`);
      const hasFix = !!edgeTrim(row.cheapest_fix);
      if (hasFix !== (row.verdict !== 'leave')) {
        throw new Error(`Phrase verdict and fix disagree: ${para} / ${phrase}`);
      }
      if (!/^\d+$/.test(row.fix_words)) {
        throw new Error(`Phrase fix_words is not a nonnegative integer: ${para} / ${phrase}`);
      }
    }
  }

  function validatePacket(packet) {
    if (packet?.schema !== PACKET_SCHEMA) {
      throw new Error(`Unsupported review packet schema: ${packet?.schema || '(missing)'}`);
    }
    if (!Array.isArray(packet.regions)) throw new Error('Review packet regions must be an array');
    if (!packet.patient || typeof packet.patient !== 'object' || Array.isArray(packet.patient)) {
      throw new Error('Review packet patient must be an object');
    }
    for (const field of ['repo', 'path', 'commit']) {
      if (typeof packet.patient[field] !== 'string') {
        throw new Error(`Review packet patient ${field} must be a string`);
      }
    }
    const seen = new Set();
    for (const region of packet.regions) {
      if (!region?.id) throw new Error('Every review packet region must have an id');
      if (seen.has(region.id)) throw new Error(`Duplicate review packet region: ${region.id}`);
      seen.add(region.id);
      if (region.kind !== 'edit') continue;
      for (const field of ['original_text', 'proposed_text', 'decision', 'original_text_status']) {
        if (typeof region[field] !== 'string') {
          throw new Error(`Review packet edit ${region.id} ${field} must be a string`);
        }
      }
      if (region.evidence !== undefined && !Array.isArray(region.evidence)) {
        throw new Error(`Review packet edit ${region.id} evidence must be an array`);
      }
      if (region.relocation !== undefined && region.relocation !== null
          && (typeof region.relocation !== 'object' || Array.isArray(region.relocation))) {
        throw new Error(`Review packet edit ${region.id} relocation must be an object or null`);
      }
    }
  }

  async function build({ spec, files, metadata = {}, repo = '', ref = 'main', specPath = DEFAULT_SPEC }) {
    if (typeof spec === 'string') spec = parseJson(spec, specPath);
    if (spec?.schema !== SOURCE_SCHEMA) {
      throw new Error(`Unsupported text source schema: ${spec?.schema || '(missing)'}`);
    }
    for (const field of ['phrase_reviews', 'phrase_context', 'audit_packet']) {
      if (!spec[field] || typeof spec[field] !== 'string') {
        throw new Error(`Text source specification is missing ${field}`);
      }
    }

    const phraseText = bodyOf(files, 'phrase_reviews', spec.phrase_reviews);
    const contextText = bodyOf(files, 'phrase_context', spec.phrase_context);
    const packetText = bodyOf(files, 'audit_packet', spec.audit_packet);
    const phraseSource = artifact(repo, ref, spec.phrase_reviews,
      metaOf(files, metadata, 'phrase_reviews', spec.phrase_reviews), phraseText);
    const contextSource = artifact(repo, ref, spec.phrase_context,
      metaOf(files, metadata, 'phrase_context', spec.phrase_context), contextText);
    const packetSource = artifact(repo, ref, spec.audit_packet,
      metaOf(files, metadata, 'audit_packet', spec.audit_packet), packetText);
    const specSource = artifact(repo, ref, specPath, metadata.spec || {}, JSON.stringify(spec));

    const contexts = parsePassages(contextText);
    const phraseRows = csvRows(phraseText, [
      'para', 'phrase', 'ordinary_reading', 'closed_in_situ',
      'cheapest_fix', 'fix_words', 'verdict',
    ]);
    validatePhraseRows(phraseRows, contexts);
    const packet = parseJson(packetText, spec.audit_packet);
    validatePacket(packet);

    const texts = {};
    const textIds = new Map();
    const proposals = [];
    const proposalById = new Map();
    const origins = [];
    const originsByProposal = {};
    const laneByProposal = {};
    const analysisByProposal = {};

    async function addText(value) {
      const text = edgeTrim(value);
      if (!text) return null;
      if (textIds.has(text)) return textIds.get(text);
      const id = await sha256(text);
      if (texts[id] !== undefined && texts[id] !== text) {
        throw new Error(`Text identity collision: ${id}`);
      }
      texts[id] = text;
      textIds.set(text, id);
      return id;
    }

    async function addProposal(source, replacement, author, purpose, lane) {
      const from = await addText(source);
      const to = await addText(replacement);
      if (!from || !to || from === to) return null;
      const fields = { from, to, author, purpose };
      const id = await sha256(pythonJson(fields));
      let proposal = proposalById.get(id);
      if (!proposal) {
        proposal = { id, ...fields };
        proposalById.set(id, proposal);
        proposals.push(proposal);
        laneByProposal[id] = lane;
        originsByProposal[id] = [];
      }
      return proposal;
    }

    function addOrigin(proposal, origin) {
      origins.push(origin);
      originsByProposal[proposal.id].push(origin);
    }

    for (let i = 0; i < phraseRows.length; i++) {
      const row = phraseRows[i];
      const phrase = edgeTrim(row.phrase);
      const fix = edgeTrim(row.cheapest_fix);
      if (!fix || phrase === fix) continue;
      const proposal = await addProposal(
        phrase,
        fix,
        AUTHOR_PHRASE,
        `Imported ${row.verdict} recommendation`,
        LANE_PHRASE,
      );
      if (!proposal) continue;
      const origin = {
        proposal_id: proposal.id,
        source_id: phraseSource.source_id,
        record: i + 1,
        scope: 'source-occurrence',
        context: { source_id: contextSource.source_id, section: row.para },
        original_verdict: row.verdict,
      };
      addOrigin(proposal, origin);
      analysisByProposal[proposal.id] ||= {
        ordinary_reading: row.ordinary_reading,
        closed_in_situ: row.closed_in_situ,
        fix_words: Number(row.fix_words),
      };
    }

    for (const region of packet.regions) {
      if (region.kind !== 'edit') continue;
      const original = edgeTrim(region.original_text);
      const proposed = edgeTrim(region.proposed_text);
      if (!original || !proposed || original === proposed) continue;
      const proposal = await addProposal(
        original,
        proposed,
        AUTHOR_AUDIT,
        region.decision,
        LANE_AUDIT,
      );
      if (!proposal) continue;
      addOrigin(proposal, {
        proposal_id: proposal.id,
        source_id: packetSource.source_id,
        record: region.id,
        scope: 'source-occurrence',
        patient: packet.patient || null,
        operation: region.decision,
        original_status: region.original_text_status,
        original_note: region.original_text_note ?? null,
        decision: region.decision,
        rationale: region.rationale ?? null,
        relocation: region.relocation ?? null,
        evidence: Array.isArray(region.evidence) ? region.evidence : [],
      });
    }

    let webToolsSource = null;
    const webToolsSpec = spec.web_tools_paragraphs;
    const webToolsText = files?.web_tools_paragraphs;
    if (webToolsSpec && webToolsText !== undefined && webToolsText !== null) {
      if (typeof webToolsSpec !== 'object' || Array.isArray(webToolsSpec)) {
        throw new Error('web_tools_paragraphs source specification must be an object');
      }
      const payloadPath = webToolsPayloadPath(spec);
      if (!payloadPath) throw new Error('web_tools_paragraphs is missing drafts_inventory or inventory');
      webToolsSource = artifact(repo, ref, payloadPath,
        metaOf(files, metadata, 'web_tools_paragraphs', payloadPath), webToolsText);
      const author = typeof webToolsSpec.agent === 'string' && webToolsSpec.agent
        ? webToolsSpec.agent : 'Chief of Staff (Grok)';
      const purpose = typeof webToolsSpec.purpose === 'string' && webToolsSpec.purpose
        ? webToolsSpec.purpose
        : 'Half-length rewrite (targetRatio 0.5); retention is not endorsement';
      const signedAt = webToolsSpec.signedAt ?? null;
      const targetRatio = webToolsSpec.targetRatio ?? null;
      const scannedRepo = typeof webToolsSpec.scanned_repo === 'string'
        ? webToolsSpec.scanned_repo : '';
      const scannedCommit = typeof webToolsSpec.scanned_commit === 'string'
        && /^[0-9a-f]{40}$/.test(webToolsSpec.scanned_commit)
        ? webToolsSpec.scanned_commit : '';
      if (webToolsSpec.scanned_commit && !scannedCommit) {
        throw new Error(
          'web_tools_paragraphs.scanned_commit must be a full 40-char hex SHA '
          + `(got ${JSON.stringify(webToolsSpec.scanned_commit)})`);
      }
      const scanMethod = typeof webToolsSpec.scan_method === 'string'
        ? webToolsSpec.scan_method : '';
      const rows = parseJsonl(webToolsText, payloadPath);
      let draftRows = 0;
      for (const row of rows) {
        const draft = row?.draft;
        if (draft === undefined || draft === null || draft === '') continue;
        draftRows += 1;
        const original = edgeTrim(row.original);
        const proposed = edgeTrim(draft);
        if (!original) {
          throw new Error(`web-tools paragraph row is missing original text: ${row.id || '(unknown)'}`);
        }
        if (!proposed || original === proposed) continue;
        const proposal = await addProposal(original, proposed, author, purpose, LANE_WEB_TOOLS);
        if (!proposal) continue;
        const paragraph = row.index ?? row.paragraph ?? null;
        const document = {
          repo: scannedRepo,
          commit: scannedCommit,
          path: row.path || '',
          paragraph,
          start_line: row.startLine ?? row.start_line ?? null,
          end_line: row.endLine ?? row.end_line ?? null,
          kind: row.kind ?? null,
          priority: row.priority ?? null,
          import_id: row.id || null,
          scan_method: scanMethod,
        };
        addOrigin(proposal, {
          proposal_id: proposal.id,
          source_id: webToolsSource.source_id,
          record: row.id || `${document.path}:p${paragraph}`,
          scope: 'source-occurrence',
          agent: author,
          signedAt,
          targetRatio,
          document,
          ratio: row.ratio ?? null,
          draftWords: row.draftWords ?? row.draft_words ?? null,
          words: row.words ?? null,
        });
        analysisByProposal[proposal.id] ||= {
          target_ratio: targetRatio,
          ratio: row.ratio ?? null,
          words: row.words ?? null,
          draft_words: row.draftWords ?? row.draft_words ?? null,
        };
      }
      if (typeof webToolsSpec.drafts === 'number' && webToolsSpec.drafts !== draftRows) {
        throw new Error(
          `web_tools_paragraphs drafts count mismatch: expected ${webToolsSpec.drafts}, got ${draftRows}`);
      }
    }

    const localSources = [];
    if (spec.local_proposals !== undefined && !Array.isArray(spec.local_proposals)) {
      throw new Error('local_proposals must be an array of bundle paths');
    }
    for (const path of spec.local_proposals || []) {
      if (typeof path !== 'string' || !path) throw new Error('Invalid local proposal path');
      const text = bodyOf(files, path, path);
      const bundle = parseJson(text, path);
      if (bundle?.schema !== 'text-local-proposals/v1' || !Array.isArray(bundle.rows)) {
        throw new Error('Unsupported local proposal bundle');
      }
      const source = artifact(repo, ref, path, metaOf(files, metadata, path, path), text);
      localSources.push(source);
      const seen = new Set();
      for (const row of bundle.rows) {
        const { task, result, runtime } = row;
        if (!task?.id || task.id !== result?.task_id || task.original !== row.original
            || result.status !== 'proposal' || result.replacement !== row.replacement
            || pythonJson(runtime) !== pythonJson(bundle.runtime)
            || row.run_id !== bundle.run?.run_id || seen.has(task.id)) {
          throw new Error('Local proposal identity or provenance mismatch');
        }
        seen.add(task.id);
        const proposal = await addProposal(row.original, row.replacement, row.author, row.purpose, LANE_LOCAL);
        if (!proposal || proposal.id !== row.proposal_id || proposal.from !== row.from || proposal.to !== row.to) {
          throw new Error('Local proposal identity or provenance mismatch');
        }
        addOrigin(proposal, {
          proposal_id: proposal.id, source_id: source.source_id, record: task.id,
          scope: 'source-occurrence', document: task.document, agent: row.author,
          signedAt: result.finished_at, operation: task.objective,
          rationale: `Model note (unverified): ${result.note}`,
          original_status: 'saved source snapshot',
          original_note: `Run ${row.run_id}; file SHA-256 ${task.document.sha256}`,
          ratio: result.word_ratio,
          evidence: [
            { type: 'runtime', source: `${runtime.name} @ ${runtime.digest}`,
              quote: `Ollama ${runtime.ollama_version}; ${result.seconds}s; flags: ${(result.flags || []).join(', ') || 'none'}. Quality not assessed.` },
            { type: 'context', source: 'Saved preceding context', quote: task.context.before },
            { type: 'context', source: 'Saved following context', quote: task.context.after },
          ],
        });
        analysisByProposal[proposal.id] ||= {
          ratio: result.word_ratio, flags: result.flags, quality_assessed: false,
        };
      }
    }

    const sources = {
      [phraseSource.source_id]: phraseSource,
      [contextSource.source_id]: contextSource,
      [packetSource.source_id]: packetSource,
    };
    if (webToolsSource) sources[webToolsSource.source_id] = webToolsSource;
    for (const source of localSources) sources[source.source_id] = source;
    const index = {
      schema: SCHEMA,
      repo,
      ref,
      spec: specSource,
      sources,
      source_roles: {
        phrase_reviews: phraseSource.source_id,
        phrase_context: contextSource.source_id,
        audit_packet: packetSource.source_id,
        ...(webToolsSource ? { web_tools_paragraphs: webToolsSource.source_id } : {}),
      },
      texts,
      proposals,
      origins,
      contexts,
      summary: null,
      _origins_by_proposal: originsByProposal,
      _lane_by_proposal: laneByProposal,
      _analysis_by_proposal: analysisByProposal,
    };

    const byLane = { [LANE_PHRASE]: 0, [LANE_AUDIT]: 0, [LANE_WEB_TOOLS]: 0 };
    const byAction = {};
    for (const proposal of proposals) {
      const row = view(index, proposal);
      byLane[row.lane] = (byLane[row.lane] || 0) + 1;
      byAction[row.action] = (byAction[row.action] || 0) + 1;
    }
    // Exact lookup used to scan every proposal. At ~2.3k edges that is still
    // cheap for short selections, but the FAB passes the whole visible page;
    // indexing by the from-text string keeps exact matches O(1) as the corpus
    // grows without changing the match rules.
    const fromTextIndex = new Map();
    for (const proposal of proposals) {
      const fromText = texts[proposal.from];
      const list = fromTextIndex.get(fromText);
      if (list) list.push(proposal);
      else fromTextIndex.set(fromText, [proposal]);
    }
    index._from_text_index = fromTextIndex;
    index.summary = {
      proposals: proposals.length,
      origins: origins.length,
      contexts: Object.keys(contexts).length,
      by_lane: byLane,
      by_action: byAction,
    };
    return index;
  }

  function sourceView(index, sourceId) {
    const source = index.sources[sourceId];
    return source ? { ...source } : null;
  }

  function patientView(patient) {
    if (!patient) return null;
    const repo = patient.repo || '';
    const ref = patient.commit || 'main';
    const path = patient.path || '';
    return { ...patient, repo, commit: ref, path,
      url: repo && path ? blobUrl(repo, ref, path) : '' };
  }

  // Scanned document occurrence for the web-tools paragraph lane. The overnight
  // path:pN import_id is provenance only. Historical links open the path at the
  // pinned scanned_commit from Home (not moving main).
  function documentView(document) {
    if (!document) return null;
    const repo = document.repo || '';
    const path = document.path || '';
    const commit = typeof document.commit === 'string' && /^[0-9a-f]{40}$/.test(document.commit)
      ? document.commit : '';
    const paragraph = document.paragraph ?? null;
    const start = document.start_line ?? null;
    const end = document.end_line ?? null;
    let url = '';
    if (repo && path && document.revision !== 'working-tree') {
      // Prefer the verified overnight SHA; refuse to silently fall back to
      // moving main when a commit was expected but malformed.
      const ref = commit || 'main';
      url = blobUrl(repo, ref, path);
      if (Number.isFinite(start) && start > 0) {
        url += end && end !== start ? `#L${start}-L${end}` : `#L${start}`;
      }
    }
    return {
      ...document,
      repo,
      commit,
      path,
      paragraph,
      start_line: start,
      end_line: end,
      url,
      label: [
        repo && path ? `${repo}/${path}` : (path || repo || ''),
        paragraph !== null && paragraph !== undefined ? `p${paragraph}` : '',
        Number.isFinite(start) ? (end && end !== start ? `L${start}-L${end}` : `L${start}`) : '',
      ].filter(Boolean).join(' · '),
    };
  }

  function originView(index, origin, lane) {
    let context = null;
    if (origin.context) {
      const parsed = index.contexts[origin.context.section] || {};
      context = {
        source: sourceView(index, origin.context.source_id),
        section: origin.context.section,
        date: parsed.date || '',
        session_id_prefix: parsed.session_id_prefix || '',
        markdown: parsed.markdown || '',
      };
    }
    const document = origin.document ? documentView(origin.document) : null;
    return {
      proposal_id: origin.proposal_id,
      lane,
      scope: origin.scope,
      record: origin.record,
      source: sourceView(index, origin.source_id),
      context,
      original_verdict: origin.original_verdict ?? null,
      patient: patientView(origin.patient),
      document,
      agent: origin.agent ?? null,
      signedAt: origin.signedAt ?? null,
      targetRatio: origin.targetRatio ?? null,
      ratio: origin.ratio ?? null,
      draftWords: origin.draftWords ?? null,
      words: origin.words ?? null,
      operation: origin.operation ?? null,
      original_status: origin.original_status ?? null,
      original_note: origin.original_note ?? null,
      decision: origin.decision ?? null,
      rationale: origin.rationale ?? null,
      relocation: origin.relocation ?? null,
      evidence: Array.isArray(origin.evidence) ? origin.evidence : [],
      // Historical reconsideration proposals use the same proposal edge and
      // view machinery. These fields keep their occurrence-scoped derivation
      // visible without making it part of proposal identity.
      source_occurrence_id: origin.source_occurrence_id ?? null,
      reconsideration_id: origin.reconsideration_id ?? null,
      historical_inputs: origin.historical_inputs ?? null,
    };
  }

  function view(index, proposalOrId) {
    const proposal = typeof proposalOrId === 'string'
      ? index.proposals.find(row => row.id === proposalOrId)
      : proposalOrId;
    if (!proposal?.id) return null;
    const lane = index._lane_by_proposal[proposal.id] || '';
    const origins = (index._origins_by_proposal[proposal.id] || [])
      .map(origin => originView(index, origin, lane));
    const first = origins[0] || {};
    const verdict = lane === LANE_PHRASE ? first.original_verdict ?? null : null;
    const decision = lane === LANE_AUDIT ? first.decision ?? null : null;
    const operation = lane === LANE_AUDIT ? first.operation ?? null : null;
    const halfLength = lane === LANE_WEB_TOOLS ? ACTION_HALF_LENGTH : null;
    const analysis = index._analysis_by_proposal[proposal.id] || null;
    return {
      id: proposal.id,
      lane,
      action: verdict || decision || halfLength || (lane === LANE_LOCAL ? first.operation : '') || '',
      verdict,
      decision,
      operation,
      from: { text_id: proposal.from, text: index.texts[proposal.from] },
      to: { text_id: proposal.to, text: index.texts[proposal.to] },
      author: proposal.author,
      purpose: proposal.purpose,
      analysis: analysis ? { ...analysis } : null,
      origins,
    };
  }

  const WORD = /[\p{L}\p{N}_]/u;
  const word = char => !!char && WORD.test(char);

  function spansIn(haystack, needle) {
    const spans = [];
    if (!needle || needle.length > haystack.length) return spans;
    let at = haystack.indexOf(needle);
    while (at !== -1) {
      const end = at + needle.length;
      const leftOk = !word(needle[0]) || !word(haystack[at - 1]);
      const rightOk = !word(needle[needle.length - 1]) || !word(haystack[end]);
      // An ACCEPTED span consumes its own length, so two reported occurrences
      // never overlap. A REJECTED one must only advance by a character: it was
      // rejected for its neighbours, not its content, and skipping a needle's
      // length past it loses a real match that starts inside it. Probe: `a-a`
      // in `xa-a-a` found nothing, where [3,6] is a valid span.
      if (leftOk && rightOk) { spans.push([at, end]); at = haystack.indexOf(needle, end); }
      else at = haystack.indexOf(needle, at + 1);
    }
    return spans;
  }

  function lookup(index, value, { contained = false } = {}) {
    const text = edgeTrim(value);
    if (!text) throw new Error('The selection is empty after edge trimming');
    const indexed = index._from_text_index?.get(text);
    const exactRows = indexed || index.proposals.filter(row => index.texts[row.from] === text);
    const exactIds = new Set(exactRows.map(row => row.id));
    const exact = exactRows.map(row => view(index, row));
    const within = [];
    if (contained) {
      const hayLen = text.length;
      for (let order = 0; order < index.proposals.length; order++) {
        const proposal = index.proposals[order];
        if (exactIds.has(proposal.id)) continue;
        const needle = index.texts[proposal.from];
        // Same match rules; skip needles that cannot fit. Contained scans stay
        // linear in proposal count (~2.3k) and are fine for ordinary pages.
        if (!needle || needle.length > hayLen) continue;
        const spans = spansIn(text, needle);
        if (spans.length) within.push({ proposal, spans, order, length: needle.length });
      }
      within.sort((a, b) => b.length - a.length || a.order - b.order);
    }
    const containedViews = within.map(row => ({ ...view(index, row.proposal), spans: row.spans }));
    return {
      selection: { text },
      exact,
      contained: containedViews,
      warnings: exact.length || containedViews.length ? [SCOPE_WARNING] : [],
    };
  }

  function search(index, { q = '', lane = '', action = '' } = {}) {
    const query = edgeTrim(q).toLowerCase();
    return index.proposals.map(row => view(index, row)).filter(row => {
      if (lane && row.lane !== lane) return false;
      if (action && row.action !== action) return false;
      if (!query) return true;
      const haystack = [
        row.from.text,
        row.to.text,
        row.purpose,
        row.action,
        row.analysis,
        row.origins.map(origin => ({
          context: origin.context?.markdown || '',
          patient: origin.patient,
          document: origin.document,
          agent: origin.agent,
          rationale: origin.rationale,
          original_note: origin.original_note,
          relocation: origin.relocation,
          evidence: origin.evidence,
          record: origin.record,
        })),
      ].map(value => typeof value === 'string' ? value : JSON.stringify(value ?? ''))
        .join('\n').toLowerCase();
      return haystack.includes(query);
    });
  }

  // Quiet and interactive reads cannot share one promise. gh-auth attaches its
  // page-level token prompt outside GH's request promise, so a FAB background
  // read must never inherit the takeover behavior of a simultaneous viewer read.
  const loadKey = (gh, specPath, quiet = false) =>
    `${authScope(authorizationOf(gh))}:${gh?.repo || ''}@${gh?.ref || 'main'}:${specPath}:${quiet ? 'quiet' : 'interactive'}`;

  async function load(gh, { specPath = DEFAULT_SPEC, fresh = false, quiet = false } = {}) {
    if (!gh || typeof gh.get !== 'function') throw new Error('TextProposals.load requires a GH client');
    const key = loadKey(gh, specPath, quiet);
    const held = loads.get(key);
    if (fresh) loads.delete(key);
    else if (held) {
      // A rejection is HELD, not dropped. The FAB re-reads on every scan, so
      // deleting it meant a fresh failing request per selection change, which
      // spends the anonymous rate limit on a page a reader leaves open. It is
      // held only for FAIL_MS, so the three ways access can change all recover
      // without a reload: a different credential is a different cache key
      // already, a permission grant on the same token expires with the entry,
      // and so does the source landing on the branch this reads.
      if (!held.failedAt || Date.now() - held.failedAt < api.FAIL_MS) return held.promise;
      loads.delete(key);
    }
    const readOptions = {
      ...(fresh ? (window.GH?.FRESH || { cache: 'no-store' }) : {}),
      ...(quiet ? { quiet: true } : {}),
    };
    // A failed catalog read cannot tell the reader WHY. A 404 on a private
    // repository is missing access, a missing path, or a source that has not
    // landed on the ref being read, and during a two-repository rollout it is
    // routinely the last of those. So name the state and the status, and let
    // the cause stay on the error for anyone debugging.
    // Scoped to the catalog fetches below, so the
    // kit's own schema and validation errors are never swallowed: those name a
    // real problem in the data and are thrown after every read has returned.
    const unavailable = (error) => {
      const status = Number.isFinite(error?.status) ? error.status : null;
      const wrapped = new Error('Retained proposals are unavailable'
        + (status ? ` (the catalog read returned ${status}).` : '.'));
      if (status) wrapped.status = status;
      wrapped.cause = error;
      return wrapped;
    };
    const promise = (async () => {
      const read = (path) => gh.get(path, readOptions).catch(error => { throw unavailable(error); });
      const readBytes = (path) => {
        if (typeof gh.bytes !== 'function') {
          throw new Error('TextProposals.load requires gh.bytes for gzip inventory payloads');
        }
        return gh.bytes(path, readOptions).catch(error => { throw unavailable(error); });
      };
      const specResult = await read(specPath);
      const spec = parseJson(specResult.text, specPath);
      if (spec?.schema !== SOURCE_SCHEMA) {
        throw new Error(`Unsupported text source schema: ${spec?.schema || '(missing)'}`);
      }
      const roles = ['phrase_reviews', 'phrase_context', 'audit_packet'];
      const results = await Promise.all(roles.map(async role => {
        const path = spec[role];
        if (!path || typeof path !== 'string') throw new Error(`Text source specification is missing ${role}`);
        return [role, await read(path)];
      }));
      const files = Object.fromEntries(results.map(([role, result]) => [role, result.text]));
      const metadata = Object.fromEntries(results);
      metadata.spec = specResult;
      const webToolsPath = webToolsPayloadPath(spec);
      if (webToolsPath) {
        // Scoped so a gzip / schema failure after a successful fetch still
        // names the real problem; only the network miss goes through unavailable.
        const bin = await readBytes(webToolsPath);
        const jsonl = await gunzipUtf8(bin.bytes, webToolsPath);
        files.web_tools_paragraphs = jsonl;
        metadata.web_tools_paragraphs = {
          sha: bin.sha,
          size: bin.size,
          url: bin.url,
          path: webToolsPath,
        };
      }
      if (spec.local_proposals !== undefined && !Array.isArray(spec.local_proposals)) {
        throw new Error('local_proposals must be an array of bundle paths');
      }
      await Promise.all((spec.local_proposals || []).map(async path => {
        if (typeof path !== 'string' || !path) throw new Error('Invalid local proposal path');
        const result = await read(path);
        files[path] = result.text;
        metadata[path] = result;
      }));
      return build({
        spec,
        files,
        metadata,
        repo: gh.repo || '',
        ref: gh.ref || 'main',
        specPath,
      });
    })();
    const entry = { promise, failedAt: 0 };
    loads.set(key, entry);
    try { return await promise; }
    catch (error) {
      if (loads.get(key) === entry) entry.failedAt = Date.now();
      throw error;
    }
  }

  function clear(gh = null, { specPath = DEFAULT_SPEC } = {}) {
    if (!gh) {
      loads.clear();
      authScopes.clear();
    }
    else {
      loads.delete(loadKey(gh, specPath, false));
      loads.delete(loadKey(gh, specPath, true));
    }
  }

  const api = {
    SCHEMA,
    DEFAULT_SPEC,
    SCOPE_WARNING,
    LANE_PHRASE,
    LANE_AUDIT,
    LANE_WEB_TOOLS,
    LANE_LOCAL,
    ACTION_HALF_LENGTH,
    // How long a failed catalog read is remembered, mirroring GH.MEMO_MS: the
    // same minute GitHub's own Cache-Control grants a successful read, applied
    // to a failed one. Settable, like GH.MEMO_MS, so a test need not wait it out.
    FAIL_MS: 60_000,
    load,
    build,
    view,
    lookup,
    search,
    clear,
  };
  window.TextProposals = api;
})();
