// repo-mark.js — a repository's mark, resolved from its manifest and drawn
// one way wherever a repository is named.
//
// THE SHAPE, four optional keys of a repository's .web-tools.json:
//
//   icon    a Phosphor class ("ph-lightning"). The glyph, and the fallback for
//           everything below. It never holds a path: a dozen consumers outside
//           this kit draw it as a class (the swipe deck's header, the landing
//           masthead, the repo menus), and a path there draws nothing.
//   mark    a drawn SVG: a repo-root-relative path, or owner/repo[@ref]:path
//           for a file kept elsewhere, such as the hub's docs/favicons/repos/.
//           It replaces the glyph once read; while the read is out the slot
//           holds its width blank, and a file that cannot be read draws the
//           glyph.
//   tone    a key of TONES below. It colours the glyph, and an SVG drawn in one
//           ink (one that fills with currentColor). An SVG with fills of its
//           own keeps them.
//   weight  a key of WEIGHTS below, for the glyph. Duotone when a tone is set
//           and regular otherwise, so a manifest declaring only `icon` draws
//           what it drew before this file existed.
//
// ONE WEIGHT CLASS PER GLYPH. Phosphor's web package loads all six weight
// stylesheets, and `.ph` and `.ph-duotone` each set the font family and each
// glyph's content with the same specificity, so `ph ph-duotone ph-x` is
// settled by which stylesheet the package's script injected last. It happens
// to come out duotone; that is load order, not a rule. html() writes exactly
// one of the classes below and never `ph` beside another.
//
// THE PALETTE IS A FIXED MAP of whole class names. The pages run Tailwind's
// browser build, which compiles a class when it appears in the DOM, so a class
// arriving from JSON would paint; a baked page (the bake-page skill) compiles
// only the classes its source spells out, and would drop it. Naming every class
// here keeps both working. Shade 500 for yellow, amber and lime, which turn
// mustard and olive at 600 on the winter theme's white; 600 for every other hue,
// where 500 reads faint at 16px. Compared by eye at 3x on the scope pill's
// background, 2026-10-28.
//
// DRAWN, NOT INLINED. A one-ink SVG is painted as a CSS mask in the text
// colour, which is how the app already draws the hub's marks; one with fills of
// its own is an <img> of a data URL, which is how it draws a project's. Neither
// runs a script the file might carry, and neither puts the file's ids in the
// page, where two marks that both name a mask `clear` (chat-histories and
// wa-bills do) would resolve to whichever came first. The file is still parsed
// once, to refuse anything that is not an SVG and to tell the two kinds apart.
//
// THE SLOT IS 1em SQUARE, like a Phosphor glyph, so a caller's text-base or
// text-lg sizes a mark and a glyph alike, and the drawing fills it. A drawn
// mark fills its viewBox nearly edge to edge where a glyph keeps a margin, so
// beside glyphs it reads a little larger; it is not shrunk to match, because
// the Drawn marks rules (docs/favicons/README.md) set every gap at 2.5 of 29
// units, about 1.4 CSS px at 16, and at 80% that gap falls to 1.1.
//
//   RepoMark.spec(cfg, repo)   -> mark spec, from manifest fields; no reads
//   RepoMark.load(spec)        -> Promise of the spec with its SVG read
//   RepoMark.of(repo)          -> Promise of a loaded spec from the repository's
//                                 own manifest, or null where it declares none
//   RepoMark.html(spec, o?)    -> markup
//   RepoMark.TONES, .WEIGHTS, .NEUTRAL
//
// html() takes three classes, and writes at most one colour, since two colour
// utilities on one element are settled by stylesheet order. `o.cls` sizes the
// mark and carries no colour. `o.color` is the caller's resting colour, which a
// tone replaces. `o.tint` is for a caller whose colour is information, such as
// the Sessions table's pull-request state: it replaces the tone, and an SVG
// with colours of its own is drawn in one ink so the state still reads.
//
// Attaches to window.RepoMark.
(() => {
  const TONES = {
    red: 'text-red-600', orange: 'text-orange-600', amber: 'text-amber-500',
    yellow: 'text-yellow-500', lime: 'text-lime-500', green: 'text-green-600',
    emerald: 'text-emerald-600', teal: 'text-teal-600', cyan: 'text-cyan-600',
    sky: 'text-sky-600', blue: 'text-blue-600', indigo: 'text-indigo-600',
    violet: 'text-violet-600', purple: 'text-purple-600', fuchsia: 'text-fuchsia-600',
    pink: 'text-pink-600', rose: 'text-rose-600', slate: 'text-slate-600',
  };
  const WEIGHTS = { regular: 'ph', bold: 'ph-bold', fill: 'ph-fill', duotone: 'ph-duotone' };
  const NEUTRAL = 'ph-bookmark-simple';
  const GLYPH_RE = /^ph-[a-z0-9-]+$/;
  // Larger than any drawn mark by two orders: the hub's run 0.6 to 3 KB, and
  // the surfacing program's, the largest, is 4.6 KB.
  const MAX_BYTES = 64 * 1024;

  // owner/repo[@ref]:path, read by the estate's one parser of that grammar
  // (kits/repo-address.js, which boots before this), or a path in `repo`
  // itself. Only an .svg is a mark.
  function markRef(v, repo) {
    if (typeof v !== 'string' || !/\.svg$/i.test(v.trim())) return null;
    const s = v.trim();
    const a = window.RepoAddress?.parse(s);
    if (a) return { repo: a.repo, ref: a.ref, path: a.path.replace(/^\/+/, '') };
    return repo ? { repo, ref: '', path: s.replace(/^\/+/, '') } : null;
  }

  function spec(cfg, repo = '') {
    const c = cfg && typeof cfg === 'object' ? cfg : {};
    const glyph = typeof c.icon === 'string' && GLYPH_RE.test(c.icon.trim()) ? c.icon.trim() : '';
    const tone = typeof c.tone === 'string' && TONES[c.tone] ? c.tone : '';
    const weight = typeof c.weight === 'string' && WEIGHTS[c.weight] ? c.weight : (tone ? 'duotone' : 'regular');
    const mark = markRef(c.mark, repo);
    return { repo, glyph: glyph || NEUTRAL, declared: !!(glyph || mark), weight, tone, mark };
  }

  // A file, read once per repo@ref:path for the page's life. A value is
  // { src, ink } for a drawable SVG and null for anything else.
  const FILES = new Map();
  function readSvg(ref) {
    const key = ref.repo + '@' + ref.ref + ':' + ref.path;
    if (!FILES.has(key)) {
      FILES.set(key, (async () => {
        try {
          if (!window.GH) return null;
          // No ref named means the page's selection decides (refs=, ?use= for
          // the hub), and main where it names none, so a preview link can pin
          // the branch that changes a mark.
          const g = new window.GH({ token: window.TOKEN || '', repo: ref.repo, ...(ref.ref ? { ref: ref.ref } : {}) });
          return drawable((await g.get(ref.path)).text);
        } catch { return null; }
      })());
    }
    return FILES.get(key);
  }
  // An SVG document whose root is <svg>, or nothing. `ink` is a file that
  // paints with currentColor, which the page then colours.
  function drawable(text) {
    const t = String(text || '');
    if (!t || t.length > MAX_BYTES || typeof window.DOMParser !== 'function') return null;
    const doc = new window.DOMParser().parseFromString(t, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
    return { src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(t), ink: /currentColor/i.test(t) };
  }

  async function load(s) {
    if (!s || !s.mark) return s;
    return { ...s, svg: await readSvg(s.mark) };
  }

  // The repository's own manifest, once per repository. null when it cannot be
  // read or declares neither an icon nor a mark: the caller counts it rather
  // than drawing a neutral glyph for it.
  const MANIFESTS = new Map();
  function of(repo) {
    if (!MANIFESTS.has(repo)) {
      MANIFESTS.set(repo, (async () => {
        try {
          const g = new window.GH({ token: window.TOKEN || '', repo });
          const s = spec(JSON.parse((await g.get('.web-tools.json')).text), repo);
          return s.declared ? load(s) : null;
        } catch { return null; }
      })());
    }
    return MANIFESTS.get(repo);
  }

  function html(s, o = {}) {
    // window.esc (lib/vanilla-bundle.js), read at call time: the boot list
    // loads it first, so it is there by the time anything draws.
    const esc = window.esc;
    const sp = s || spec(null);
    const cls = o.cls || 'text-base';
    const ink = o.tint || TONES[sp.tone] || o.color || '';
    // A mark whose read is out: hold the width, draw nothing yet.
    if (sp.mark && sp.svg === undefined) {
      return `<span class="inline-block size-[1em] shrink-0 ${esc(cls)}" aria-hidden="true"></span>`;
    }
    // The file rides a custom property, the one value no utility class can
    // carry, as the shell's markStyle and the Map's marks do.
    if (sp.svg && (sp.svg.ink || o.tint)) {
      return `<span class="inline-block size-[1em] shrink-0 bg-current [mask:var(--mark)_center/contain_no-repeat] ${esc(cls + ' ' + ink)}"`
        + ` style="--mark:url(&quot;${esc(sp.svg.src)}&quot;)" aria-hidden="true"></span>`;
    }
    if (sp.svg) {
      return `<img src="${esc(sp.svg.src)}" alt="" class="inline-block size-[1em] shrink-0 ${esc(cls)}" aria-hidden="true">`;
    }
    return `<i class="${WEIGHTS[sp.weight]} ${esc(sp.glyph)} shrink-0 leading-none ${esc(cls + ' ' + ink)}" aria-hidden="true"></i>`;
  }

  window.RepoMark = { spec, load, of, html, drawable, markRef, TONES, WEIGHTS, NEUTRAL };
})();
