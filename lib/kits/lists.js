// Lists: the registry's lists/ folder, read and written as one kind of file.
//
// Every list is one JSON document in the registry's lists/ folder: an `items`
// array beside whatever top-level keys describe the list. Three are built in
// and carry behavior the Lists pane implements for them alone (To-do, Jot and
// Pin, below). Any other file there whose top level has a `title` and an
// `items` array is a list someone created in the pane, and it describes itself:
//
//   { "title": "Aphorisms", "icon": "quotes", "capabilities": ["done"],
//     "items": [ { "id": "l…", "text": "…", "note": "…", "created_at": "…" } ] }
//
// `icon` is a Phosphor icon name without its `ph-` prefix. `note` is an item's
// optional second line. A key nothing here reads survives every write, the
// rule the built-in savers already followed for item fields.
//
// A FILE WITH NO TITLE IS NOT A LIST. lists/autocorrect.json shares the folder
// (the dictate page's find-and-replace table) and has `items` too, so the title
// is the mark that a file was made to be read as a list.
//
// CAPABILITIES ARE CLOSED; LISTS ARE OPEN. The rule the estate settled for a
// jot's kind on 2026-08-26: a set is closed where code has to switch on its
// values, and open where only a reader acts on it. Each capability below is
// behavior the pane has to implement, so the vocabulary is declared here and
// nowhere else; which lists exist is the folder's business. OPEN names the
// capabilities a created list can turn on today. The rest are implemented for
// the built-in list that has them, and join OPEN when a created list needs one.
//
// EVERY WRITE IS A FRESH READ, THEN THE CHANGE, THEN THE SAVE, and only a
// missing file (404) reads as empty. A writer that saved its own copy lost
// whatever landed in between, and one that read every failure as "empty" (the
// sidebar finder's jot until this kit) turned a dropped connection into a pile
// holding only the newest jot.
//
// Attaches window.Lists, loaded via gh.load('kits/lists.js').
(() => {
  const DIR = 'lists';
  const FRESH = () => (window.GH && window.GH.FRESH) || { cache: 'no-store' };
  const DEFAULT_ICON = 'list-bullets';

  const CAPABILITIES = {
    done:  { label: 'Check off', fields: ['done', 'done_at'],
             gloss: 'Each item has a checkbox; a checked item moves below the open ones.' },
    due:   { label: 'Due date', fields: ['due', 'urgent'],
             gloss: 'An item can carry a date and an urgent flag, and the hot ones sort first.' },
    kind:  { label: 'Kind', fields: ['kind'],
             gloss: 'An item can carry one tag from an open vocabulary, offered as chips.' },
    link:  { label: 'Link', fields: ['target'],
             gloss: 'An item names a file or folder in a repo, and tapping it opens that.' },
    group: { label: 'Groups', fields: ['group'],
             gloss: 'Items render under headings by their group.' },
  };
  const OPEN = ['done'];

  // The three built-in lists, described in the shape a created list describes
  // itself. Their files carry no header: the pane's markup for them predates
  // this kit, and these records are what keeps the descriptions in one place.
  const BUILT_IN = [
    { path: 'lists/todo.json', title: 'To-do', icon: 'list-checks', capabilities: ['done', 'due'] },
    { path: 'lists/jots.json', title: 'Jot',   icon: 'lightbulb',   capabilities: ['kind'] },
    { path: 'lists/pins.json', title: 'Pin',   icon: 'push-pin',    capabilities: ['link', 'group'] },
  ];
  const isBuiltIn = (path) => BUILT_IN.some(b => b.path === path);

  const icon = (s) => {
    const v = String(s || '').trim().toLowerCase().replace(/^ph-/, '');
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= 40 ? v : DEFAULT_ICON;
  };
  const slug = (s) => String(s || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  const pathFor = (title) => { const s = slug(title); return s ? DIR + '/' + s + '.json' : ''; };
  const newId = (prefix = 'l') => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const split = (raw) => {
    const { items, ...header } = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    return { header, items: Array.isArray(items) ? items : [] };
  };
  const isList = (raw) => !!raw && typeof raw.title === 'string' && !!raw.title.trim() && Array.isArray(raw.items);

  // What the pane needs to draw a list's heading. A created list keeps only the
  // capabilities in OPEN, so a file naming one the pane cannot render for it
  // reads as a plain list rather than half of a feature.
  function describe(path, header = {}) {
    const b = BUILT_IN.find(x => x.path === path);
    const caps = b ? b.capabilities
      : (Array.isArray(header.capabilities) ? header.capabilities.filter(c => OPEN.includes(c)) : []);
    return { path, title: String(header.title || (b && b.title) || path).trim(),
             icon: icon(header.icon || (b && b.icon)), capabilities: caps, builtIn: !!b };
  }

  async function read(reg, path) {
    let text;
    try { text = (await reg.get(path, FRESH())).text; }
    catch (e) { if (e && e.status === 404) return { header: {}, items: [], text: '' }; throw e; }
    return { ...split(JSON.parse(text)), text };
  }

  // `change(items, header)` returns the new items, or { items, header } when
  // the list's own description changes too.
  async function mutate(reg, path, change, message) {
    if (typeof reg.save !== 'function' && window.gh && window.gh.load) await window.gh.load('gh-store.js');
    const cur = await read(reg, path);
    const next = change(cur.items, cur.header);
    const items = Array.isArray(next) ? next : (next.items || cur.items);
    const header = Array.isArray(next) ? cur.header : (next.header || cur.header);
    const value = { ...header, items };
    await reg.save(path, value, message);
    return { header, items, value };
  }
  const append = (reg, path, item, message) => mutate(reg, path, items => [...items, item], message);

  // The created lists, title order. A file that fails to read or parse is left
  // out rather than failing the folder: one hand-edited file with a stray comma
  // should not take every other list off the screen.
  async function discover(reg) {
    let entries;
    try { entries = await reg.req('contents/' + DIR, FRESH()); }
    catch (e) { if (e && e.status === 404) return []; throw e; }
    const paths = (Array.isArray(entries) ? entries : [])
      .filter(e => e && e.type === 'file' && /\.json$/.test(e.name || ''))
      .map(e => DIR + '/' + e.name)
      .filter(p => !isBuiltIn(p));
    const found = await Promise.all(paths.map(async (path) => {
      try {
        const { header, items, text } = await read(reg, path);
        return isList({ ...header, items }) ? { ...describe(path, header), header, items, text } : null;
      } catch { return null; }
    }));
    return found.filter(Boolean).sort((a, b) => a.title.localeCompare(b.title));
  }

  // The file is named once, from the title it was created with. A later rename
  // changes the title and leaves the path, the rule a jot already follows: a
  // data file renamed to match a label is a migration that buys nothing.
  async function create(reg, { title, icon: ic, capabilities = [] } = {}, message) {
    title = String(title || '').trim();
    if (!title) throw new Error('a list needs a title');
    const path = pathFor(title);
    if (!path) throw new Error('a title needs a letter or a digit');
    if (isBuiltIn(path)) throw new Error(path + ' is a built-in list');
    let taken = false;
    try { await reg.get(path, FRESH()); taken = true; }
    catch (e) { if (!e || e.status !== 404) throw e; }
    if (taken) throw new Error('a list is already stored at ' + path);
    if (typeof reg.save !== 'function' && window.gh && window.gh.load) await window.gh.load('gh-store.js');
    const caps = (capabilities || []).filter(c => OPEN.includes(c));
    const header = { title, icon: icon(ic), ...(caps.length ? { capabilities: caps } : {}) };
    await reg.save(path, { ...header, items: [] }, message || ('Create the list "' + title + '" via Web Tools'));
    return { ...describe(path, header), header, items: [] };
  }

  // Only an empty list, read fresh. Deleting a list's items is a gesture per
  // item, each with its undo, so the last step can never take content with it.
  async function remove(reg, path, message) {
    if (isBuiltIn(path)) throw new Error(path + ' is a built-in list');
    const cur = await read(reg, path);
    if (cur.items.length) throw new Error('only an empty list can be deleted');
    if (typeof reg.del !== 'function' && window.gh && window.gh.load) await window.gh.load('gh-store.js');
    return reg.del(path, message);
  }

  window.Lists = { DIR, DEFAULT_ICON, CAPABILITIES, OPEN, BUILT_IN, isBuiltIn, icon, slug, pathFor,
                   newId, isList, describe, read, mutate, append, discover, create, remove };
})();
