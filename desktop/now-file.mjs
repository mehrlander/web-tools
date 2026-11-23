#!/usr/bin/env node
// Publish a selected local result into Now's persistent Assistant outputs.
// Usage: npm run -s now-file -- <file> [--name <filename>] [--state <data-folder>]
// The command prints a private Now link. The copy remains after source cleanup.
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rmdir, unlink } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const usage = 'Usage: npm run -s now-file -- <file> [--name <filename>] [--state <data-folder>]';

export function dataDirectory(env = process.env) {
  if (env.WEBTOOLS_COMPANION_DATA) return resolve(env.WEBTOOLS_COMPANION_DATA);
  if (!env.LOCALAPPDATA) throw new Error('LOCALAPPDATA is unavailable; give --state with the companion data folder');
  return join(env.LOCALAPPDATA, 'WebToolsDesktop');
}

function validName(name) {
  if (typeof name !== 'string' || !name || name === '.' || name === '..' || name.toLowerCase() === '.git'
      || /[\\/:<>"|?*]|\p{Cc}/u.test(name) || /[ .]$/.test(name)) return false;
  return !/^(?:CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[1-9¹²³]|LPT[1-9¹²³])$/i.test(name.split('.')[0].trimEnd());
}

export function phoneAddress(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('configure Now phone access before publishing files'); }
  const tailnetHost = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+ts\.net$/i;
  if (url.protocol !== 'https:' || !tailnetHost.test(url.hostname) || url.port
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Now phone access must use its private Tailscale HTTPS root address');
  }
  return url;
}

export async function publishFile(source, { state = dataDirectory(), name = basename(source) } = {}) {
  if (!validName(name)) throw new Error('give one regular Windows filename');
  const settings = JSON.parse(await readFile(join(state, 'companion-access.json'), 'utf8'));
  const url = phoneAddress(settings.PhoneUrl);
  const info = await lstat(source);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('select a regular file');
  const root = join(resolve(state), 'outputs');
  await mkdir(root, { recursive: true });
  if ((await lstat(root)).isSymbolicLink()) throw new Error('Assistant outputs must be a regular folder');
  const label = name.replace(/\.[^.]*$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40).toLowerCase() || 'file';
  const folder = await mkdtemp(join(root, label + '-'));
  const target = join(folder, name);
  try {
    const inside = relative(await realpath(root), await realpath(folder));
    if (!inside || isAbsolute(inside) || inside.startsWith('..' + sep) || inside === '..' || resolve(folder) !== folder) {
      throw new Error('the published file must remain in Assistant outputs');
    }
    await copyFile(source, target, constants.COPYFILE_EXCL);
    const saved = await lstat(target);
    if (saved.size !== info.size || saved.isSymbolicLink() || !saved.isFile()) {
      throw new Error('the source changed while publishing; try again after the file is complete');
    }
    const path = relative(root, target).split(sep).join('/');
    url.hash = new URLSearchParams({ view: 'files', root: 'outputs', file: path }).toString();
    return { url: url.href, path, name, bytes: saved.size };
  } catch (error) {
    await unlink(target).catch(() => {});
    await rmdir(folder).catch(() => {});
    throw error;
  }
}

async function main(args) {
  let source, name, state;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { console.log(usage); return; }
    if (arg === '--name' || arg === '--state') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(arg + ' needs a value');
      if (arg === '--name') name = value; else state = value;
    } else if (arg.startsWith('--')) throw new Error('unknown option ' + arg);
    else if (source) throw new Error('select one file');
    else source = arg;
  }
  if (!source) throw new Error('select a file\n' + usage);
  const result = await publishFile(resolve(source), { state: state ? resolve(state) : dataDirectory(), name: name ?? basename(source) });
  console.log(result.url);
  console.error(`now-file: saved ${result.name} (${result.bytes.toLocaleString()} bytes) in Assistant outputs`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error('now-file: ' + error.message); process.exitCode = 1; });
}
