// lib/kits/wsl-core.js — dependency-free WSL core: the XML→record parsers
// (as a factory), pension classification, and the pure list/group helpers.
//
// This is a classic kit body (registers a global, no import/export), with ONE
// twist: it takes its XML libraries through `makeParsers({ XMLParser, flatten })`
// instead of importing them. Because it imports nothing, the SAME file runs in
// both environments that need the logic:
//   • browser — `gh.load('kits/wsl-core.js')`, then the wsl.js kit injects the
//     CDN builds of fast-xml-parser/flat;
//   • Node    — `new Function('gh', src)({})` in fetch-data.mjs, injecting the
//     npm builds. (No source rewrite — that hack is gone.)
//
// Registers `globalThis.wslCore`. pension-map.js folded in here.

;(() => {
  const BASE = 'https://wslwebservices.leg.wa.gov';

  // URL builders — separate from fetchers so paste-mode can show a relative
  // variant (no host) for snippets executed on the wslwebservices domain.
  const URLS = {
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

  const ABBR = {
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

  const sanitize = v => {
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

  const consolidate = (recs, pk = 'BillId') => {
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

  const getBillNumber = (b) => b?.BillNumber || b?.BillId?.match(/\d+/)?.[0];

  const groupWithCompanions = (bills) => {
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

  // --- Pension classification (was pension-map.js) ------------------------
  const PENSION_MAP = {
    systems: {
      "JRS":   { ch: "2.10",  name: "Judges 1971-1988" },
      "JRF":   { ch: "2.12",  name: "Judges pre-1971" },
      "JRA":   { ch: "2.14",  name: "Judicial DC 1988-2007" },
      "LEOFF": { ch: "41.26", name: "Law Enforcement & Fire Fighters", plans: { "1": [40, 160], "2": [400, 560] } },
      "TRS":   { ch: "41.32", name: "Teachers",            plans: { "1": [240, 530], "2": [700, 830], "3": [831, 920] } },
      "SERS":  { ch: "41.35", name: "School Employees",    plans: { "2": [30, 299],  "3": [500, 650] } },
      "PSERS": { ch: "41.37", name: "Public Safety Employees" },
      "PERS":  { ch: "41.40", name: "Public Employees",    plans: { "1": [120, 370], "2": [600, 780], "3": [780, 920] } },
      "WSPRS": { ch: "43.43", name: "State Patrol", rcws: [120, 320], plans: { "1": [120, 200], "2": [200, 320] } }
    },
    general: {
      "41.34": "Plan 3 DC", "41.45": "Funding", "41.50": "DRS", "41.54": "Portability"
    },
    governance: {
      "41.04": { label: "SCPP", rcws: [276, 278, 281] },
      "43.33A": "WSIB",
      "44.44":  "OSA / SCPP"
    },
    adjacent: {
      "6.15":   "Exempt",
      "26.16":  "Marital",
      "26.18":  "Support",
      "41.28":  "Local fire",
      "41.44":  "Local city",
      "51.08":  "L&I defs",
      "51.32":  "L&I ben",
      "74.20A": "DCS"
    },
    special: {
      "41.40.124": "Judicial Multiplier",
      "41.40.761": "Judicial Multiplier P2",
      "41.45.0631": "WSPRS Rates",
      "41.50.770": "DCP",
      "41.50.780": "DCP Accounts",
      "41.26.130": "Disability Offset",
      "41.26.470": "Disability Offset",
      "41.37.230": "Disability Offset",
      "41.40.038": "L&I Service Credit",
      "41.37.060": "L&I Service Credit",
      "41.26.473": "L&I Service Credit",
      "41.26.048": "Line of Duty Death"
    }
  };

  const inRange = (sec, r) => !r || (r.length === 2 ? +sec >= r[0] && +sec <= r[1] : r.includes(+sec));

  const findInMap = (ch, sec) => {
    const full = sec ? `${ch}.${sec}` : ch, m = [];
    if (PENSION_MAP.special[full]) m.push({ cat: 'system', label: PENSION_MAP.special[full], rcw: full });

    Object.entries(PENSION_MAP.systems).forEach(([sys, d]) => {
      if (d.ch !== ch || !inRange(sec, d.rcws)) return;
      const plan = sec && d.plans && Object.entries(d.plans).find(([, r]) => +sec >= r[0] && +sec <= r[1]);
      m.push({ cat: 'system', sys, plan: plan?.[0] || null, rcw: full });
    });

    if (PENSION_MAP.general[ch]) m.push({ cat: 'general', label: PENSION_MAP.general[ch], rcw: full });
    const g = PENSION_MAP.governance[ch];
    if (g && (typeof g === 'string' ? true : inRange(sec, g.rcws))) m.push({ cat: 'governance', label: g.label || g, rcw: full });
    if (PENSION_MAP.adjacent[ch]) m.push({ cat: 'adjacent', label: PENSION_MAP.adjacent[ch], rcw: ch });

    return m;
  };

  const classifyPensionBill = (rcwList = []) => {
    const pension = [], adjacent = [], rcwsP = [], rcwsA = [];

    rcwList.forEach(cite => {
      const parts = cite.split('.');
      const ch = parts.slice(0, 2).join('.');
      const sec = parts[2] || null;

      findInMap(ch, sec).forEach(m => {
        if (['system', 'general', 'governance'].includes(m.cat)) {
          pension.push(m); rcwsP.push(cite);
        } else if (m.cat === 'adjacent') {
          adjacent.push(m.label); rcwsA.push(cite);
        }
      });
    });

    const sysStore = {}, otherLabels = [];
    pension.forEach(m => {
      if (m.sys) {
        sysStore[m.sys] = sysStore[m.sys] || { plans: new Set() };
        if (m.plan) sysStore[m.sys].plans.add(m.plan);
      } else { otherLabels.push(m.label); }
    });

    const sysLabels = Object.entries(sysStore).map(([sys, d]) => {
      const plans = [...d.plans].sort();
      return plans.length ? `${sys} ${plans.join('/')}` : sys;
    });

    return {
      PensionLabels:  [...new Set([...sysLabels, ...otherLabels])].sort(),
      PensionRcws:    [...new Set(rcwsP)].sort(),
      AdjacentLabels: [...new Set(adjacent)].sort(),
      AdjacentRcws:   [...new Set(rcwsA)].sort(),
      hasPension:     pension.length > 0,
      hasAdjacent:    adjacent.length > 0
    };
  };

  // --- Parser factory: inject XMLParser + flatten -------------------------
  const makeParsers = ({ XMLParser, flatten }) => {
    const parser = new XMLParser({
      ignoreNameSpace: true,
      parseAttributeValue: true,
      isArray: (name) => ['RcwCiteAffected','LegislationInfo','CommitteeAction','CommitteeReferral','LegislativeStatus','CommitteeRecommendation'].includes(name)
    });

    const parseXml = (xmlText) => parser.parse(xmlText);

    const transform = r => {
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

    const parseSponsorsXml = (xmlText) => {
      const parsed = parseXml(xmlText);
      const arr = findArray(parsed) || [parsed];
      return arr.map(transform).filter(Boolean);
    };

    const parseRcwXml = (xmlText, billId) => {
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

    const parseActionsXml = (xmlText, billNumber) => {
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

    const parseHistoryXml = (xmlText, billNumber) => {
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

    return {
      parseXml, transform,
      parseLegislationXml: parseBillList,
      parsePrefilesXml:    parseBillList,
      parseSponsorsXml, parseRcwXml, parseActionsXml, parseHistoryXml
    };
  };

  const root = (typeof window !== 'undefined' ? window : globalThis);
  root.wslCore = {
    BASE, URLS, ABBR, sanitize,
    PENSION_MAP, classifyPensionBill,
    consolidate, findArray, getBillNumber, groupWithCompanions,
    makeParsers
  };
})();
