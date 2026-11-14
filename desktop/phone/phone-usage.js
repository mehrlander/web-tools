/* One phone Usage view: current allowances, aligned history, and recent Claude context. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const P={codex:{name:'Codex',color:'#169b7e'},gemini:{name:'Gemini',color:'#2a71ce'},claude:{name:'Claude',color:'#c77d55'}};
 const mark=key=>window.assistantMark?.svg(key,{cls:'brand'})||'';
 const DATA={providers:[]};
 const emptyHistory=()=>({schemaVersion:1,periods:[],tokenDays:[],adjustments:[],dailyAllowance:{days:[],providers:[]}});
 let HISTORY=emptyHistory(),snapshot=null,now=Date.now(),host=null;
 let archiveLoaded=false,archiveBusy=false,archiveAttempted=false,archiveSaved=false;
 let timelineFollowToday=true,timelineAnchor=null,timelinePlan=null,timelineRestoring=false,timelinePointer=false,timelineLastScroll=0,timelineDeferred,timelineKeyboardDetail=false;
 let selectedDailyDay=null,dialogFocus=null,rendering=false;
 const HISTORY_KEY='web-tools-phone-usage-history-v1',MAX_HISTORY=8*1024*1024;
 function currentRows(key){
  return rows(key).filter(row=>row.durationMinutes===10080).sort((a,b)=>{
   const account=row=>!row.label||row.label==='All models'||row.label.toLowerCase()===key;
   return Number(account(b))-Number(account(a))||(b.usedPercent??-1)-(a.usedPercent??-1);
  });
 }
const paths={activity:'M2 12h4l3-8 6 16 3-8h4',hand:'M18 11V7a2 2 0 0 0-4 0v4M14 10V5a2 2 0 0 0-4 0v6M10 10.5V7a2 2 0 0 0-4 0v9M18 8a2 2 0 1 1 4 0v8a6 6 0 0 1-6 6h-2c-2.1 0-3.4-.6-4.5-1.7l-5.4-5.4a2 2 0 0 1 2.8-2.8L6 13',hourglass:'M6 3h12M6 21h12M7 3v4l10 10v4M17 3v4L7 17v4',clock:'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',check:'m5 12 4 4L19 6',pause:'M9 5v14M15 5v14',circle:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0',alert:'M12 8v5m0 3v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',reply:'M9 5 3 11l6 6M3 11h12a6 6 0 0 1 6 6',more:'M12 5h.01M12 12h.01M12 19h.01',detail:'M8 3h9l4 4v14H5V3Zm9 0v5h4M9 12h8M9 16h6',copy:'M9 5H5v16h12v-4M9 3h12v14H9Z',open:'M14 4h6v6M20 4 10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',windows:'M8 21h8m-4-5v5m-5-11h10m-3-3 3 3-3 3',cloud:'M6.5 19a4.5 4.5 0 0 1-.8-8.93A6.5 6.5 0 0 1 18.5 9a5 5 0 0 1-.5 10Z',laptop:'M4 16 2 20h20l-2-4M9 20h6',reset:'M20 7v5h-5M4 17v-5h5M5.5 7a7.5 7.5 0 0 1 12.8-1L20 9M4 15l1.7 3a7.5 7.5 0 0 0 12.8-1',folder:'M3 7V5h6l2 2h10v13H3Z',repo:'M5 3h14v18H5Zm4 0v18M5 17h14',speaker:'M3 9v6h4l5 4V5L7 9Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14'};
const icon=(name,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name==='windows'?'<rect x="3" y="4" width="18" height="12" rx="2"/>':name==='laptop'?'<rect x="4" y="3" width="16" height="13" rx="1.5"/>':''}<path d="${paths[name]||name}"/></svg>`;
const numeric=value=>!['number','string'].includes(typeof value)||String(value).trim()===''?null:Number.isFinite(Number(value))?Number(value):null;
const providerData=key=>DATA.providers.find(p=>p.provider===key)||{};
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
function periodName(minutes,label='Limit'){
 if(minutes===10080)return 'Week';
 if(minutes===1440)return 'Day';
 if(minutes>0)return minutes%1440===0?minutes/1440+'d':minutes%60===0?minutes/60+'h':minutes+'m';
 return label;
}
function rows(key){
 const provider=providerData(key),raw=provider.windows;
 const windows=Array.isArray(raw)?raw:raw&&typeof raw==='object'?[raw]:[];
 const seen=new Map();
 return windows.filter(w=>w&&typeof w==='object').map((w,index)=>{
  const duration=numeric(w.durationMinutes),minutes=duration>0?duration:null,used=numeric(w.usedPercent);
  const sourceLabel=typeof w.label==='string'?w.label.trim():'';
  const generic=!sourceLabel||sourceLabel.toLowerCase()===key||sourceLabel.toLowerCase()===P[key].name.toLowerCase()||sourceLabel==='All models';
  const period=periodName(minutes,generic?'Limit':sourceLabel);
  const scope=minutes&&!generic?sourceLabel:'';
  const base=(minutes||'unknown')+'|'+(scope||(!minutes?period:''));
  const duplicate=seen.get(base)||0;seen.set(base,duplicate+1);
  return {...w,id:w.id||key+'-window-'+index,durationMinutes:minutes,usedPercent:used!==null&&used>=0?used:null,resetsAt:validDate(w.resetsAt)?w.resetsAt:null,period,labelText:scope?period+' · '+scope:period,slot:base+(duplicate?'|'+duplicate:'')};
 }).sort((a,b)=>(a.durationMinutes===10080?-1:a.durationMinutes||Infinity)-(b.durationMinutes===10080?-1:b.durationMinutes||Infinity)||a.labelText.localeCompare(b.labelText));
}
const pc=w=>w.usedPercent===null?'Unavailable':w.usedPercent>0&&w.usedPercent<1?'&lt;1':String(Math.round(w.usedPercent));
const expired=w=>w.resetsAt&&Date.parse(w.resetsAt)<=now;
function stale(key){const p=providerData(key),at=Date.parse(p.observedAt);return p.status!=='available'||!Number.isFinite(at)||now-at>600000||at-now>60000;}
function elapsed(w,key){
 if(!w.durationMinutes||!w.resetsAt||expired(w)||stale(key)||w.usedPercent===null)return null;
 const startAt=Date.parse(w.resetsAt)-w.durationMinutes*60000;
 if(now<startAt)return null;
 return Math.max(0,Math.min(100,(now-startAt)/(w.durationMinutes*60000)*100));
}
function meter(key,w){
 const unavailable=w.usedPercent===null||expired(w),pace=elapsed(w,key);
 return `<span class="quota-bar ${stale(key)||expired(w)?'last-reading':''} ${unavailable?'unavailable':''}" ${unavailable?'aria-hidden="true"':`role="progressbar" aria-label="${P[key].name} ${esc(w.labelText)} allowance used" aria-valuenow="${w.usedPercent}" aria-valuemin="0" aria-valuemax="${Math.max(100,w.usedPercent)}"`} style="--color:${P[key].color}">${!unavailable?`<span class="fill" style="width:${Math.min(100,w.usedPercent)}%"></span>`:''}${pace!==null?`<span class="elapsed" style="left:${pace}%"></span>`:''}</span>`;
}
function archiveGroups(key){
 const minutes=10080,current=currentRows(key)[0];
 const groups=new Map();
 for(const record of HISTORY.periods||[]){
  if(record.provider!==key||record.minutes!==minutes||(current&&record.bucket!==current.id))continue;
  const reset=Date.parse(record.reset),at=Date.parse(record.last_at),value=numeric(record.last_used);
  if(!Number.isFinite(reset)||!Number.isFinite(at)||reset>=now||at>reset||value===null||value<0)continue;
  const date=NowUsage.calendarDay(record.reset,calendarZone()),group=groups.get(date)||{key,id:key+'|saved|'+minutes+'|'+date,date,reset:record.reset,last:record.last_at,value,peak:numeric(record.peak),samples:0,revisions:0,kind:'recorded'};
  group.samples+=record.samples||0;group.revisions++;
  if(at>=Date.parse(group.last)){group.last=record.last_at;group.reset=record.reset;group.value=value;}
  group.peak=Math.max(group.peak??value,numeric(record.peak)??value);
  groups.set(date,group);
 }
 return [...groups.values()].sort((a,b)=>Date.parse(a.reset)-Date.parse(b.reset));
}
function usageForecast(key,window=currentRows(key)[0]){
 if(!window||!window.durationMinutes||!window.resetsAt||window.usedPercent===null||expired(window)||stale(key))return null;
 const observed=Date.parse(providerData(key).observedAt),reset=Date.parse(window.resetsAt),duration=window.durationMinutes*60000,elapsed=observed-(reset-duration);
 if(!Number.isFinite(observed)||elapsed<Math.max(600000,duration*.01)||elapsed>duration)return null;
 const restore=allowanceDrops(key,window).filter(event=>event.confirmed_restore&&Math.abs(Date.parse(event.reset)-reset)<=120000&&Date.parse(event.at)<=observed).at(-1);
 if(restore){
  const since=observed-Date.parse(restore.at),increase=window.usedPercent-restore.after;
  if(since<600000||increase<0)return null;
  const value=window.usedPercent+increase/since*(reset-observed);
  return Number.isFinite(value)?{value,used:window.usedPercent,elapsed:elapsed/duration*100,at:observed,restored:true,baseline:restore.after,since:restore.at}:null;
 }
 const estimate=window.usedPercent*duration/elapsed;
 return Number.isFinite(estimate)?{value:estimate,used:window.usedPercent,elapsed:elapsed/duration*100,at:observed}:null;
}
function allowanceDrops(key,window=currentRows(key)[0]){
 const bucket=window?.id||({claude:'seven_day',gemini:'gemini-weekly',codex:'codex:primary'})[key];
 return (HISTORY.adjustments||[]).filter(row=>row.provider===key&&row.bucket===bucket&&row.minutes===(window?.durationMinutes||10080)&&Date.parse(row.at)<=now&&Number.isFinite(row.drop)&&row.drop>0);
}
function allowanceDropMarkers(key){
 const groups=new Map();
 for(const event of allowanceDrops(key).filter(event=>event.drop>=1)){
  const date=NowUsage.calendarDay(event.at,calendarZone());if(!date)continue;
  let group=groups.get(date);if(!group){group={key,id:key+'|decrease|'+date,kind:'decrease',events:[],value:event.drop,reset:event.at};groups.set(date,group);}
  group.events.push(event);if(event.drop>group.value){group.value=event.drop;group.reset=event.at;}
 }
 return [...groups.values()];
}
function availablePace(key,window=currentRows(key)[0]){
 const provider=providerData(key);
 return NowUsage.remainingPace(window,{now,observedAt:provider.observedAt,status:provider.status});
}
function paceLabel(value){
 if(value===null)return '—';
 if(value>0&&value<.01)return '<0.01×';
 return (value>=1000?shortNumber(value):new Intl.NumberFormat('en-US',{maximumFractionDigits:value>=10?1:2}).format(value))+'×';
}
function timelineMarkers(key){
 const markers=[...archiveGroups(key),...allowanceDropMarkers(key)],window=currentRows(key)[0];
 if(window?.resetsAt&&Date.parse(window.resetsAt)>now){
  markers.push({key,id:key+'|upcoming|'+window.id+'|'+window.resetsAt,kind:'upcoming',reset:window.resetsAt,value:window.usedPercent,window,unavailable:window.usedPercent===null||stale(key)});
 }
 return markers;
}
function calendarZone(){
 const candidate=HISTORY.dailyAllowance?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone;
 try{return new Intl.DateTimeFormat('en-US',{timeZone:candidate==='Pacific time'?'America/Los_Angeles':candidate}).resolvedOptions().timeZone;}
 catch{return null;}
}
function createTimelinePlan(width){
 return NowUsage.calendarAxis({width,now,timezone:calendarZone(),dates:dailyModel().dates,markers:Object.keys(P).flatMap(timelineMarkers)});
}
function railX(value,plan=timelinePlan){return plan?.x(value)??0;}
function railTime(x,plan=timelinePlan){return plan?.time(x)??now;}
function timelineValue(marker){
 if(marker.kind==='upcoming')return marker.value===null?'—':(marker.value>0&&marker.value<1?'<1':Math.round(marker.value))+'%'+(marker.unavailable?'*':'');
 if(marker.kind==='decrease')return '−'+(marker.value<1?'<1':Math.round(marker.value))+'pp';
 if(marker.value===null)return '?';
 const value=marker.value>0&&marker.value<1?'<1':marker.value>=1000?shortNumber(marker.value):Math.round(marker.value);
 return (marker.kind==='projected'?'~':'')+value+'%';
}
function calendarFooter(){
 const model=dailyModel();
 if(!model.dates.length)return `<div class="daily-loading" role="status">${archiveAttempted?'Daily readings unavailable':'Loading saved readings…'}</div>`;
 return `<div class="calendar-footer"><button data-daily-info aria-label="About daily allowance history">Bars · 0–${model.ceiling}% of week ${icon('M12 8v.01M12 11v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0')}</button><div class="daily-patterns">${model.series.some(series=>series.days.some(day=>day.state==='partial'))?'<span><i class="daily-partial-key"></i>Partial</span>':''}${model.series.some(series=>series.days.some(day=>day.state==='missing'))?'<span><i class="daily-missing-key"></i>No reading</span>':''}</div></div><div class="calendar-coverage"><button data-pace-guide-info class="calendar-rate-key" aria-label="About even pace and catch-up daily rate lines"><i aria-hidden="true"></i>Even <i class="catch-up" aria-hidden="true"></i>Catch up</button><span>${esc(model.timezone)}</span></div>`;
}
function rowChart(){
 return `<div class="row-chart usage-calendar"><div class="history-rail-tools"><button class="history-rail-legend" data-timeline-info aria-label="About current use and available pace"><span class="legend-current" aria-hidden="true"></span>Now <span class="legend-recorded" aria-hidden="true">${NowUsage.resetMarker()}</span>Reset <span class="legend-drop" aria-hidden="true"></span>Drop ${icon('M12 8v.01M12 11v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0')}</button><span class="history-rail-month"></span><button class="history-today" data-timeline-today>Today</button></div><div class="history-grid"><div class="history-fixed"><div class="history-date-spacer" aria-hidden="true"></div><div id="history-identities">${timelineIdentityHTML()}</div></div><div id="reset-history-scroll" class="history-rail-scroll" data-no-swipe role="region" tabindex="0" aria-label="Usage calendar. Scroll horizontally for daily use and reset history."><div class="history-rail-canvas"></div></div></div><div id="usage-calendar-footer">${calendarFooter()}</div></div>`;
}
function updateTimelineIdentity(){const identities=$('history-identities');if(identities)identities.innerHTML=timelineIdentityHTML();const footer=$('usage-calendar-footer');if(footer)footer.innerHTML=calendarFooter();}
function calendarStamp(value,options){return new Date(value).toLocaleString('en-US',{timeZone:calendarZone()||undefined,...options});}
function updateTodayControl(){
 const button=document.querySelector('[data-timeline-today]');if(button)button.style.visibility=timelineFollowToday?'hidden':'visible';
 const month=document.querySelector('.history-rail-month');if(month){const date=new Date(timelineFollowToday?now:timelineAnchor??now);month.textContent=calendarStamp(date,{month:'short'});month.title=calendarStamp(date,{year:'numeric',month:'long'});}
}
function saveTimelinePosition(){
 const viewport=$('reset-history-scroll');if(!viewport||!timelinePlan||timelineRestoring)return;
 timelineLastScroll=performance.now();
 timelineFollowToday=Math.abs(viewport.scrollLeft-railX(timelinePlan.home))<2;
 timelineAnchor=timelineFollowToday?null:railTime(viewport.scrollLeft);
 updateTodayControl();
}
function showTimelineToday(){
 timelineFollowToday=true;timelineAnchor=null;const viewport=$('reset-history-scroll');if(!viewport||!timelinePlan)return;
 timelineRestoring=true;viewport.scrollLeft=railX(timelinePlan.home);updateTodayControl();requestAnimationFrame(()=>timelineRestoring=false);
}
function calendarRateGuides(key){
 const provider=providerData(key),window=currentRows(key)[0];
 const current=window?NowUsage.dailyPaceGuides(window,{now,observedAt:provider.observedAt,status:provider.status}):[];
 const historical=archiveGroups(key).flatMap(record=>NowUsage.dailyPaceGuides({durationMinutes:10080,resetsAt:record.reset}));
 return [...historical,...current];
}
function calendarGuideHTML(plan,key,ceiling){
 const width=plan.days.length*plan.cell,from=plan.days[0].start,until=plan.days.at(-1).end;
 const guides=calendarRateGuides(key).filter(guide=>guide.until>from&&guide.from<until);
 const even=guides.filter(guide=>guide.kind==='even').sort((a,b)=>a.from-b.from),merged=[];
 for(const guide of even){const last=merged.at(-1);if(last&&guide.from<=last.until&&Math.abs(guide.dailyPercent-last.dailyPercent)<.000001)last.until=Math.max(last.until,guide.until);else merged.push({...guide});}
 const html=[...merged,...guides.filter(guide=>guide.kind==='catch-up')].map(guide=>{
  const x1=plan.x(Math.max(from,guide.from)),x2=plan.x(Math.min(until,guide.until)),offscale=guide.dailyPercent>ceiling;
  const y=Math.max(1,Math.min(29,30*(1-guide.dailyPercent/ceiling)));
  const label=(guide.kind==='even'?'Even pace':'Catch up from now')+': '+dailyNumber(guide.dailyPercent)+' percentage points per 24 hours'+(offscale?', above chart scale':'');
  return `<g data-guide-kind="${guide.kind}" data-guide-rate="${guide.dailyPercent}" data-guide-from="${guide.from}" data-guide-until="${guide.until}" data-offscale="${offscale}"><title>${esc(label)}</title><line class="${guide.kind}" x1="${x1}" x2="${x2}" y1="${y}" y2="${y}"/>${offscale?`<path class="catch-up" d="M${x2-5} 6l3-4 3 4"/>`:''}</g>`;
 }).join('');
 return `<svg class="calendar-pace-guides" viewBox="0 0 ${width} 30" preserveAspectRatio="none" role="img" aria-label="${P[key].name} daily budget rate guides, in percentage points per 24 hours">${html}</svg>`;
}
function showDailyPaceGuides(){
 const rates=Object.keys(P).map(key=>{const current=calendarRateGuides(key).filter(guide=>guide.kind==='catch-up').at(-1);return P[key].name+': '+(current?dailyNumber(current.dailyPercent)+' percentage points per 24 hours until '+calendarStamp(current.until,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'.':'catch-up rate unavailable.');}).join(' ');
 tip('Daily budget pace','Dashed: one full allowance spread evenly over the reported week. Colored: remaining allowance spread over the time from now to reset. '+rates,'Both lines are rates per 24 hours on the same percentage-point scale as the bars. A bar is the amount observed during a local calendar day; today and 23/25-hour days have different lengths. Lines are budget references, not observed use or forecasts. Catch-up stops at reset and disappears without a fresh reading. An upward chevron means the catch-up rate exceeds the chart scale.');
}
function calendarDailyHTML(plan,key){
 const model=dailyModel(),series=model.series.find(row=>row.key===key);
 const days=(series?.days||[]).filter(row=>plan.days.some(bucket=>bucket.day===row.day));
 return `<div class="calendar-daily-bars" data-daily-chart="${key}" data-ceiling="${model.ceiling}" role="group" aria-label="${P[key].name}, daily percentage points of weekly allowance, 0 to ${model.ceiling}">${calendarGuideHTML(plan,key,model.ceiling)}${days.map(row=>`<button class="daily-bar ${row.state} ${row.today?'is-today':''} ${selectedDailyDay===row.day?'daily-selected':''}" style="left:${plan.x(row.day)}px;width:${plan.cell}px" data-daily-day="${row.day}" data-daily-vendor="${key}" aria-label="${esc(P[key].name+', '+row.day+', '+(row.points===null?'insufficient readings':dailyNumber(row.points)+' percentage points of weekly allowance'+(row.state==='partial'?', incomplete readings':''))+(row.today?', today so far':''))}"><span class="daily-bar-track">${row.points===null?'':row.points===0?'<i class="daily-zero"></i>':`<i class="daily-fill" style="height:${Math.min(100,row.points/model.ceiling*100)}%"></i>`}</span></button>`).join('')}</div>`;
}
function calendarMarkerHTML(marker){
 const key=marker.key,period=marker.window?.labelText||'weekly';
 let label=P[key].name+', reported reset '+calendarStamp(marker.reset,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+', last observed '+timelineValue(marker);
 if(marker.kind==='upcoming')label=P[key].name+', upcoming '+period+' reset, latest reported '+timelineValue(marker)+' used'+(marker.unavailable?' (last reading or unavailable)':'');
 if(marker.kind==='decrease')label=P[key].name+', observed allowance drop, '+timelineValue(marker)+', '+marker.events.length+' decrease'+(marker.events.length===1?'':'s')+' on this date';
 return `<button class="history-usage-marker ${marker.kind} ${marker.kind==='decrease'?'allowance-drop':''} ${marker.unavailable?'is-unavailable':''}" data-usage-history-marker="${esc(marker.id)}" data-marker-at="${esc(marker.reset)}" style="left:${railX(marker.reset)}px" aria-label="${esc(label)}"><span class="history-usage-point">${['recorded','upcoming'].includes(marker.kind)?NowUsage.resetMarker():''}</span><span class="history-usage-value">${esc(timelineValue(marker))}</span></button>`;
}
function mountHistoryRail(force=false){
 const viewport=$('reset-history-scroll');if(!viewport||!viewport.clientWidth)return;
 if(!force&&(timelinePointer||timelineLastScroll&&performance.now()-timelineLastScroll<180)){
  clearTimeout(timelineDeferred);timelineDeferred=setTimeout(()=>mountHistoryRail(),200);return;
 }
 const plan=createTimelinePlan(viewport.clientWidth);if(!plan){viewport.querySelector('.history-rail-canvas').innerHTML='<div class="daily-loading" role="status">Calendar timezone unavailable</div>';return;}timelinePlan=plan;
 const active=document.activeElement,focusedDay=active?.dataset.dailyDay,focusedVendor=active?.dataset.dailyVendor,focusedMarker=active?.dataset.usageHistoryMarker;
 const canvas=viewport.querySelector('.history-rail-canvas'),width=plan.days.length*plan.cell;
 canvas.style.width=width+'px';canvas.style.setProperty('--rail-cell',plan.cell+'px');
 const dateHTML=plan.days.map(bucket=>{const date=new Date(bucket.day+'T12:00:00Z');return `<span class="${bucket.day===plan.today?'is-today':''}" data-calendar-day="${bucket.day}" aria-label="${esc(date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}))}">${date.toLocaleDateString('en-US',{weekday:'short',timeZone:'UTC'}).slice(0,2)}<b>${date.getUTCDate()}</b></span>`;}).join('');
 const todayX=railX(plan.today),nowX=railX(now);
 canvas.innerHTML=`<div class="history-rail-dates">${dateHTML}</div>`+Object.keys(P).map(key=>{
  const source=document.querySelector(`.history-fixed-row[data-provider="${key}"]`),height=source?.getBoundingClientRect().height||76;
  const markers=Object.keys(P).flatMap(timelineMarkers).filter(marker=>marker.key===key);
  return `<div class="history-rail-lane" data-history-lane="${key}" style="height:${height}px;--color:${P[key].color}"><span class="history-day-shade" style="left:${todayX}px;width:${plan.cell}px"></span><span class="history-day-grid"></span><span class="history-now" style="left:${nowX}px"></span><span class="history-baseline"></span>${markers.map(calendarMarkerHTML).join('')}${calendarDailyHTML(plan,key)}</div>`;
 }).join('');
 const target=railX(timelineFollowToday?plan.home:timelineAnchor??plan.home);
 if(Math.abs(viewport.scrollLeft-target)>1){timelineRestoring=true;viewport.scrollLeft=target;requestAnimationFrame(()=>timelineRestoring=false);}
 if(!viewport.dataset.ready){
  viewport.dataset.ready='true';
  viewport.addEventListener('scroll',()=>{saveTimelinePosition();placeCalendarLabels();if(!timelineKeyboardDetail)closeTip();},{passive:true});
  viewport.addEventListener('pointerdown',()=>{timelinePointer=true;timelineKeyboardDetail=false;},{passive:true});
  viewport.addEventListener('keydown',event=>{
   if(event.target.closest('[data-daily-day]')||event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();event.stopPropagation();timelineKeyboardDetail=false;
   if(event.key==='Home')viewport.scrollLeft=0;
   else if(event.key==='End')showTimelineToday();
   else viewport.scrollLeft+=(event.key==='ArrowRight'?1:-1)*timelinePlan.cell;
  });
 }
 if(focusedDay)[...viewport.querySelectorAll('[data-daily-day]')].find(button=>button.dataset.dailyDay===focusedDay&&button.dataset.dailyVendor===focusedVendor)?.focus({preventScroll:true});
 if(focusedMarker)[...viewport.querySelectorAll('[data-usage-history-marker]')].find(button=>button.dataset.usageHistoryMarker===focusedMarker)?.focus({preventScroll:true});
 placeCalendarLabels();updateTodayControl();
}
function placeCalendarLabels(){
 const rail=$('reset-history-scroll');if(!rail)return;
 for(const lane of rail.querySelectorAll('.history-rail-lane')){
  const visible=[];
  for(const marker of lane.querySelectorAll('.history-usage-marker')){
   const center=parseFloat(marker.style.left)-rail.scrollLeft,label=marker.querySelector('.history-usage-value');if(!label)continue;
   let leader=marker.querySelector('.history-label-leader');
   if(!leader){leader=document.createElement('span');leader.className='history-label-leader';leader.setAttribute('aria-hidden','true');marker.prepend(leader);}
   label.style.visibility='hidden';leader.hidden=true;
   if(center<0||center>rail.clientWidth)continue;
   const width=label.getBoundingClientRect().width;
   visible.push({marker,label,leader,center,width,left:Math.max(2,Math.min(rail.clientWidth-width-2,center-width/2))});
  }
  visible.sort((a,b)=>a.center-b.center);
  let edge=2;
  for(const row of visible){row.left=Math.max(row.left,edge);edge=row.left+row.width+4;}
  edge=rail.clientWidth-2;
  for(const row of [...visible].reverse()){row.left=Math.min(row.left,edge-row.width);edge=row.left-4;}
  edge=2;
  for(const row of visible){
   // Dense histories keep every marker tappable; labels that cannot fit are disclosed on tap.
   if(row.left<edge||row.left+row.width>rail.clientWidth-2)continue;
   const delta=row.left+row.width/2-row.center;
   row.label.style.visibility='visible';row.label.style.transform='translateX(calc(-50% + '+delta+'px))';edge=row.left+row.width+4;
   if(Math.abs(delta)>4){row.leader.hidden=false;row.leader.style.width=Math.hypot(delta,10)+'px';row.leader.style.transform='rotate('+Math.atan2(-10,delta)+'rad)';}
  }
 }
}
function showAllowanceDrop(marker){
 const events=[...marker.events].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 const body=events.map(event=>dailyNumber(event.before)+'% → '+dailyNumber(event.after)+'% used ('+dailyNumber(event.drop)+' percentage points lower), observed between '+calendarStamp(event.before_at,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' and '+calendarStamp(event.at,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'.').join(' ');
 const related=(HISTORY.adjustments||[]).filter(row=>row.provider===marker.key&&row.bucket==='seven_day_fable'&&events.some(event=>Date.parse(row.at)===Date.parse(event.at)));
 const confirmed=events.filter(event=>event.confirmed_restore);
 const notes=(confirmed.length?'You identified this observed drop as a '+confirmed[0].restore_label+' reset. Daily counting resumes from the lower observed reading without subtracting the restored allowance from prior consumption. The unobserved part of the reset interval remains unknown. ':'')+(related.length?'Fable also fell in the same observation: '+related.map(row=>dailyNumber(row.before)+'% → '+dailyNumber(row.after)+'%').join(', ')+'. ':'')+'The scheduled reset stayed within the same reporting window. '+(confirmed.length?'The reset classification comes from your report, not a provider event record. ':'The saved readings do not identify a button press or the reason for the decrease. Daily totals remain conservative while a counter is below its earlier peak; a manual restore can therefore leave consumption uncounted. ')+'The diamond marks the first lower reading, not an exact action time. '+(events.length>1?'The calendar label shows the largest drop on this date. ':'')+'Times follow '+calendarZone()+'.';
 tip(P[marker.key].name+' · observed allowance drop',body,notes);
}
function showUpcomingUsage(marker){
 const provider=providerData(marker.key),window=marker.window;
 const body=marker.value===null?'A current allowance reading is unavailable.':dailyNumber(marker.value)+'% of the '+(window?.durationMinutes===300?'five-hour':'weekly')+' allowance reported used.';
 tip(P[marker.key].name+' · upcoming reset',body+' Resets '+calendarStamp(marker.reset,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'.',(marker.unavailable?'This value is unavailable or from an older reading. ':'')+(provider.observedAt?'Observed '+calendarStamp(provider.observedAt,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'. ':'')+'The percentage is the latest reported use, shown against its upcoming reset. It is not a forecast of final usage. The multiplier beside the vendor name gives the available pace for the remaining period.');
}
function showAvailablePace(marker){
 const pace=marker.pace,period=marker.window?.labelText||'Allowance';
 const title=P[marker.key].name+' · '+period+' available pace';
 if(!pace){tip(title,'Available pace unavailable','A fresh usage reading, a known period length and a future reset time are required. No rate is guessed from stale or unknown windows.');return;}
 const hourly=marker.window.durationMinutes<1440,normal=pace.normalDailyPercent/(hourly?24:1),available=pace.availableDailyPercent/(hourly?24:1),unit=hourly?'hour':'day';
 tip(title,paceLabel(pace.multiplier)+' the normal even pace until '+calendarStamp(marker.reset,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'. '+dailyNumber(pace.remainingPercent)+'% of the allowance and '+dailyNumber(pace.remainingFraction*100)+'% of the period remain.','Remaining allowance ÷ remaining time, relative to one full allowance over one full period. Normal pace is '+dailyNumber(normal)+' percentage points per '+unit+'; the remaining budget permits '+dailyNumber(available)+' per '+unit+'. Halfway through an unused week, 100% ÷ 50% = 2×. This is available capacity, not a prediction of what you will use. Future resets or credits are not assumed.');
}
function showUsageHistoryMarker(id){
 const marker=Object.keys(P).flatMap(timelineMarkers).find(marker=>marker.id===id);if(!marker)return;
 if(marker.kind==='decrease'){showAllowanceDrop(marker);return;}
 if(marker.kind==='upcoming'){showUpcomingUsage(marker);return;}
 const title=P[marker.key].name+' · reported reset '+calendarStamp(marker.reset,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 if(marker.kind==='recorded'){
   const peak=Number.isFinite(marker.peak)&&marker.peak>marker.value?'Peak observed '+marker.peak+'%. ':'';
  const gap=(Date.parse(marker.reset)-Date.parse(marker.last))/60000;
  const missing=gap<1?'less than a minute':gap<60?Math.round(gap)+' minutes':Math.round(gap/60)+' hours';
  tip(title,marker.value+'% last observed '+calendarStamp(marker.last,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}),peak+'Reading was '+missing+' before reset. Final usage is not supplied. '+marker.revisions+' reported reset timestamps grouped on this date.');
 }else if(marker.forecast?.restored){
  tip(title,'About '+Math.round(marker.value)+'% at the pace observed since the confirmed restore. Current reported use '+marker.forecast.used+'%.','The estimate starts from '+marker.forecast.baseline+'% at the first lower reading '+calendarStamp(marker.forecast.since,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'. Earlier credited usage is not treated as current consumption. Actual usage can change.');
 }else if(marker.forecast){
  tip(title,'About '+Math.round(marker.value)+'% at the current average pace. Reported use '+marker.forecast.used+'% after '+Math.round(marker.forecast.elapsed)+'% of the period.','Linear estimate since the reported period began. Actual usage can change.');
 }else tip(title,'Projection unavailable','A fresh reading and enough elapsed time in this period are required.');
}
const shortNumber=value=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value);
const dailyDate=value=>new Date(value+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
const dailyNumber=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
function dailyModel(){
 const raw=HISTORY.dailyAllowance,validDay=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day);
 const dates=Array.isArray(raw?.days)?[...new Set(raw.days.filter(validDay))].sort():[];
 const series=Object.keys(P).map(key=>{
  const source=raw?.providers?.find(row=>row.provider===key),byDay=new Map((source?.days||[]).map(row=>[row.day,row]));
  const days=dates.map(day=>{
   const row=byDay.get(day),points=Number.isFinite(row?.points)&&row.points>=0?row.points:null;
   return {...row,day,points,state:points===null?'missing':row.state==='observed'?'observed':'partial'};
  });
  return {key,days,firstAt:source?.firstAt,lastAt:source?.lastAt};
 });
 const rateMaximum=Math.max(0,...Object.keys(P).flatMap(calendarRateGuides).map(guide=>Math.min(100,guide.dailyPercent)));
 const maximum=Math.max(rateMaximum,...series.flatMap(row=>row.days.map(day=>day.points||0)));
 const ceiling=maximum>20?Math.ceil(maximum/10)*10:maximum>10?20:10;
 return {dates,series,ceiling,timezone:raw?.timezone||'Laptop local time',updatedAt:raw?.updatedAt};
}
function rawTokenSummary(key){
 const rows=HISTORY.tokenDays.filter(row=>row.provider===key&&Number.isFinite(row.tokens)&&row.tokens>=0).sort((a,b)=>a.day.localeCompare(b.day)),latest=rows.at(-1);
 if(!latest)return 'Raw daily token totals are not connected for '+P[key].name+'.';
 return 'Separate raw token record: '+latest.tokens.toLocaleString('en-US')+' tokens on '+dailyDate(latest.day)+', '+latest.day.slice(0,4)+(key==='claude'?' UTC. Retained laptop Claude Code logs only; cloud and other devices are excluded.':' (provider-reported account date). Raw token totals are not used in these allowance bars.');
}
function showDailyDay(key,day){
 const model=dailyModel(),series=model.series.find(row=>row.key===key),row=series?.days.find(row=>row.day===day);if(!row)return;
 selectedDailyDay=day;document.querySelectorAll('[data-daily-day]').forEach(button=>button.classList.toggle('daily-selected',button.dataset.dailyDay===day));
 const title=P[key].name+' · '+dailyDate(day)+', '+day.slice(0,4)+(row.today?' · so far':'');
 const body=row.points===null?'Daily use unavailable: insufficient comparable readings.':(row.estimated?'About ':'')+dailyNumber(row.points)+'% of a weekly allowance observed'+(row.state==='partial'?' in the measured portions of this day.':' during this day.');
 const reasonNames={'allowance-restored':'A confirmed allowance restore established a new observed baseline. The restore interval remains uncertain.','overnight-gap':'A long gap crosses dates, so its increase was not divided between days.','reset-tail':'The final portion before a reset was not observed.','reported-decrease':'Reported use fell during the same allowance period. A restore or provider revision can cause this. Usage below the earlier peak is not counted again, so the total may omit new consumption after a manual restore.','correction-recovery':'A revised counter was kept from being counted twice.','period-change':'The provider changed the reported allowance period.','bucket-change':'The provider changed the weekly usage counter.'};
 const notes=[...new Set((row.reasons||[]).map(reason=>reasonNames[reason]).filter(Boolean))];
 if(row.points!==null)notes.unshift('Usable readings cover '+Math.round((row.coverage||0)*100)+'% of '+(row.today?'today so far':'this day')+'.');
 if(row.unallocated>0)notes.push(dailyNumber(row.unallocated)+' percentage points rose across a gap spanning multiple dates; that rise is not assigned to an individual day.');
 if(row.estimated)notes.push('An increase across midnight was split by elapsed time between nearby readings.');
 if(row.resets)notes.push('A weekly reset occurred on this day.');
 if(row.restores)notes.push(row.restores+' confirmed restore'+(row.restores===1?'':'s')+' lowered the reported counter by '+dailyNumber(row.restoredPoints||0)+' percentage points. That decrease is not negative consumption.');
 notes.push('Days follow '+model.timezone+'.');
 tip(title,body,notes.join(' '));
} function remainingCaption(reset){
  const minutes=Math.ceil((Date.parse(reset)-now)/60000);
  if(!Number.isFinite(minutes))return 'Reset unknown';
  if(minutes<=0)return 'Awaiting reset';
  if(minutes<60)return 'In '+minutes+'m';
  if(minutes<1440)return 'In '+Math.floor(minutes/60)+'h '+minutes%60+'m';
  return 'In '+Math.floor(minutes/1440)+'d '+Math.floor(minutes%1440/60)+'h';
 }
 function currentAccounts(){
  return Object.keys(P).map(key=>{
   const row=currentRows(key)[0],provider=providerData(key),unknown=!row||row.usedPercent===null,old=stale(key),due=row&&expired(row);
   const value=unknown||due?'—':pc(row)+'%',reset=row?.resetsAt;
   const resetDate=reset?calendarStamp(reset,{weekday:'short',hour:'numeric',minute:'2-digit'}):'Reset unknown';
   const label=P[key].name+', '+(unknown?'weekly reading unavailable':due?'awaiting a new reset reading':dailyNumber(row.usedPercent)+'% of weekly allowance used'+(old?', saved reading':''))+'. '+(reset?'Resets '+resetDate+'. ':'')+'Open all allowance details.';
   return `<button class="pu-account ${old||due?'is-stale':''}" data-allowance-provider="${key}" aria-label="${esc(label)}" style="--account-color:${P[key].color}"><span class="pu-account-name">${mark(key)}${P[key].name}</span><span class="pu-account-value">${value}${old&&!unknown&&!due?'<small>last</small>':''}</span>${row?meter(key,row):'<span class="quota-bar unavailable" aria-hidden="true"></span>'}<span class="pu-reset-date">${esc(resetDate)}</span><span class="pu-reset-left">${esc(reset?remainingCaption(reset):provider.status==='available'?'No weekly limit reported':'Not connected')}</span></button>`;
  }).join('');
 }
 function timelineIdentityHTML(){
  return Object.keys(P).map(key=>{
   const row=currentRows(key)[0],pace=availablePace(key,row),label=pace?paceLabel(pace.multiplier):'—';
   return `<section class="history-fixed-row" data-provider="${key}"><div class="calendar-identity"><button class="timeline-provider" data-allowance-provider="${key}" aria-label="${P[key].name} allowance details" style="color:${P[key].color}">${mark(key)}<span>${P[key].name}</span></button><button class="calendar-pace ${pace?'':'is-unavailable'}" data-available-pace="${key}" aria-label="${P[key].name}, catch up at ${esc(label)} relative to normal weekly pace"><span class="calendar-pace-label">Catch up at:</span><span class="calendar-pace-value">${esc(label)}</span></button></div></section>`;
  }).join('');
 }
 function ensureDialog(){
  let dialog=$('phone-usage-dialog');if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.id='phone-usage-dialog';dialog.className='pu-dialog';dialog.setAttribute('aria-labelledby','pu-dialog-title');
  dialog.innerHTML='<header><h2 id="pu-dialog-title"></h2><button type="button" data-usage-close aria-label="Close usage details">×</button></header><div class="pu-dialog-body"></div>';
  dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-usage-close]'))closeTip();});
  dialog.addEventListener('close',()=>{if(dialogFocus?.isConnected)dialogFocus.focus({preventScroll:true});dialogFocus=null;});
  document.body.append(dialog);return dialog;
 }
 function showDetail(title,body){
  const dialog=ensureDialog();dialogFocus=document.activeElement;
  dialog.querySelector('h2').textContent=title;dialog.querySelector('.pu-dialog-body').innerHTML=body;
  if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
  dialog.querySelector('[data-usage-close]').focus({preventScroll:true});
 }
 function closeTip(){const dialog=$('phone-usage-dialog');if(!dialog?.open)return;if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}
 function tip(title,body,sub=''){showDetail(title,`<p>${esc(body)}</p>${sub?`<p class="pu-note">${esc(sub)}</p>`:''}`);}
 function showProviderDetails(key){
  if(!P[key])return;
  showDetail(P[key].name+' allowances',NowUsage.render(DATA.providers,{provider:key,now})+`<p class="pu-note">${esc(rawTokenSummary(key))}</p>`);
 }
 function adaptedItems(){
  return (snapshot?.items||[]).map(item=>({key:String(item.provider||'').toLowerCase(),identity:item.key,id:item.id,kind:item.kind,title:item.title,state:item.state,
   at:Date.parse(item.at),place:String(item.location||'').toLowerCase(),sessionUrl:item.sessionUrl,url:item.url}));
 }
 function cacheRows(){return window.NowRecentUsage?.select(adaptedItems(),HISTORY.sessionUsage,{now})||[];}
 function setHTML(node,text){if(node&&node._usageHTML!==text){node.innerHTML=text;node._usageHTML=text;}}
 function render(){
  host=$('usage');if(!host||rendering||!window.NowUsage)return;rendering=true;
  const scroll=window.NowViews?.scrollPosition?.('usage')??host.scrollTop,focus=document.activeElement;
  const focusKey=focus?.dataset.recentSession||focus?.dataset.allowanceProvider||focus?.dataset.availablePace;
  const focusType=focus?.dataset.recentSession?'recent-session':focus?.dataset.allowanceProvider?'allowance-provider':focus?.dataset.availablePace?'available-pace':'';
  now=Date.now();
  try{
   if(!host.querySelector('.pu-shell')){
    host.innerHTML=`<div class="pu-shell"><section class="pu-current" aria-label="Current weekly allowances"><h2>Weekly allowances</h2><div class="pu-accounts"></div></section>${NowUsage.workspace({timeline:rowChart()})}<div id="usage-recent-sessions"></div></div>`;
   }
   setHTML(host.querySelector('.pu-accounts'),currentAccounts());
   updateTimelineIdentity();
   setHTML($('usage-recent-sessions'),window.NowRecentUsage?.render(cacheRows(),{now})||'');
   const footer=$('usage-calendar-footer');
   if(footer&&archiveSaved)footer.insertAdjacentHTML('beforeend','<p class="pu-saved">Saved history · '+esc(new Date(HISTORY.updatedAt).toLocaleString())+'</p>');
   if(focusType&&!focus.isConnected)[...host.querySelectorAll('[data-'+focusType+']')].find(node=>node.getAttribute('data-'+focusType)===focusKey)?.focus({preventScroll:true});
   requestAnimationFrame(()=>mountHistoryRail());
   if(window.NowViews?.scrollTo)window.NowViews.scrollTo(scroll,'usage');else if(host.scrollTop!==scroll)host.scrollTop=scroll;
  }finally{rendering=false;}
 }
 function validArchive(value){
  return value?.schemaVersion===1&&Array.isArray(value.periods)&&value.periods.length<=20000&&Array.isArray(value.tokenDays)&&value.tokenDays.length<=100000
   &&Number.isFinite(Date.parse(value.updatedAt))&&(!value.dailyAllowance||Array.isArray(value.dailyAllowance.days)&&Array.isArray(value.dailyAllowance.providers));
 }
 function restoreHistory(){
  try{const text=localStorage.getItem(HISTORY_KEY);if(!text||text.length>MAX_HISTORY)return;const saved=JSON.parse(text);if(validArchive(saved)){HISTORY=saved;archiveLoaded=true;archiveSaved=true;}}
  catch{/* Browser storage is optional. */}
 }
 async function refresh(){
  if(archiveBusy||document.hidden)return;archiveBusy=true;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
   const response=await fetch('/api/v1/usage-history',{cache:'no-store',signal:controller.signal});
   if(response.status===403){HISTORY=emptyHistory();archiveLoaded=false;archiveSaved=false;try{localStorage.removeItem(HISTORY_KEY);}catch{}return;}
   if(!response.ok||Number(response.headers.get('content-length'))>MAX_HISTORY)throw Error('Unavailable');
   const text=await response.text();if(text.length>MAX_HISTORY)throw Error('Oversized history');
   const value=JSON.parse(text);if(!validArchive(value))throw Error('Invalid history');
   HISTORY=value;archiveLoaded=true;archiveSaved=false;
   try{localStorage.setItem(HISTORY_KEY,text);}catch{}
   window.dispatchEvent(new CustomEvent('nowusagearchivechange'));
  }catch{archiveSaved=archiveLoaded;}
  finally{clearTimeout(timer);archiveBusy=false;archiveAttempted=true;render();}
 }
 function update(value){snapshot=value;DATA.providers=Array.isArray(value?.usage)?value.usage:[];render();}
 document.addEventListener('click',event=>{
  if(!event.target.closest('#usage'))return;
  const provider=event.target.closest('[data-allowance-provider]');if(provider){showProviderDetails(provider.dataset.allowanceProvider);return;}
  const session=event.target.closest('[data-recent-session]');
  if(session&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!event.shiftKey){event.preventDefault();window.NowPhone?.openSession(session.dataset.recentSession);return;}
  const pace=event.target.closest('[data-available-pace]');if(pace){const key=pace.dataset.availablePace,row=currentRows(key)[0];showAvailablePace({key,window:row,pace:availablePace(key,row),reset:row?.resetsAt});return;}
  const marker=event.target.closest('[data-usage-history-marker]');if(marker){showUsageHistoryMarker(marker.dataset.usageHistoryMarker);return;}
  const day=event.target.closest('[data-daily-day]');if(day){showDailyDay(day.dataset.dailyVendor,day.dataset.dailyDay);return;}
  if(event.target.closest('[data-timeline-today]')){showTimelineToday();return;}
  if(event.target.closest('[data-pace-guide-info]')){showDailyPaceGuides();return;}
  if(event.target.closest('[data-daily-info]')){tip('Daily allowance use','Bars show percentage points of weekly allowance consumed on each date. All three vendors share the same scale.','Hatching marks incomplete readings. Striped empty slots lack sufficient readings. Today is unfinished. Unknown gaps and reset tails are not guessed.');return;}
  if(event.target.closest('[data-timeline-info]'))tip('Usage and resets','Colored reset arrows show the last saved percentage before reset. Gray arrows show current reported use against the next reset. Diamonds mark observed counter drops.','Daily bars measure percentage points of weekly allowance. The catch-up multiplier is available capacity for the remaining time, not a prediction. Dates follow '+calendarZone()+'.');
 });
 document.addEventListener('keydown',event=>{
  const button=event.target.closest('#usage [data-daily-day]');if(!button||event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();
  const items=[...button.closest('[data-daily-chart]').querySelectorAll('[data-daily-day]')],index=items.indexOf(button);
  const next=event.key==='Home'?0:event.key==='End'?items.length-1:Math.max(0,Math.min(items.length-1,index+(event.key==='ArrowRight'?1:-1)));
  items[next].focus({preventScroll:true});timelineKeyboardDetail=true;
  const rail=$('reset-history-scroll'),target=railX(items[next].dataset.dailyDay);
  if(target<rail.scrollLeft)rail.scrollLeft=target;else if(target+timelinePlan.cell>rail.scrollLeft+rail.clientWidth)rail.scrollLeft=target+timelinePlan.cell-rail.clientWidth;
  showDailyDay(items[next].dataset.dailyVendor,items[next].dataset.dailyDay);
 });
 window.addEventListener('pointerup',()=>timelinePointer=false);
 window.addEventListener('pointercancel',()=>timelinePointer=false);
 window.addEventListener('resize',()=>requestAnimationFrame(()=>mountHistoryRail(true)));
 window.addEventListener('nowviewchange',()=>{closeTip();if(window.NowViews?.current()==='usage')requestAnimationFrame(render);});
 window.addEventListener('pageshow',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();refresh();}});
 window.NowPhoneUsage={update,refresh,sessionUsage:()=>archiveSaved?{...HISTORY.sessionUsage,available:false}:HISTORY.sessionUsage||{},recentRows:cacheRows,
  state:()=>({archiveLoaded,archiveSaved,archiveAttempted,updatedAt:HISTORY.updatedAt,followingToday:timelineFollowToday,anchor:timelineAnchor}),showProvider:showProviderDetails};
 restoreHistory();render();refresh();
 setInterval(refresh,60000);
 setInterval(()=>{if(!document.hidden)render();},30000);
})();
