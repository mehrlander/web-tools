// lib/kits/wsl.js — browser-facing WSL kit. The page calls `gh.load('kits/wsl.js')`
// after bootstrapping gh-api; this loads the dependency-free core, injects the
// browser's XML libs + idb-keyval, and registers `window.wsl` with:
//   • the parsers (lazy — only fast-xml-parser/flat-loaded on first parse, so a
//     snapshot-only page like pension-dash never pulls them);
//   • fetch-and-parse helpers for CORS-permitting direct sync;
//   • loadStore/saveStore over the committed JSON snapshot (+ IDB augment);
//   • RCW reference lookups + linkify/tooltip/popup display utilities.
//
// Classic kit body; returns its async wiring so gh.load awaits window.wsl ready.

return (async () => {
  await gh.load('kits/wsl-core.js');
  const core = window.wslCore;
  const { get, set } = await import('https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm');

  // --- lazy XML parsers ---------------------------------------------------
  let parsersP = null;
  const parsers = () => (parsersP ??= (async () => {
    const [fxp, flatMod] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/fast-xml-parser@4.5.1/+esm'),
      import('https://cdn.jsdelivr.net/npm/flat@6.0.0/+esm')
    ]);
    return core.makeParsers({ XMLParser: fxp.XMLParser, flatten: flatMod.flatten });
  })());
  const lazy = name => async (...a) => (await parsers())[name](...a);

  const parseLegislationXml = lazy('parseLegislationXml');
  const parsePrefilesXml    = lazy('parsePrefilesXml');
  const parseSponsorsXml    = lazy('parseSponsorsXml');
  const parseRcwXml         = lazy('parseRcwXml');
  const parseHistoryXml     = lazy('parseHistoryXml');
  const parseActionsXml     = lazy('parseActionsXml');

  // --- committed snapshot loader (was wsl-data.js) ------------------------
  const BIENNIUM = '2025-26';
  const KEYED = new Set(['rcws', 'history', 'actions']);
  const dbKey = (k, b = BIENNIUM) => `wsl-${b}-${k}`;

  const fetchStore = async (k, base) => {
    try {
      const r = await fetch(`${base}/${k}.json`, { cache: 'no-cache' });
      if (r.ok) return await r.json();
    } catch { /* fall through to empty */ }
    return KEYED.has(k) ? {} : [];
  };

  // Files are the source of truth (the Action refreshes the full lists). IDB
  // augments only the keyed stores: a paste can persist rcws/history/actions
  // for bills beyond the snapshot, and those keys merge on top. List stores
  // ignore IDB, so a stale paste can never shadow the auto-refreshed snapshot.
  const loadStore = async ({ stores, biennium = BIENNIUM, base = `./data/${biennium}`, overlay = true } = {}) => {
    const out = {};
    await Promise.all(stores.map(async k => {
      let val = await fetchStore(k, base);
      if (overlay && KEYED.has(k)) {
        const saved = await get(dbKey(k, biennium));
        if (saved && typeof saved === 'object') val = { ...val, ...saved };
      }
      out[k] = val;
    }));
    return out;
  };
  const saveStore = (k, value) => set(dbKey(k), value);

  // --- fetch-and-parse helpers (direct fetch, CORS permitting) ------------
  const getLegislation = async (sinceDate) =>
    parseLegislationXml(await (await fetch(core.URLS.legislation(sinceDate))).text());
  const getPrefiles = async () =>
    parsePrefilesXml(await (await fetch(core.URLS.prefiles())).text());
  const getSponsors = async (biennium) =>
    parseSponsorsXml(await (await fetch(core.URLS.sponsors(biennium))).text());
  const getRcwFor = async (b, biennium = BIENNIUM) => {
    const billId = b?.BillId || b;
    if (!billId) return null;
    return parseRcwXml(await (await fetch(core.URLS.rcwFor(billId, biennium))).text(), billId);
  };
  const getActionsFor = async (b, biennium = BIENNIUM) => {
    const bn = core.getBillNumber(b);
    if (!bn) return [];
    return parseActionsXml(await (await fetch(core.URLS.actionsFor(bn, biennium))).text(), bn);
  };
  const getHistoryFor = async (b, biennium = BIENNIUM, beginDate = '1/1/2025', endDate = '12/31/2026') => {
    const bn = core.getBillNumber(b);
    if (!bn) return [];
    return parseHistoryXml(await (await fetch(core.URLS.historyFor(bn, biennium, beginDate, endDate))).text(), bn);
  };

  // --- RCW reference data + display utilities -----------------------------
  // rcw/*.json sits beside the page; preload fetches it relative to the
  // document (both wsl pages live in pages/wsl-sync/).
  const PENSION_MAP = core.PENSION_MAP;
  const rcwUrl = cite => `https://app.leg.wa.gov/RCW/default.aspx?cite=${cite}`;

  let byChapter = null, byTitle = null, byCite = null;

  const preload = async () => {
    if (byChapter) return;
    const [chapters, titles, full] = await Promise.all([
      fetch('./rcw/rcw-chapters.json').then(r => r.json()),
      fetch('./rcw/rcw-titles.json').then(r => r.json()),
      fetch('./rcw/rcw-full.json').then(r => r.json())
    ]);
    byChapter = Object.fromEntries(chapters.map(c => [c.Chapter, c]));
    byTitle   = Object.fromEntries(titles.map(t => [t.title.toUpperCase(), t]));
    byCite    = Object.fromEntries(full.map(f => [f.Cite, f]));
  };

  const getChapterInfo = ch   => byChapter?.[ch];
  const getTitleInfo   = t    => byTitle?.[t.toUpperCase()];
  const getCiteInfo    = cite => byCite?.[cite];

  const groupByChapter = (fullRcws) => {
    const byChap = {};
    (fullRcws || '').split('|').filter(Boolean).forEach(r => {
      const ch = r.split('.').slice(0, 2).join('.');
      (byChap[ch] = byChap[ch] || []).push(r);
    });
    return byChap;
  };

  const groupByTitle = (rcwList) => {
    const byTit = {};
    rcwList.forEach(r => {
      const t = r.split('.')[0];
      (byTit[t] = byTit[t] || []).push(r);
    });
    return byTit;
  };

  const getChapterLabel = (ch) => {
    for (const [sys, d] of Object.entries(PENSION_MAP.systems)) {
      if (d.ch === ch) return { label: sys, type: 'system' };
    }
    if (PENSION_MAP.general[ch])  return { label: PENSION_MAP.general[ch],  type: 'general' };
    const g = PENSION_MAP.governance[ch];
    if (g) return { label: typeof g === 'string' ? g : g.label, type: 'governance' };
    if (PENSION_MAP.adjacent[ch]) return { label: PENSION_MAP.adjacent[ch], type: 'adjacent' };
    return null;
  };

  const linkifyList = (chapterStr, fullRcws) => {
    if (!chapterStr || !byChapter) return chapterStr || '';
    const byChap = groupByChapter(fullRcws);
    return chapterStr.split(', ').filter(Boolean).map(ch => {
      const info = byChapter[ch];
      const rcws = byChap[ch] || [];
      if (!info) return ch;
      return `<a href="${info.URL}" target="_blank" rel="noopener" class="link link-primary" data-chapter="${ch}" data-rcws="${rcws.join('|')}">${ch}</a>`;
    }).join(', ');
  };

  const linkifyTitles = titleStr => {
    if (!titleStr || !byTitle) return titleStr || '';
    return titleStr.split(', ').filter(Boolean).map(t => {
      const info = byTitle[t.toUpperCase()];
      if (!info) return t;
      return `<a href="${rcwUrl(t)}" target="_blank" rel="noopener" class="link link-primary" data-title="${t}">${t}</a>`;
    }).join(', ');
  };

  const chapterTooltip = (e) => {
    const ch = e.target?.dataset?.chapter;
    if (!ch) return;
    const info = byChapter?.[ch];
    if (!info) return ch;
    const rcws = (e.target?.dataset?.rcws || '').split('|').filter(Boolean);
    const sections = rcws.map(r => r.split('.').slice(2).join('.')).filter(Boolean).sort((a, b) => +a - +b);
    const detail = sections.length ? `\nSections: ${sections.join(', ')}` : '';
    return `${ch}: ${info.Description}${detail}`;
  };

  const titleTooltip = (e) => {
    const t = e.target?.dataset?.title;
    if (!t) return;
    const info = byTitle?.[t.toUpperCase()];
    return info ? `Title ${t}: ${info.name}` : t;
  };

  const buildChapterBlock = (ch, rcws, badgeClass = 'badge-secondary') => {
    const chInfo = byCite?.[ch];
    const chName = chInfo?.Name || byChapter?.[ch]?.Description || '';
    const chMeta = getChapterLabel(ch);
    const chBadge = chMeta ? `<span class="badge badge-xs ${badgeClass} ml-1">${chMeta.label}</span>` : '';

    const sectionHtml = rcws
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map(rcw => {
        const secInfo = byCite?.[rcw];
        const secName = secInfo?.Name || '';
        const special = PENSION_MAP.special[rcw];
        const secBadge = special ? `<span class="badge badge-xs badge-primary ml-1">${special}</span>` : '';
        return `<div class="ml-4 py-0.5">
                <a href="${rcwUrl(rcw)}" target="_blank" class="link link-primary text-sm">${rcw}</a>
                <span class="text-base-content/60 text-sm">${secName}</span>${secBadge}
            </div>`;
      }).join('');

    return `<div class="mt-2">
        <div class="font-medium">
            <a href="${rcwUrl(ch)}" target="_blank" class="link link-secondary">${ch}</a>
            <span class="text-base-content/70">${chName}</span>${chBadge}
        </div>
        ${sectionHtml}
    </div>`;
  };

  const buildTitleBlock = (t, rcwsInTitle, badgeClass = 'badge-secondary') => {
    const titleInfo = byCite?.[t];
    const titleName = titleInfo?.Name || '';

    const byChap = {};
    rcwsInTitle.forEach(r => {
      const ch = r.split('.').slice(0, 2).join('.');
      (byChap[ch] = byChap[ch] || []).push(r);
    });

    const chapterHtml = Object.entries(byChap)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([ch, rcws]) => buildChapterBlock(ch, rcws, badgeClass))
      .join('');

    return `<div class="[&:not(:last-child)]:mb-3">
        <div class="font-bold border-b border-base-300 pb-1">
            <a href="${rcwUrl(t)}" target="_blank" class="link">${t}</a>
            <span class="text-base-content/80">${titleName}</span>
        </div>
        ${chapterHtml}
    </div>`;
  };

  const buildRcwPopup = (rcwListStr, options = {}) => {
    const { emptyMessage = 'No RCWs', badgeClass = 'badge-secondary' } = options;
    const rcwList = (rcwListStr || '').split('|').filter(Boolean);
    if (!rcwList.length) return `<div class="p-3 text-base-content/50">${emptyMessage}</div>`;

    const byTit = groupByTitle(rcwList);
    const titleNums = Object.keys(byTit).sort((a, b) => +a - +b);
    const sections = titleNums.map(t => buildTitleBlock(t, byTit[t], badgeClass)).join('');

    return `<div class="p-3 max-w-md max-h-96 overflow-auto">${sections}</div>`;
  };

  const buildPensionPopup  = (rcwListStr) => buildRcwPopup(rcwListStr, { emptyMessage: 'No pension RCWs',  badgeClass: 'badge-secondary' });
  const buildAdjacentPopup = (rcwListStr) => buildRcwPopup(rcwListStr, { emptyMessage: 'No adjacent RCWs', badgeClass: 'badge-warning' });

  const buildChapterPopup = (chapter, rcwListStr) => {
    const rcwList = (rcwListStr || '').split('|').filter(Boolean).filter(r => r.startsWith(chapter + '.'));
    if (!rcwList.length) return `<div class="p-3 text-base-content/50">No sections in ${chapter}</div>`;

    const chInfo = byCite?.[chapter];
    const chName = chInfo?.Name || byChapter?.[chapter]?.Description || '';
    const chMeta = getChapterLabel(chapter);
    const chBadge = chMeta ? `<span class="badge badge-xs badge-secondary ml-1">${chMeta.label}</span>` : '';

    const sectionHtml = rcwList
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map(rcw => {
        const secInfo = byCite?.[rcw];
        const secName = secInfo?.Name || '';
        const special = PENSION_MAP.special[rcw];
        const badge = special ? `<span class="badge badge-xs badge-primary ml-1">${special}</span>` : '';
        return `<div class="py-0.5">
                <a href="${rcwUrl(rcw)}" target="_blank" class="link link-primary">${rcw}</a>
                <span class="text-base-content/60 text-sm">${secName}</span>${badge}
            </div>`;
      }).join('');

    return `<div class="p-3 max-w-md max-h-96 overflow-auto">
        <div class="font-bold border-b border-base-300 pb-1 mb-2">
            <a href="${rcwUrl(chapter)}" target="_blank" class="link">${chapter}</a>
            <span class="text-base-content/80">${chName}</span>${chBadge}
        </div>
        ${sectionHtml}
    </div>`;
  };

  const buildTitlePopup = (title, rcwListStr) => {
    const rcwList = (rcwListStr || '').split('|').filter(Boolean).filter(r => r.split('.')[0] === title);
    if (!rcwList.length) return `<div class="p-3 text-base-content/50">No RCWs in Title ${title}</div>`;
    return buildTitleBlock(title, rcwList);
  };

  window.wsl = {
    BIENNIUM, dbKey, loadStore, saveStore,
    URLS: core.URLS, PENSION_MAP,
    classifyPensionBill: core.classifyPensionBill,
    consolidate: core.consolidate,
    getBillNumber: core.getBillNumber,
    groupWithCompanions: core.groupWithCompanions,
    parseLegislationXml, parsePrefilesXml, parseSponsorsXml,
    parseRcwXml, parseHistoryXml, parseActionsXml,
    getLegislation, getPrefiles, getSponsors, getRcwFor, getActionsFor, getHistoryFor,
    preload, getChapterInfo, getTitleInfo, getCiteInfo,
    linkifyList, linkifyTitles, chapterTooltip, titleTooltip,
    buildRcwPopup, buildPensionPopup, buildAdjacentPopup, buildChapterPopup, buildTitlePopup
  };
})();
