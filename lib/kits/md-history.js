// kits/md-history.js — evidence-bearing history for current Markdown passages.
//
// The join is exact and occurrence-scoped. This kit counts occurrences of each
// raw Markdown block in the open file and asks TextHistory for a matching
// current occurrence at that repo/path/full-file-blob/ordinal. It does not use md-diff's
// similarity alignment to discover history: md-diff enters only after a
// committed inferred-predecessor record has supplied both sides to display.
(() => {
  if (window.mdHistory) return;

  const HOME = { repo: 'mehrlander/home', ref: 'main',
    spec: 'projects/text/current-sources.json' };
  const LAB = 'https://mehrlander.github.io/web-tools/pages/text-lab.html';
  const PY_EDGE = /^(?:\p{White_Space}|[\u001c-\u001f])+|(?:\p{White_Space}|[\u001c-\u001f])+$/gu;
  const exact = value => String(value ?? '').replace(PY_EDGE, '');
  const list = value => Array.isArray(value) ? value : [];
  const load = name => window.gh ? window.gh.load(name).catch(() => {}) : Promise.resolve();

  const el = (tag, classes = '', text = null) => {
    const node = document.createElement(tag);
    if (classes) node.className = classes;
    if (text !== null && text !== undefined) node.textContent = String(text);
    return node;
  };
  const icon = name => {
    const node = el('i', `ph ${name}`);
    node.setAttribute('aria-hidden', 'true');
    return node;
  };
  const textOf = value => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join('; ');
    for (const key of ['observation', 'description', 'summary', 'note', 'reason', 'quote', 'label', 'value']) {
      if (value[key] !== undefined) return textOf(value[key]);
    }
    return JSON.stringify(value);
  };

  function plan(md, historyIndex, { repo = '', path = '', blob = '', ref = '' } = {}) {
    if (!window.mdDiff || !window.TextHistory) {
      throw new Error('mdHistory.plan needs mdDiff and TextHistory');
    }
    if (!repo || !path || !blob) return { blocks: [], entries: [], ambiguous: [], count: 0, ref, blob };
    const ordinals = new Map();
    const blocks = [];
    const ambiguous = [];
    for (const block of window.mdDiff.blocks(md)) {
      const key = exact(block.text);
      const ordinal = (ordinals.get(key) || 0) + 1;
      ordinals.set(key, ordinal);
      const found = window.TextHistory.lookup(historyIndex, block.text, {
        repo,
        path,
        blob,
        ref,
        sameTextOrdinal: ordinal,
      });
      if (found.ambiguous) ambiguous.push({ block, ordinal, matches: found.matches });
      if (!found.matches.length || found.ambiguous) continue;
      for (const match of found.matches) blocks.push({ block, ordinal, match });
    }

    // A split/merge is one connection with sets on both sides, not several
    // one-to-one histories. Aggregate matched current blocks by connection so
    // the display keeps that branching shape intact.
    const entriesById = new Map();
    for (const row of blocks) {
      for (const connection of row.match.connections) {
        let entry = entriesById.get(connection.id);
        if (!entry) {
          entry = { connection, current: [], current_occurrences: new Map() };
          entriesById.set(connection.id, entry);
        }
        if (!entry.current.some(item => item.block.start === row.block.start)) {
          entry.current.push({ block: row.block, occurrence: row.match.occurrence });
        }
        entry.current_occurrences.set(row.match.occurrence.id, row.match.occurrence);
      }
    }
    const entries = [...entriesById.values()].map(entry => ({
      connection: entry.connection,
      current: entry.current.sort((a, b) => a.block.start - b.block.start),
      current_occurrences: [...entry.current_occurrences.values()],
      predecessors: list(entry.connection.from_occurrences),
      continuations: list(entry.connection.occurrence_continuations)
        .filter(row => list(row.to_occurrence_ids).some(id => entry.current_occurrences.has(id))),
      // A connection may name current branches which are not present in this
      // exact pinned document blob. The UI reports that limit rather than filling them
      // from similarity.
      missing_current_occurrence_ids: list(entry.connection.current_occurrence_ids)
        .filter(id => !entry.current_occurrences.has(id)),
    }));
    return { blocks, entries, ambiguous, count: entries.length, ref, blob };
  }

  function line(label, value, classes = '') {
    const text = textOf(value);
    if (!text) return null;
    const row = el('div', `grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)] ${classes}`.trim());
    row.append(el('div', 'text-[11px] uppercase tracking-wide opacity-50 font-medium', label));
    row.append(el('div', 'text-sm leading-5 whitespace-pre-wrap break-words', text));
    return row;
  }

  function evidenceList(values) {
    const items = list(values).map(textOf).filter(Boolean);
    if (!items.length) return null;
    const ul = el('ul', 'list-disc pl-5 text-sm leading-5 grid gap-1');
    for (const item of items) ul.append(el('li', 'break-words', item));
    return ul;
  }

  function proposalRow(proposal, label) {
    const box = el('div', 'border-t border-base-300/60 pt-3 first:border-t-0 first:pt-0');
    const head = el('div', 'flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-tight');
    head.append(el('span', 'uppercase tracking-wide opacity-50 font-medium', label));
    if (proposal.author) head.append(el('span', 'opacity-70', proposal.author));
    const inTextLab = proposal.lane !== window.TextHistory?.FRESH_LANE;
    if (proposal.id && inTextLab) {
      const link = el('a', 'link link-hover text-primary', 'Text Lab');
      link.href = `${LAB}?proposal=${encodeURIComponent(proposal.id)}`;
      link.target = '_blank';
      link.rel = 'noopener';
      head.append(link);
    }
    box.append(head);
    const origin = proposal.origins?.[0];
    if (origin?.document?.url) {
      const source = el('div', 'mt-1 text-xs leading-5 opacity-60');
      source.append('Source observation · ');
      const link = el('a', 'link link-hover text-primary', origin.document.label || 'Pinned document occurrence');
      link.href = origin.document.url;
      link.target = '_blank';
      link.rel = 'noopener';
      source.append(link);
      box.append(source);
    } else if (origin?.record) {
      box.append(el('div', 'mt-1 text-xs leading-5 opacity-60', `Source observation · ${origin.record}`));
    }
    const pair = el('div', 'mt-1 grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start');
    pair.append(el('div', 'text-sm leading-5 whitespace-pre-wrap break-words opacity-70', proposal.from?.text || ''));
    pair.append(icon('ph-arrow-right'));
    pair.append(el('div', 'text-sm leading-5 whitespace-pre-wrap break-words font-medium', proposal.to?.text || ''));
    box.append(pair);
    if (proposal.purpose) box.append(el('div', 'mt-1 text-xs leading-5 opacity-60', proposal.purpose));
    return box;
  }

  function revisionBand(connection) {
    const revision = connection.revision;
    const band = el('section', 'grid gap-3 border-t border-base-300/70 pt-4');
    const title = el('div', 'flex flex-wrap items-center gap-2');
    title.append(icon('ph-git-commit'));
    title.append(el('h4', 'text-sm font-semibold', 'Actual document revision'));
    if (!revision) title.append(el('span', 'text-xs opacity-50', 'No revision record linked'));
    band.append(title);
    if (!revision) return band;
    const commit = revision.commit || '';
    const repo = revision.repo || revision.document?.repo || '';
    if (repo && commit) {
      const link = el('a', 'link link-hover text-sm font-mono break-all', commit.slice(0, 12));
      link.href = `https://github.com/${repo}/commit/${encodeURIComponent(commit)}`;
      link.target = '_blank';
      link.rel = 'noopener';
      band.append(link);
    }
    const counts = `${list(revision.removed_occurrence_ids).length} removed occurrence${list(revision.removed_occurrence_ids).length === 1 ? '' : 's'} → `
      + `${list(revision.added_occurrence_ids).length} added occurrence${list(revision.added_occurrence_ids).length === 1 ? '' : 's'}`;
    band.append(el('div', 'text-xs opacity-60', counts));
    const evidence = evidenceList(revision.evidence || revision.observed_evidence);
    if (evidence) band.append(evidence);
    return band;
  }

  function inferenceBand(connection, entry) {
    const band = el('section', 'grid gap-3 border-t border-base-300/70 pt-4');
    const title = el('div', 'flex flex-wrap items-center gap-2');
    title.append(icon('ph-clock-counter-clockwise'));
    title.append(el('h4', 'text-sm font-semibold', 'Inferred predecessor'));
    if (connection.confidence !== undefined && connection.confidence !== null) {
      title.append(el('span', 'badge badge-ghost badge-sm', `confidence ${textOf(connection.confidence)}`));
    }
    band.append(title);
    const shape = `${entry.predecessors.length} predecessor occurrence${entry.predecessors.length === 1 ? '' : 's'} → `
      + `${list(connection.to_occurrence_ids).length} post-revision occurrence${list(connection.to_occurrence_ids).length === 1 ? '' : 's'}`;
    band.append(el('div', 'text-xs opacity-60', shape));
    const basis = evidenceList([
      ...list(connection.basis),
      ...list(connection.evidence),
    ]);
    if (basis) band.append(basis);
    const limits = line('Limits', connection.limits || connection.uncertainty);
    if (limits) band.append(limits);
    return band;
  }

  function continuationBand(entry) {
    const continuations = list(entry.continuations);
    if (!continuations.length) return null;
    const band = el('section', 'grid gap-4 border-t border-base-300/70 pt-4');
    const title = el('div', 'flex flex-wrap items-center gap-2');
    title.append(icon('ph-git-branch'));
    title.append(el('h4', 'text-sm font-semibold', 'Inferred occurrence continuation'));
    band.append(title);
    for (const continuation of continuations) {
      const item = el('div', 'grid gap-2');
      const fromCount = list(continuation.from_occurrence_ids).length;
      const toCount = list(continuation.to_occurrence_ids).length;
      item.append(el('div', 'text-xs opacity-60',
        `${fromCount} exact revision result${fromCount === 1 ? '' : 's'} → ${toCount} pinned current occurrence${toCount === 1 ? '' : 's'}`));
      if (continuation.confidence !== undefined && continuation.confidence !== null) {
        item.append(el('div', 'text-xs opacity-60', `Confidence ${textOf(continuation.confidence)}`));
      }
      const evidence = evidenceList([
        ...list(continuation.basis),
        ...list(continuation.evidence),
      ]);
      if (evidence) item.append(evidence);
      const limits = line('Limits', continuation.limits || continuation.uncertainty);
      if (limits) item.append(limits);
      band.append(item);
    }
    if (entry.missing_current_occurrence_ids.length) {
      band.append(el('div', 'text-xs text-warning',
        `${entry.missing_current_occurrence_ids.length} continued current occurrence${entry.missing_current_occurrence_ids.length === 1 ? ' is' : 's are'} not in this exact file view.`));
    }
    return band;
  }

  function proposalSourceBand(connection) {
    const connections = list(connection.proposal_source_connections);
    if (!connections.length) return null;
    const band = el('section', 'grid gap-4 border-t border-base-300/70 pt-4');
    const title = el('div', 'flex flex-wrap items-center gap-2');
    title.append(icon('ph-link'));
    title.append(el('h4', 'text-sm font-semibold', 'Inferred proposal-source continuation'));
    band.append(title);
    for (const sourceConnection of connections) {
      const item = el('div', 'grid gap-2');
      const fromCount = list(sourceConnection.from_occurrence_ids).length;
      const toCount = list(sourceConnection.to_occurrence_ids).length;
      item.append(el('div', 'text-xs opacity-60',
        `${fromCount} retained proposal-source occurrence${fromCount === 1 ? '' : 's'} → ${toCount} exact revision predecessor${toCount === 1 ? '' : 's'}`));
      if (sourceConnection.confidence !== undefined && sourceConnection.confidence !== null) {
        item.append(el('div', 'text-xs opacity-60', `Confidence ${textOf(sourceConnection.confidence)}`));
      }
      const evidence = evidenceList([
        ...list(sourceConnection.basis),
        ...list(sourceConnection.evidence),
      ]);
      if (evidence) item.append(evidence);
      const limits = line('Limits', sourceConnection.limits || sourceConnection.uncertainty);
      if (limits) item.append(limits);
      band.append(item);
    }
    return band;
  }

  function reconsiderationBand(connection) {
    const reviews = list(connection.reconsiderations);
    if (!reviews.length) return null;
    const band = el('section', 'grid gap-5 border-t border-base-300/70 pt-4');
    const title = el('div', 'flex items-center gap-2');
    title.append(icon('ph-lightbulb'));
    title.append(el('h4', 'text-sm font-semibold', 'Reconsideration'));
    band.append(title);
    for (const review of reviews) {
      const item = el('div', 'grid gap-3');
      const outcomeKind = typeof review.outcome === 'object'
        ? review.outcome?.kind : review.outcome;
      const outcomeLabel = {
        'nothing-useful-remains': 'Nothing useful remains',
        'fresh-proposal': 'Fresh proposal retained',
      }[outcomeKind] || outcomeKind;
      const outcome = line('Outcome', outcomeLabel);
      if (outcome) item.append(outcome);
      for (const [label, key] of [
        ['Attempted improvement', 'attempted_improvement'],
        ['Subsequent edit', 'subsequent_edit'],
        ['Subsequent edits', 'subsequent_edits'],
        ['Already achieved', 'already_achieved'],
        ['Still useful', 'remains_useful'],
        ['Still useful', 'what_remains_useful'],
        ['No longer applies', 'no_longer_applies'],
        ['No longer applies', 'what_no_longer_applies'],
        ['Judgment', 'judgment'],
      ]) {
        const row = line(label, review[key]);
        if (row) item.append(row);
      }
      const author = review.author || review.attributed_to;
      const date = review.date || review.attributed_at;
      if (author || date) {
        item.append(el('div', 'text-xs opacity-50', [author, date].filter(Boolean).join(' · ')));
      }
      if (review.earlier_proposals?.length) {
        const proposals = el('div', 'grid gap-3');
        for (const proposal of review.earlier_proposals) {
          proposals.append(proposalRow(proposal, 'Retained proposal from predecessor'));
        }
        item.append(proposals);
      }
      if (review.fresh_proposals?.length) {
        const proposals = el('div', 'grid gap-3');
        for (const proposal of review.fresh_proposals) {
          proposals.append(proposalRow(proposal, 'Fresh retained proposal'));
        }
        item.append(proposals);
      }
      band.append(item);
    }
    return band;
  }

  async function render(host, md, historyIndex, opts = {}) {
    if (!window.mdDiff) await load('kits/md-diff.js');
    if (!window.TextHistory) await load('kits/text-history.js');
    if (!window.mdDiff || !window.TextHistory) throw new Error('mdHistory.render: kits unavailable');
    // The visible Markdown may have frontmatter stripped, but occurrence scope
    // is the Git blob for the complete file bytes supplied by the viewer.
    // Never trust a moving ref name (or a caller-provided blob) as that scope.
    const source = Object.prototype.hasOwnProperty.call(opts, 'source') ? opts.source : md;
    const blob = await window.TextHistory.gitBlobId(source);
    const planned = plan(md, historyIndex, { ...opts, blob });
    host.textContent = '';
    host.classList.add('grid', 'gap-8', 'min-w-0');
    if (planned.ambiguous.length) {
      const warning = el('div', 'border-l-2 border-warning pl-3 text-sm leading-5');
      warning.append(el('div', 'font-semibold', 'Ambiguous occurrence'));
      warning.append(el('div', 'opacity-70',
        'Identical current wording occurs more than once and the retained locator did not select one. No history was attached to those blocks.'));
      host.append(warning);
    }
    for (const entry of planned.entries) {
      const article = el('article', 'grid gap-4 min-w-0 border-b border-base-300 pb-8 last:border-b-0');
      article.dataset.mdHistoryFor = entry.connection.id;
      const head = el('div', 'flex flex-wrap items-center gap-2');
      head.append(icon('ph-clock-counter-clockwise'));
      head.append(el('h3', 'text-base font-semibold', 'Passage history'));
      const occurrence = entry.current_occurrences[0];
      if (occurrence?.location?.start_line) {
        const where = occurrence.location.end_line && occurrence.location.end_line !== occurrence.location.start_line
          ? `L${occurrence.location.start_line}–${occurrence.location.end_line}`
          : `L${occurrence.location.start_line}`;
        head.append(el('span', 'text-xs opacity-50 font-mono', where));
      }
      article.append(head);

      const predecessorMd = entry.predecessors.map(row => row.text).filter(Boolean).join('\n\n');
      const currentMd = entry.current.map(row => row.block.text).join('\n\n');
      const comparison = el('div', 'min-w-0');
      article.append(comparison);
      // Similarity is used here only to lay out two sides named by an explicit
      // connection. It never feeds plan() or TextHistory.lookup().
      await window.mdDiff.render(comparison, predecessorMd, currentMd, {
        strip: false,
        ...(opts.diff || {}),
      });
      article.append(revisionBand(entry.connection));
      article.append(inferenceBand(entry.connection, entry));
      const continuation = continuationBand(entry);
      if (continuation) article.append(continuation);
      const proposalSource = proposalSourceBand(entry.connection);
      if (proposalSource) article.append(proposalSource);
      const reconsideration = reconsiderationBand(entry.connection);
      if (reconsideration) article.append(reconsideration);
      host.append(article);
    }
    return { plan: planned, count: planned.count, ambiguous: planned.ambiguous.length };
  }

  async function index({ token, fresh = false, quiet = true } = {}) {
    if (!window.Csv) await load('kits/csv.js');
    if (!window.TextProposals) await load('kits/text-proposals.js');
    if (!window.TextHistory) await load('kits/text-history.js');
    if (!window.TextHistory || !window.TextProposals) throw new Error('the history projection kits are unavailable');
    if (typeof window.GH !== 'function') throw new Error('no GH client on this page');
    const saved = token ?? (window.ghAuth?.resolve?.() || '');
    const embedded = window.TOKEN && !String(window.TOKEN).includes('🎟') ? window.TOKEN : '';
    const home = new window.GH({ token: saved || embedded, repo: HOME.repo, ref: HOME.ref });
    const proposals = await window.TextProposals.load(home, {
      specPath: HOME.spec,
      fresh,
      quiet,
    });
    return window.TextHistory.load(home, {
      specPath: HOME.spec,
      proposalIndex: proposals,
      fresh,
      quiet,
    });
  }

  window.mdHistory = { plan, render, index, HOME, LAB, _exact: exact };
})();
