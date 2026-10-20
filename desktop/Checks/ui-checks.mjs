import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../ui/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../ui/laptop.js', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'https://desktop.web-tools.local/index.html', runScripts: 'outside-only' });
const { window } = dom;
const messages = [];
let receive;
window.chrome = { webview: {
  postMessage: message => messages.push(message),
  addEventListener: (event, listener) => { if (event === 'message') receive = listener; },
} };
window.eval(script);
const now = new Date().toISOString();
const data = {
  machineName: 'Fixture laptop', seenThrough: now,
  activity: { observedAt: now, connected: true, errands: [{
    id: 'fixture-1', title: 'A result <img src=x onerror=alert(1)>', note: '<b>Untrusted note</b>',
    state: 'complete', createdAt: now, updatedAt: now, isNew: true,
    hasLocalOutput: true, reply: '<script>alert(1)</script>',
  }] },
  daemon: { state: 'detected', detail: 'Fixture worker', lastLogAt: now },
  applications: [{name: 'Fixture app', detail: 'Open application', state: 'open'}],
  places: [{id: 'outputs', name: 'Outputs', detail: 'Fixture output folder'}],
  downloads: [{id: '0', name: '<img src=x>.txt', modifiedAt: now}],
};
const snapshot = () => receive({ data: { type: 'snapshot', data } });
snapshot();
assert.equal(window.document.querySelector('#new-count').textContent, '1');
assert.equal(window.document.querySelector('img'), null, 'Untrusted titles and filenames stay text.');
window.document.querySelector('.errand-title').click();
assert.equal(window.document.querySelector('.errand-detail b'), null, 'Untrusted notes stay text.');
assert.equal(window.document.querySelectorAll('script').length, 2, 'Reply markup never becomes a script.');
const expandedTitle = window.document.querySelector('.errand-title');
data.activity.observedAt = new Date(Date.now() + 15000).toISOString();
snapshot();
assert.equal(window.document.querySelector('.errand-title'), expandedTitle, 'A periodic check keeps focused errand controls stable.');
assert.ok(window.document.querySelector('.errand-detail'), 'A periodic check preserves an expanded result.');
window.document.querySelector('[data-action=output]').click();
assert.equal(messages.at(-1).action, 'output');
assert.equal(messages.at(-1).id, 'fixture-1');
window.document.querySelector('[data-action=errand]').click();
assert.equal(messages.at(-1).action, 'errand');
window.document.querySelector('[data-filter=queued]').click();
assert.match(window.document.querySelector('#errands').textContent, /No errands in the queue/);
window.document.querySelector('[data-filter=all]').click();
const search = window.document.querySelector('#search');
search.value = 'no matching title';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.match(window.document.querySelector('#errands').textContent, /No matching errands/);
window.document.querySelector('[data-action=seen]').click();
assert.equal(messages.at(-1).action, 'seen');
dom.window.close();
console.log('12 laptop UI checks passed: text handling, refresh stability, filters, and desktop actions.');
