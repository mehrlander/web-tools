// kits/visit-log.js — turn an address into a storable visit, by allowlist.
//
// A visit log stores where a reader went. The hazard is that in this estate an
// address is not always a location: #gz= and #html= carry a whole document in
// the fragment, and a stage link folds local text in beside its refs
// (alpineComponents/stage.js: "Refs are pointers, so their content stays behind
// the token; everything else is authored or carried, so it rides the link
// itself"). A log that stored addresses verbatim would therefore store pasted
// documents, and a workbench you used on local data would leak it into the
// record the moment you navigated away.
//
// THE DEFENCE IS NOT A FILTER. A filter is a list of the payload forms someone
// thought of, so the next form nobody thought of rides straight through. This
// module never carries its input forward at all: it matches the address against
// a closed list of recognized routes, pulls out the fields that route declares,
// checks each against a narrow grammar, and REBUILDS the stored row from the
// route's own template. Nothing that arrived is written. A payload has nowhere
// to ride, even when the match is wrong, because a matched template has no slot
// shaped like a payload.
//
// The three outcomes, and only one of them is a defect:
//
//   matched        rebuilt from the template. Safe by construction.
//   unrecognized   nothing stored but the PATHNAME and a count. Costs a gap in
//                  the log, and is the signal that the registry has fallen
//                  behind the code. The pathname is safe because every payload
//                  form in this system rides in the fragment or the query and
//                  never in the path.
//   misrecognized  a row labelled as route X that was really route Y. Costs a
//                  wrong label and a link that opens the wrong screen. Still
//                  cannot leak, since X's template decided every field written.
//
// A live case where a filter and an allowlist disagree, from this repo rather
// than from a thought experiment: pages/toss-render.html reads
// `param('url') || param('u')`, and until 2026-09-17 docs/routes-modes.csv had
// no row for `u`. A filter stripping known payload keys would not have known
// `u` and would have stored the payload. This module never matched it, so it
// recorded an unrecognized visit and nothing else. `u` has a row now, which is
// the misalignment the unrecognized outcome exists to surface.
//
// THE ALLOWLIST IS DATA, AND NOT THIS FILE'S. Delivery modes come from
// docs/routes-modes.csv, whose `carries` column is already `inline` against
// `reference`; typed toss keys from docs/routes-routes.csv; app routes from
// docs/app-routes.csv. All three are governed
// registries (docs/registries.csv), so this module joins rather than
// classifying, and a new mode is described once rather than twice. The caller
// hands the tables in.
//
// Pure: no DOM, no network, no clock, no storage. The caller supplies the
// address, the tables and the timestamp. Storage is the shell's, the way
// route-activity.js folds and the shell crawls.
//
//   VisitLog.classify(href, { modes, routes, tossRoutes, now }) -> row | null
//   VisitLog.key(row)                               -> the dedupe key
//
// Attaches to window.VisitLog, loaded via gh.load('kits/visit-log.js').
(() => {
  // ── The grammars ─────────────────────────────────────────────────────────
  //
  // Narrow on purpose, and narrower than the parsers that READ these forms.
  // repo-address.js accepts `(.+)` for a path because it has to parse whatever
  // git allows; this module is deciding what to WRITE, so it accepts only what
  // it is willing to store. A path carrying '?' or '#' is refused rather than
  // trimmed: trimming is the sanitizing move this file exists to avoid, and a
  // refusal lands in `unrecognized` where it is visible.
  //
  // LENGTH IS THE CONTROL THAT ACTUALLY STOPS BULK, and saying so is the point
  // of this note. A character class does not separate a path from a payload:
  // base64url is [A-Za-z0-9_-], which `[\w.\-\/]+` accepts happily, so an
  // unbounded PATH stored a 226-character gzip blob arriving as
  // `?view=project&project=<blob>`. The corpus test caught it; the fix is a
  // bound sized to what each field legitimately holds, plus the row-size cap
  // below as the backstop no single grammar has to carry.
  //
  // The honest residue: a SHORT string that is not a path can still be stored
  // as one. That is the misrecognized outcome, and it is acceptable by design,
  // because a wrong label costs a wrong link while bulk costs the document.
  const OWNER_REPO = /^[\w.-]{1,39}\/[\w.-]{1,39}$/;
  const REF = /^[\w.\-\/]{1,100}$/;
  const PATH = /^[\w.\-\/]{1,160}$/;
  const SLUG = /^[\w.-]{1,40}$/;
  // A view key, a tab, a lens: the short vocabulary words the app's own query
  // uses. Never a free string.
  const WORD = /^[a-z][\w-]{0,31}$/i;
  // A record id: a session stem, a branch spec, a commit-ish. Bounded, because
  // an unbounded "id" is a place for anything to hide.
  const ID = /^[\w.\-\/@:,]{1,120}$/;

  const ok = (re, v) => typeof v === 'string' && v !== '' && re.test(v);

  // Why an address was not stored. A CLOSED VOCABULARY: the value written is
  // looked up here by a key this file controls, so no rejection reason can be
  // assembled out of the address it is rejecting.
  const WHY = {
    addressUnparsed: 'the value was not owner/repo[@ref]:path shaped',
    addressGrammar: 'an address field failed its grammar',
    stageGrammar: 'the stage spec failed its grammar',
    fragmentUndescribed: 'the fragment carried a key no registry describes',
    noView: 'no view, app or repo key',
    viewUndescribed: 'the view is in no route registry',
    viewGrammar: 'the view failed its grammar',
    tooLarge: 'the minted row was larger than a visit row can be',
  };

  // ── The route templates ──────────────────────────────────────────────────
  //
  // One row per storable shape. `fields` names what may be written and the
  // grammar each must satisfy; nothing outside it is ever read off the address.
  // `kind` is what the row IS, which is what a reader groups by.
  const TEMPLATES = {
    // A toss of a repo file, the estate's one durable render address.
    toss: { kind: 'toss', fields: { repo: OWNER_REPO, ref: REF, path: PATH } },
    // A typed toss: the key names a renderer, the value addresses the content.
    route: { kind: 'toss', fields: { route: WORD, repo: OWNER_REPO, ref: REF, path: PATH } },
    // The app's own routes. `view` is the route key; the rest is whatever that
    // route's row in docs/app-routes.csv is entitled to carry.
    app: { kind: 'route', fields: {
      view: WORD, repo: OWNER_REPO, ref: REF, project: PATH, tab: WORD,
      item: ID, session: ID, detail: ID, sfile: ID, app: SLUG,
    } },
    // A stage link's REFS only. The `gz` segment beside them is local content
    // and is never a field here, so it cannot be written even by a caller
    // asking for this template by name.
    stage: { kind: 'stage', fields: { spec: ID } },
  };

  // Which delivery modes may be stored at all, read off the table's own
  // `carries` column rather than named here. An unknown value is treated as
  // inline, so a typo in the registry fails closed.
  const storableModes = (modes) => new Set(
    (modes || []).filter(m => String(m.carries).trim() === 'reference')
      .map(m => String(m.param).trim()));

  // Every mode the table describes, storable or not. A mode that is described
  // and inline is REFUSED by name; a mode that is not described at all falls
  // through to unrecognized. Both end with nothing stored, and the difference
  // is only what the log can tell you afterwards.
  const knownModes = (modes) => new Set((modes || []).map(m => String(m.param).trim()));

  // The TYPED TOSS keys, from docs/routes-routes.csv. routes-modes.csv carries
  // a single `<route>` row standing for all of them, which is right for a table
  // describing delivery modes and useless as an allowlist: a key has to be
  // matchable by name. So the third registry is read here rather than inferred.
  const tossRouteKeys = (tossRoutes) => new Set(
    (tossRoutes || []).map(r => String(r.key || '').trim()).filter(Boolean));

  // The app's route keys, from docs/app-routes.csv. `writes` and `alias`
  // spellings both resolve, since a saved link may carry either.
  const appRouteKeys = (routes) => {
    const out = new Set();
    for (const r of routes || []) {
      for (const k of [r.key, r.writes, r.alias]) if (k) out.add(String(k).trim());
    }
    return out;
  };

  // Re-mint: take a template and a bag of candidate values, and emit ONLY the
  // fields the template declares, only where the grammar accepts them. This is
  // the whole safety property, in six lines.
  function mint(tpl, candidates) {
    const out = {};
    for (const [field, re] of Object.entries(tpl.fields)) {
      const v = candidates[field];
      if (ok(re, v)) out[field] = v;
    }
    return out;
  }

  // Split `owner/repo[@ref]:path` without inheriting repo-address.js's
  // permissive path. A trailing ?query or #frag makes the whole thing refuse
  // rather than get trimmed: see the note on the grammars.
  function splitAddress(spec) {
    const m = String(spec || '').match(/^([^/@:]+\/[^/@:]+)(?:@([^:]+))?:(.+)$/);
    if (!m) return null;
    return { repo: m[1], ref: m[2] || '', path: m[3] };
  }

  // The fragment, as key/value segments. Read by slice rather than
  // URLSearchParams, matching toss-render's own readFragment: a payload
  // segment is not 'k=v' shaped and must not be re-encoded on the way past.
  function segments(hash) {
    return String(hash || '').replace(/^#/, '').split('&').filter(Boolean)
      .map(seg => {
        const at = seg.indexOf('=');
        return at < 0 ? [seg, ''] : [seg.slice(0, at), seg.slice(at + 1)];
      });
  }

  // ── classify ─────────────────────────────────────────────────────────────
  //
  // Returns a row, or null when the address is not a visit at all (an empty
  // string, a parse failure). An unrecognized address is a ROW, not a null:
  // the count is the point, and a silent drop would hide the drift this whole
  // design is built to surface.
  // THE BACKSTOP. Every grammar above is a judgement about one field; this is a
  // fact about the whole row. A visit row is a handful of short identifiers, so
  // anything past this is carrying something, whatever it claimed to be, and is
  // refused as unrecognized rather than stored. It exists so that no future
  // field, and no combination of fields each individually plausible, can smuggle
  // bulk past a per-field check.
  const ROW_CAP = 400;

  const capped = (row, base) => JSON.stringify(row).length <= ROW_CAP
    ? row : { ...base, kind: 'unrecognized', why: WHY.tooLarge };

  function classify(href, opts) {
    const o = opts || {};
    let u;
    try { u = new URL(String(href), 'https://mehrlander.github.io/'); }
    catch { return null; }
    if (!u.pathname) return null;

    const at = typeof o.now === 'number' ? o.now : 0;
    // The pathname is always safe to carry, so every row gets it and an
    // unrecognized row gets nothing else.
    const base = { path: u.pathname, at };
    // `why` IS A CODE FROM A CLOSED SET, never a sentence built from the
    // address. It read `'view=' + view + ' is in no route registry'` for an
    // hour and that was a leak: a payload arriving as ?view=<blob> reached the
    // row inside its own rejection reason. The corpus test at the foot of
    // tools/test/visit-log.test.mjs caught it, which is the whole argument for
    // testing the property rather than the cases. Interpolating input into a
    // diagnostic is the same mistake as storing it, and a refusal path is the
    // easiest place in a design like this to make it.
    const unknown = (why) => ({ ...base, kind: 'unrecognized', why: WHY[why] });

    const known = knownModes(o.modes);
    const storable = storableModes(o.modes);
    const routeKeys = appRouteKeys(o.routes);
    const tossKeys = tossRouteKeys(o.tossRoutes);

    // 1. THE FRAGMENT FIRST, because a delivery mode outranks whatever query
    //    the page also carries: a #gz= toss of a page whose own ?view= rides
    //    along is a payload visit, not an app route.
    const segs = segments(u.hash);
    for (const [k, v] of segs) {
      if (!known.has(k) && !tossKeys.has(k) && k !== 'stage') continue;
      // A described mode that carries content: refuse it BY NAME, so the log
      // can say a local document was rendered without holding a byte of it.
      if (known.has(k) && !storable.has(k)) {
        return capped({ ...base, kind: 'payload', mode: k, bytes: v.length }, base);
      }
      if (k === 'gh') {
        const a = splitAddress(v);
        if (!a) return unknown('addressUnparsed');
        const row = mint(TEMPLATES.toss, a);
        if (!row.repo || !row.path) return unknown('addressGrammar');
        return capped({ ...base, kind: TEMPLATES.toss.kind, ...row }, base);
      }
      if (k === 'stage') {
        // REFS ONLY. The spec half is stored; every other segment of a stage
        // link (gz, prompts, cmp, view, dest) is left behind, and `gz` is
        // content by the grammar above rather than by this exclusion.
        const row = mint(TEMPLATES.stage, { spec: v });
        if (!row.spec) return unknown('stageGrammar');
        return capped({ ...base, kind: TEMPLATES.stage.kind, ...row }, base);
      }
      // A typed toss: the key is a registered renderer, the value an address.
      const a = splitAddress(v);
      if (!a) return unknown('addressUnparsed');
      const row = mint(TEMPLATES.route, { route: k, ...a });
      if (!row.repo || !row.path) return unknown('addressGrammar');
      return capped({ ...base, kind: TEMPLATES.route.kind, ...row }, base);
    }
    // A fragment that carried something this module does not recognize is
    // unrecognized, never "probably fine". Anchors are the one exception, since
    // a bare '#heading' is a scroll target rather than an address.
    if (segs.length && segs.some(([, v]) => v !== '')) {
      return unknown('fragmentUndescribed');
    }

    // 2. THE QUERY, for the app's own routes. `?on=` is the fragment's query
    //    fallback and may carry a subject's whole param string, so it is a
    //    payload here exactly as a fragment mode would be.
    const q = u.searchParams;
    if (q.get('on')) return capped({ ...base, kind: 'payload', mode: 'on', bytes: q.get('on').length }, base);
    const view = q.get('view') || (q.get('app') ? 'app' : (q.get('repo') ? 'landing' : ''));
    if (!view) return unknown('noView');
    if (!routeKeys.has(view)) return unknown('viewUndescribed');
    const cand = {};
    for (const f of Object.keys(TEMPLATES.app.fields)) {
      const v = q.get(f);
      if (v != null) cand[f] = v;
    }
    cand.view = view;
    const row = mint(TEMPLATES.app, cand);
    if (!row.view) return unknown('viewGrammar');
    return capped({ ...base, kind: TEMPLATES.app.kind, ...row }, base);
  }

  // ── key ──────────────────────────────────────────────────────────────────
  //
  // What makes two visits the same destination. The READING PARAMETERS are
  // deliberately out of it (lens, grain, window, smode, set): revisiting a
  // screen at a different lens moves the one row rather than splitting it, so
  // the list stays a list of places. `tab` IS in the key, because Map's twelve
  // tabs are twelve panes rather than twelve readings of one.
  //
  // Every unrecognized visit to one pathname collapses to one key, which is
  // what turns a leak-proof refusal into a countable signal.
  function key(row) {
    if (!row) return '';
    if (row.kind === 'unrecognized') return 'unrecognized|' + row.path;
    if (row.kind === 'payload') return 'payload|' + row.path + '|' + row.mode;
    if (row.kind === 'stage') return 'stage|' + row.spec;
    if (row.kind === 'toss') {
      return 'toss|' + (row.route || 'gh') + '|' + row.repo + '@' + (row.ref || '') + ':' + row.path;
    }
    const parts = [row.view, row.repo || '', row.project || '', row.tab || '',
                   row.app || '', row.session || row.detail || row.sfile || row.item || ''];
    return 'route|' + parts.join('|');
  }

  window.VisitLog = { classify, key, TEMPLATES };
})();
