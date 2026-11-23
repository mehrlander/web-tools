import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const dom=new JSDOM('<main><section id="usage"></section></main>',{url:'https://fixture.example/',runScripts:'outside-only',pretendToBeVisual:true});
const {window}=dom,doc=window.document;
const now=Date.parse('2026-11-14T18:00:00Z'),minute=60000;
window.Date=class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
window.setInterval=()=>0;
window.requestAnimationFrame=callback=>{callback();return 0;};
window.assistantMark={svg:key=>`<svg class="brand" aria-hidden="true" data-brand="${key}"></svg>`};
let scroll=127,mode='success',opened=[],requests=[];
window.NowViews={current:()=> 'usage',scrollPosition:()=>scroll,scrollTo:value=>{scroll=value;}};
window.NowPhone={openSession:key=>opened.push(key)};
const reset=new Date(now+4*86400000).toISOString(),observedAt=new Date(now).toISOString();
const allowance=(id,label,usedPercent,minutes=10080)=>({id,label,usedPercent,durationMinutes:minutes,resetsAt:reset,
 history:[{at:new Date(now-minute).toISOString(),resetsAt:reset,usedPercent:usedPercent-1},{at:observedAt,resetsAt:reset,usedPercent}]});
const snapshot={items:[{key:'cloud:measured',id:'measured',provider:'Claude',kind:'cloud',location:'Cloud',title:'Session <unsafe>',at:new Date(now-10*minute).toISOString()}],usage:[
 {provider:'codex',status:'available',observedAt,windows:[allowance('codex:primary','codex',20)]},
 {provider:'gemini',status:'available',observedAt,windows:[allowance('gemini-model','Model A',90),allowance('gemini-weekly','All models',30),allowance('gemini-5h','Gemini',8,300)]},
 {provider:'claude',status:'available',observedAt,windows:[allowance('seven_day','All models',40)]}]};
const history={schemaVersion:1,updatedAt:observedAt,periods:[],tokenDays:[],adjustments:[],
 dailyAllowance:{timezone:'Pacific time',days:['2026-11-13','2026-11-14'],providers:[{provider:'claude',days:[{day:'2026-11-14',points:4,state:'partial',coverage:.5,today:true}]}]},
 sessionUsage:{available:true,observedAt,revision:'fixture',sessions:[{provider:'claude',id:'measured',contextTokens:123456,outputTokens:6000,usageAt:new Date(now-15*minute).toISOString()}]}};
window.fetch=async(url,options)=>{
 requests.push({url,options});
 if(mode==='fail')throw Error('Offline');
 return {ok:mode!=='denied',status:mode==='denied'?403:200,headers:new Map(),text:async()=>JSON.stringify(history)};
};
window.eval(readFileSync(new URL('../../lib/kits/panel-tip.js',import.meta.url),'utf8'));
for(const name of ['phone-info.js','usage-view.js','recent-usage.js'])window.eval(readFileSync(new URL('../shared/'+name,import.meta.url),'utf8'));
window.eval(readFileSync(new URL('../phone/phone-usage.js',import.meta.url),'utf8'));
const U=window.NowPhoneUsage;
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
try{
 await new Promise(resolve=>setTimeout(resolve,0));
 U.update(snapshot);
 check(doc.querySelectorAll('.pu-account').length===3&&doc.querySelector('.usage-calendar')&&doc.querySelector('.nru'),
  'One native Usage page combines current allowances, a shared history calendar and Claude context.');
 const gemini=doc.querySelector('.pu-account[data-allowance-provider="gemini"]');
 check(gemini.querySelector('.pu-account-value').textContent==='30%'&&!doc.querySelector('.pu-current').textContent.includes('5h'),
  'The weekly surface prefers account-wide readings and keeps shorter limits in details.');
 check([...doc.querySelectorAll('.pu-reset-date')].every(node=>node.textContent&&!node.textContent.includes('unknown')),
  'Current allowances expose reset dates without requiring a calendar interaction.');
 check(doc.querySelector('.nru-title').textContent==='Session <unsafe>'&&!doc.querySelector('unsafe')
  &&doc.querySelector('.nru-value').textContent==='123.5k'&&doc.querySelector('.nru-time').textContent==='50m',
  'The cache list retains escaped titles, measured context and the remaining activity-window timer.');
 doc.querySelector('.nru-row').click();
 check(opened.join(',')==='cloud:measured','Cache rows navigate through the native Now session handler.');
 gemini.click();
 const detail=doc.querySelector('#phone-info-card');
 check(detail?.getAttribute('aria-modal')==='false'&&detail.querySelectorAll('[data-usage-window]').length===3&&detail.textContent.includes('5h')&&detail.textContent.includes('Model A'),
  'Vendor details preserve every reported window, including short and model-specific limits.');
 check(detail.querySelector('[data-usage-trend]')&&detail.querySelector('[data-usage-link]').href==='https://antigravity.google.com/',
  'Within-period trends and the provider usage destination survive consolidation.');
 detail.querySelector('[data-wt-panel-tip-close]').click();
 check(!doc.querySelector('#phone-info-card'),'Allowance details have an explicit close control without obscuring the page.');
 doc.querySelector('[data-cache-info="window"]').click();
 check(doc.querySelector('#phone-info-card').textContent.includes('Recent activity does not confirm that a cache remains available'),
  'The cache-window limitation is available with a tap, rather than only mouse hover.');
 doc.querySelector('#phone-info-card [data-wt-panel-tip-close]').click();
 const account=doc.querySelector('[data-allowance-provider="codex"]');account.focus();
 snapshot.usage[0].windows[0].usedPercent=25;U.update(snapshot);
 check(scroll===127&&doc.activeElement.dataset.allowanceProvider==='codex',
  'A data refresh preserves the actual Usage panel position and focused allowance.');
 check(requests.every(row=>row.url==='/api/v1/usage-history'&&row.options.cache==='no-store'),
  'History uses the canonical same-origin owner-protected API without HTTP caching.');
 mode='fail';await U.refresh();
 check(U.state().archiveSaved&&U.sessionUsage().available===false&&doc.querySelector('.pu-saved'),
  'Temporary failure retains dated history and marks session measurements as saved.');
 mode='success';history.dailyAllowance.timezone='Not/AZone';await U.refresh();U.update(snapshot);
 check(doc.querySelectorAll('.pu-account').length===3,'An invalid saved calendar timezone cannot break current allowances.');
 mode='denied';await U.refresh();
 check(!U.state().archiveLoaded&&window.localStorage.getItem('web-tools-phone-usage-history-v1')===null,
  'An access denial removes cached history instead of presenting it as available.');
 console.log(checks+' native Usage integration checks passed.');
}finally{dom.window.close();}
