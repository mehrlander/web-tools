// kits/console.js — console retention + filter + subscribe layer.
//
// gh-api.js already hooks console.{log,warn,error,info} at module top to
// push pre-stringified lines onto window.__consoleLogs (it stays minimal
// because it's cache-shy — purging gh-api.js from jsDelivr is costly). This
// kit layers ON TOP of that hook — it never touches gh-api.js — adding:
//
//   console.history              live array of retained entries
//   console.subscribe(fn)        replays existing history, then streams new
//                                entries; returns an unsubscribe fn. A
//                                clear() delivers a sentinel { clear: true }.
//   console.filter({level,text}) query helper over history
//   console.clear()              also clears retained history + signals subs
//
// Each entry keeps BOTH a structured snapshot of the original args (so a
// renderer can show a JSON tree / table) AND the pre-joined text msg (for
// copy + a no-structure fallback). Live object refs are never retained —
// they mutate after the log call — so args are snapshotted via
// structuredClone, with a JSON-safe fallback, then null if neither works.
//
// Why extend the native console instead of a separate `journal` global?
// Callers keep writing plain console.log(); retention is invisible and
// nothing in the codebase learns a new API. It's the same additive tactic
// console/base.js uses for its formatting helpers (style/box/see) — the two
// are orthogonal and coexist (this kit touches log/info/warn/error/debug/
// table/clear; base.js adds style/box/see/help/env).

(() => {
  if (window.consoleKit) return; // idempotent — gh.load re-executes files

  const CAP = 1000;
  const history = [];
  const subs = new Set();
  let truncated = 0;

  const snapshot = args => {
    try { return structuredClone(args); }
    catch (e) {
      try { return JSON.parse(JSON.stringify(args)); }
      catch (e2) { return null; }
    }
  };

  const stringify = args => args.map(a => {
    try { return (a !== null && typeof a === 'object') ? JSON.stringify(a) : String(a); }
    catch (e) { return String(a); }
  }).join(' ');

  const emit = entry => { for (const fn of [...subs]) { try { fn(entry); } catch (e) {} } };

  const record = (level, args, extra) => {
    const entry = { level, args: snapshot(args), msg: stringify(args), time: Date.now(), ...extra };
    history.push(entry);
    if (history.length > CAP) { history.shift(); truncated++; }
    emit(entry);
    return entry;
  };

  // Wrap whatever console.<level> currently is (gh-api's hook if present,
  // else native). Record the structured entry, then delegate downstream so
  // __consoleLogs / native output stay intact.
  ['log', 'info', 'warn', 'error', 'debug'].forEach(level => {
    const downstream = console[level] || console.log;
    console[level] = (...args) => { record(level, args); return downstream.apply(console, args); };
  });

  const downstreamTable = console.table || console.log;
  console.table = (data, columns) => {
    const args = columns === undefined ? [data] : [data, columns];
    record('table', args, { kind: 'table', table: { data, columns } });
    return downstreamTable.apply(console, args);
  };

  // Uncaught errors / rejections don't pass through console.error, so retain
  // them here directly (gh-api keeps its own copy in __consoleLogs).
  window.addEventListener('error', e =>
    record('error', [e.message || String(e)], { uncaught: true }));
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason;
    record('error', ['Unhandled rejection: ' + ((r && (r.message || r.stack)) || String(r))], { uncaught: true });
  });

  const origClear = console.clear ? console.clear.bind(console) : null;
  console.clear = () => {
    history.length = 0;
    truncated = 0;
    emit({ clear: true });
    if (origClear) origClear();
  };

  console.subscribe = fn => {
    if (typeof fn !== 'function') throw new Error('console.subscribe(fn) requires a function');
    for (const e of history) { try { fn(e); } catch (err) {} }
    subs.add(fn);
    return () => subs.delete(fn);
  };

  console.filter = ({ level, text } = {}) => {
    const t = text ? text.toLowerCase() : '';
    return history.filter(e =>
      (!level || e.level === level) &&
      (!t || (e.msg || '').toLowerCase().includes(t)));
  };

  Object.defineProperty(console, 'history', { get: () => history, configurable: true });

  window.consoleKit = {
    history,
    subscribe: console.subscribe,
    filter: console.filter,
    cap: CAP,
    get truncated() { return truncated; }
  };
})();
