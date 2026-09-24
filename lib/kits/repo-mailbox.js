// The mailbox's reads: tree, branches and fetch against one of the user's
// repos, with the user's token. An errand whose action is one of these calls
// fulfill() when a person taps Run on the Stage (kits/errands.js); nothing calls
// it on load. The request files a session drops in the registry's
// mailbox/requests are read as errands and close at mailbox/results.
//
//   tree     — recursive Git-trees listing of a repo (paths/types/sizes)
//   branches — branch names + tip shas
//   fetch    — contents of specific text files (params.paths[])
//
// `ask` records live in the same folder and are hand errands. servable, isAsk,
// validateAsk and closeAsk are kept for them: servable is an allowlist of the
// read kinds, so fulfill() is never handed a record it would answer with its
// own rejection, and a decline carries its reason.
//
// Pure helpers are unit-tested; fulfill takes an injected GH so it can be
// tested against a stub. Attaches window.RepoMailbox, loaded via
// gh.load('kits/repo-mailbox.js').
(() => {
  const REQ_DIR = 'mailbox/requests';
  const RES_DIR = 'mailbox/results';
  // The kinds show-repo fulfills on load, unattended. `ask` is deliberately not
  // among them; KINDS keeps its meaning as "what fulfill() handles" so every
  // existing caller and test reads the same.
  const KINDS = ['tree', 'branches', 'fetch'];
  const ASK = 'ask';

  // Which request files lack a same-named result file (so nothing re-runs).
  function pending(requestNames, resultNames) {
    const done = new Set(resultNames);
    return requestNames.filter(n => n.endsWith('.json') && !done.has(n));
  }

  // The guard the fulfill loop runs first: answer only a kind this kit knows.
  // A positive allowlist rather than a skip for `ask`, because writing a result
  // is what marks a request answered and fulfill() returns one for every kind
  // it does not recognise, so an unrecognised request that reaches it is closed
  // by its own rejection before anyone sees it. That is how the first real ask
  // died, on 2026-08-13, fifteen days before isAsk was written. An allowlist
  // costs the same and covers the kind nobody has added yet.
  function servable(req) {
    return !!req && typeof req === 'object' && KINDS.includes(req.kind);
  }

  // Which pending records are asks, which is a different question from whether
  // the loop may answer one: the stage picks asks OUT of the same listing to
  // render them, and a MALFORMED ask is still an ask, so this stays keyed on
  // the record rather than on a validation verdict.
  function isAsk(req) {
    return !!req && typeof req === 'object' && req.kind === ASK;
  }

  // An ask names what is wanted and where it lands. `note` is prose, because
  // what is being asked for often has no filename: "whatever is in that folder"
  // and "a listing of that directory" are the normal cases, and a path schema
  // would either drop them or fake them. `dest` is structured, since it is what
  // aims the stage and what lets one list span every repo.
  function validateAsk(req) {
    if (!isAsk(req)) return { ok: false, error: 'not an ask' };
    if (typeof req.note !== 'string' || !req.note.trim()) return { ok: false, error: 'ask needs a note saying what is wanted' };
    if (typeof req.dest !== 'string' || !req.dest.includes('/')) return { ok: false, error: 'ask needs a dest (owner/repo[@ref]:dir)' };
    return { ok: true };
  }

  // The record a person's answer writes, at RES_DIR/<same name>. Writing it is
  // what closes the ask, by the same rule that closes every other kind: pending
  // means no same-named result exists. `answered` distinguishes sent from
  // declined; `ok` stays true for both, since a decline is a served request and
  // not a failure. The message is required on a decline and optional on a send,
  // because "no" without a reason wastes the next session's time as surely as
  // no answer at all.
  function closeAsk(req, { answered, message, now } = {}) {
    const base = { id: req?.id, kind: ASK, dest: req?.dest, task: req?.task,
                   fulfilledAt: now || new Date().toISOString() };
    const msg = typeof message === 'string' ? message.trim() : '';
    if (!answered && !msg) return { ok: false, error: 'a decline needs a message saying why' };
    return { ...base, ok: true, answered: !!answered, message: msg };
  }

  // Shape/kind validation before touching the network.
  function validate(req) {
    if (!req || typeof req !== 'object') return { ok: false, error: 'request is not an object' };
    if (!KINDS.includes(req.kind)) return { ok: false, error: 'unsupported kind: ' + req.kind };
    if (typeof req.repo !== 'string' || !req.repo.includes('/')) return { ok: false, error: 'bad or missing repo (owner/name)' };
    if (req.kind === 'fetch' && (!Array.isArray(req.paths) || !req.paths.length)) return { ok: false, error: 'fetch needs a non-empty paths[]' };
    return { ok: true };
  }

  // Execute one request with an injected GH class + token. Returns a result
  // object; never throws (errors land in the result). Read-only.
  async function fulfill(req, { GH, token, now }) {
    const ref = req.ref || 'main';
    const base = { id: req.id, kind: req.kind, repo: req.repo, ref, fulfilledAt: now || new Date().toISOString() };
    const v = validate(req);
    if (!v.ok) return { ...base, ok: false, error: v.error };
    try {
      const gh = new GH({ token, repo: req.repo, ref });
      if (req.kind === 'tree') {
        const t = await gh.req(`git/trees/${encodeURIComponent(ref)}?recursive=1`);
        return { ...base, ok: true, data: {
          truncated: !!t.truncated,
          entries: (t.tree || []).map(e => ({ path: e.path, type: e.type, size: e.size, sha: e.sha })),
        } };
      }
      if (req.kind === 'branches') {
        const b = await gh.branches();
        return { ...base, ok: true, data: { branches: b.map(x => ({ name: x.name, sha: x.commit?.sha })) } };
      }
      if (req.kind === 'fetch') {
        const files = [];
        for (const p of req.paths) {
          try { const f = await gh.get(p); files.push({ path: p, ok: true, size: f.size, text: f.text }); }
          catch (e) { files.push({ path: p, ok: false, error: String(e?.message || e) }); }
        }
        return { ...base, ok: true, data: { files } };
      }
      return { ...base, ok: false, error: 'unhandled kind' };
    } catch (e) {
      return { ...base, ok: false, error: String(e?.message || e) };
    }
  }

  window.RepoMailbox = { REQ_DIR, RES_DIR, KINDS, ASK, pending, validate, fulfill,
                         servable, isAsk, validateAsk, closeAsk };
})();
