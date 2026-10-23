// kits/call-answer.js — answering a documentation user call (window.CallAnswer).
//
// A documentation call (web-tools-private user-calls/user-call.py, kind
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
//   CallAnswer.summary(decisions)           -> '1 confirmed, 1 discarded'
//   CallAnswer.entry({ decisions, note, call, file, notes, ...extra })
//                                           -> the answer line user-call.py's `answers` reads
//   CallAnswer.ready()                      -> loads what patch() needs
//   CallAnswer.patch(path, base, next)      -> the edit as a diff git applies (MdSurface.patch)
//   CallAnswer.comment(call, entry, from)   -> the PR comment that wakes a subscribed session
//   CallAnswer.record({ where, call, entry, token, comment, from })
//                                           -> appends the line beside the call
//   CallAnswer.fileOf(call)                 -> { repo, ref, path } of the call's document
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
// RECORDING NEVER COMMITS THE DOCUMENT. The confirmed edits go in the line as a
// patch with `apply: "session"`, and a session applies it where the target
// repo's commit hook runs (user-call.py patch <id> | git apply). A commit from
// the browser goes through the contents API and skips that hook, which in
// web-tools left derived registries stale and failed the suite on every later
// PR (owner, 2026-10-04). Dictate's two commit exits are its own and add
// `target` and `commit` to the line instead.
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
    + (e.patch ? '\n\nRecorded with the confirmed edits as a patch, for a session to apply.' : '')
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
  // a call that names no ref is read at main.
  const fileOf = (call) => {
    const a = window.RepoAddress?.parse(String(call?.file || '').trim());
    return a && a.path ? { repo: a.repo, ref: a.ref || 'main', path: a.path } : null;
  };

  window.CallAnswer = { ORDER, spans, phase, stage, withConfirmed, summary, entry, ready, patch, comment, record, fileOf };
})();
