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

// The timer follows observed activity, not archive polling or confirmed cache expiry.
const timerRow = (age,extra = {}) => ({...item('timed'),activityAt:now-age,contextTokens:123456,...extra});
render([timerRow(0),timerRow(30*minute),timerRow(60*minute-1000),timerRow(60*minute)]);
let timed = [...doc.querySelectorAll('.nru-row')];
check(timed.map(row=>row.querySelector('.nru-time').textContent).join(',') === '60m,30m,1m,0m'
  && timed.map(row=>row.style.getPropertyValue('--nru-remaining')).join(',') === '100.000%,50.000%,0.028%,0.000%',
  'Remaining bars shrink from a full hour to zero, with positive partial minutes rounded up at the boundary.');
check(timed.every(row=>/minutes? left in the one-hour activity window since last observed activity/.test(row.getAttribute('aria-label')))
  && doc.querySelector('header .nru-column:last-child').textContent === 'Left'
  && !/cache expir|cache warm/i.test(timed[0].getAttribute('aria-label')),
  'Minutes are labeled as time remaining in the activity window, without asserting cache expiry.');
render([timerRow(60*minute+1),timerRow(-1),timerRow(0,{activityAt:NaN}),timerRow(0,{activityAt:null})]);
check(!doc.querySelector('.nru-row'),'Expired, future and invalid activity anchors do not receive bars or countdowns.');
rows = select([item('poll-independent',{at:now-40*minute})],
  [usage('poll-independent',123456,{usageAt:iso(now-2*60*minute)})]);
render(rows);
check(doc.querySelector('.nru-time').textContent === '20m' && doc.querySelector('.nru-value').textContent === '123.5k'
  && doc.querySelector('.nru-row').title.includes(new Date(now-2*60*minute).toLocaleString()),
  'A fresh archive poll does not reset the activity timer, and older context retains its own measured timestamp.');
render(rows,{now:now+15*minute});
check(doc.querySelector('.nru-time').textContent === '5m'
  && doc.querySelector('.nru-row').style.getPropertyValue('--nru-remaining') === '8.333%',
  'Rerendering a saved row advances the timer even when no new activity arrives.');
render([timerRow(30*minute,{contextTokens:null,activityAt:iso(now-30*minute)})]);
check(doc.querySelector('.nru-time').textContent === '30m' && doc.querySelector('.nru-value').hasAttribute('data-unknown'),
  'An ISO activity timestamp and unknown context still produce a valid activity timer.');
render([timerRow(0,{activityAt:'2026-11-01T01:40:00-07:00'})],{now:Date.parse('2026-11-01T01:10:00-08:00')});
check(doc.querySelector('.nru-time').textContent === '30m',
  'The countdown uses elapsed time across a daylight-saving clock change.');

// Now's token flair uses recorded Claude output, independently of the
// one-hour context list and independently of cumulative cached-input totals.
const snapshot = (sessions,extra = {}) => ({sessions,available:true,observedAt:iso(now),...extra});
const counted = usage('cloud-record',987654,{agentSessionId:'session_counted',inputTokens:10,outputTokens:3000,
  cacheReadTokens:20,cacheWriteTokens:30,measuredSteps:2,reloads:1,
  cache_creation:{ephemeral_1h_input_tokens:30},iterations:[{input_tokens:10,output_tokens:3000}],totalTokens:9999999});
const match = (source,records,extra = {}) => U.matchUsage(source,snapshot(records,extra),{now});
let measured = match(item('cloud-record'),[counted]);
check(measured?.outputTokens === 3000 && measured.totalTokens === 3060 && measured.contextTokens === 987654,
  'Usage matching sums the four disjoint recorded counters once, without adding context, nested cache splits, iterations, or a supplied total.');
check([
  item('cloud-record',{key:'codex'}),item('cloud-record',{key:'gemini'}),item('cloud-record',{kind:'errand'}),
  item('cloud-record',{kind:'session',place:'laptop'}),item('cloud-record',{kind:'cloud',place:'laptop'})
].every(source => match(source,[counted]) === null && U.tokenBadge(source,snapshot([counted]),{now}) === ''),
  'Recorded cloud usage is never attributed to another provider, an errand, or a laptop session that happens to share an ID.');
check(match(item('cloud-record',{place:''}),[counted])?.outputTokens === 3000,
  'A Claude cloud item remains matchable when its optional place field is empty.');
measured = match(item('cloud-record',{sessionUrl:'https://claude.ai/code/session_counted'}),
  [counted,usage('different-record',123,{agentSessionId:'session_counted',outputTokens:9000,usageAt:iso(now-minute)})]);
check(measured?.id === 'cloud-record' && measured.outputTokens === 3000,
  'An exact record match takes precedence over a newer agent-link alias when attaching token metadata.');
check(match(item('other-record',{sessionUrl:'https://claude.ai/code/session_counted'}),[counted])?.id === 'cloud-record'
  && match(item('session_counted'),[counted]) === null,
  'Agent fallback requires the full approved Claude session URL, rather than a bare provider ID or a similar record suffix.');
check(['http://claude.ai/code/session_counted','https://claude.ai.evil.example/code/session_counted',
  'https://user@claude.ai/code/session_counted','javascript:alert(1)','session_counted'].every(sessionUrl =>
  match(item('no-exact-match',{sessionUrl}),[counted]) === null),
  'Insecure, credential-bearing, lookalike, and non-URL agent references cannot attach another session\'s usage.');
check(match(item('11111111-other'),[usage('11111111',123,{outputTokens:3000})]) === null
  && match(item('cloud-record'),[{...counted,provider:'codex'}]) === null,
  'Usage matching does not join short prefixes or metadata from another provider.');
measured = match(item('cloud-record'),[{...counted,usageAt:iso(now-23*60*minute),outputTokens:1000},
  {...counted,usageAt:iso(now-minute),outputTokens:2000},{...counted,usageAt:iso(now+minute),outputTokens:9000}]);
check(measured?.outputTokens === 2000
  && match(item('cloud-record'),[{...counted,usageAt:iso(now-24*60*minute)}])?.outputTokens === 3000
  && match(item('cloud-record'),[{...counted,usageAt:iso(now-24*60*minute-1)}]) === null,
  'Token badges use the latest non-future reading within the inclusive 24-hour metadata window, independently of the context list\'s one-hour scope.');
check([{inputTokens:-1},{cacheReadTokens:'20'},{cacheWriteTokens:1.5},{outputTokens:Infinity},{inputTokens:true},
  {inputTokens:Number.MAX_SAFE_INTEGER,outputTokens:1}].every(change => match(item('cloud-record'),[{...counted,...change}])?.totalTokens === null),
  'Malformed, missing, or overflowing disjoint sums remain unknown rather than producing a misleading recorded total.');
measured = match(item('cloud-record'),[{...counted,inputTokens:undefined,cacheReadTokens:undefined,cacheWriteTokens:undefined,outputTokens:0}]);
check(measured?.outputTokens === 0 && measured.totalTokens === null,
  'A measured zero output is valid even when the other token counters are unavailable.');
measured = match(item('cloud-record'),[{...counted,inputTokens:0,cacheReadTokens:0,cacheWriteTokens:0,outputTokens:0}]);
check(measured?.totalTokens === 0,'Four explicitly measured zero counters produce a valid zero total.');

const badge = (source,records,extra = {}) => { doc.querySelector('main').innerHTML = U.tokenBadge(source,snapshot(records,extra),{now}); return doc.querySelector('.session-token-badge'); };
let tokenButton = badge(item('cloud-record'),[counted]);
let tokenLabel = (tokenButton?.getAttribute('aria-label') || '') + ' ' + (tokenButton?.getAttribute('title') || '');
check(tokenButton?.tagName === 'BUTTON' && tokenButton.dataset.sessionTokens === 'cloud-record'
  && tokenButton.querySelectorAll('svg').length === 1 && /3k/i.test(tokenButton.textContent)
  && /output tokens/i.test(tokenLabel) && /main.conversation/i.test(tokenLabel) && /recorded/i.test(tokenLabel),
  'The shared coin badge identifies compact output tokens from recorded main-conversation calls, rather than input context or total token traffic.');
check(!/[$%]/.test(tokenLabel) && !/current context|quota|warm|cache available/i.test(tokenLabel),
  'The output badge makes no claim about quota percentage, dollar cost, current context, or a reusable cache.');
tokenButton = badge(item('cloud-record'),[counted],{available:false});
tokenLabel = (tokenButton?.getAttribute('aria-label') || '') + ' ' + (tokenButton?.getAttribute('title') || '');
check(/saved reading/i.test(tokenLabel),'Unavailable metadata retains its measured output with an explicit saved-reading label.');
tokenButton = badge(item('cloud-record'),[{...counted,inputTokens:undefined,cacheReadTokens:undefined,cacheWriteTokens:undefined,outputTokens:0}]);
check(tokenButton && /\b0\b/.test(tokenButton.textContent),
  'The output badge retains a real zero measurement without requiring a complete session total.');
check([undefined,null,-1,'3000',Infinity].every(outputTokens => U.tokenBadge(item('cloud-record'),snapshot([{...counted,outputTokens}]),{now}) === ''),
  'Unknown or invalid output values produce no token badge.');
const badgeIdentity = 'cloud:counted" data-injected="yes<img src=x onerror=alert(1)>';
tokenButton = badge(item('cloud-record',{identity:badgeIdentity,title:hostile}),[counted]);
check(tokenButton?.dataset.sessionTokens === badgeIdentity && !doc.querySelector('[data-injected],img'),
  'Badge identities and labels stay escaped when a token badge is attached to a hostile session title or identity.');

console.log(`${checks} recent session usage checks passed.`);
dom.window.close();
