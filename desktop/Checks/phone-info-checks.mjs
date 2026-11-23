import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const dom=new JSDOM('<button id="first">61%</button><button id="second">Context</button><div id="page"></div>',{runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,doc=w.document;
w.matchMedia=()=>({matches:true});
w.requestAnimationFrame=fn=>{fn();return 0;};
const viewport=new w.EventTarget();Object.assign(viewport,{width:390,height:844,offsetLeft:0,offsetTop:0});
Object.defineProperty(w,'visualViewport',{value:viewport});
for(const path of ['../../lib/kits/panel-tip.js','../shared/phone-info.js'])w.eval(readFileSync(new URL(path,import.meta.url),'utf8'));
const first=doc.getElementById('first'),second=doc.getElementById('second');
const show=(anchor=first)=>w.NowPhoneInfo.open({anchor,title:'Tokens <untrusted>',body:'<p>Exact recorded count</p>'});
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
try{
 first.focus();show();
 let panel=doc.querySelector('#phone-info-card');
 check(panel?.getAttribute('role')==='dialog'&&panel.getAttribute('aria-modal')==='false'&&!doc.querySelector('dialog'),
  'A metric opens an anchored nonmodal disclosure, leaving the surrounding list available.');
 check(panel.querySelector('h2').textContent==='Tokens <untrusted>'&&!panel.querySelector('untrusted')&&first.getAttribute('aria-expanded')==='true',
  'Titles are escaped and the trigger identifies its open disclosure.');
 panel.querySelector('[data-wt-panel-tip-close]').click();
 check(!doc.querySelector('#phone-info-card')&&doc.activeElement===first&&!first.hasAttribute('aria-controls'),
  'The shared close control restores its trigger and removes transient accessibility state.');
 show();doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 check(!doc.querySelector('#phone-info-card')&&doc.activeElement===first,'Escape returns to the metric.');
 show();show(second);
 check(doc.querySelectorAll('#phone-info-card').length===1&&second.getAttribute('aria-expanded')==='true'&&!first.hasAttribute('aria-expanded'),
  'Selecting another metric replaces the card without leaving an earlier trigger expanded.');
 panel=doc.querySelector('#phone-info-card');panel.dispatchEvent(new w.Event('scroll'));
 check(doc.querySelector('#phone-info-card')===panel,'Scrolling long metric details keeps the card open.');
 doc.getElementById('page').dispatchEvent(new w.Event('scroll'));
 check(!doc.querySelector('#phone-info-card'),'Scrolling the underlying page dismisses details before the anchor can drift.');
 show();doc.getElementById('page').dispatchEvent(new w.Event('pointerdown',{bubbles:true}));
 check(!doc.querySelector('#phone-info-card'),'An outside press dismisses the card through shared panel-tip behavior.');
 show();w.dispatchEvent(new w.Event('nowviewchange'));
 check(!doc.querySelector('#phone-info-card'),'Navigating away removes the metric card.');
 show();viewport.dispatchEvent(new w.Event('resize'));
 check(!doc.querySelector('#phone-info-card'),'Changing the iPhone visual viewport dismisses details before their position can drift.');
 show();first.replaceWith(first.cloneNode(true));await Promise.resolve();
 check(!doc.querySelector('#phone-info-card'),'Replacing a metric during background polling removes its anchored detail without stealing focus.');
 console.log(checks+' anchored metric disclosure checks passed.');
}finally{w.close();}
