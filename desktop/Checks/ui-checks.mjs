import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const dom = new JSDOM(read('../ui/index.html'), {url:'https://desktop.web-tools.local/index.html',runScripts:'outside-only',pretendToBeVisual:true});
const {window} = dom;
const doc = window.document;
let checks = 0, receive;
function check(condition, message) { assert.ok(condition, message); checks++; }
const messages = [];
window.chrome = {webview:{postMessage:m => messages.push(m),addEventListener:(event, listener) => { if (event === 'message') receive = listener; }}};
window.matchMedia = () => ({matches:true});
window.eval(read('../../lib/kits/claude-mark.js'));
window.eval(read('../../lib/kits/assistant-mark.js'));
window.eval(read('../../lib/kits/title-tip.js'));
const legacyReviewKey = 'web-tools-now-reviewed:Fixture laptop';
const legacyReview = JSON.stringify({since:Date.now() - 86400000,seen:{'errand:result':'change-result','cloud:cloud':'change-cloud','session:Codex:local':'change-local'}});
window.localStorage.setItem(legacyReviewKey,legacyReview);
window.eval(read('../shared/now-shared.js'));
window.eval(read('../shared/usage-view.js'));
window.eval(read('../ui/laptop.js'));
const now = new Date().toISOString();
const earlier = seconds => new Date(Date.now() - seconds * 1000).toISOString();
const job = (id,state,title,seconds = 0) => ({id,state,title,note:'',createdAt:earlier(seconds),updatedAt:earlier(seconds),isNew:false});
const data = {
  machineName:'Fixture laptop',seenThrough:now,
  activity:{observedAt:now,revision:'fixture',connected:true,errands:[
    {...job('result','complete','A result <img src=x onerror=alert(1)>'),note:'<b>Untrusted note</b>',reply:'<script>alert(1)</script>',hasLocalOutput:true,isNew:true},
    job('second','queued','Second in queue',20), job('first','queued','First in queue',90),
    job('claimed','claimed','Accepted by worker',60), {...job('failed','failed','Failed result',10),isNew:true},
  ]},
  daemon:{state:'detected',detail:'Worker process present; task state comes from session events.',lastLogAt:now},
  applications:[{name:'Codex',state:'open',detail:'Application process'},{name:'Ollama',state:'open',detail:'Local service'}],
  places:[{id:'outputs',name:'Outputs'}],downloads:[{name:'<img src=x>.txt',modifiedAt:now}],
  sessions:{items:[{id:'local',provider:'Codex',title:'Current <b>session</b>',state:'working',updatedAt:now,workspace:'C:/fixture',detail:'Checking the queue',location:'Laptop'}],notices:[]},
  cloud:{capturedAt:now,items:[{id:'cloud',provider:'Claude',title:'Cloud work',state:'recorded',updatedAt:earlier(30),detail:'Recorded: choice needed',location:'Cloud'}],notice:null},
  changes:[{key:'errand:result',id:'change-result',provider:'Gemini',title:'A result',state:'complete',at:now,detail:'Result ready',location:'Laptop'}, {key:'cloud:cloud',id:'change-cloud',provider:'Claude',title:'Cloud work',state:'recorded',at:now,detail:'Recorded checkpoint',location:'Cloud'}, {key:'session:Codex:local',id:'change-local',provider:'Codex',title:'Local work',state:'working',at:now,detail:'Started work',location:'Laptop'}],
  events:[{id:'event',sessionId:'local',provider:'Codex',title:'Current session',state:'working',at:earlier(5),detail:'Turn started',location:'Laptop'}],
};
const snapshot = () => receive({data:{type:'snapshot',data}});
const click = selector => { const node = doc.querySelector(selector); assert.ok(node, `Missing ${selector}`); node.click(); };
snapshot();
click('[data-launch="errand:result"]');
check(doc.querySelector('[data-external="errand:result"]')?.href === 'https://mehrlander.github.io/web-tools/app/?repo=mehrlander/web-tools-private&ref=background&view=files&file=errands%2Fresults%2Fresult.json','A desktop errand launcher resolves its saved result URL from the actual errand ID.');
click('[data-launch="errand:result"]');
check(doc.querySelector('[data-filter=all]').getAttribute('aria-pressed') === 'true' && doc.querySelectorAll('#errands .activity-row').length === 7, 'Desktop opens on Recent, including activity that an older app version marked seen.');
check(doc.querySelectorAll('#assistants > article').length === 3, 'All three assistants have a prominent lane.');
check(doc.querySelectorAll('#assistants [data-assistant] svg').length === 3, 'Assistant marks come from the existing shared kits.');
const assistantLinks = [...doc.querySelectorAll('#assistants [data-provider-link]')];
check(assistantLinks.length === 3 && assistantLinks.map(a=>a.href).join('|') === 'https://chatgpt.com/|https://antigravity.google.com/|https://claude.ai/code','Desktop assistant headers offer the same three launch destinations as the phone.');
check(assistantLinks.every(a=>a.target === '_blank' && a.rel.includes('noopener') && a.getAttribute('aria-label')) && !doc.querySelector('#assistants button a'),'Desktop launch controls are separate accessible links without nested controls.');
data.usage = [{provider:'codex',status:'available',observedAt:now,windows:[{id:'weekly',label:'codex',usedPercent:3,durationMinutes:10080,resetsAt:new Date(Date.now()+86400000).toISOString()}]}];
snapshot();
check(doc.querySelector('#assistants [role=progressbar]')?.getAttribute('aria-valuenow') === '3','The desktop assistant header shows reported usage beside the assistant.');
data.usage[0].windows[0].usedPercent = 4;
snapshot();
check(doc.querySelector('#assistants [role=progressbar]')?.getAttribute('aria-valuenow') === '4','Quota-only desktop updates bypass the assistant activity cache.');
check(doc.querySelector('#session-count').textContent === '1 working session', 'Claims and cloud records do not inflate the working-session count.');
check(doc.querySelector('#new-count').textContent === '2', 'Needs you combines failed results with recorded cloud choices.');
check(doc.querySelector('#queue-summary').textContent.includes('2 waiting'), 'The Gemini queue shows its waiting count.');
check(doc.querySelector('#queue-summary').textContent.includes('1 claimed'), 'Accepted work is distinct from waiting work.');
check(doc.querySelector('[data-assistant=gemini]').closest('article').textContent.includes('2 queued'), 'Gemini queue state is visible at the top.');
check(doc.querySelector('#queue button').textContent.includes('First in queue'), 'The waiting list is ordered by request time.');
check(doc.querySelector('details') === null, 'Signal explanations use no expanders.');
check(doc.querySelector('#assistants [title], #worker-state [title]') === null, 'Assistant and worker facts use the shared tooltip instead of native HTML titles.');
const workerTip = doc.querySelector('#worker-state [data-title-tip]');
window.TitleTip.open(workerTip);
check(doc.querySelector('[role=tooltip]').textContent.includes('Worker process present'), 'The shared tooltip displays the worker signal on demand.');
window.TitleTip.close();
check(doc.querySelector('img') === null, 'Untrusted activity and filenames stay text.');
check(doc.querySelector('.session b') === null, 'Untrusted session titles stay text.');

click('[data-pick="errand:result"]');
check(doc.querySelector('.errand-detail b') === null, 'Result notes remain text.');
check(doc.querySelector('.errand-detail script') === null, 'Reply markup never becomes a script.');
const selectedTitle = doc.querySelector('[data-pick="errand:result"]');
const sessionNode = doc.querySelector('.session');
data.activity.observedAt = new Date(Date.now() + 2000).toISOString(); snapshot();
check(doc.querySelector('[data-pick="errand:result"]') === selectedTitle, 'An unchanged poll preserves activity controls.');
check(doc.querySelector('.session') === sessionNode, 'An unchanged poll preserves assistant controls.');
check(!!doc.querySelector('.errand-detail'), 'An unchanged poll preserves the selected result.');
click('[data-action=output]'); check(messages.at(-1).action === 'output' && messages.at(-1).id === 'result', 'Output actions use the selected errand ID.');
click('[data-action=errand]'); check(messages.at(-1).action === 'errand', 'Errands open their Web Tools record.');

click('[data-assistant=claude]');
check(doc.querySelectorAll('#errands .activity-row').length === 1 && doc.querySelector('#errands').textContent.includes('Cloud work'), 'Selecting Claude filters the activity list.');
click('[data-action=cloud-session]'); check(messages.at(-1).id === 'cloud', 'Cloud activity opens the exact recorded session.');
data.cloud.items[0].detail = 'Recorded: done'; snapshot(); click('[data-filter=done]');
check(doc.querySelector('#errands').textContent.includes('Cloud work'), 'Explicitly completed Claude cloud records appear under Finished.');
click('[data-queue-pick="errand:first"]');
check(doc.querySelector('#detail h3').textContent === 'First in queue', 'A queue pick opens the selected errand across assistant filters.');

click('[data-filter=queued]');
check(doc.querySelectorAll('#errands .activity-row').length === 2, 'The queue filter shows every waiting errand.');
data.activity.errands = data.activity.errands.filter(j => j.state !== 'queued'); snapshot();
check(doc.querySelector('#queue-summary').textContent.includes('Queue clear'), 'A drained queue updates automatically.');
check(doc.querySelector('#errands').textContent.includes('No errands in the queue'), 'An empty queue has an explicit state.');
data.activity.revision = null; data.activity.connected = false; snapshot();
check(doc.querySelector('#queue-summary').textContent.includes('Queue unavailable') && !doc.querySelector('#queue-summary').textContent.includes('Queue clear'), 'Missing records cannot masquerade as an empty queue.');
data.activity.revision = 'fixture'; snapshot();
check(doc.querySelector('#queue-summary').textContent.includes('Saved queue'), 'Offline queue counts identify the saved snapshot.');

data.sessions.items[0].state = 'quiet'; snapshot();
check(doc.querySelector('#session-count').textContent === '', 'Quiet sessions do not claim to be running.');
check(doc.querySelector('#assistants').textContent.includes('Quiet'), 'A stale session visibly becomes quiet.');
check(doc.querySelector('[data-action=refresh]') === null && doc.querySelector('#checked') === null, 'Continuous polling has no refresh control or flashing checked timestamp.');
click('[data-filter=all]');
const search = doc.querySelector('#search'); search.value = 'nothing matches'; search.dispatchEvent(new window.Event('input',{bubbles:true}));
check(doc.querySelector('#errands').textContent.includes('No matching activity'), 'Search filters the combined activity feed.');
search.value = ''; search.dispatchEvent(new window.Event('input',{bubbles:true}));
check(!doc.querySelector('[data-review], [data-filter=changes], #changes-count') && !/Since last look|Mark changes seen/.test(doc.body.textContent), 'Desktop has no acknowledgement controls or seen/unseen filter.');
const recentKeys = [...doc.querySelectorAll('#errands [data-pick]')].map(n => n.dataset.pick);
snapshot();
window.dispatchEvent(new window.StorageEvent('storage',{key:legacyReviewKey,newValue:legacyReview}));
check(JSON.stringify([...doc.querySelectorAll('#errands [data-pick]')].map(n => n.dataset.pick)) === JSON.stringify(recentKeys) && window.localStorage.getItem(legacyReviewKey) === legacyReview, 'Polling and legacy storage events leave recent activity visible without changing review state.');
data.changes[0].id = 'later-result'; snapshot();
check(doc.querySelectorAll('#errands [data-pick="errand:result"]').length === 1, 'A later update keeps one result in Recent without a new-change badge.');
data.daemon.activity = {kind:'topics',headline:'Summarising 2 sessions',at:earlier(30)}; snapshot();
check(doc.querySelector('#worker-activity').textContent.includes('Summarising 2 sessions') && doc.querySelector('#worker-activity').textContent.includes('Reported'), 'The worker shows its last reported task with an observation age.');
data.cloud.items[0].checkpoint = {summary:'Published summary <b>text</b>',headline:'Latest useful checkpoint',at:earlier(300),turns:[{turn:2,headline:'A checkpoint',summary:'Work completed',files:2,pushes:1,agents:3}],links:[{label:'home #72',url:'https://github.com/mehrlander/home/pull/72'}]};
snapshot(); click('[data-assistant=claude]'); click('[data-filter=all]');
check(doc.querySelector('#assistants').textContent.includes('Latest useful checkpoint') && doc.querySelector('#detail').textContent.includes('Published checkpoint'), 'Cloud cards and details show published checkpoints separately from live activity.');
check(!doc.querySelector('#detail b') && doc.querySelector('#detail').textContent.includes('<b>text</b>'), 'Checkpoint summaries remain text.');
click('[data-action=work-link]'); check(messages.at(-1).id === 'cloud:0', 'Checkpoint links send only a known session and link index to the native bridge.');
data.changes[1].id = 'cloud-latest'; snapshot();
check(doc.querySelectorAll('#errands .activity-row').length === 1 && !doc.querySelector('#errands').textContent.includes('New change'), 'A cloud update stays visible without unread badges.');
data.cloud.items[0].sourceUrl = 'https://claude.ai/code/session_fixture'; snapshot();
const launch = doc.querySelector('#errands [data-launch]');
check(launch?.getAttribute('aria-label').startsWith('Open session options:'),'Each desktop feed item has a separate session launcher.');
launch.click();
check(doc.querySelector('#errands [data-session-link]')?.href === 'https://claude.ai/code/session_fixture','The desktop launcher uses the same validated original Claude URL as the phone.');
doc.querySelector('#errands [data-session-link]').focus(); doc.querySelector('#errands').scrollTop = 90;
data.cloud.items[0].detail = 'A new observation'; snapshot();
check(doc.activeElement.dataset.sessionLink === launch.dataset.launch && doc.querySelector('#errands').scrollTop === 90,'A desktop update preserves the open launcher, focused session link and list scroll position.');

dom.window.close();
console.log(`${checks} Now UI checks passed.`);
