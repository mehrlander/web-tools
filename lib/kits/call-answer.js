// kits/call-answer.js — answering a documentation user call (window.CallAnswer).
//
// A documentation call (skills/user-calls/user-call.py, kind
// documentation) proposes edits to one document and asks the owner which to
// apply. Two surfaces answer one: pages/dictate.html, where the edits are staged
// as change cards in an editable copy of the file, and the Docs tab of the Map
// view (alpineComponents/map.js), where they are labelled on the paragraphs of
// the document as it reads. They reach their decisions differently: Dictate
// reads each one off its buffer, since the owner may confirm, retype or undo a
// card, and the Docs tab is told each one by a Confirm or Discard. Everything
// after that is this file, so the answer line is the same whichever page wrote
// it.
//
//   CallAnswer.spans(text, s)               -> [[start, end], ...] where s stands in text:
//                                              exactly, else with any run of whitespace
//                                              matching any other
//   CallAnswer.phase(text, edit)            -> 'old' | 'new' | 'neither': which side of
//                                              the edit the text holds
//   CallAnswer.stage(base, edits)           -> { text, status }: base with every stageable
//                                              edit in it, and each edit's standing
//   CallAnswer.withConfirmed(base, edits, decisions)
//                                           -> base with only the confirmed edits in it
//   CallAnswer.source(call, read, prBase)   -> { base, status, committed }: the text the
//                                              call's edits are decided on, and where
//   CallAnswer.answerPatch({ path, base, edits, decisions, committed })
//                                           -> the patch the answer carries, '' for none
//   CallAnswer.summary(decisions)           -> '1 confirmed, 1 discarded'
//   CallAnswer.entry({ decisions, note, call, file, notes, ...extra })
//                                           -> the answer line user-call.py's `answers` reads
//   CallAnswer.ready()                      -> loads what patch() needs
//   CallAnswer.patch(path, base, next)      -> the edit as a diff git applies (MdSurface.patch)
//   CallAnswer.comment(call, entry, from)   -> the PR comment that wakes a subscribed session
//   CallAnswer.record({ where, call, entry, token, comment, from })
//                                           -> appends the line beside the call
//   CallAnswer.fileOf(call)                 -> { repo, ref, path, item? } of the call's document
//   CallAnswer.listOf(call)                 -> true when the call edits entries of a list
//   CallAnswer.listCall(call)               -> the call with each entry edit as a { from, to } of text
//   CallAnswer.listDoc(json, ids)           -> the entries `ids` names, read as one document
//   CallAnswer.setEntries(json, sets)       -> the list's JSON with each [id, { text, note }] set
//
// An edit is { from, to }: text the file holds and what should stand in its
// place, block runs as user-call.py pairs them. It is found ONCE or not at all,
// since an edit that could land in two places is not one a page can place
// without guessing. Its standing in a text is one of
//   staged     found once, so a page can show it and the owner decide it
//   applied    the text already says what the edit proposes
//   stale      neither side found
//   ambiguous  found more than once
//   overlap    its span crosses another edit's
// and a decision is a staged edit's verdict, `confirmed`, `amended` (Dictate
// only: the owner retyped it), `discarded` or `open`, or the standing of an edit
// that was never staged. A decision of each kind is counted, in ORDER, into the
// line's `answer`.
//
// A SESSION COMMITS ITS EDITS BEFORE IT FILES THE CALL (doc-craft): the branch
// holds its best thinking, and the call asks which of the changes made to keep.
// The file at the call's ref then holds every edit already, so source() reads
// the text they replace at the call's `base` (else, for a call naming a PR, the
// PR's base) and stages them there, `committed`. A call whose edits are still
// unmade stages them on the file as it names it, as calls once all did.
//
// RECORDING NEVER COMMITS THE DOCUMENT. The answer carries a patch with
// `apply: "session"`, and a session applies it where the target repo's commit
// hook runs (user-call.py patch <id> | git apply). For a committed call the
// patch takes the discarded edits back out of the branch, so an answer that
// keeps every edit needs none; for an uncommitted one it puts the confirmed
// edits in. A commit from
// the browser goes through the contents API and skips that hook, which in
// web-tools left derived registries stale and failed the suite on every later
// PR (owner, 2026-10-04). Dictate's two commit exits are its own and add
// `target` and `commit` to the line instead.
//
// A CALL CAN EDIT ENTRIES OF A LIST, a lists/*.json file of the Lists view:
// its `file` names the list, with `#<id>` for a call on one entry, and each
// edit names its entry in `item`, with `from` and `to` as { text, note? }.
// listCall() turns each into the { from, to } of text every function here
// takes: the entry read as `**<id>** · <text>`, then its note, so the
// page draws and decides it as it does a paragraph. listDoc() reads the
// list the same way, and the answer's patch is the list's JSON with the kept
// entries set (setEntries), not a diff of that reading.
(() => {
  const ORDER = ['confirmed', 'amended', 'discarded', 'open', 'applied', 'stale', 'ambiguous', 'overlap'];

  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const spans = (text, s) => {
    if (!s.trim()) return [];
    const out = [];
    for (let i = text.indexOf(s); i >= 0; i = text.indexOf(s, i + 1)) out.push([i, i + s.length]);
    if (out.length) return out;
    const re = new RegExp(s.trim().split(/\s+/).map(escRe).join('\\s+'), 'g');
    return [...text.matchAll(re)].map((m) => [m.index, m.index + m[0].length]);
  };
  // The longer side is asked first, because an insertion's `to` contains its
  // `from` (the neighbour it hangs on) and a removal's `from` contains its `to`.
  const phase = (text, e) => {
    const sides = [['old', e.from], ['new', e.to]];
    if (e.to.length > e.from.length) sides.reverse();
    for (const [k, s] of sides) if (spans(text, s).length) return k;
    return !e.to.trim() && !spans(text, e.from).length ? 'new' : 'neither';
  };
  const stage = (base, edits) => {
    const status = [], take = [];
    edits.forEach((e, i) => {
      const at = phase(base, e) === 'old' ? spans(base, e.from) : null;
      status[i] = !at ? (phase(base, e) === 'new' ? 'applied' : 'stale') : at.length > 1 ? 'ambiguous' : 'staged';
      if (status[i] === 'staged') take.push({ i, at: at[0], to: e.to });
    });
    let text = base, floor = Infinity;
    for (const t of take.sort((a, b) => b.at[0] - a.at[0])) {
      if (t.at[1] > floor) { status[t.i] = 'overlap'; continue; }
      text = text.slice(0, t.at[0]) + t.to + text.slice(t.at[1]);
      floor = t.at[0];
    }
    return { text, status };
  };
  // The confirmed edits alone, staged as a set so two that collide are caught
  // the same way. `decisions` holds one string per edit, in the call's order.
  const withConfirmed = (base, edits, decisions) =>
    stage(base, edits.filter((_, i) => decisions[i] === 'confirmed')).text;

  // `read(ref)` resolves to the call's document at that ref; `prBase()`, when
  // given, to the base branch of the PR the call names. A list call's
  // document is listDoc's reading of its entries, and `raw` the list's JSON
  // at the call's ref, which its answer's patch is made from.
  async function source(call, read, prBase) {
    if (!listOf(call)) return sourceOf(call, read, prBase);
    const c = listCall(call), ids = c.edits.map((e) => e.item), raws = {};
    const out = await sourceOf(c, async (ref) => listDoc(raws[ref] = await read(ref), ids), prBase);
    return { ...out, raw: raws[fileOf(call).ref] };
  }
  async function sourceOf(call, read, prBase) {
    const f = fileOf(call), edits = call?.edits || [];
    if (!f) throw new Error('the call names no file');
    let base = await read(f.ref), { status } = stage(base, edits), committed = '';
    if (!status.includes('staged') && status.includes('applied')) {
      const into = call.base || (prBase ? await prBase().catch(() => null) : null);
      if (into && into !== f.ref) {
        const b = await read(into).catch(() => null), s2 = b == null ? null : stage(b, edits).status;
        if (s2?.includes('staged')) { base = b; status = s2; committed = into; }
      }
    }
    return { base, status, committed };
  }
  // The decided text, from the text the call's ref holds: base with every
  // staged edit for a committed call, base itself for an uncommitted one.
  // A list call's patch starts from the list at the call's ref (`raw`): for a
  // committed call it puts each discarded entry back as it was, and for an
  // uncommitted one it sets each confirmed entry as proposed.
  const answerPatch = ({ path, base, edits, decisions, committed, raw }) => {
    if (edits.some((e) => e.entry)) {
      const sets = edits.map((e, i) => (committed ? decisions[i] === 'discarded' && [e.item, e.entry.from]
        : decisions[i] === 'confirmed' && [e.item, e.entry.to])).filter(Boolean);
      const next = setEntries(raw, sets);
      return next === raw ? '' : patch(path, raw, next);
    }
    const want = withConfirmed(base, edits, decisions), from = committed ? stage(base, edits).text : base;
    return from === want ? '' : patch(path, from, want);
  };

  const summary = (ds) => {
    const n = {};
    for (const d of ds) n[d] = (n[d] || 0) + 1;
    return ORDER.filter((k) => n[k]).map((k) => n[k] + ' ' + k).join(', ');
  };
  // `decisions` is [{ edit, decision, note? }], one per edit in the call's
  // order; `notes` is [{ on, note }] for notes on text no edit touches.
  const entry = ({ decisions, note = '', call, file, notes = [], ...extra }) => ({
    answer: summary(decisions.map((d) => d.decision)), note: String(note || '').trim(), at: new Date().toISOString(),
    call, file, decisions, ...(notes.length ? { notes } : {}), ...extra,
  });

  // The patch is MdSurface's, which kits/md-surface.js's suite applies with
  // git; jsdiff comes through md-diff's loader, so a page that already draws
  // diffs shares its copy.
  async function ready() {
    const gh = window.gh;
    if (!window.mdDiff) await gh.load('kits/md-diff.js');
    if (!window.Diff) await window.mdDiff.needDiff();
    if (!window.MdSurface) await gh.load('kits/md-surface.js');
  }
  const patch = (path, base, next) => window.MdSurface?.patch(path, base, next) || '';

  const comment = (call, e, from) => '**User call: ' + call.question + '**\n\nAnswer: **' + e.answer + '**'
    + (e.commit ? '\n\nCommitted: ' + e.commit : '')
    + (e.patch ? '\n\nRecorded with ' + (e.base ? 'the discarded edits as a patch that takes them back out' : 'the confirmed edits as a patch') + ', for a session to apply.' : '')
    + (e.note ? '\n\n> ' + e.note : '')
    + '\n\n_' + (call.id || '') + ', answered in ' + from + '._';

  // `where` is the call file, { repo, ref, path }; the line goes in
  // <path minus .json>.answers.jsonl beside it. `comment` true also posts on
  // the call's PR, when it names one.
  async function record({ where, call, entry: e, token, comment: onPr = false, from }) {
    if (!window.UserCallForm) await window.gh.load('alpineComponents/user-call-form.js');
    const F = window.UserCallForm, pr = onPr ? F.prOf(call.pr) : null;
    return F.postAnswer({ repo: where.repo, ref: where.ref || undefined, token,
      path: where.path.replace(/\.json$/, '') + '.answers.jsonl', entry: e,
      pr, comment: pr ? comment(call, e, from) : '' });
  }

  // The address grammar is kits/repo-address.js's, in every page's boot chain;
  // a call that names no ref is read at main. A list's `#<id>` is the entry.
  const fileOf = (call) => {
    const a = window.RepoAddress?.parse(String(call?.file || '').trim());
    if (!a || !a.path) return null;
    const [path, item] = a.path.split('#');
    return { repo: a.repo, ref: a.ref || 'main', path, ...(item ? { item } : {}) };
  };

  // ── Entries of a list ───────────────────────────────────────────────
  const listOf = (call) => /\.json$/i.test(fileOf(call)?.path || '');
  const ENTRY_RULE = '\n\n* * *\n\n';
  const entryText = (id, f) => '**' + id + '** · ' + String(f?.text || '') + (f?.note ? '\n\n' + f.note : '');
  const listCall = (call) => {
    if (!listOf(call) || call._list) return call;
    const one = fileOf(call).item;
    return { ...call, _list: true, edits: (call.edits || []).map((e) => {
      const item = e.item || one;
      return { ...e, item, entry: { from: e.from, to: e.to }, from: entryText(item, e.from), to: entryText(item, e.to) };
    }) };
  };
  const listItems = (json) => { const d = JSON.parse(json); return Array.isArray(d?.items) ? d.items : []; };
  const listDoc = (json, ids) => {
    const items = listItems(json);
    return ids.map((id) => items.find((it) => it?.id === id)).filter(Boolean)
      .map((it) => entryText(it.id, it)).join(ENTRY_RULE);
  };
  // Written as the Lists view writes a list, two-space JSON, keeping the
  // file's last newline. A list laid out some other way is changed only where
  // an entry's text or note stands, so the patch holds the entry alone.
  const setEntries = (json, sets) => {
    if (!sets.length) return json;
    const doc = JSON.parse(json), nl = json.endsWith('\n') ? '\n' : '';
    const plain = JSON.stringify(doc, null, 2) + nl === json;
    let out = json;
    for (const [id, f] of sets) {
      const it = (doc.items || []).find((x) => x?.id === id);
      if (!it) throw new Error('the list holds no entry ' + id);
      for (const k of ['text', 'note']) {
        const to = f?.[k] || undefined;
        if (to === (it[k] || undefined)) continue;
        if (!plain) {
          const was = JSON.stringify(k) + ': ' + JSON.stringify(it[k] ?? '');
          if (it[k] == null || to == null || out.split(was).length !== 2) throw new Error('cannot place the ' + k + ' of entry ' + id + ' in this list\'s layout');
          out = out.replace(was, () => JSON.stringify(k) + ': ' + JSON.stringify(to));
        }
        if (to == null) delete it[k]; else it[k] = to;
      }
    }
    return plain ? JSON.stringify(doc, null, 2) + nl : out;
  };

  window.CallAnswer = { ORDER, spans, phase, stage, withConfirmed, source, answerPatch, summary, entry, ready, patch, comment, record, fileOf,
                        listOf, listCall, listDoc, setEntries };
})();
