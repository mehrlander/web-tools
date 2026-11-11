// Notes: short, signed, dated observations addressed to a subject.
//
// One JSON line per note in the registry's notes/notes.jsonl:
//
//   {"id":"n…","at":"<UTC ISO>","author":"…","about":"<locator>","text":"…"}
//
// plus an optional `anchor` ({exact, prefix, suffix}) for a note about a
// passage, and an optional `vote` on a note about a user call: 'up' or 'down'
// on its recommendation, '' to withdraw. An author's latest vote counts, as in
// the Text collection's reviews (kits/text-collection.js). A reply is a note
// whose `about` is `note:<id>`. Notes are never
// edited or deleted. The skill and the command-line writer are
// skills/notes/ (SKILL.md, note.py); this is the browser's half, and the
// two agree on the record, the locator grammar and the store.
//
// APPEND IS A COMPARE-AND-SWAP. gh-store's save() answers a 409 by fetching the
// current sha and putting the SAME bytes again, which for a whole-document
// writer is right and for an append is a lost note: whatever landed in between
// is overwritten. So append() re-reads the file and re-appends on every
// conflict, and each PUT carries the sha of the exact bytes it extended.
//
// A read seconds after a write can be served the version that write replaced
// (lib/kits/last-write.js has the measurement). append() remembers the blob it
// wrote and the one it replaced, and treats a read that returns the replaced
// one as the one it wrote.
//
// Attaches window.Notes, loaded via gh.load('kits/notes.js').
(() => {
  const PATH = 'notes/notes.jsonl';
  // A note's subject, with no whitespace anywhere (findings.js parse() reads
  // one the same way). Two forms are the notes' own: another note, and a pull
  // request. The rest is RepoAddress's grammar, read by its parse() (a file,
  // owner/repo[@ref]:path, a #fragment riding in the path) and parseRepo() (a
  // repo or a branch). skills/notes/note.py carries the same four as patterns;
  // node/test/notes-kit.test.mjs holds the two to one answer.
  const NOTE_RE = /^note:n[0-9a-z]+$/;
  const PULL_RE = /^[\w.-]+\/[\w.-]+#\d+$/;
  function isLocator(about) {
    const s = String(about == null ? '' : about);
    if (!s || /\s/.test(s)) return false;
    const A = window.RepoAddress;
    return NOTE_RE.test(s) || PULL_RE.test(s) || !!A.parse(s) || !!A.parseRepo(s);
  }
  // What a locator names, read off its shape alone. KINDS is every answer,
  // each with the label and icon a list of notes draws it with.
  //
  // A list item is a record of a registry list (lists/<file>.json#<id>) or a
  // snag at the address it had while snags were a Markdown log
  // (docs/SNAGS.md#<id>): notes are never edited, so the older ones still
  // name it there. findings.js parse() reads the same shapes for a finding's
  // subjects; node/test/notes-kit.test.mjs holds the two to one answer.
  const KINDS = {
    session: { label: 'Session', icon: 'ph-terminal-window' },
    call:    { label: 'User call', icon: 'ph-tray' },
    list:    { label: 'List item', icon: 'ph-list-bullets' },
    pull:    { label: 'Pull request', icon: 'ph-git-pull-request' },
    branch:  { label: 'Branch', icon: 'ph-git-branch' },
    file:    { label: 'File', icon: 'ph-file-text' },
    repo:    { label: 'Repo', icon: 'ph-folder' },
    note:    { label: 'Note', icon: 'ph-chat-circle-text' },
  };
  // { kind, … } with the pieces a link to the thing is built from: repo, and
  // by kind a number, a ref, or a path with its fragment. A session adds the
  // record's name and short id, a user call its name, a list item its list
  // and id. kind is '' for a string that is not a locator.
  function subject(about) {
    const s = String(about == null ? '' : about);
    const none = { kind: '' };
    if (!s || /\s/.test(s)) return none;
    if (NOTE_RE.test(s)) return { kind: 'note', id: s.slice(5) };
    if (PULL_RE.test(s)) {
      const cut = s.lastIndexOf('#');
      return { kind: 'pull', repo: s.slice(0, cut), number: +s.slice(cut + 1) };
    }
    const A = window.RepoAddress;
    const bare = A.parseRepo(s);
    if (bare) return bare.ref ? { kind: 'branch', repo: bare.repo, ref: bare.ref } : { kind: 'repo', repo: bare.repo };
    const a = A.parse(s);
    const cut = a ? a.path.indexOf('#') : -1;
    const path = a ? (cut < 0 ? a.path : a.path.slice(0, cut)) : '';
    if (!path) return none;
    const at = { repo: a.repo, ref: a.ref, path, fragment: cut < 0 ? '' : a.path.slice(cut + 1) };
    let m = /^sessions\/\d{4}\/\d{2}\/([\w-]+)\.json$/.exec(path);
    if (m) return { kind: 'session', ...at, name: m[1], short: m[1].split('-').pop() };
    m = /^user-calls\/([\w.-]+)\.json$/.exec(path);
    if (m) return { kind: 'call', ...at, name: m[1] };
    m = at.fragment && /^lists\/([\w.-]+)\.json$/.exec(path);
    if (m) return { kind: 'list', ...at, list: m[1], id: at.fragment };
    if (at.fragment && /(^|\/)SNAGS\.md$/.test(path)) return { kind: 'list', ...at, list: 'snag', id: at.fragment };
    return { kind: 'file', ...at };
  }
  const kind = (about) => subject(about).kind;

  // A note has only its text, so the title a list shows for it is derived and
  // never stored: the first sentence of the first line that holds a word (a
  // code fence's own line is not one), without Markdown's marks, cut at a
  // word when it runs past `max`. Text with no word in it, an emoji or a row
  // of marks, is its own title.
  //
  // A full stop inside a file name or a number ends no sentence, since no
  // space follows it. Nor does one NOT_END matches, read with a NUL standing
  // where the stop ends: after an abbreviation, in a dotted run (e.g., U.S.),
  // after "No" before a number, and after an initial beside another (H. W.
  // Fowler). A lone capital does end a sentence ("plan B. We go on."), so a
  // lone initial before a surname cuts its title short ("by J").
  const WORD = /[\p{L}\p{N}]/u, FENCE = /^(?:```|~~~)/;
  const NOT_END = /(?:^|[\s(\[])(?:(?:vs|cf|approx|Dr|Mrs?|Ms|Prof)\.\0|(?:[A-Za-z]\.){2,}\0|No\.\0 \d|[A-Z]\.\0 [A-Z]\.|[A-Z]\. [A-Z]\.\0)/;
  // A character as a reader counts one: an emoji built of several code
  // points, or a letter with its combining mark, is never cut in two.
  let segmenter;
  const characters = (s) => {
    if (segmenter === undefined) segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    return segmenter ? Array.from(segmenter.segment(s), g => g.segment) : Array.from(s);
  };
  // `s` whole when it fits in `max` characters, else cut at a word.
  function clip(s, max) {
    if (s.length <= max) return s;
    const all = characters(s);
    if (all.length <= max) return s;
    const head = all.slice(0, max - 1).join(''), space = head.lastIndexOf(' ');
    return (space > max / 2 ? head.slice(0, space) : head).replace(/[\s,;:.([\-]+$/, '') + '…';
  }
  function title(text, max = 90) {
    const lines = String(text == null ? '' : text).split('\n').map(l => l.trim()).filter(Boolean);
    const line = lines.find(l => WORD.test(l) && !FENCE.test(l));
    if (line === undefined) return clip(lines.join(' ').replace(/\s+/g, ' '), max);
    const s = line.replace(/^(?:#{1,6}|[-*+>]|\d{1,3}[.)])\s+/, '')
      .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1').replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();
    let end = s.length;
    // A sentence's end in Latin, Arabic and Devanagari script wants a space
    // or the line's end after it; a CJK one stands against the next sentence.
    const stop = /[.!?؟।]+["'”’)\]]*(?=\s|$)|[。！？]+/g;
    for (let m; (m = stop.exec(s));) {
      if (m[0][0] === '.' && NOT_END.test(s.slice(0, m.index + 1) + '\0' + s.slice(m.index + 1, m.index + 4))) continue;
      end = m.index + m[0].length;
      break;
    }
    // A title carries no closing full stop; a question or an exclamation keeps its mark.
    return clip(s.slice(0, end).replace(/([^.])[.。।]$/, '$1'), max);
  }

  const TRIES = 6;
  const VOTES = ['up', 'down'];
  const FRESH = () => (window.GH && window.GH.FRESH) || { cache: 'no-store' };
  const last = new Map();   // repo -> { replaced, sha, text }

  const parse = (text) => String(text || '').split('\n').flatMap(l => {
    if (!l.trim()) return [];
    try { return [JSON.parse(l)]; } catch { return []; }
  });

  const newId = () => 'n' + Date.now().toString(36)
    + Array.from({ length: 4 }, () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)]).join('');

  function make({ about, text, author, anchor, vote }) {
    about = String(about || '').trim();
    text = String(text || '').trim();
    if (!isLocator(about)) throw new Error('not a locator: ' + about);
    if (!text) throw new Error('a note needs text');
    if (!author) throw new Error('a note needs an author');
    const n = { id: newId(), at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), author, about, text };
    if (anchor && anchor.exact) n.anchor = { exact: anchor.exact, prefix: anchor.prefix || '', suffix: anchor.suffix || '' };
    if (vote !== undefined) {
      if (vote !== '' && !VOTES.includes(vote)) throw new Error('a vote is up, down, or empty to withdraw one');
      n.vote = vote;
    }
    return n;
  }

  // Notes about `about`, oldest first, each with its replies nested the same way.
  function thread(notes, about) {
    return notes.filter(n => n.about === about)
      .sort((a, b) => a.at.localeCompare(b.at))
      .map(n => ({ ...n, replies: thread(notes, 'note:' + n.id) }));
  }

  // Top-level notes whose subject passes `test`, newest first, threaded.
  function threads(notes, test) {
    return notes.filter(n => !n.about.startsWith('note:') && test(n.about))
      .sort((a, b) => b.at.localeCompare(a.at))
      .map(n => ({ ...n, replies: thread(notes, 'note:' + n.id) }));
  }

  // How many notes sit in a subject's threads, replies included.
  const count = (ts) => ts.reduce((s, t) => s + 1 + count(t.replies), 0);

  // The locator of a record inside a registry list: lists/<file>.json#<id>.
  const listItem = (repo, path, id) => `${repo}:${path}#${id}`;

  // A page's locator, from a GitHub blob URL or anything RepoAddress reads (a
  // toss link, a bare address). The ref is dropped: a note is about the file.
  function fromUrl(url) {
    const s = String(url || '');
    const blob = s.match(/^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/blob\/[^/]+\/([^?#]+)/);
    if (blob) return blob[1] + ':' + decodeURIComponent(blob[2]);
    const a = window.RepoAddress && window.RepoAddress.fromPaste(s);
    return a ? a.repo + ':' + a.path : '';
  }

  async function read(gh) {
    try {
      const f = await gh.get(PATH, FRESH());
      const mine = last.get(gh.repo);
      if (mine && f.sha === mine.replaced) return { text: mine.text, sha: mine.sha };
      return { text: f.text, sha: f.sha };
    } catch (e) {
      if (e && e.status === 404) return { text: '', sha: null };
      throw e;
    }
  }

  // Every read and write is announced, so each view on the page holding this
  // store's notes (Lists, Activity, Tending) shows the same ones.
  const publish = (gh, notes) => {
    const E = window.CustomEvent;
    if (E && window.dispatchEvent) window.dispatchEvent(new E('notes:changed', { detail: { repo: gh.repo, notes } }));
    return notes;
  };

  async function load(gh) { return publish(gh, parse((await read(gh)).text)); }

  // Append one note, or several as one commit; returns every note on main after
  // the write. Several go together because each write carries the whole file
  // (330 KB on 2026-10-22, read and then written back): seven notes sent one at
  // a time from a walkthrough took seven of those trips.
  async function append(gh, note) {
    const list = Array.isArray(note) ? note : [note];
    if (!list.length) return load(gh);
    const message = list.length === 1 ? `note: ${list[0].about}\n\n${list[0].text.slice(0, 200)}`
      : `notes: ${list.length}\n\n` + list.map(n => `${n.about}: ${n.text.split('\n')[0].slice(0, 80)}`).join('\n');
    for (let attempt = 1; ; attempt++) {
      const cur = await read(gh);
      const text = (cur.text && !cur.text.endsWith('\n') ? cur.text + '\n' : cur.text) + list.map(n => JSON.stringify(n) + '\n').join('');
      const body = { message, content: window.GH.toBase64(text) };
      if (cur.sha) body.sha = cur.sha;
      if (gh.ref) body.branch = gh.ref;
      try {
        const res = await gh.req('contents/' + PATH, { method: 'PUT', body: JSON.stringify(body) });
        last.set(gh.repo, { replaced: cur.sha, sha: res.content.sha, text });
        return publish(gh, parse(text));
      } catch (e) {
        if ((e.status !== 409 && e.status !== 422) || attempt >= TRIES) throw e;
        await new Promise(r => setTimeout(r, 300 * attempt * attempt + Math.random() * 250));
      }
    }
  }

  // The signed-in login, asked once per page.
  let me = null;
  const author = async (gh) => me || (me = (await gh.req('/user')).login);

  window.Notes = { PATH, isLocator, KINDS, subject, kind, title, VOTES, parse, make, thread, threads, count, listItem, fromUrl, load, append, author };
})();
