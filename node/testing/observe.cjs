// Optional per-worker observations. Load after runtime-command.cjs has finished
// its host probes. A record describes observations, not complete static reach.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const mod = require('node:module');
const child = require('node:child_process');
const { fileURLToPath } = require('node:url');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { promisify } = require('node:util');

const output = process.env.WEB_TOOLS_TEST_OBSERVATIONS;
const entry = process.argv[1];
const coordinator = process.execArgv.includes('--test') && !process.env.NODE_TEST_CONTEXT;

if (output && path.isAbsolute(output) && entry && /\.test\.mjs$/.test(entry) && !coordinator) {
  const root = path.resolve(process.env.WEB_TOOLS_TEST_ROOT || process.cwd());
  const destination = path.resolve(output);
  const sets = { files: new Set(), directories: new Set(), missing: new Set(), opaque: new Set() };
  const original = Object.fromEntries(Object.keys(fs).filter(k => typeof fs[k] === 'function').map(k => [k, fs[k]]));
  const write = original.writeFileSync;
  const mkdir = original.mkdirSync;
  const realpath = original.realpathSync;
  let observing = false;
  let synchronousRead = null;

  // Node's callback APIs carry symbol metadata for util.promisify. Retaining
  // those descriptors keeps exists/read/execFile return shapes unchanged.
  function preserveSymbols(fn, wrapped, customCall) {
    for (const symbol of Object.getOwnPropertySymbols(fn)) {
      const descriptor = Object.getOwnPropertyDescriptor(fn, symbol);
      if (symbol === promisify.custom && typeof fn[symbol] === 'function') {
        const custom = fn[symbol];
        Object.defineProperty(wrapped, symbol, {
          configurable: true, value: function (...args) {
            return customCall(custom, this, args);
          },
        });
      } else Object.defineProperty(wrapped, symbol, descriptor);
    }
    return wrapped;
  }

  function within(base, target) {
    const relative = path.relative(base, target);
    return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
  }

  function absolute(value) {
    if (value instanceof URL) {
      if (value.protocol !== 'file:') return null;
      return fileURLToPath(value);
    }
    if (Buffer.isBuffer(value)) value = value.toString();
    return typeof value === 'string' ? path.resolve(value) : null;
  }

  function relative(value, allowRoot = false) {
    const resolved = absolute(value);
    if (!resolved || !within(root, resolved) || within(destination, resolved)) return null;
    const rel = path.relative(root, resolved).split(path.sep).join('/');
    if (rel.split('/').some(p => p.toLowerCase() === 'node_modules')) return null;
    return rel || (allowRoot ? '.' : null);
  }

  // Instrumentation must never replace an original filesystem exception.
  function note(value, kind = 'files') {
    if (observing) return;
    observing = true;
    try {
      const rel = relative(value, kind === 'directories');
      if (rel !== null) sets[kind].add(rel);
      // Keep the symlink's spelling as well as an in-repository target. A
      // dependency outside the repository is not evidence of empty reach.
      if (rel !== null && kind !== 'missing') {
        try {
          const resolved = realpath(absolute(value));
          const canonical = relative(resolved, kind === 'directories');
          if (canonical !== null) sets[kind].add(canonical);
          else if (!within(root, resolved)) sets.opaque.add('filesystem-symlink-outside-root');
        } catch { /* The original operation records a missing path below. */ }
      }
    } catch { sets.opaque.add('filesystem-path-unavailable'); }
    finally { observing = false; }
  }

  function missing(value, error) {
    if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) note(value, 'missing');
  }

  function result(value, name, answer) {
    if (name === 'exists' || name === 'existsSync') {
      if (!answer) note(value, 'missing');
    } else if (answer && typeof answer.isDirectory === 'function' && answer.isDirectory()) note(value, 'directories');
  }

  function readable(name, args) {
    if (name !== 'open' && name !== 'openSync') return true;
    const flags = args[1];
    if (typeof flags === 'number') return (flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR)) !== fs.constants.O_WRONLY;
    return flags === undefined || typeof flags !== 'string' || flags.includes('r') || flags.includes('+');
  }

  const directories = new Set(['readdir', 'readdirSync', 'opendir', 'opendirSync', 'cp', 'cpSync']);
  const operations = ['readFileSync', 'readFile', 'openSync', 'open', 'existsSync', 'exists',
    'statSync', 'stat', 'lstatSync', 'lstat', 'accessSync', 'access', 'realpathSync', 'realpath',
    'readlinkSync', 'readlink', 'readdirSync', 'readdir', 'opendirSync', 'opendir', 'createReadStream',
    'copyFileSync', 'copyFile', 'cpSync', 'cp'];
  for (const name of operations) {
    const fn = original[name];
    if (!fn) continue;
    const wrapped = function (...args) {
      const value = args[0], track = !observing && readable(name, args);
      let observedValue = value;
      try { observedValue = absolute(value) || value; } catch { /* note reports unsupported inputs. */ }
      if (track) {
        if (typeof value === 'number') sets.opaque.add('filesystem-descriptor');
        else note(value, directories.has(name) ? 'directories' : 'files');
      }
      const last = args.length - 1;
      if (track && typeof args[last] === 'function') {
        const callback = args[last];
        args[last] = function (...values) {
          if (name === 'exists') result(observedValue, name, values[0]);
          else { missing(observedValue, values[0]); if (!values[0]) result(observedValue, name, values[1]); }
          // chdir can race asynchronous filesystem work. Retain both path
          // interpretations rather than discard a possible dependency.
          if (name === 'exists') result(value, name, values[0]);
          else { missing(value, values[0]); if (!values[0]) result(value, name, values[1]); }
          return Reflect.apply(callback, this, values);
        };
      }
      const previousRead = synchronousRead;
      const readContext = name === 'readFileSync' && typeof observedValue === 'string';
      if (readContext) synchronousRead = { path: observedValue, fd: null };
      try {
        const answer = Reflect.apply(fn, this, args);
        if (name === 'openSync' && synchronousRead && typeof observedValue === 'string' &&
            path.relative(synchronousRead.path, observedValue) === '' && Number.isInteger(answer)) {
          synchronousRead.fd = answer;
        }
        if (track && (name.endsWith('Sync') || name === 'existsSync')) result(observedValue, name, answer);
        return answer;
      } catch (error) { if (track) missing(observedValue, error); throw error; }
      finally { if (readContext) synchronousRead = previousRead; }
    };
    // realpath's native implementation is a separate public entry point.
    if (typeof fn.native === 'function') {
      wrapped.native = function (...args) {
        note(args[0]);
        const last = args.length - 1;
        if (typeof args[last] === 'function') {
          const callback = args[last];
          args[last] = function (...values) { missing(args[0], values[0]); return Reflect.apply(callback, this, values); };
        }
        try { return Reflect.apply(fn.native, this, args); }
        catch (error) { missing(args[0], error); throw error; }
      };
    }
    fs[name] = preserveSymbols(fn, wrapped, (custom, receiver, args) => {
      const value = args[0];
      note(value, directories.has(name) ? 'directories' : 'files');
      const answer = Reflect.apply(custom, receiver, args);
      if (answer && typeof answer.then === 'function') answer.then(
        resultValue => { result(value, name, resultValue); },
        error => { missing(value, error); },
      );
      return answer;
    });
  }

  for (const name of ['read', 'readSync', 'readv', 'readvSync']) {
    const fn = original[name];
    if (!fn) continue;
    const wrapped = function (...args) {
      // Node's ESM loader reads source through readFileSync without an
      // encoding. Accept only the descriptor that call opened for its known
      // path, and only during that synchronous call. Keep arbitrary user
      // descriptors opaque; no descriptor identity survives a later close/reuse.
      if (!observing && (!synchronousRead || args[0] !== synchronousRead.fd)) sets.opaque.add('filesystem-descriptor');
      return Reflect.apply(fn, this, args);
    };
    fs[name] = preserveSymbols(fn, wrapped, (custom, receiver, args) => {
      sets.opaque.add('filesystem-descriptor');
      return Reflect.apply(custom, receiver, args);
    });
  }

  const promises = fs.promises;
  for (const name of ['readFile', 'open', 'stat', 'lstat', 'access', 'realpath', 'readlink', 'readdir', 'opendir', 'copyFile', 'cp']) {
    const fn = promises[name];
    if (!fn) continue;
    promises[name] = function (...args) {
      const value = args[0], track = !observing && readable(name, args);
      let observedValue = value;
      try { observedValue = absolute(value) || value; } catch { /* note reports unsupported inputs. */ }
      if (track) note(value, directories.has(name) ? 'directories' : 'files');
      try {
        return Reflect.apply(fn, this, args).then(answer => {
          if (track) { result(observedValue, name, answer); result(value, name, answer); }
          return answer;
        }, error => { if (track) { missing(observedValue, error); missing(value, error); } throw error; });
      } catch (error) { if (track) missing(observedValue, error); throw error; }
    };
  }

  for (const name of ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']) {
    const fn = child[name];
    const wrapped = function (...args) {
      sets.opaque.add('subprocess:' + name);
      return Reflect.apply(fn, this, args);
    };
    child[name] = preserveSymbols(fn, wrapped, (custom, receiver, args) => {
      sets.opaque.add('subprocess:' + name);
      return Reflect.apply(custom, receiver, args);
    });
  }
  mod.syncBuiltinESMExports();

  if (typeof mod.registerHooks === 'function') {
    try {
      mod.registerHooks({ resolve(specifier, context, next) {
        let resolved;
        try { resolved = next(specifier, context); }
        catch (error) {
          sets.opaque.add('module-resolution-failed');
          if (typeof specifier === 'string' && (/^\.{1,2}\//.test(specifier) || specifier.startsWith('file:'))) {
            try { note(new URL(specifier, context.parentURL), 'missing'); } catch { /* Opacity remains explicit. */ }
          }
          throw error;
        }
        if (resolved.url && resolved.url.startsWith('file:')) note(new URL(resolved.url));
        return resolved;
      } });
    } catch { sets.opaque.add('module-resolution-unavailable'); }
  } else sets.opaque.add('module-resolution-unavailable');

  note(entry);
  process.once('exit', code => {
    const finished = Date.now();
    const row = {
      schema: 'web-tools-test-observation/1', path: relative(entry), pid: process.pid,
      started_at: new Date(performance.timeOrigin).toISOString(), finished_at: new Date(finished).toISOString(),
      elapsed_ms: Math.max(0, Math.round(performance.now())), exit_code: code, complete: true,
      ...Object.fromEntries(Object.entries(sets).map(([name, values]) => [name, [...values].sort()])),
    };
    try {
      mkdir(destination, { recursive: true });
      write(path.join(destination, process.pid + '-' + randomUUID() + '.json'), JSON.stringify(row) + '\n', { flag: 'wx' });
    } catch (error) {
      // Failed telemetry leaves the suite's exit status alone. The collector
      // detects the missing worker instead of promoting an incomplete capture.
      process.stderr.write('test observation unavailable: ' + error.message + '\n');
    }
  });
}
