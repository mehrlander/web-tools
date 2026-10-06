// Notes: short, signed, dated observations addressed to a subject.
//
// One JSON line per note in the registry's notes/notes.jsonl:
//
//   {"id":"n…","at":"<UTC ISO>","author":"…","about":"<locator>","text":"…"}
//
// plus an optional `anchor` ({exact, prefix, suffix}) for a note about a
// passage, and an optional `stance` (agrees, disagrees, moot) for a note that
// weighs in on a recommendation, such as a second opinion on a user call. A reply is a note whose `about` is `note:<id>`. Notes are never
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
  const LOCATOR = /^(?:note:n[0-9a-z]+|[\w.-]+\/[\w.-]+(?:#\d+|(?:@[^\s:]+)?(?::[^\s#]+(?:#\S+)?)?))$/;
  const TRIES = 6;
  const STANCES = ['agrees', 'disagrees', 'moot'];
  const FRESH = () => (window.GH && window.GH.FRESH) || { cache: 'no-store' };
  const last = new Map();   // repo -> { replaced, sha, text }

  const parse = (text) => String(text || '').split('\n').flatMap(l => {
    if (!l.trim()) return [];
    try { return [JSON.parse(l)]; } catch { return []; }
  });

  const newId = () => 'n' + Date.now().toString(36)
    + Array.from({ length: 4 }, () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)]).join('');

  function make({ about, text, author, anchor, stance }) {
    about = String(about || '').trim();
    text = String(text || '').trim();
    if (!LOCATOR.test(about)) throw new Error('not a locator: ' + about);
    if (!text) throw new Error('a note needs text');
    if (!author) throw new Error('a note needs an author');
    const n = { id: newId(), at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), author, about, text };
    if (anchor && anchor.exact) n.anchor = { exact: anchor.exact, prefix: anchor.prefix || '', suffix: anchor.suffix || '' };
    if (stance) {
      if (!STANCES.includes(stance)) throw new Error('a stance is one of ' + STANCES.join(', '));
      n.stance = stance;
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

  // Append one note; returns every note on main after the write.
  async function append(gh, note) {
    if (!window.GH.toBase64 && window.gh && window.gh.load) await window.gh.load('gh-store.js');
    for (let attempt = 1; ; attempt++) {
      const cur = await read(gh);
      const text = (cur.text && !cur.text.endsWith('\n') ? cur.text + '\n' : cur.text) + JSON.stringify(note) + '\n';
      const body = { message: `note: ${note.about}\n\n${note.text.slice(0, 200)}`, content: window.GH.toBase64(text) };
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

  window.Notes = { PATH, LOCATOR, STANCES, parse, make, thread, threads, count, listItem, fromUrl, load, append, author };
})();
