#!/usr/bin/env node
// Generate the same serializable review stage the browser uses, without
// executing PowerShell. Usage: node node/powershell-units.mjs FILE
// [--before OLD_FILE] [--output JSON_FILE] [--tolerant]. A directory inventories every
// .ps1/.psm1 below it and reports files the parser cannot reliably read.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { Parser, Language } from 'web-tree-sitter';
import { repoRoot } from './repo-root.mjs';

const args = process.argv.slice(2), input = args[0];
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : null;
if (!input || input.startsWith('--')) throw new Error('Provide a PowerShell file or directory.');
const read = file => {
  const bytes = readFileSync(file);
  if (bytes[0] === 255 && bytes[1] === 254) return new TextDecoder('utf-16le', { ignoreBOM: true }).decode(bytes);
  if (bytes[0] === 254 && bytes[1] === 255) return new TextDecoder('utf-16be', { ignoreBOM: true }).decode(bytes);
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { return new TextDecoder('windows-1252').decode(bytes); }
};
const sha256 = text => createHash('sha256').update(text).digest('hex');
await Parser.init();
const parser = new Parser();
parser.setLanguage(await Language.load(fileURLToPath(new URL('../node_modules/tree-sitter-powershell/tree-sitter-powershell.wasm', import.meta.url))));
const scope = { window: {} }; vm.runInNewContext(readFileSync(path.join(repoRoot, 'lib/kits/powershell-units.js'), 'utf8'), scope);
const K = scope.window.PowerShellUnits;
const options = { parser, tolerant: args.includes('--tolerant') };
const inventory = async file => ({ path: file, sha256: sha256(read(file)), ...await K.inventory(read(file), options) });
let result;
try {
  if (statSync(input).isDirectory()) {
    const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ps1|psm1)$/i.test(e.name) ? [path.join(dir, e.name)] : []);
    const files = [], errors = [];
    for (const file of walk(input)) {
      try { files.push(await inventory(file)); } catch (e) { errors.push({ path: file, error: e.message }); }
    }
    result = { schema: 1, files, errors };
    console.error(`${files.length} files parsed; ${errors.length} require whole-file review`);
    if (errors.length) process.exitCode = 1;
  } else if (option('--before')) {
    const before = read(option('--before')), after = read(input);
    result = { path: input, before_sha256: sha256(before), after_sha256: sha256(after), ...await K.compare(before, after, options) };
  } else result = await inventory(input);
} finally { parser.delete(); }
const json = JSON.stringify(result, null, 2) + '\n';
if (option('--output')) writeFileSync(option('--output'), json); else process.stdout.write(json);
