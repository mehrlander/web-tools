#!/usr/bin/env node
// node/reception-link.mjs: mint a reception link, a reception one errand sets
// up. The link opens pages/reception.html carrying a session's function; the
// reader pastes data, the function runs on it there, and only the result comes
// back, copied or handed to the Stage. The page's header says how it keeps the
// data in the browser.
//
// Usage:
//   npm run -s reception-link -- <fn.js> [--label "<label>"] [--note "<what is wanted>"] [--dest <owner/repo[@ref]:folder>] [--file <name>] [--page <url>]
//
// <fn.js> holds the source of one function, (rows, text) => result; rows are
// the paste as a table, text the paste itself. --label and --note are what the
// page shows. --dest and --file are named as an errand's are (docs/manifest.md,
// "Errands"): where the page's Send aims the Stage, and the result's file name;
// without --dest the reader copies the result. The payload is {label?, note?,
// fn, dest?, file?} as JSON, gzipped, base64url, in #gz=, the form
// kits/gz-payload.js reads. --page points the link at another copy of the page,
// such as a local server under test. The link goes to stdout and its length to
// stderr.

import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const PAGE = 'https://mehrlander.github.io/web-tools/pages/reception.html';
const USAGE = 'Usage: npm run -s reception-link -- <fn.js> [--label "<label>"] [--note "<what is wanted>"] [--dest <owner/repo[@ref]:folder>] [--file <name>] [--page <url>]';
const fail = (msg) => { console.error('reception-link: ' + msg); process.exit(1); };

const args = process.argv.slice(2);
const opt = {};
let src = '';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--help' || a === '-h') { console.log(USAGE); process.exit(0); }
  else if (/^--(label|note|dest|file|page)$/.test(a)) opt[a.slice(2)] = args[++i] ?? fail(a + ' needs a value');
  else if (a.startsWith('--')) fail('unknown option ' + a);
  else if (src) fail('one function file only');
  else src = a;
}
if (!src) fail('name the function file');
if (opt.dest && !/^[^/@:\s]+\/[^/@:\s]+(?:@[^:\s]+)?:\S+$/.test(opt.dest)) fail('--dest takes owner/repo[@ref]:folder');
if (opt.file && !opt.dest) fail('--file names the result for --dest; give --dest too');

const fn = readFileSync(src, 'utf8').trim();
try { new Function('return (' + fn + ')'); } catch (e) { fail(`${src} does not parse as a function: ${e.message}`); }

const spec = Object.fromEntries(Object.entries({ label: opt.label, note: opt.note, fn, dest: opt.dest, file: opt.file }).filter(([, v]) => v));
const gz = gzipSync(Buffer.from(JSON.stringify(spec))).toString('base64url');
const url = `${opt.page || PAGE}#gz=${gz}`;
console.log(url);
console.error(`reception-link: ${url.length.toLocaleString()} characters`);
