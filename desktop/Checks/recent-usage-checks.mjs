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

let rows = select([item('record'),item('alias',{sessionUrl:'https://claude.ai/code/session_agent'}),
  item('record',{key:'codex',identity:'codex-record'}),item('gemini',{key:'gemini'})],
  [usage('record',400000),usage('other',250000,{agentSessionId:'session_agent'}),usage('gemini',900000,{provider:'gemini'})]);
check(rows.length === 2 && rows[0].contextTokens === 400000 && rows[1].contextTokens === 250000 && rows.every(row => row.key === 'claude'),
  'Record IDs and Claude session URLs join usage, while Codex and Gemini stay outside the Claude list.');
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
check(select([item('day',{at:now-23*60*minute}),item('just-outside',{at:now-60*minute-1})],
  [usage('measured-day',900000,{usageAt:iso(now-2*60*minute)})],{hours:24}).length === 0,
  'The preceding-hour scope remains fixed even when a caller passes the removed 24-hour option.');
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
  'Titles and session identifiers render as text, rather than becoming markup or attributes.');
let link = doc.querySelector('a.nru-row'), destination = new URLSearchParams(link.getAttribute('href').slice(1));
check(link.dataset.recentSession === rows[0].identity && link.getAttribute('href') === '#view=now&session=' + encodeURIComponent(rows[0].identity)
  && destination.get('view') === 'now' && destination.get('session') === rows[0].identity
  && !link.hasAttribute('target') && !link.hasAttribute('rel'),
  'A compact cloud row navigates to the exact encoded session identity in this app\'s Now view.');
const heading = doc.querySelector('section[aria-label="Claude one-hour cache window"]');
const explanation = [heading?.getAttribute('title'),heading?.querySelector('header')?.getAttribute('title'),heading?.querySelector('h2')?.getAttribute('title')].filter(Boolean).join(' ');
check(heading?.querySelector('h2').textContent === 'Claude · 1h cache window' && heading.querySelector('header').textContent.includes('Context')
  && /hour/i.test(explanation) && /cache/i.test(explanation) && /not|cannot|unconfirmed|doesn.t/i.test(explanation),
  'The fixed Claude heading labels input context and explains that past-hour activity does not establish cache availability.');
check(doc.querySelector('.nru-value').textContent === '354k' && !doc.querySelector('.nru-meta') && !link.querySelector('svg,[data-assistant-mark]')
  && !/ago|updated|warm|%/i.test(link.textContent),
  'Each row contains a compact context amount without provider icons, timestamps, or a cache-state claim.');
const titleStyle = window.getComputedStyle(doc.querySelector('.nru-title'));
check(titleStyle.whiteSpace === 'nowrap' && titleStyle.textOverflow === 'ellipsis' && titleStyle.overflow === 'hidden',
  'Long session titles stay on one line and use ellipsis within the available space.');
check(!doc.querySelector('.nru button,[data-recent-hours],[data-recent-usage-info],[data-recent-usage-detail],[data-recent-session-actions]') && typeof U.detail === 'undefined',
  'The list has no range selector, information button, metric detail, action menu, or detail-rendering API.');

const preferred = 'https://mehrlander.github.io/web-tools/app/?view=sessions&session=recorded-detail';
render(select([item('alternate-id',{identity:'cloud:alternate-id',url:preferred})]));
check(doc.querySelector('a.nru-row').getAttribute('href') === '#view=now&session=cloud%3Aalternate-id',
  'Even an existing external Web Tools detail URL stays within the current app and uses the feed identity.');
render(select([item('unsafe-code',{identity:'cloud:unsafe-code&view=files',url:'javascript:alert(1)'}),item('lookalike',{url:'https://mehrlander.github.io.evil.example/web-tools/app/?view=sessions&session=wrong'}),
  item('wrong-view',{url:'https://mehrlander.github.io/web-tools/app/?view=files&session=wrong'})]));
check([...doc.querySelectorAll('a.nru-row')].every(anchor => {
  const href = anchor.getAttribute('href'), route = new URLSearchParams(href.slice(1));
  return href === '#view=now&session=' + encodeURIComponent(anchor.dataset.recentSession)
    && route.get('view') === 'now' && route.get('session') === anchor.dataset.recentSession
    && [...route.keys()].join(',') === 'view,session' && !anchor.hasAttribute('target') && !anchor.hasAttribute('rel');
}), 'Hostile external URLs and route-like identity text cannot change the internal Now destination.');
render(select([item('local-safe',{identity:'session:Claude:local-safe',kind:'session',place:'laptop',sessionUrl:'https://claude.ai/code/session_LocalSafe'}),
  item('local-unsafe',{identity:'session:Claude:local-unsafe',kind:'session',place:'laptop',sessionUrl:'javascript:alert(1)'})]));
check([...doc.querySelectorAll('a.nru-row')].every(anchor => anchor.getAttribute('href') === '#view=now&session=' + encodeURIComponent(anchor.dataset.recentSession)),
  'Local Claude sessions use their full internal feed identities, independent of provider URLs.');
render(select([],[usage('metadata-only',123456)]));
check(doc.querySelector('a.nru-row').getAttribute('href') === '#view=now&session=cloud%3Ametadata-only',
  'A measured session absent from the bounded feed retains its synthesized cloud identity in the internal route.');
render(select([item('unknown-context')]),{hours:24});
check(/^[–—-]$/.test(doc.querySelector('.nru-value').textContent.trim()) && !/NaN|undefined|24h/.test(doc.querySelector('.nru').textContent),
  'Missing context remains an unknown dash, while the removed range option never appears.');
render([]);
check(doc.querySelector('section[aria-label="Claude one-hour cache window"]') && doc.querySelector('.nru-empty').textContent.includes('past hour')
  && !doc.querySelector('.nru a,.nru button'),'An empty list retains the Claude one-hour label without adding controls.');
check(doc.querySelectorAll('#now-recent-usage-style').length === 1,'Repeated rendering keeps one shared component stylesheet.');

console.log(`${checks} recent session usage checks passed.`);
dom.window.close();
