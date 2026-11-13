import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const dom = new JSDOM('<main></main>',{runScripts:'outside-only'});
const {window} = dom, doc = window.document;
window.assistantMark = {svg:provider => `<svg data-assistant-mark="${provider}" aria-hidden="true"></svg>`};
window.eval(readFileSync(new URL('../shared/recent-usage.js',import.meta.url),'utf8'));
const U = window.NowRecentUsage, now = Date.parse('2026-11-13T22:00:00Z'), minute = 60000;
const iso = at => new Date(at).toISOString();
const item = (id,extra = {}) => ({key:'claude',id,identity:id,kind:'cloud',title:'Session ' + id,at:now-5*minute,place:'cloud',...extra});
const usage = (id,contextTokens,extra = {}) => ({provider:'claude',id,contextTokens,usageAt:iso(now-6*minute),...extra});
const select = (items,sessions = [],options = {}) => U.select(items,{sessions,observedAt:iso(now)}, {now,...options});
let checks = 0;
const check = (condition,message) => { assert.ok(condition,message); checks++; };
const render = (rows,options = {}) => { doc.querySelector('main').innerHTML = U.render(rows,{now,...options}); };

let rows = select([item('record'),item('alias',{sessionUrl:'https://claude.ai/code/session_agent'}),item('record',{key:'codex',identity:'codex-record'})],
  [usage('record',400000),usage('other',250000,{agentSessionId:'session_agent'})]);
check(rows.length === 3 && rows[0].contextTokens === 400000 && rows[1].contextTokens === 250000 && rows[2].contextTokens === null,
  'Record IDs and provider session URLs join usage without attributing Claude readings to another assistant.');
rows = select([item('record',{sessionUrl:'https://claude.ai/code/session_agent'})],
  [usage('record',100000),usage('other',900000,{agentSessionId:'session_agent',usageAt:iso(now-minute)})]);
check(rows[0].contextTokens === 100000,'An exact record match takes precedence over an unrelated session-link match.');
rows = select([item('record'),item('session_agent',{sessionUrl:'https://claude.ai/code/session_agent'}),
  item('record',{identity:'laptop-record',kind:'session',place:'laptop'})],
  [usage('record',400000),usage('alias-record',250000,{agentSessionId:'session_agent'}),
    usage('outside-feed',600000,{title:'Indexed title',sessionUrl:'https://claude.ai/code/session_outside'}),
    usage('old-metadata',900000,{usageAt:iso(now-2*60*minute)}),usage('unknown-metadata',null)]);
check(rows.length === 4 && rows[0].identity === 'cloud:outside-feed' && rows[0].title === 'Indexed title'
  && rows[0].at === now-6*minute && rows[0].url.endsWith('session=outside-feed') && rows[0].sessionUrl.endsWith('session_outside')
  && rows.filter(row => row.kind === 'cloud' && row.usage?.id === 'record').length === 1,
  'Recent measured metadata fills gaps in a bounded activity feed, while record and agent joins avoid duplicate cloud rows and preserve laptop work.');
rows = select([item('record',{at:now-10*minute}),item('session_agent',{at:now-minute,sessionUrl:'https://claude.ai/code/session_agent'})],
  [usage('record',400000,{agentSessionId:'session_agent'})]);
check(rows.length === 1 && rows[0].id === 'session_agent','Multiple cloud activity identities for the same measured session retain the latest activity row.');
rows = select([],[usage('old-copy',900000,{agentSessionId:'session_copied',usageAt:iso(now-20*minute)}),
  usage('current-copy',200000,{agentSessionId:'https://claude.ai/code/session_copied',usageAt:iso(now-minute)})]);
check(rows.length === 1 && rows[0].id === 'current-copy' && rows[0].contextTokens === 200000,
  'Metadata aliases retain the most recent measured session, rather than an older copy with a larger context.');

rows = select([item('old',{at:now-2*60*minute}),item('boundary',{at:now-60*minute}),item('too-old',{at:now-60*minute-1}),
  item('future',{at:now+1}),item('errand',{kind:'errand'}),item('invalid',{at:NaN})],
  [usage('old',300000,{usageAt:iso(now-minute)})]);
check(rows.length === 2 && rows[0].id === 'old' && rows[0].activityAt === now-minute && rows[1].id === 'boundary',
  'Actual recent usage can qualify an older session; the hour boundary is inclusive, while errands and invalid or future-only activity are excluded.');
check(select([item('day',{at:now-23*60*minute})],[],{hours:24}).length === 1 && select([item('day',{at:now-25*60*minute})],[],{hours:24}).length === 0,
  'The 24-hour window includes older daily activity without admitting sessions outside that window.');
rows = select([item('recent')],[usage('recent',700000,{usageAt:iso(now+minute)})]);
check(rows.length === 1 && rows[0].contextTokens === null && rows[0].usageAt === null,'A future usage record cannot supply a context value to otherwise recent activity.');
check(select([item('bad-date',{at:NaN})],[usage('bad-date',123,{usageAt:'2026-02-30T12:00:00Z'})]).length === 0,
  'An impossible calendar date cannot establish activity.');

rows = select([item('older',{identity:'same',at:now-10*minute,title:'Earlier title'}),item('newer',{identity:'same',at:now-minute,title:'Latest title'}),
  item('cloud',{identity:'same',kind:'session',place:'laptop'})]);
check(rows.length === 2 && rows.some(row => row.title === 'Latest title') && !rows.some(row => row.title === 'Earlier title'),
  'Repeated identities retain the latest activity while cloud and laptop sessions remain separate.');
rows = select([item('invalid'),item('zero'),item('known'),item('unknown',{at:now})],
  [usage('invalid','800000'),usage('zero',0),usage('known',123456,{inputTokens:-1,outputTokens:Infinity,cacheReadTokens:2.5,cacheWriteTokens:8})]);
check(rows.map(row => row.id).join(',') === 'known,zero,unknown,invalid' && rows[0].usage.inputTokens === null && rows[0].usage.outputTokens === null
  && rows[0].usage.cacheReadTokens === null && rows[0].usage.cacheWriteTokens === 8,
  'Known context sizes sort above unknown readings, zero remains measured, and malformed counters remain unknown.');
rows = select([item('latest')],[usage('latest',900000,{usageAt:iso(now-10*minute)}),usage('latest',200000,{usageAt:iso(now-minute)})]);
check(rows[0].contextTokens === 200000,'The latest usage reading wins when context decreases after compaction.');
rows = select(Array.from({length:30},(_,n) => item('bounded-' + n)),Array.from({length:30},(_,n) => usage('bounded-' + n,n*1000)));
check(rows.length === 24 && rows[0].contextTokens === 29000 && rows.at(-1).contextTokens === 6000,'The list is bounded after sorting, so the largest recent contexts survive the cap.');
const frozenItem = Object.freeze(item('immutable')), frozenUsage = Object.freeze(usage('immutable',123));
check(select(Object.freeze([frozenItem]),Object.freeze([frozenUsage]))[0].contextTokens === 123,'Selection accepts immutable input without modifying session or usage snapshots.');

const hostile = `A <img src=x onerror="alert(1)"> & 'session'`;
rows = select([item('safe',{identity:'safe" data-injected="yes',title:hostile})],
  [usage('safe',354031,{usageAt:iso(now-2*60*minute),inputTokens:12,outputTokens:34,cacheReadTokens:56,cacheWriteTokens:78,measuredSteps:3,reloads:1})]);
render(rows);
check(doc.querySelector('.nru-title').textContent === hostile && !doc.querySelector('img') && !doc.querySelector('[data-injected]'),
  'Titles and action identifiers render as text, rather than becoming markup or attributes.');
check(doc.querySelector('[data-recent-usage-detail]').dataset.recentUsageDetail === rows[0].identity && doc.querySelector('[data-recent-session-actions]').dataset.recentSessionActions === rows[0].identity,
  'Metric and session-action controls expose the original identity for delegated events.');
check(doc.querySelector('[data-assistant-mark=claude]') && doc.querySelector('.nru-value').textContent === '354k' && doc.querySelector('.nru-meta').textContent.includes('Context 2h ago'),
  'A known context renders with the shared provider mark and a separate age when the context reading predates activity.');
check(doc.querySelector('[data-recent-hours="1"]').getAttribute('aria-pressed') === 'true' && doc.querySelector('[data-recent-usage-info]').getAttribute('aria-label'),
  'The time-window control and information button have accessible labels and current state.');
check(!doc.querySelector('.nru').textContent.includes('%') && !/cache|warm/i.test(doc.querySelector('.nru-list').textContent),
  'The list face shows context without suggesting a cache hit rate or cache availability.');
doc.querySelector('main').innerHTML = U.detail(rows[0],{now});
check(doc.body.textContent.includes('All recorded calls') && doc.body.textContent.includes('rather than only the selected time window')
  && doc.body.textContent.includes('354,031') && doc.body.textContent.includes('78') && !doc.body.textContent.includes('NaN'),
  'Details distinguish dated input context from token sums over all recorded calls.');
render(select([item('unknown-context')]),{hours:24});
check(doc.querySelector('[data-unknown]') && doc.querySelector('[data-recent-usage-detail]').getAttribute('aria-label').includes('Context not recorded')
  && doc.querySelector('[data-recent-hours="24"]').getAttribute('aria-pressed') === 'true','Missing context stays explicitly unknown when switching the time window.');
render([]);
check(doc.querySelector('section[aria-label="Recent sessions"]') && doc.querySelector('.nru-empty').textContent.includes('past hour')
  && doc.querySelectorAll('[data-recent-hours]').length === 2,'An empty list retains its labelled section and both time-window controls.');
check(doc.querySelectorAll('#now-recent-usage-style').length === 1,'Repeated rendering keeps one shared component stylesheet.');

console.log(`${checks} recent session usage checks passed.`);
dom.window.close();
