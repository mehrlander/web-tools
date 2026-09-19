// assistant-guess.js: who wrote a branch that declares nobody.
//
// assistant-mark.js reads a DECLARATION. AGENTS.md gives each assistant a
// branch prefix and a commit trailer, classify() looks for them, and a branch
// carrying neither falls to `human`. That fallback is the classifier having
// found no signal, not a finding that a person wrote it, and on 2026-09-18
// four Gemini branches landed in it (#718, #720, #721, #722) because the
// prefix went untyped. This kit is the second opinion for exactly those rows.
//
// It is a GUESS and the UI must render it as one. assistantMark.svg(k, {guess:
// true}) draws the mark dashed for this reason. Never let a guessed mark reach
// a place that reads as a record.
//
// ── two stages, because two kinds of evidence are available ────────────────
//
// STAGE 1, identity, which is evidence rather than style. Claude Code's
// harness authors commits as `Claude <noreply@anthropic.com>`; a local tool
// authors as whatever git config holds. Measured over 190 PRs: the first
// commit of 119 of 120 claude/ branches carries the harness identity, and of
// 37 gemini/ and codex/ branches, none does. The branch's FIRST commit is what
// counts: a later harness commit only says a Claude session visited (a merge
// of main, an artifact refresh), and reading those as ownership mislabeled 2
// of 20 codex branches.
//
// Stage 1 is INERT TODAY and that is deliberate rather than unfinished. The
// activity crawl does not carry a commit author onto a row, so `firstAuthor`
// is read here and written nowhere. Wiring it is a crawl change, in
// repo-activity-cache.js and the show-repo shell, and it is the single change
// that would turn most of this kit from a guess into a reading. Until then
// every answer below comes from stage 2. The existing session resolution
// covers part of the same ground already: a branch whose Claude-Session
// trailer resolves never reaches this kit at all.
//
// STAGE 2, style. Given a branch no harness started, Gemini and Codex are told
// apart by how they write: conventional-commit heads, title length, comma and
// `and` joins, slug shape. Multinomial logistic regression, 16 features, 37
// examples. Leave-one-out accuracy 92% against a 57% majority baseline.
//
// ── what it cannot do ──────────────────────────────────────────────────────
//
// 1. There is NO human class. Every label comes from a branch prefix and a
//    person's commits carry none, so no labeled human examples exist. The
//    model answers "closest to which assistant", never "was this an assistant".
// 2. It learns one library's habits over about one month. A tool that changes
//    its commit style, or a fifth tool nobody has seen, scores as whichever of
//    the two it resembles.
// 3. The threshold does not buy accuracy. The leave-one-out sweep is flat:
//    92% of 37 answers at p>=0.5, 88% of 25 at p>=0.7. Abstention is held at
//    0.70 anyway, as a hedge against the classes the model does not have
//    rather than a claim the sweep supports. `fitted` carries the numbers.
//
// The model block below is GENERATED. Edit data/assistant-attribution/
// branches.csv (or re-acquire it with `--fetch`) and run
// `python3 scripts/assistant-model.py`; tools/test/assistant-guess.test.mjs
// recomputes its fixtures in JavaScript, so a feature function that drifts
// from the Python one fails the suite rather than scoring differently in the
// browser. Attaches to window.assistantGuess.
(() => {
/* MODEL-BEGIN */
const MODEL = {
  "classes": [
    "gemini",
    "codex"
  ],
  "fitted": {
    "answered_at_threshold": 0.676,
    "correct_at_threshold": 0.88,
    "examples": 37,
    "identity_base_rates": {
      "claude": {
        "harness": 119,
        "web": 1
      },
      "codex": {
        "local": 21,
        "web": 7
      },
      "copilot": {
        "web": 1
      },
      "gemini": {
        "local": 16
      }
    },
    "loo_accuracy": 0.919,
    "loo_baseline": 0.568,
    "per_class": {
      "codex": 21,
      "gemini": 16
    }
  },
  "fixtures": [
    {
      "p": {
        "codex": 0.8897,
        "gemini": 0.1103
      },
      "slug": "core-pam-tech-budget-history",
      "title": "Clarify CORE PAM technology budget history"
    },
    {
      "p": {
        "codex": 0.704,
        "gemini": 0.296
      },
      "slug": "authored-use-locator",
      "title": "Declare Budget DRS authored result isolation and UI uses"
    },
    {
      "p": {
        "codex": 0.6643,
        "gemini": 0.3357
      },
      "slug": "submittal-readme-single-view",
      "title": "Make the Budget DRS submittal view authoritative"
    },
    {
      "p": {
        "codex": 0.2647,
        "gemini": 0.7353
      },
      "slug": "word-fiscal-summary-powershell",
      "title": "submittal: build Fiscal Summary table and document Word workflow"
    },
    {
      "p": {
        "codex": 0.704,
        "gemini": 0.296
      },
      "slug": "wps-installation-map",
      "title": "Map WPS work installation and align ISE Links paths"
    },
    {
      "p": {
        "codex": 0.6643,
        "gemini": 0.3357
      },
      "slug": "core-pam-draft-text-label",
      "title": "Label CORE PAM prose as draft text"
    }
  ],
  "threshold": 0.7,
  "weights": {
    "codex": {
      "and": -0.595781,
      "bias": 0.234727,
      "cap": 0.35209,
      "cc": -0.349499,
      "ccscope": -0.285717,
      "cctype_budget-drs": -0.086762,
      "cctype_build": -0.2276,
      "cctype_docs": -0.362942,
      "cctype_feat": -0.157869,
      "cctype_fix": -0.127849,
      "cctype_state": -0.086762,
      "cctype_submittal": 0.700285,
      "colon_early": -0.255028,
      "comma": -0.052222,
      "digit": -0.241253,
      "slughyp_l": -0.520312,
      "slughyp_m": -0.08239,
      "slughyp_s": 0.605293,
      "wlen_l": -0.321619,
      "wlen_m": -0.163127,
      "wlen_s": 0.539559,
      "wlen_xl": -0.052222
    },
    "gemini": {
      "and": 0.595781,
      "bias": -0.234727,
      "cap": -0.35209,
      "cc": 0.349499,
      "ccscope": 0.285717,
      "cctype_budget-drs": 0.086762,
      "cctype_build": 0.2276,
      "cctype_docs": 0.362942,
      "cctype_feat": 0.157869,
      "cctype_fix": 0.127849,
      "cctype_state": 0.086762,
      "cctype_submittal": -0.700285,
      "colon_early": 0.255028,
      "comma": 0.052222,
      "digit": 0.241253,
      "slughyp_l": 0.520312,
      "slughyp_m": 0.08239,
      "slughyp_s": -0.605293,
      "wlen_l": 0.321619,
      "wlen_m": 0.163127,
      "wlen_s": -0.539559,
      "wlen_xl": 0.052222
    }
  }
};
/* MODEL-END */

  const HARNESS = 'noreply@anthropic.com';
  const CC = /^([a-z][a-z-]*)(\([^)]*\))?:\s/;

  // Mirrors feats() in scripts/assistant-model.py, line for line. Every entry
  // is a property of the title or the branch slug. Deliberately no vocabulary,
  // no file paths, no timestamps: adding title words scores five points better
  // and does it by learning which files each tool touched that week, which
  // measures the work rather than the writer.
  function feats(title, slug) {
    const t = title || '', s = slug || '', f = { bias: 1 };
    const m = CC.exec(t);
    if (m) {
      f.cc = 1;
      if (m[2]) f.ccscope = 1;
      f['cctype_' + m[1]] = 1;
    }
    if (t.slice(0, 24).includes(':')) f.colon_early = 1;
    const n = t.trim() ? t.trim().split(/\s+/).length : 0;
    f['wlen_' + (n <= 6 ? 's' : n <= 10 ? 'm' : n <= 14 ? 'l' : 'xl')] = 1;
    if (/^[A-Z]/.test(t)) f.cap = 1;
    if (t.includes(' and ')) f.and = 1;
    if (t.includes(',')) f.comma = 1;
    if (t.includes('`')) f.tick = 1;
    if (/\d/.test(t)) f.digit = 1;
    if (t.includes('(') && !m) f.paren = 1;
    const h = (s.match(/-/g) || []).length;
    f['slughyp_' + (h <= 2 ? 's' : h <= 4 ? 'm' : 'l')] = 1;
    if (/-(?=[a-z0-9]{6}$)[a-z0-9]*\d[a-z0-9]*$/.test(s)) f.rand6 = 1;
    return f;
  }

  const dot = (w, f) => Object.entries(f).reduce((a, [k, v]) => a + (w[k] || 0) * v, 0);

  function score(title, slug) {
    const f = feats(title, slug), z = {};
    for (const c of MODEL.classes) z[c] = dot(MODEL.weights[c], f);
    const mx = Math.max(...Object.values(z));
    let s = 0;
    const ex = {};
    for (const c of MODEL.classes) { ex[c] = Math.exp(z[c] - mx); s += ex[c]; }
    const p = {};
    for (const c of MODEL.classes) p[c] = ex[c] / s;
    return p;
  }

  // The two features that pushed hardest toward the answer, for the tooltip. A
  // guess a reader cannot interrogate is worse than no guess: this is what
  // lets one be dismissed on sight.
  function why(title, slug, assistant) {
    const f = feats(title, slug), other = MODEL.classes.find(c => c !== assistant);
    return Object.keys(f)
      .filter(k => k !== 'bias')
      .map(k => [k, (MODEL.weights[assistant][k] || 0) - (MODEL.weights[other]?.[k] || 0)])
      .filter(([, v]) => v > 0.2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([k]) => k);
  }

  // A row as estate.js builds it: `name` the branch, `subject` its tip commit
  // subject (or the PR title for a row that is here on its PR alone), and
  // `firstAuthor` if a crawl ever carries one. Returns null when the kit
  // declines to answer, which the caller must render as nothing at all.
  function predict(row) {
    if (!row || !MODEL.classes) return null;
    const name = typeof row === 'string' ? row : (row.name || row.head || '');
    const slug = name.includes('/') ? name.slice(name.indexOf('/') + 1) : name;
    const title = typeof row === 'string' ? '' : (row.subject || row.pr?.title || row.title || '');
    const first = typeof row === 'string' ? '' : (row.firstAuthor || '');
    if (first && first.includes(HARNESS)) {
      return { assistant: 'claude', p: 1, basis: 'identity', why: ['first commit by the Claude harness'] };
    }
    if (!title && !slug) return null;
    const p = score(title, slug);
    const best = MODEL.classes.reduce((a, c) => (p[c] > p[a] ? c : a), MODEL.classes[0]);
    if (p[best] < MODEL.threshold) return null;
    return { assistant: best, p: p[best], basis: 'style', why: why(title, slug, best) };
  }

  window.assistantGuess = { MODEL, feats, score, predict, why };
})();
