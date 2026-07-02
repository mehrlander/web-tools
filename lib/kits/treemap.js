// treemap.js — pure logic for mapping a file tree as a treemap.
// Extracted from pages/repo-atlas.html so the kernels are testable (npm test)
// and reusable by other visualizers (IDB stores, zip contents, …).
// No DOM, no colors — rendering choices stay with the page.
(() => {
  // ── Category taxonomy ──────────────────────────────────────────────────────
  // Seven keys: six identity families + 'other'. Colors are the caller's
  // concern (repo-atlas assigns the dataviz palette's dark categorical slots).
  const CATS = {
    code:   'Code',
    docs:   'Docs',
    data:   'Data',
    markup: 'Markup',
    media:  'Media',
    styles: 'Styles',
    other:  'Other',
  };

  const EXT_CAT = (() => {
    const m = {};
    const put = (cat, exts) => exts.split(' ').forEach(e => m[e] = cat);
    put('code', 'js mjs cjs ts tsx jsx py rb sh bash zsh ps1 bat c h cc cpp hpp cs java go rs swift kt kts lua pl pm php sql r jl scala clj ex exs erl hs ml vue svelte astro');
    put('docs', 'md markdown txt rst adoc org tex bib');
    put('data', 'json jsonl ndjson csv tsv xml yaml yml toml ini lock env properties parquet geojson map');
    put('markup', 'html htm xhtml ejs hbs pug jade njk liquid');
    put('media', 'png jpg jpeg gif webp avif bmp ico svg mp3 wav ogg flac mp4 webm mov avi woff woff2 ttf otf eot pdf psd ai');
    put('styles', 'css scss sass less styl pcss');
    return m;
  })();
  const NAME_CAT = {
    license: 'docs', 'license.txt': 'docs', notice: 'docs', readme: 'docs',
    dockerfile: 'code', makefile: 'code', gemfile: 'code', rakefile: 'code', procfile: 'data',
  };

  function categorize(name) {
    const lower = name.toLowerCase();
    if (NAME_CAT[lower]) return NAME_CAT[lower];
    const dot = lower.lastIndexOf('.');
    if (dot <= 0) return 'other';
    return EXT_CAT[lower.slice(dot + 1)] || 'other';
  }

  // ── Tree build ─────────────────────────────────────────────────────────────
  // entries: git-trees-API shape — [{ path, type: 'blob'|'tree'|…, size }].
  // Returns the root of a node tree: dirs { name, path, isDir:true, size,
  // children, fileCount, dirCount, parent }, files { name, path, isDir:false,
  // size, cat, parent }. Children sorted by size desc; sizes rolled up.
  function buildTree(entries, rootName) {
    const root = { name: rootName, path: '', isDir: true, size: 0, children: [], fileCount: 0, dirCount: 0, parent: null };
    const dirs = new Map([['', root]]);
    const dirFor = path => {
      if (dirs.has(path)) return dirs.get(path);
      const i = path.lastIndexOf('/');
      const parent = dirFor(i < 0 ? '' : path.slice(0, i));
      const d = { name: path.slice(i + 1), path, isDir: true, size: 0, children: [], fileCount: 0, dirCount: 0, parent };
      parent.children.push(d);
      dirs.set(path, d);
      return d;
    };
    for (const e of entries) {
      if (e.type !== 'blob') continue;
      const i = e.path.lastIndexOf('/');
      const parent = dirFor(i < 0 ? '' : e.path.slice(0, i));
      const name = e.path.slice(i + 1);
      parent.children.push({ name, path: e.path, isDir: false, size: e.size || 0, cat: categorize(name), parent });
    }
    (function roll(n) {
      for (const c of n.children) {
        if (c.isDir) {
          roll(c);
          n.size += c.size; n.fileCount += c.fileCount; n.dirCount += c.dirCount + 1;
        } else {
          n.size += c.size; n.fileCount++;
        }
      }
      n.children.sort((a, b) => b.size - a.size);
    })(root);
    return root;
  }

  // Aggregate bytes/files per category under a node.
  function catTotals(node) {
    const t = {};
    (function walk(n) {
      for (const c of n.children) {
        if (c.isDir) walk(c);
        else { (t[c.cat] ??= { bytes: 0, files: 0 }); t[c.cat].bytes += c.size; t[c.cat].files++; }
      }
    })(node);
    return t;
  }

  // ── Squarified treemap (Bruls, Huizing & van Wijk 2000) ────────────────────
  // items: [{ weight }] sorted desc. Returns rects [{x,y,w,h}] aligned to
  // items, tiling (x,y,w,h) exactly; each row is laid along the shorter side,
  // rows accept items while the worst aspect ratio improves.
  function squarify(items, x, y, w, h) {
    const total = items.reduce((s, i) => s + i.weight, 0);
    const rects = [];
    if (total <= 0 || w <= 0 || h <= 0) return items.map(() => ({ x, y, w: 0, h: 0 }));
    let i = 0, cx = x, cy = y, cw = w, ch = h;
    const scale = (w * h) / total;

    while (i < items.length) {
      // guard: the 0.0001 area floor (and float drift) can exhaust the region
      // before the items run out — emit zero rects rather than negative ones
      if (cw <= 0 || ch <= 0) {
        for (; i < items.length; i++) rects.push({ x: cx, y: cy, w: 0, h: 0 });
        break;
      }
      const vertical = cw < ch; // region taller than wide → row spans the width
      const side = vertical ? cw : ch;
      // The row's worst aspect ratio is max(thick²/minArea, maxArea/thick²),
      // so a min/max/sum triple scores each candidate in O(1) — no row copy,
      // no rescan (matters in files mode, where flat dirs make √n-long rows).
      let rowSum = 0, rowMin = Infinity, rowMax = 0, rowLen = 0, worst = Infinity;
      let j = i;
      while (j < items.length) {
        const a = Math.max(items[j].weight * scale, 0.0001);
        const sum = rowSum + a;
        const thick = sum / side, t2 = thick * thick;
        const mn = Math.min(rowMin, a), mx = Math.max(rowMax, a);
        const wst = Math.max(t2 / mn, mx / t2);
        if (wst > worst && rowLen) break;
        rowSum = sum; rowMin = mn; rowMax = mx; rowLen++; worst = wst; j++;
      }
      const thick = Math.min(rowSum / side, vertical ? ch : cw);
      let off = 0;
      for (let k = i; k < j; k++) {
        const a = Math.max(items[k].weight * scale, 0.0001);
        const len = Math.min(a / thick, side - off);
        rects.push(vertical
          ? { x: cx + off, y: cy, w: len, h: thick }
          : { x: cx, y: cy + off, w: thick, h: len });
        off += len;
      }
      if (vertical) { cy += thick; ch -= thick; }
      else { cx += thick; cw -= thick; }
      i = j;
    }
    return rects;
  }

  // ── Formatting ─────────────────────────────────────────────────────────────
  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  window.treemap = { CATS, categorize, buildTree, catTotals, squarify, fmtBytes };
})();
