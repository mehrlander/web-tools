// kits/browser-kind.js names a browser the same way for the Here view, the
// Traffic pane and the traffic log: the reader's own name for it if they gave
// one, else the kind read off the browser. The cases that matter are the ones
// the user-agent string gets wrong on its own: Chrome on iOS calls itself
// Safari as well, and an iPad asks for desktop sites as a Mac.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const src = readFileSync(path.join(repoRoot, 'lib/kits/browser-kind.js'), 'utf8');
const load = (store = {}) => {
  const window = { navigator: {}, matchMedia: () => ({ matches: false }) };
  const localStorage = { getItem: (k) => (k in store ? store[k] : null) };
  new Function('window', 'localStorage', src)(window, localStorage);
  return window.BrowserKind;
};
const B = load();
const no = () => false;
const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
  ipadAsMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0',
};

test('the kind reads the browser and the platform, and says when it is a home-screen app', () => {
  assert.equal(B.kind(B.detect({ userAgent: UA.iphoneSafari, maxTouchPoints: 5 }, no)), 'iPhone Safari');
  assert.equal(B.kind(B.detect({ userAgent: UA.iphoneChrome, maxTouchPoints: 5 }, no)), 'iPhone Chrome', 'CriOS is Chrome, though it names Safari too');
  assert.equal(B.kind(B.detect({ userAgent: UA.ipadAsMac, maxTouchPoints: 5 }, no)), 'iPad Safari', 'a Mac with a touch screen is an iPad');
  assert.equal(B.kind(B.detect({ userAgent: UA.ipadAsMac, maxTouchPoints: 0 }, no)), 'Mac Safari');
  assert.equal(B.kind(B.detect({ userAgent: UA.macChrome, maxTouchPoints: 0 }, no)), 'Mac Chrome');
  assert.equal(B.kind(B.detect({ userAgent: UA.windowsEdge, maxTouchPoints: 0 }, no)), 'Windows Edge');
  assert.equal(B.kind(B.detect({ userAgent: UA.iphoneSafari, maxTouchPoints: 5, standalone: true }, no)), 'iPhone Safari, home screen');
});

test('the reader\'s own name for the browser comes first', () => {
  assert.equal(load({ 'wt:browserNote': 'Desk Chrome' }).name(), 'Desk Chrome');
  assert.equal(load({}).name(), load({}).kind(), 'with no name given, the kind');
});
