#!/usr/bin/env node
// node/stage-link.mjs: mint a Web Tools stage link that carries local files as
// text, so a session can hand over a script or a draft with no commit, no repo
// and no token.
//
// Usage:
//   npm run stage-link -- <file>... [--diff] [--app <url>]
//
// Each file rides the link in full as `#gz=`, the payload StageLink.decodeLocals
// reads: [{name, text}] as JSON, gzipped, base64url. The link opens the Stage's
// reader on the first file (`&mode=read`), where Copy hands the text back out
// exactly as it was carried. --diff opens the comparison of the first two files
// instead (`&mode=diff`). Over the stage's own budget (GZ_MAX) the command
// refuses with both numbers rather than printing a link that will not open.
//
// The link goes to stdout and the sizes to stderr, so `$(npm run -s stage-link
// -- f.ps1)` is the link alone.

import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const GZ_MAX = 24 * 1024;
const APP = 'https://mehrlander.github.io/web-tools/app/';

const fail = (msg) => { console.error('stage-link: ' + msg); process.exit(1); };

const args = process.argv.slice(2);
const files = [];
let mode = 'read';
let app = APP;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--diff') mode = 'diff';
  else if (a === '--app') app = args[++i] || fail('--app needs a URL');
  else if (a === '--help' || a === '-h') {
    console.log('Usage: npm run stage-link -- <file>... [--diff] [--app <url>]');
    process.exit(0);
  } else files.push(a);
}
if (!files.length) fail('name at least one file');
if (mode === 'diff' && files.length < 2) fail('--diff needs two files to compare');

// TEXT, NOT BYTES. A link carries text, and the reader's Copy hands back
// exactly what was carried, so a byte-order mark would arrive in front of the
// first line of whatever it is pasted into (a script's first token, in the
// ISE). A file that is not UTF-8 is refused by name rather than carried as
// replacement characters.
const items = files.map((f) => {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(f)); }
  catch (e) { fail(e.code === 'ENOENT' ? 'no such file: ' + f : f + ' is not UTF-8 text'); }
  return { name: path.basename(f), text: text.replace(/^﻿/, '') };
});

const payload = gzipSync(Buffer.from(JSON.stringify(items), 'utf8')).toString('base64url');
if (payload.length > GZ_MAX) {
  fail('the files compress to ' + Math.round(payload.length / 1024) + 'K, over the '
    + Math.round(GZ_MAX / 1024) + 'K a link can carry');
}

const chars = items.reduce((n, it) => n + it.text.length, 0);
console.error(`stage-link: ${items.length} file(s), ${chars.toLocaleString()} characters, `
  + `${payload.length.toLocaleString()} of ${GZ_MAX.toLocaleString()} payload`);
console.log(app + '#gz=' + payload + '&mode=' + mode);
