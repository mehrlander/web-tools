// wsl-api.js — WSL Web Services API helpers + RCW lookup/display utilities.
//
// Consolidates what used to live in legislation/tools/wsl-api-13.js and
// rcw/rcw-utils.js, and re-exports pension classification from pension-map.js.
// This lets the root-level HTML pages pull one helper module via same-directory
// ES import (works under GitHub Pages without build tooling).
//
// Two key design changes vs the previous split:
//   1. Pension map is no longer duplicated here — single source in pension-map.js.
//   2. URL builders are exported separately from fetchers, so wsl-sync.html
//      can offer a "paste-mode" fallback for browsers blocked by CORS.

import { XMLParser } from 'https://cdn.jsdelivr.net/npm/fast-xml-parser@4.5.1/+esm';
import { flatten } from 'https://cdn.jsdelivr.net/npm/flat@6.0.0/+esm';
export { PENSION_MAP, classifyPensionBill } from './pension-map.js';
import { PENSION_MAP, classifyPensionBill } from './pension-map.js';

// ============================================================================
// WSL SOAP ENDPOINTS
// ============================================================================

export const BASE = 'https://wslwebservices.leg.wa.gov';

// URL builders — exported so paste-mode can show them without fetching.
// Pass a relative variant (no host) when building console snippets that will
// be executed on the wslwebservices.leg.wa.gov domain itself.
export const URLS = {
    legislation: (sinceDate, { relative = false } = {}) =>
        `${relative ? '' : BASE}/LegislationService.asmx/GetLegislationIntroducedSince?sinceDate=${sinceDate}`,
    prefiles: ({ relative = false } = {}) =>
        `${relative ? '' : BASE}/LegislationService.asmx/GetPrefiledLegislation`,
    sponsors: (biennium, { relative = false } = {}) =>
        `${relative ? '' : BASE}/SponsorService.asmx/GetSponsors?biennium=${biennium}`,
    rcwFor: (billId, biennium = '2025-26', { relative = false } = {}) =>
        `${relative ? '' : BASE}/LegislationService.asmx/GetRcwCitesAffected?biennium=${biennium}&billId=${billId}`,
    actionsFor: (billNumber, biennium = '2025-26', { relative = false } = {}) =>
        `${relative ? '' : BASE}/CommitteeActionService.asmx/GetCommitteeExecutiveActionsByBill?biennium=${biennium}&billNumber=${billNumber}`,
    historyFor: (billNumber, biennium = '2025-26', beginDate = '1/1/2025', endDate = '12/31/2026', { relative = false } = {}) =>
        `${relative ? '' : BASE}/LegislationService.asmx/GetLegislativeStatusChangesByBillNumber?biennium=${biennium}&billNumber=${billNumber}&beginDate=${beginDate}&endDate=${endDate}`
};

const parser = new XMLParser({
    ignoreNameSpace: true,
    parseAttributeValue: true,
    isArray: (name) => ['RcwCiteAffected','LegislationInfo','CommitteeAction','CommitteeReferral','LegislativeStatus','CommitteeRecommendation'].includes(name)
});

export const ABBR = {
    'Companions.Companion.': 'c.',
    'CurrentStatus.':        'cs.',
    'RCW.':                  'r.'
};

const REQUESTED_BY_MAP = {
    'RequestedByGovernor':        'Governor',
    'RequestedByBudgetCommittee': 'BudgetCommittee',
    'RequestedByDepartment':      'Department',
    'RequestedByOther':           'Other'
};

export const sanitize = v => {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    let val = String(v).trim();
    if (val === 'true'  || v === true)  return '1';
    if (val === 'false' || v === false) return '0';
    if (val.startsWith('0001-01-01')) return null;
    const iso = val.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const [y, m, d] = iso.split('-');
        return `${+m}/${+d}/${y}`;
    }
    return val;
};

export const transform = r => {
    if (!r) return null;
    const f = flatten(r), out = {};
    const requestedByActive = [];

    for (let k in f) {
        let key = k.trim();
        if (['Companions', '', '\r', 'PK_Count'].includes(key) || key.includes('LegislationType')) continue;

        let val = sanitize(f[key]);
        if (val === null) continue;

        if (REQUESTED_BY_MAP[key]) {
            if (val === '1') requestedByActive.push(REQUESTED_BY_MAP[key]);
            continue;
        }

        Object.entries(ABBR).forEach(([long, short]) => {
            if (key.startsWith(long)) key = key.replace(long, short);
        });
        out[key] = val;
    }

    if (requestedByActive.length > 0) out['RequestedBy'] = requestedByActive.join(', ');
    return out;
};

export const consolidate = (recs, pk = 'BillId') => {
    const g = {};
    recs.forEach(r => { if (r?.[pk]) (g[r[pk]] = g[r[pk]] || []).push(r); });
    return Object.entries(g).map(([id, grp]) => {
        const res = grp.length === 1 ? { ...grp[0] } : { PK_Count: String(grp.length) };
        if (grp.length > 1) {
            const keys = [...new Set(grp.flatMap(Object.keys))];
            keys.forEach(k => {
                const v = [...new Set(grp.map(x => x[k]).filter(y => y != null))];
                res[k] = v.length > 1 ? v.sort().join('|') : v[0];
            });
        } else { res.PK_Count = '1'; }
        return res;
    });
};

const findArray = obj => {
    if (Array.isArray(obj)) return obj;
    if (obj && typeof obj === 'object') {
        for (const v of Object.values(obj)) {
            const found = findArray(v);
            if (found) return found;
        }
    }
    return null;
};

export const parseXml = (xmlText) => parser.parse(xmlText);

export const getBillNumber = (b) => b?.BillNumber || b?.BillId?.match(/\d+/)?.[0];

// ============================================================================
// XML-to-records parsers — paste-mode entry points (no network)
// ============================================================================

const parseBillList = (xmlText) => {
    const parsed = parseXml(xmlText);
    const arr = findArray(parsed) || [parsed];
    return arr
        .filter(item => {
            const type = item.ShortLegislationType?.ShortLegislationType ||
                         item.LegislationInfo?.ShortLegislationType?.ShortLegislationType;
            return type === 'B';
        })
        .map(transform)
        .filter(Boolean);
};

export const parseLegislationXml = parseBillList;
export const parsePrefilesXml    = parseBillList;

export const parseSponsorsXml = (xmlText) => {
    const parsed = parseXml(xmlText);
    const arr = findArray(parsed) || [parsed];
    return arr.map(transform).filter(Boolean);
};

export const parseRcwXml = (xmlText, billId) => {
    const parsed = parseXml(xmlText);
    const arr = findArray(parsed) || [parsed];
    const records = arr.map(transform).filter(Boolean);
    const rcws = records.map(r => r.RcwCite).filter(Boolean);
    const cats = classifyPensionBill(rcws);
    return {
        BillId: billId,
        Rcws: rcws.length ? rcws.join('|') : 'none',
        PensionLabels:  cats.PensionLabels.join('|'),
        AdjacentLabels: cats.AdjacentLabels.join('|'),
        PensionRcws:    cats.PensionRcws.join('|'),
        AdjacentRcws:   cats.AdjacentRcws.join('|'),
        isPension:      cats.hasPension ? '1' : '0'
    };
};

const flattenRecs = (recs = []) => {
    const out = {}, maj = recs.find(r => r.RecommendationType === 'Majority'), min = recs.find(r => r.RecommendationType === 'Minority');
    if (maj) { out['r.MajorityCode'] = maj.Recommendation; out['r.MajorityLong'] = maj.LongRecommendation; out['r.MajoritySigned'] = maj.MembersSigned; }
    if (min) { out['r.MinorityCode'] = min.Recommendation; out['r.MinorityLong'] = min.LongRecommendation; out['r.MinoritySigned'] = min.MembersSigned; }
    return out;
};

export const parseActionsXml = (xmlText, billNumber) => {
    const p = parseXml(xmlText);
    return (p.ArrayOfCommitteeAction?.CommitteeAction || []).map(a => ({
        BillNumber: billNumber,
        AgendaId:       String(a.AgendaId),
        HearingDate:    sanitize(a.HearingDate),
        BillId:         a.LegislationInfo?.BillId,
        DisplayNumber:  String(a.LegislationInfo?.DisplayNumber || ''),
        Committee:      a.Committee?.Acronym,
        CommitteeLong:  a.Committee?.LongName,
        Agency:         a.Committee?.Agency,
        ReferredTo:     a.ReferredToCommittee?.Acronym  || null,
        ReferredToLong: a.ReferredToCommittee?.LongName || null,
        ...flattenRecs(a.CommitteeRecommendations?.CommitteeRecommendation)
    }));
};

export const parseHistoryXml = (xmlText, billNumber) => {
    const p = parseXml(xmlText);
    return (p.ArrayOfLegislativeStatus?.LegislativeStatus || []).map(s => ({
        BillNumber: billNumber,
        BillId:          s.BillId,
        ActionDate:      sanitize(s.ActionDate),
        HistoryLine:     s.HistoryLine,
        Status:          s.Status,
        AmendmentsExist: s.AmendmentsExist ? '1' : '0'
    }));
};

// ============================================================================
// Fetch-and-parse wrappers — used when CORS allows direct fetch
// ============================================================================

export const getLegislation = async (sinceDate) =>
    parseLegislationXml(await (await fetch(URLS.legislation(sinceDate))).text());

export const getPrefiles = async () =>
    parsePrefilesXml(await (await fetch(URLS.prefiles())).text());

export const getSponsors = async (biennium) =>
    parseSponsorsXml(await (await fetch(URLS.sponsors(biennium))).text());

export const getRcwFor = async (b, biennium = '2025-26') => {
    const billId = b?.BillId || b;
    if (!billId) return null;
    return parseRcwXml(await (await fetch(URLS.rcwFor(billId, biennium))).text(), billId);
};

export const getActionsFor = async (b, biennium = '2025-26') => {
    const bn = getBillNumber(b);
    if (!bn) return [];
    return parseActionsXml(await (await fetch(URLS.actionsFor(bn, biennium))).text(), bn);
};

export const getHistoryFor = async (b, biennium = '2025-26', beginDate = '1/1/2025', endDate = '12/31/2026') => {
    const bn = getBillNumber(b);
    if (!bn) return [];
    return parseHistoryXml(await (await fetch(URLS.historyFor(bn, biennium, beginDate, endDate))).text(), bn);
};

// ============================================================================
// Bill grouping / joining helpers
// ============================================================================

export const groupWithCompanions = (bills) => {
    const byNumber = {};
    bills.forEach(b => {
        const num = b.BillNumber;
        if (!byNumber[num]) byNumber[num] = [];
        byNumber[num].push(b);
    });

    const groups = [], seen = new Set();

    Object.entries(byNumber).forEach(([num, bills]) => {
        if (seen.has(num)) return;
        seen.add(num);
        const group = { numbers: [num], bills: [...bills] };
        for (const b of bills) {
            const companionNum = b['c.BillId']?.replace(/[A-Z\s]/g, '');
            if (companionNum && byNumber[companionNum] && !seen.has(companionNum)) {
                seen.add(companionNum);
                group.numbers.push(companionNum);
                group.bills.push(...byNumber[companionNum]);
            }
        }
        groups.push(group);
    });

    return groups;
};

// ============================================================================
// RCW LOOKUPS (chapters, titles, full hierarchy)
// ============================================================================

const CHAPTERS_URL = './rcw/rcw-chapters.json';
const TITLES_URL   = './rcw/rcw-titles.json';
const FULL_URL     = './rcw/rcw-full.json';

let chapters = null, titles = null, full = null;
let byChapter = null, byTitle = null, byCite = null;

export const preload = async () => {
    if (chapters) return;
    [chapters, titles, full] = await Promise.all([
        fetch(CHAPTERS_URL).then(r => r.json()),
        fetch(TITLES_URL).then(r => r.json()),
        fetch(FULL_URL).then(r => r.json())
    ]);
    byChapter = Object.fromEntries(chapters.map(c => [c.Chapter, c]));
    byTitle   = Object.fromEntries(titles.map(t => [t.title.toUpperCase(), t]));
    byCite    = Object.fromEntries(full.map(f => [f.Cite, f]));
};

export const getChapterInfo = ch   => byChapter?.[ch];
export const getTitleInfo   = t    => byTitle?.[t.toUpperCase()];
export const getCiteInfo    = cite => byCite?.[cite];

// ============================================================================
// DISPLAY UTILITIES (linkify, tooltips, popups)
// ============================================================================

const rcwUrl = cite => `https://app.leg.wa.gov/RCW/default.aspx?cite=${cite}`;

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

export const linkifyList = (chapterStr, fullRcws) => {
    if (!chapterStr || !byChapter) return chapterStr || '';
    const byChap = groupByChapter(fullRcws);
    return chapterStr.split(', ').filter(Boolean).map(ch => {
        const info = byChapter[ch];
        const rcws = byChap[ch] || [];
        if (!info) return ch;
        return `<a href="${info.URL}" target="_blank" rel="noopener" class="link link-primary" data-chapter="${ch}" data-rcws="${rcws.join('|')}">${ch}</a>`;
    }).join(', ');
};

export const linkifyTitles = titleStr => {
    if (!titleStr || !byTitle) return titleStr || '';
    return titleStr.split(', ').filter(Boolean).map(t => {
        const info = byTitle[t.toUpperCase()];
        if (!info) return t;
        return `<a href="${rcwUrl(t)}" target="_blank" rel="noopener" class="link link-primary" data-title="${t}">${t}</a>`;
    }).join(', ');
};

export const chapterTooltip = (e) => {
    const ch = e.target?.dataset?.chapter;
    if (!ch) return;
    const info = byChapter?.[ch];
    if (!info) return ch;
    const rcws = (e.target?.dataset?.rcws || '').split('|').filter(Boolean);
    const sections = rcws.map(r => r.split('.').slice(2).join('.')).filter(Boolean).sort((a, b) => +a - +b);
    const detail = sections.length ? `\nSections: ${sections.join(', ')}` : '';
    return `${ch}: ${info.Description}${detail}`;
};

export const titleTooltip = (e) => {
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

export const buildRcwPopup = (rcwListStr, options = {}) => {
    const { emptyMessage = 'No RCWs', badgeClass = 'badge-secondary' } = options;
    const rcwList = (rcwListStr || '').split('|').filter(Boolean);
    if (!rcwList.length) return `<div class="p-3 text-base-content/50">${emptyMessage}</div>`;

    const byTit = groupByTitle(rcwList);
    const titleNums = Object.keys(byTit).sort((a, b) => +a - +b);
    const sections = titleNums.map(t => buildTitleBlock(t, byTit[t], badgeClass)).join('');

    return `<div class="p-3 max-w-md max-h-96 overflow-auto">${sections}</div>`;
};

export const buildPensionPopup  = (rcwListStr) => buildRcwPopup(rcwListStr, { emptyMessage: 'No pension RCWs',  badgeClass: 'badge-secondary' });
export const buildAdjacentPopup = (rcwListStr) => buildRcwPopup(rcwListStr, { emptyMessage: 'No adjacent RCWs', badgeClass: 'badge-warning' });

export const buildChapterPopup = (chapter, rcwListStr) => {
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

export const buildTitlePopup = (title, rcwListStr) => {
    const rcwList = (rcwListStr || '').split('|').filter(Boolean).filter(r => r.split('.')[0] === title);
    if (!rcwList.length) return `<div class="p-3 text-base-content/50">No RCWs in Title ${title}</div>`;
    return buildTitleBlock(title, rcwList);
};
