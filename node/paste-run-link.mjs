#!/usr/bin/env node
// node/paste-run-link.mjs: mint a link to pages/paste-run.html carrying a
// function, so a session can ask the reader to run it on data the session
// should not see and hand back only the result.
//
// Usage:
//   npm run -s paste-run-link -- <fn.js> [--title "<title>"] [--ask "<one line>"] [--send <owner/repo@ref:folder/file>] [--page <url>]
//
// <fn.js> holds the source of one function, (rows, text) => result; rows are
// the paste as a table, text the paste itself (pages/paste-run.html says how a
// result shows). --send names where the page's Send aims the Web Tools stage;
// without it the reader copies the result. The payload is {title?, ask?, fn,
// send?} as JSON, gzipped, base64url, in #gz=, the form kits/gz-payload.js
// reads. --page points the link at another copy of the page, such as a local
// server under test. The link goes to stdout and its length to stderr.

import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const PAGE = 'https://mehrlander.github.io/web-tools/pages/paste-run.html';
const fail = (msg) => { console.error('paste-run-link: ' + msg); process.exit(1); };

const args = process.argv.slice(2);
const opt = {};
let file = '';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--help' || a === '-h') {
    console.log('Usage: npm run -s paste-run-link -- <fn.js> [--title "<title>"] [--ask "<one line>"] [--send <owner/repo@ref:folder/file>] [--page <url>]');
    process.exit(0);
  } else if (/^--(title|ask|send|page)$/.test(a)) opt[a.slice(2)] = args[++i] ?? fail(a + ' needs a value');
  else if (a.startsWith('--')) fail('unknown option ' + a);
  else if (file) fail('one function file only');
  else file = a;
}
if (!file) fail('name the function file');

const fn = readFileSync(file, 'utf8').trim();
try { new Function('return (' + fn + ')'); } catch (e) { fail(`${file} does not parse as a function: ${e.message}`); }

const spec = { ...(opt.title ? { title: opt.title } : {}), ...(opt.ask ? { ask: opt.ask } : {}), fn };
if (opt.send) {
  const m = opt.send.match(/^([^/@:\s]+\/[^/@:\s]+(?:@[^:\s]+)?):(.+)\/([^/]+)$/);
  if (!m) fail('--send takes owner/repo[@ref]:folder/file');
  spec.send = { to: `${m[1]}:${m[2]}`, file: m[3] };
}
const gz = gzipSync(Buffer.from(JSON.stringify(spec))).toString('base64url');
const url = `${opt.page || PAGE}#gz=${gz}`;
console.log(url);
console.error(`paste-run-link: ${url.length.toLocaleString()} characters`);
