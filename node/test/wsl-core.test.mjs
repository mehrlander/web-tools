// kits/wsl-core.js — the dependency-free WSL core. Pure helpers run as-is;
// makeParsers gets the npm fast-xml-parser/flat builds injected, exactly as
// pages/wsl-sync/fetch-data.mjs does in the Action.

import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser } from 'fast-xml-parser';
import { flatten } from 'flat';
import { loadKit } from './bootstrap.mjs';

const { wslCore } = loadKit('wsl-core');

// ---- pure helpers ----------------------------------------------------

test('sanitize: booleans to 1/0, ISO dates to M/D/YYYY, sentinels to null', () => {
  assert.equal(wslCore.sanitize(true), '1');
  assert.equal(wslCore.sanitize('false'), '0');
  assert.equal(wslCore.sanitize('2025-01-14T00:00:00'), '1/14/2025');
  assert.equal(wslCore.sanitize('0001-01-01T00:00:00'), null);
  assert.equal(wslCore.sanitize('   '), null);
  assert.equal(wslCore.sanitize(null), null);
  assert.equal(wslCore.sanitize('Sine Die'), 'Sine Die');
});

test('URLS build absolute by default, relative on request', () => {
  assert.ok(wslCore.URLS.legislation('1/1/2025')
    .startsWith('https://wslwebservices.leg.wa.gov/LegislationService.asmx'));
  assert.ok(wslCore.URLS.sponsors('2025-26', { relative: true })
    .startsWith('/SponsorService.asmx'));
  assert.ok(wslCore.URLS.rcwFor(1234).includes('biennium=2025-26&billId=1234'));
});

test('consolidate merges records sharing a primary key, pipe-joining conflicts', () => {
  const out = wslCore.consolidate([
    { BillId: 'HB 1000', Status: 'IntroducedFirst', Sponsor: 'A' },
    { BillId: 'HB 1000', Status: 'PassedHouse', Sponsor: 'A' },
    { BillId: 'HB 2000', Status: 'IntroducedFirst' },
  ]);
  const merged = out.find(r => r.BillId === 'HB 1000');
  assert.equal(merged.PK_Count, '2');
  assert.equal(merged.Status, 'IntroducedFirst|PassedHouse'); // sorted join
  assert.equal(merged.Sponsor, 'A');                          // identical values collapse
  assert.equal(out.find(r => r.BillId === 'HB 2000').PK_Count, '1');
});

test('findArray digs out the first array anywhere in a parsed tree', () => {
  assert.deepEqual(wslCore.findArray({ a: { b: { c: [1, 2] } } }), [1, 2]);
  assert.equal(wslCore.findArray({ a: 1 }), null);
});

test('getBillNumber falls back from BillNumber to digits in BillId', () => {
  assert.equal(wslCore.getBillNumber({ BillNumber: '1000' }), '1000');
  assert.equal(wslCore.getBillNumber({ BillId: 'SHB 1234' }), '1234');
});

test('groupWithCompanions links a bill to its companion by c.BillId', () => {
  const groups = wslCore.groupWithCompanions([
    { BillNumber: '1000', 'c.BillId': 'SB 5000' },
    { BillNumber: '5000' },
    { BillNumber: '1111' },
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].numbers, ['1000', '5000']);
  assert.equal(groups[0].bills.length, 2);
  assert.deepEqual(groups[1].numbers, ['1111']);
});

// ---- pension classification ------------------------------------------

test('classifyPensionBill: system chapters resolve to system + plan labels', () => {
  const r = wslCore.classifyPensionBill(['41.26.048', '41.40.010', '6.15.010']);
  assert.equal(r.hasPension, true);
  assert.equal(r.hasAdjacent, true);
  // 41.26.048: LEOFF plan-1 range AND the Line of Duty Death special.
  // 41.40.010: PERS chapter, section outside every plan range → bare PERS.
  assert.deepEqual(r.PensionLabels, ['LEOFF 1', 'Line of Duty Death', 'PERS']);
  assert.deepEqual(r.PensionRcws, ['41.26.048', '41.40.010']);
  assert.deepEqual(r.AdjacentLabels, ['Exempt']);
  assert.deepEqual(r.AdjacentRcws, ['6.15.010']);
});

test('classifyPensionBill: governance rcw lists gate by section; non-pension is empty', () => {
  assert.equal(wslCore.classifyPensionBill(['41.04.276']).PensionLabels[0], 'SCPP');
  assert.equal(wslCore.classifyPensionBill(['41.04.999']).hasPension, false);
  const none = wslCore.classifyPensionBill(['18.20.010']);
  assert.deepEqual(none, {
    PensionLabels: [], PensionRcws: [], AdjacentLabels: [], AdjacentRcws: [],
    hasPension: false, hasAdjacent: false,
  });
});

// ---- makeParsers with the real XML libs -------------------------------

const parsers = wslCore.makeParsers({ XMLParser, flatten });

const LEGISLATION_XML = `<?xml version="1.0" encoding="utf-8"?>
<ArrayOfLegislationInfo xmlns="http://WSLWebServices.leg.wa.gov/">
  <LegislationInfo>
    <Biennium>2025-26</Biennium>
    <BillId>HB 1000</BillId>
    <BillNumber>1000</BillNumber>
    <ShortLegislationType>
      <ShortLegislationType>B</ShortLegislationType>
      <LongLegislationType>Bill</LongLegislationType>
    </ShortLegislationType>
    <IntroducedDate>2025-01-14T00:00:00</IntroducedDate>
    <Active>true</Active>
    <CurrentStatus>
      <BillId>HB 1000</BillId>
      <ActionDate>2025-02-01T00:00:00</ActionDate>
      <Status>HRules</Status>
      <AmendedByOppositeBody>false</AmendedByOppositeBody>
    </CurrentStatus>
    <RequestedByGovernor>true</RequestedByGovernor>
    <RequestedByOther>false</RequestedByOther>
  </LegislationInfo>
  <LegislationInfo>
    <Biennium>2025-26</Biennium>
    <BillId>HR 4600</BillId>
    <BillNumber>4600</BillNumber>
    <ShortLegislationType>
      <ShortLegislationType>R</ShortLegislationType>
      <LongLegislationType>Resolution</LongLegislationType>
    </ShortLegislationType>
    <Active>true</Active>
  </LegislationInfo>
</ArrayOfLegislationInfo>`;

test('parseLegislationXml keeps only type-B records and flattens/abbreviates keys', () => {
  const bills = parsers.parseLegislationXml(LEGISLATION_XML);
  assert.equal(bills.length, 1, 'the resolution is filtered out');
  const b = bills[0];
  assert.equal(b.BillId, 'HB 1000');
  assert.equal(b.IntroducedDate, '1/14/2025');       // sanitize ran
  assert.equal(b.Active, '1');                       // boolean → '1'
  assert.equal(b['cs.Status'], 'HRules');            // CurrentStatus. → cs.
  assert.equal(b['cs.ActionDate'], '2/1/2025');
  assert.equal(b['cs.AmendedByOppositeBody'], '0');
  assert.equal(b.RequestedBy, 'Governor');           // only the true flags
  assert.ok(!('RequestedByGovernor' in b));
  assert.ok(!Object.keys(b).some(k => k.includes('LegislationType')));
});

test('parseRcwXml classifies the cited RCWs into the snapshot row shape', () => {
  const xml = `<?xml version="1.0"?>
  <ArrayOfRcwCiteAffected xmlns="http://WSLWebServices.leg.wa.gov/">
    <RcwCiteAffected><RcwCite>41.40.010</RcwCite></RcwCiteAffected>
    <RcwCiteAffected><RcwCite>6.15.010</RcwCite></RcwCiteAffected>
  </ArrayOfRcwCiteAffected>`;
  const row = parsers.parseRcwXml(xml, 'HB 1000');
  assert.equal(row.BillId, 'HB 1000');
  assert.equal(row.Rcws, '41.40.010|6.15.010');
  assert.equal(row.PensionLabels, 'PERS');
  assert.equal(row.AdjacentLabels, 'Exempt');
  assert.equal(row.isPension, '1');
});

test('parseRcwXml with no cites reports "none" and not-pension', () => {
  const row = parsers.parseRcwXml('<ArrayOfRcwCiteAffected/>', 'HB 2000');
  assert.equal(row.Rcws, 'none');
  assert.equal(row.isPension, '0');
});

test('parseHistoryXml maps status changes onto flat rows', () => {
  const xml = `<?xml version="1.0"?>
  <ArrayOfLegislativeStatus xmlns="http://WSLWebServices.leg.wa.gov/">
    <LegislativeStatus>
      <BillId>HB 1000</BillId>
      <ActionDate>2025-01-14T00:00:00</ActionDate>
      <HistoryLine>First reading.</HistoryLine>
      <Status>Intro</Status>
      <AmendmentsExist>false</AmendmentsExist>
    </LegislativeStatus>
  </ArrayOfLegislativeStatus>`;
  const rows = parsers.parseHistoryXml(xml, '1000');
  assert.deepEqual(rows, [{
    BillNumber: '1000', BillId: 'HB 1000', ActionDate: '1/14/2025',
    HistoryLine: 'First reading.', Status: 'Intro', AmendmentsExist: '0',
  }]);
});

test('parseActionsXml flattens committee actions and recommendations', () => {
  const xml = `<?xml version="1.0"?>
  <ArrayOfCommitteeAction xmlns="http://WSLWebServices.leg.wa.gov/">
    <CommitteeAction>
      <AgendaId>99</AgendaId>
      <HearingDate>2025-01-20T00:00:00</HearingDate>
      <LegislationInfo><BillId>HB 1000</BillId><DisplayNumber>1000</DisplayNumber></LegislationInfo>
      <Committee><Acronym>APP</Acronym><LongName>Appropriations</LongName><Agency>House</Agency></Committee>
      <CommitteeRecommendations>
        <CommitteeRecommendation>
          <RecommendationType>Majority</RecommendationType>
          <Recommendation>DP</Recommendation>
          <LongRecommendation>Do pass.</LongRecommendation>
          <MembersSigned>20</MembersSigned>
        </CommitteeRecommendation>
      </CommitteeRecommendations>
    </CommitteeAction>
  </ArrayOfCommitteeAction>`;
  const rows = parsers.parseActionsXml(xml, '1000');
  assert.equal(rows.length, 1);
  const a = rows[0];
  assert.equal(a.AgendaId, '99');
  assert.equal(a.HearingDate, '1/20/2025');
  assert.equal(a.Committee, 'APP');
  assert.equal(a.CommitteeLong, 'Appropriations');
  assert.equal(a['r.MajorityCode'], 'DP');
  assert.equal(a['r.MajoritySigned'], 20);
  assert.equal(a.ReferredTo, null);
});
