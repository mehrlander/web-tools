import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';

const read = path => readFileSync(new URL(path,import.meta.url),'utf8');
const html = read('../phone/index.html'), views = read('../phone/views.js');
const swipe = read('../../lib/kits/swipe-deck.js');
const names = ['now','usage','errands','computer','files'];
let checks = 0;
const check = (condition,message) => { assert.ok(condition,message); checks++; };
const flush = () => new Promise(resolve => setImmediate(resolve));

async function fixture(hash = '', options = {}) {
  const errors = [], virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError',error => errors.push(error));
  const dom = new JSDOM(html,{url:'https://fixture.example.ts.net/'+hash,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
  const w = dom.window, doc = w.document, panels = [...doc.querySelectorAll('[data-slide]')];
  const panel = name => panels.find(node => node.dataset.slide === name);
  const track = panels[0]?.parentElement;
  assert.ok(track,'The document supplies the swipe track before navigation mounts.');
  const hosts = {computer:doc.getElementById('computer'),devices:doc.getElementById('devices')};
  const activations = [], historyWrites = [], rafs = new Map();
  let nextFrame = 0, driver, positions = 0, updates = 0, horizontal = options.horizontal !== false;
  const sizeObservers = [];
  w.ResizeObserver = class {
    constructor(callback){this.callback=callback;this.targets=new Set();sizeObservers.push(this);}
    observe(target){this.targets.add(target);}
    disconnect(){this.targets.clear();}
  };
  Object.defineProperty(w,'scrollY',{configurable:true,get:() => 0});
  w.scrollTo = () => { throw new Error('Navigation must scroll its panel, not the document.'); };
  if (!('inert' in w.HTMLElement.prototype)) Object.defineProperty(w.HTMLElement.prototype,'inert',{
    configurable:true,get(){return this.hasAttribute('inert');},set(value){this.toggleAttribute('inert',Boolean(value));}
  });
  w.requestAnimationFrame = callback => { const id=++nextFrame;rafs.set(id,callback);return id; };
  w.cancelAnimationFrame = id => rafs.delete(id);
  const frames = () => {
    for(let pass=0;rafs.size&&pass<20;pass++) {
      const pending=[...rafs.values()];rafs.clear();pending.forEach(callback=>callback(w.performance.now()));
    }
  };
  const box = (left,top=57) => ({left,right:left+390,top,bottom:top+593,width:390,height:593,x:left,y:top,toJSON(){return {};}});
  Object.defineProperty(track,'clientWidth',{configurable:true,value:390});
  track.getBoundingClientRect = () => box(0);
  track.scrollTo = value => { track.scrollLeft = value.left ?? track.scrollLeft; };
  panels.forEach((node,index) => {
    node.getBoundingClientRect = () => horizontal ? box(index*390-track.scrollLeft) : box(0,57+index*593);
    node.scrollTo = value => { node.scrollTop = typeof value==='number'?value:value.top??node.scrollTop; };
  });
  const module = name => ({connection(){},setActive(value){activations.push([name,value]);}});
  w.NowComputer=module('computer');w.NowDevices=module('devices');w.NowErrands={...module('errands'),mount(){}};
  w.NowRepositories={...module('files'),positionPanels(){positions++;}};
  w.NowLocalFiles={header(){}};w.TitleTip={close(){}};
  const serviceWorker = new w.EventTarget();
  const registration={update:async()=>{updates++;}};
  serviceWorker.register=async()=>registration;
  serviceWorker.ready=Promise.resolve(registration);
  serviceWorker.getRegistration=async()=>registration;
  Object.defineProperty(w.navigator,'serviceWorker',{configurable:true,value:serviceWorker});
  for(const name of ['pushState','replaceState']) {
    const original=w.history[name].bind(w.history);
    w.history[name]=(...args)=>{historyWrites.push({method:name,url:args[2]});return original(...args);};
  }
  w.eval(swipe);
  const strip=w.swipeDeck.strip;
  w.swipeDeck.strip=options=>{driver=strip(options);return driver;};
  w.eval(views);frames();await flush();frames();
  return {dom,w,doc,panels,panel,track,hosts,activations,historyWrites,errors,frames,
    driver:()=>driver,positions:()=>positions,updates:()=>updates,serviceWorker,
    setHorizontal:value=>{horizontal=value;},
    notifySize:()=>sizeObservers.filter(observer=>observer.targets.size).forEach(observer=>observer.callback([])),
    startupObservers:()=>sizeObservers.filter(observer=>observer.targets.size>1).length,
    restyle:()=>{const style=doc.createElement('style');style.textContent='/* Updated browser utilities */';doc.head.append(style);}};
}

const h = await fixture();
try {
  const {w,doc,panel}=h;
  check(h.panels.length===5&&h.panels.map(node=>node.dataset.slide).join(',')===names.join(','),'The native strip has exactly the five ordered view panels.');
  check(h.panels.every(node=>node.parentElement===h.track&&!node.hidden),'All five slides stay mounted in the same track without display:none removing their layout.');
  check([...doc.querySelectorAll('#view-menu [data-view]')].map(node=>node.dataset.view).join(',')===names.join(','),'The title menu contains the same five destinations, without a separate Devices entry.');
  check(typeof w.NowViews.setView==='function'&&typeof w.NowViews.scrollPosition==='function'&&typeof w.NowViews.scrollTo==='function','Navigation exposes explicit view and panel-scroll methods.');
  w.NowViews.scrollTo(240);w.NowViews.scrollTo(170,'usage');w.NowViews.scrollTo(95,'files');
  check(panel('now').scrollTop===240&&panel('usage').scrollTop===170&&panel('files').scrollTop===95,'Default and explicit scroll writes affect only their owning panels.');
  w.NowViews.setView('usage');h.frames();
  check(w.NowViews.scrollPosition()===240&&w.NowViews.scrollPosition('usage')===170&&w.NowViews.scrollPosition('files')===95,'Reading another view does not change the default Now reading position.');
  check(h.panels.every(node=>node.dataset.slide==='usage'?!node.inert&&node.getAttribute('aria-hidden')!=='true':node.inert&&node.getAttribute('aria-hidden')==='true'),'Inactive mounted panels are inert and hidden from accessibility navigation.');
  w.NowViews.setView('computer');h.frames();
  check(doc.getElementById('computer')===h.hosts.computer&&doc.getElementById('devices')===h.hosts.devices&&h.hosts.computer.parentElement===h.hosts.devices.parentElement&&panel('computer').contains(h.hosts.computer),'Computer and Devices retain their original sibling host elements inside Computer.');
  check(!h.hosts.computer.hidden&&!h.hosts.devices.hidden&&h.activations.some(([name,on])=>name==='computer'&&on)&&h.activations.some(([name,on])=>name==='devices'&&on),'Both Computer modules are visible and active together.');
  w.NowViews.setView('files');h.frames();
  const before=h.positions();panel('files').dispatchEvent(new w.Event('scroll'));
  check(h.positions()>before,'Scrolling the Files element repositions its anchored panels.');
  w.NowViews.setView('now');h.frames();
  check(w.NowViews.scrollPosition()===240&&w.NowViews.scrollPosition('usage')===170&&w.NowViews.scrollPosition('files')===95,'Returning through views retains independent panel positions.');
  doc.getElementById('overview').hidden=true;
  panel('now').scrollTop=0;panel('now').dispatchEvent(new w.Event('scroll'));
  check(w.NowViews.scrollPosition()===240,'A browser-clamped scroll event while focused detail hides the overview does not erase the remembered Now position.');
  w.NowViews.setView('usage');h.frames();w.NowViews.setView('now');h.frames();
  check(panel('now').scrollTop===240&&w.NowViews.scrollPosition()===240,'Returning through Usage restores the remembered Now position after hidden content was clamped to zero.');
  w.NowViews.setView('usage');h.frames();
  const seen=[];w.addEventListener('popstate',()=>seen.push({view:w.NowViews.current(),hash:w.location.hash}));
  w.history.replaceState({nowDetail:true},'','#item=synthetic-session');
  w.dispatchEvent(new w.PopStateEvent('popstate'));
  check(seen.length===1&&seen[0].view==='now'&&seen[0].hash==='#item=synthetic-session','Session history activates Now before later popstate listeners and does not stop their propagation.');
  w.NowViews.setView('now',false);h.frames();
  check(w.location.hash==='#item=synthetic-session','A nonnavigating Now selection preserves the existing session-detail route.');
  w.NowViews.setView('usage');h.frames();
  w.history.replaceState({nowDetail:true},'','#view=now&session=cloud%3Aencoded%2Fkey');
  w.dispatchEvent(new w.PopStateEvent('popstate'));
  check(seen.length===2&&seen.at(-1).view==='now'&&new URLSearchParams(seen.at(-1).hash.slice(1)).get('session')==='cloud:encoded/key','An encoded session route activates Now before later popstate listeners without losing its key.');
  w.NowViews.setView('now',false);h.frames();
  check(w.location.hash==='#view=now&session=cloud%3Aencoded%2Fkey','A nonnavigating Now selection preserves the explicit encoded session route.');
  await flush();const updates=h.updates();
  w.dispatchEvent(new w.Event('pageshow'));doc.dispatchEvent(new w.Event('visibilitychange'));await flush();
  check(h.updates()>updates,'Returning to the foreground asks the service-worker registration to check for an update.');
  h.serviceWorker.dispatchEvent(new w.Event('controllerchange'));await flush();
  check(!h.errors.length,'Foreground and controller changes preserve the current page without a forced reload.');
} finally {h.dom.window.close();}

for(const [hash,view] of [['#view=devices','computer'],['#view=repositories&folder=project%2Fdata&filter=ignored&checkout=1234567890abcdef12345678','files'],['#view=repositories&root=','files']]) {
  const alias=await fixture(hash);
  try {
    const params=new URLSearchParams(alias.w.location.hash.slice(1));
    check(alias.w.NowViews.current()===view&&params.get('view')===view,'A legacy view alias lands on its canonical swipe destination.');
    if(view==='files'){
      check(params.get('root')==='gh','A legacy repository alias without a usable root retains gh.');
      if(hash.includes('folder='))check(params.get('folder')==='project/data'&&params.get('filter')==='ignored'&&params.get('checkout')==='1234567890abcdef12345678','Normalizing a repository alias preserves its folder, filter and checkout parameters.');
    }
    check(!alias.errors.length,'Direct legacy routes initialize without document scrolling or script errors.');
  } finally {alias.dom.window.close();}
}

const native=await fixture();
try {
  const before=native.historyWrites.length;
  native.track.scrollLeft=390;native.driver().read();native.frames();
  check(native.w.NowViews.current()==='usage'&&native.w.location.hash==='#view=usage','The strip driver reports a native swipe into the Usage route.');
  native.driver().read();native.frames();
  check(native.historyWrites.length===before+1,'Reading the same landed slide again creates no duplicate history entry.');
  check(native.panel('usage').getAttribute('aria-hidden')!=='true'&&!native.panel('usage').inert&&native.panel('now').inert,'A native slide change updates accessibility state along with the route.');
  check(!native.errors.length,'Native strip navigation has no document-scroll fallback or script errors.');
} finally {native.dom.window.close();}

const delayed=await fixture('#view=usage',{horizontal:false});
try {
  const {w,track,panel}=delayed,historyWrites=delayed.historyWrites.length;
  track.dispatchEvent(new w.Event('scroll'));track.dispatchEvent(new w.Event('scrollend'));delayed.frames();
  check(track.clientWidth===390&&track.scrollLeft===0&&w.NowViews.current()==='usage'
    &&delayed.historyWrites.length===historyWrites&&delayed.startupObservers()===1,
    'Full-width vertically stacked startup panels neither complete alignment nor let a native reading overwrite the Usage route.');
  delayed.setHorizontal(true);delayed.restyle();await flush();delayed.frames();
  check(track.scrollLeft===390&&panel('usage').getBoundingClientRect().left===track.getBoundingClientRect().left
    &&w.NowViews.current()==='usage'&&!panel('usage').inert&&delayed.startupObservers()===0,
    'Styles that create horizontal panels at the same track width align Usage and release the startup size observer.');
  w.NowViews.scrollTo(275,'usage');track.scrollLeft=430;delayed.restyle();delayed.notifySize();await flush();delayed.frames();
  check(track.scrollLeft===430&&w.NowViews.scrollPosition('usage')===275,
    'Later stylesheet mutations and unchanged resize notifications preserve a user drag and the panel reading position.');
  check(!delayed.errors.length,'Delayed utility layout has no navigation or script errors.');
} finally {delayed.dom.window.close();}

const changedBeforeStyles=await fixture('#view=usage',{horizontal:false});
try {
  const {w,track,panel}=changedBeforeStyles;
  w.NowViews.setView('files');changedBeforeStyles.frames();
  check(track.scrollLeft===0&&w.NowViews.current()==='files','Selecting another view before styles arrive retains the new destination without aligning stacked panels.');
  changedBeforeStyles.setHorizontal(true);changedBeforeStyles.notifySize();changedBeforeStyles.frames();
  check(track.scrollLeft===1560&&w.NowViews.current()==='files'&&!panel('files').inert,
    'The first horizontal layout aligns the latest selected view rather than the original cold route.');
} finally {changedBeforeStyles.dom.window.close();}

const hiddenStartup=await fixture('#view=now&session=cloud%3Afixture',{horizontal:false});
try {
  const {w,doc,track}=hiddenStartup;
  doc.getElementById('overview').hidden=true;
  hiddenStartup.setHorizontal(true);hiddenStartup.restyle();await flush();hiddenStartup.frames();
  check(hiddenStartup.startupObservers()===1,'A hidden overview during focused detail keeps startup alignment pending.');
  w.NowViews.setView('usage');hiddenStartup.frames();
  check(track.scrollLeft===390&&hiddenStartup.startupObservers()===0,
    'Returning from focused detail completes pending alignment without a permanent frame loop.');
} finally {hiddenStartup.dom.window.close();}

const explicitRefresh=await fixture();
try {
  const {w,doc}=explicitRefresh,button=doc.querySelector('#view-menu [data-interface-refresh]');
  doc.getElementById('view-picker').click();
  check(button?.getAttribute('role')==='menuitem'&&!doc.getElementById('view-menu').hidden&&button.textContent.includes('Refresh')&&button.querySelector('[data-interface-version]')?.textContent==='v'+w.NowViews.interfaceVersion,'The title dropdown visibly offers Refresh with the current interface version.');
  doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));
  check(doc.activeElement===button,'End reaches Refresh as the last keyboard menu item.');
  button.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
  const previous=doc.activeElement.hasAttribute('data-sync-status');
  doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  check(previous&&doc.activeElement===button,'Arrow keys include Connection status and Refresh alongside the view choices.');
  const updates=explicitRefresh.updates();button.click();await flush();await flush();
  check(explicitRefresh.updates()>updates&&doc.getElementById('view-menu').hidden&&doc.activeElement.id==='view-picker'&&explicitRefresh.errors.some(error=>/navigation/i.test(error.message)),'An explicit Refresh closes the menu, restores picker focus, checks the worker, and requests a reload; foreground checks alone never reload.');
} finally {explicitRefresh.dom.window.close();}



const contextual=await fixture();
try {
  const {w,doc}=contextual,link=doc.getElementById('web-tools-link');
  const target=()=>new URL(link.href);
  for(const [view,main] of [['now','sessions'],['usage','usage'],['errands','stage'],['computer','local-work'],['files','local-work']]) {
    w.NowViews.setView(view);contextual.frames();
    check(target().searchParams.get('view')===main,'The '+view+' header opens the corresponding Web Tools view.');
    if(view==='errands')check(target().searchParams.get('tab')==='errands','Errands opens the main app queue rather than the Stage landing.');
  }
  w.NowViews.setView('now');
  const recorded='https://mehrlander.github.io/web-tools/pages/session.html#gh=mehrlander/web-tools-private@main:sessions/2026/11/2026-11-18-abcdef1234567890.json';
  w.NowViews.setContext({kind:'session',url:recorded});
  check(link.href===recorded&&link.getAttribute('aria-label').includes('captured session'),'A selected captured session keeps its exact Web Tools reader destination.');
  for(const url of ['javascript:alert(1)','https://mehrlander.github.io.evil.test/web-tools/app/','https://user@mehrlander.github.io/web-tools/app/']) {
    w.NowViews.setContext({url});check(target().searchParams.get('view')==='sessions','Untrusted context links fall back to the owning view.');
  }
  w.NowViews.setContext({kind:'errand',url:'https://mehrlander.github.io/web-tools/app/?view=stage&errand=saved-1'});
  check(target().searchParams.get('errand')==='saved-1'&&link.getAttribute('aria-label').includes('errand'),'Selected errands preserve their saved request or result destination.');
  w.NowViews.setContext(null);
  check(target().searchParams.get('view')==='sessions'&&!target().searchParams.has('errand'),'Closing a detail clears its context destination.');
  w.NowRepositories.context=()=>({repo:'fixture/project',ref:'codex/topic',path:'src/nested folder'});
  w.NowViews.setView('files');contextual.frames();
  check(target().searchParams.get('repo')==='fixture/project'&&target().searchParams.get('view')==='files'
    &&target().searchParams.get('ref')==='codex/topic'&&target().searchParams.get('path')==='src/nested folder',
    'A local Git folder carries repository, branch and relative path into the GitHub Files reader.');
  w.NowRepositories.context=()=>({repo:'fixture/project',ref:'(detached)',path:'src'});w.NowViews.refreshContext();
  check(target().searchParams.get('repo')==='fixture/project'&&!target().searchParams.has('view')&&!target().searchParams.has('ref'),'A detached folder without a named source opens the repository overview rather than guessing a GitHub branch.');
  w.NowRepositories.context=()=>({repo:'fixture/project',ref:'main',path:'../private'});w.NowViews.refreshContext();
  check(target().searchParams.get('view')==='local-work','A folder traversal cannot enter a Web Tools file address.');
  check(!contextual.errors.length,'Contextual navigation does not cause browser or script errors.');
} finally {contextual.dom.window.close();}

console.log(`${checks} navigation interaction checks passed.`);
