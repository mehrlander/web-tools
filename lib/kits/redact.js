// kits/redact.js — cover parts of an image with labelled boxes, crop it, and
// prove the covered pixels are gone before it is copied out. The editor
// behind pages/redact.html and the Stage's "Edit image" action.
//
//   Redact.open(blob, { name, useLabel }) → Promise<Blob | null>
//       an overlay over the current page; resolves with the verified PNG
//       when the reader takes the result, null on Cancel. The Stage uses it.
//   Redact.mount(el, { sample: true })
//       the editor in place, for a page of its own. Mount before Alpine
//       starts (Alpine's own start initialises it); open() inits its overlay.
//
// FIND TEXT runs Tesseract.js on the device, imported on first use from
// jsDelivr (about 6 MB, cached after). The image never leaves the page. Words
// shaped like an email, a phone number, an amount or a run of digits are
// flagged; names are not, since no pattern tells a name from a word. OCR also
// misses small, faint text, so a word it did not find is not a word that is
// absent.
//
// TAP boxes a word; tapping the next word on the same line grows that box
// when the two would carry the same label, so "Jane" then "Doe" is one box
// while "Doe" beside an already boxed email stays its own. DRAW boxes anything
// OCR missed; a box's middle drags it and its edges and corners resize it, so
// a short box is fixed rather than redrawn. Moving or resizing a word box
// detaches it from its words. CROP is placed by a drag; then its edges and
// corners resize it and its middle moves it, a tap outside clears it, and a
// drag outside starts a new one. Grips are black squares at the four corners.
//
// STYLE sets a box's fill (white unless changed), its border (none, solid,
// dashed or dotted, with a colour and a width scaled to the image) and, by
// contrast, the label's ink. A change lands on the selected box and becomes
// the style for the next one, as Paint's current colour does. The colour
// input only yields opaque colours, so every fill is a full cover.
//
// DONE renders a fresh PNG at full resolution and checks it: each box in the
// exported bytes must equal the same box painted alone on a blank canvas,
// byte for byte, so no pixel of the original survives under a box. Box edges
// are snapped to whole pixels for that reason: a fractional edge would blend
// the original into the border pixels and the check would (rightly) fail.
// Labels are clipped to their box for the same reason. Copy, and the
// overlay's use button, stay disabled unless every box matches.
//
// Draw and Crop cancel touchstart/touchmove non-passively on the canvas, per
// docs/ios-sheet-drags.md, so a drag inside an app's sheet does not dismiss
// it; Tap leaves touch alone so the page still scrolls over the image. Drags
// are measured as finger travel from the press, not finger position, so a
// toolbar that changes height mid-drag cannot skew them.
(() => {
  const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js';
  const FONT = 'ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

  // One recognizer for the page, whoever asks; `log` is pointed at the
  // editor that is asking.
  let worker = null, log = () => {};
  const ocrWorker = () => worker ??= (async () => {
    const m = await import(TESSERACT);
    return (m.default || m).createWorker('eng', 1, { logger: x => log(x) });
  })().catch(e => { worker = null; throw e; });

  // Black or white, whichever reads on a fill.
  const ink = (hex) => {
    const n = parseInt(String(hex).slice(1), 16), [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? '#000000' : '#ffffff';
  };

  // One box, painted: opaque fill, then the border, then the label, all
  // clipped to the box, so nothing it draws reaches past its own rectangle.
  // The export and the check both call this, which is what makes "equal to a
  // fresh paint" a meaningful test. `base` is the image's border unit.
  const paint = (g, b, base) => {
    g.save();
    g.beginPath(); g.rect(b.x, b.y, b.w, b.h); g.clip();
    g.fillStyle = b.fill;
    g.fillRect(b.x, b.y, b.w, b.h);
    let lw = 0;
    if (b.border !== 'none') {
      lw = Math.max(1, Math.min(b.bw * base, Math.floor(Math.min(b.w, b.h) / 4)));
      g.lineWidth = lw; g.strokeStyle = b.stroke;
      g.setLineDash(b.border === 'dashed' ? [lw * 4, lw * 3] : b.border === 'dotted' ? [0, lw * 2] : []);
      g.lineCap = b.border === 'dotted' ? 'round' : 'butt';
      g.strokeRect(b.x + lw / 2, b.y + lw / 2, b.w - lw, b.h - lw);
      g.setLineDash([]);
    }
    if (b.label) {
      const room = b.w - 2 * lw - 6;
      let px = Math.max(8, Math.floor((b.h - 2 * lw) * 0.62));
      const set = () => { g.font = `600 ${px}px ${FONT}`; };
      set();
      while (px > 8 && g.measureText(b.label).width > room) { px--; set(); }
      g.fillStyle = ink(b.fill); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
    }
    g.restore();
  };

  const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const snap = (x0, y0, x1, y1, W, H) => {
    const x = Math.max(0, Math.floor(Math.min(x0, x1))), y = Math.max(0, Math.floor(Math.min(y0, y1)));
    const X = Math.min(W, Math.ceil(Math.max(x0, x1))), Y = Math.min(H, Math.ceil(Math.max(y0, y1)));
    return { x, y, w: X - x, h: Y - y };
  };

  const exportVerified = async (img, boxes, crop, W, H, base) => {
    const c = crop || { x: 0, y: 0, w: W, h: H };
    const out = canvas(c.w, c.h), g = out.getContext('2d');
    g.drawImage(img, -c.x, -c.y);
    g.translate(-c.x, -c.y);
    boxes.forEach(b => paint(g, b, base));
    const blob = await new Promise((ok, no) => out.toBlob(b => b ? ok(b) : no(new Error('PNG encode failed')), 'image/png'));

    // Decode the bytes a Copy would carry, not the canvas that made them.
    const dec = canvas(c.w, c.h), dg = dec.getContext('2d', { willReadFrequently: true });
    dg.drawImage(await createImageBitmap(blob), 0, 0);
    const ref = canvas(c.w, c.h), rg = ref.getContext('2d', { willReadFrequently: true });
    rg.translate(-c.x, -c.y);
    boxes.forEach(b => paint(rg, b, base));

    const checks = boxes.map((b, i) => {
      const r = snap(b.x - c.x, b.y - c.y, b.x - c.x + b.w, b.y - c.y + b.h, c.w, c.h);
      if (r.w <= 0 || r.h <= 0) return { n: i + 1, label: b.label, bytes: 0, diff: 0, cropped: true };
      const a = dg.getImageData(r.x, r.y, r.w, r.h).data, e = rg.getImageData(r.x, r.y, r.w, r.h).data;
      let diff = 0;
      for (let k = 0; k < a.length; k++) if (a[k] !== e[k]) diff++;
      return { n: i + 1, label: b.label, bytes: a.length, diff, cropped: false };
    });
    return { blob, w: c.w, h: c.h, checks };
  };

  // Pattern flags. Order is priority when a box spans several kinds.
  const KINDS = [
    ['email', /\S+@\S+\.\S+/, '[email]'],
    ['phone', /^\(\d{3}\)$|^\(?\d{3}\)?[-.\s]?\d{3}[-.]\d{4}\W*$|^\d{3}[-.]\d{4}\W*$/, '[phone]'],
    ['amount', /^\$\d/, '[amount]'],
    ['number', /\d{4,}|\d{3,}[-./]\d/, '[number]'],
  ];
  const kindOf = t => (KINDS.find(([, re]) => re.test(t)) || [''])[0];
  const labelOf = kinds => (KINDS.find(([k]) => kinds.includes(k)) || [, , ''])[2];

  const linesOf = (data) => {
    const out = [];
    let id = 0;
    for (const b of data.blocks || []) for (const p of b.paragraphs) for (const l of p.lines) {
      const line = out.length;
      const words = l.words.filter(w => w.text.trim())
        .map((w, i) => ({ id: id++, line, i, text: w.text, bbox: w.bbox, kind: kindOf(w.text) }));
      if (words.length) out.push({ words });
    }
    return out;
  };

  // A stand-in screenshot, drawn rather than shipped, so the page opens on
  // something with a name, an email, a phone number and an account in it.
  const sampleBlob = () => {
    const S = 3, W = 390, H = 300, c = canvas(W * S, H * S), g = c.getContext('2d');
    g.scale(S, S);
    const font = (w, px) => { g.font = `${w} ${px}px ${FONT}`; };
    g.fillStyle = '#f4f4f6'; g.fillRect(0, 0, W, H);
    font(400, 13); g.fillStyle = '#666'; g.fillText('Today 9:41 AM', 18, 30);
    g.fillStyle = '#fff'; g.beginPath(); g.roundRect(18, 42, W - 36, 206, 14); g.fill();
    const lines = [
      [['From: ', 700], ['Jane Doe <jane.doe@example.com>', 400]],
      [['Phone: ', 700], ['(360) 555-0142', 400]],
      [],
      [['Hi Sam, your claim 2026-44817 was', 400]],
      [['approved. The refund of $1,240.18 goes to', 400]],
      [['account ending 4417 by Friday.', 400]],
      [],
      [['Questions? Reply here or call the office.', 400]],
    ];
    let y = 70;
    g.fillStyle = '#111';
    for (const ln of lines) {
      let x = 32;
      for (const [t, w] of ln) { font(w, 15); g.fillText(t, x, y); x += g.measureText(t).width; }
      y += 22;
    }
    font(400, 12); g.fillStyle = '#9a9a9a'; g.fillText('Sent from my iPhone', 18, 272);
    return new Promise(ok => c.toBlob(ok, 'image/png'));
  };

  // ── The editor ──────────────────────────────────────────────────────────
  // Its config rides on the root element (el._redact), set by mount().
  const editor = () => {
    // Held outside Alpine: a reactive proxy around an ImageBitmap or a Blob
    // is not one, and drawImage / ClipboardItem refuse it.
    const raw = { img: null, src: null, out: null, cfg: {}, onResize: null };
    return {
      embedded: false, useLabel: 'Use',
      view: 'edit', tab: 'text', mode: 'tap',
      name: '', isSample: false, W: 0, H: 0, imgKey: 0,
      lines: [], showWords: false,
      boxes: [], sel: null, seq: 0, lastLabel: '[removed]', base: 1,
      // `stroke`, not `line`: a word box already carries `line`, its OCR line index.
      style: { fill: '#ffffff', border: 'solid', stroke: '#111827', bw: 1 },
      crop: null, start: null, drag: null, dragging: false, op: null, hover: '',
      ocr: { busy: false, progress: 0, status: '' },
      out: { url: '', checks: [], w: 0, h: 0, size: 0, reread: '' },
      note: { text: '', bad: false },
      colors: {},

      async init() {
        raw.cfg = this.$el._redact || {};
        this.embedded = !!raw.cfg.embedded;
        this.useLabel = raw.cfg.useLabel || 'Use';
        await this.$nextTick();
        const css = getComputedStyle(this.$el);
        this.colors = { warn: css.getPropertyValue('--color-warning').trim() || '#f59e0b' };
        const cv = this.$refs.cv;
        const block = e => { if (this.mode !== 'tap') e.preventDefault(); };
        cv.addEventListener('touchstart', block, { passive: false });
        cv.addEventListener('touchmove', block, { passive: false });
        raw.onResize = () => this.render();
        window.addEventListener('resize', raw.onResize);
        Alpine.effect(() => this.render());
        if (raw.cfg.blob) await this.load(raw.cfg.blob, raw.cfg.name || 'image');
        else if (raw.cfg.sample) await this.load(await sampleBlob(), 'sample.png', true);
      },
      destroy() {
        window.removeEventListener('resize', raw.onResize);
        if (this.out.url) URL.revokeObjectURL(this.out.url);
      },

      get words() { return this.lines.flatMap(l => l.words); },
      get selBox() { return this.boxes.find(b => b.id === this.sel) || null; },
      // What the Style menu edits: the selected box, else the style new boxes take.
      get cur() { return this.selBox || this.style; },
      get curName() { return this.selBox ? 'Box ' + (this.boxes.indexOf(this.selBox) + 1) : 'New boxes'; },
      get selLabel() { return this.selBox?.label ?? ''; },
      set selLabel(v) { if (this.selBox) { this.selBox.label = v; this.lastLabel = v; } },
      get flagged() { return this.words.filter(w => w.kind); },
      get flaggedOpen() { return this.flagged.filter(w => !this.boxOfWord(w)).length; },
      get figure() {
        if (!this.W) return '';
        const size = this.crop ? `${this.crop.w}×${this.crop.h} of ${this.W}×${this.H}` : `${this.W}×${this.H}`;
        return `${this.name} · ${size} · ${this.boxes.length} box${this.boxes.length === 1 ? '' : 'es'}`;
      },
      get verdict() {
        const c = this.out.checks.filter(c => !c.cropped);
        if (!c.length) return 'No boxes in the result';
        const bytes = c.reduce((s, x) => s + x.bytes, 0), diff = c.reduce((s, x) => s + x.diff, 0);
        return `${c.length} box${c.length === 1 ? '' : 'es'} verified · ${diff.toLocaleString()} of ${bytes.toLocaleString()} bytes differ`;
      },
      get verified() { return this.out.checks.every(c => c.diff === 0); },

      // ── Loading ──────────────────────────────────────────────────────────
      async load(blob, name, sample = false) {
        try {
          const bmp = await createImageBitmap(blob);
          raw.img = bmp; raw.src = blob;
          Object.assign(this.$refs.cv, { width: bmp.width, height: bmp.height });
          Object.assign(this, { name, isSample: sample, W: bmp.width, H: bmp.height, lines: [], boxes: [],
                                base: Math.max(1, Math.round(Math.min(bmp.width, bmp.height) / 400)),
                                sel: null, crop: null, drag: null, view: 'edit', tab: 'text' });
          this.imgKey++;
        } catch (e) { this.toast('Not an image this browser can read', true); }
      },
      onFile(e) { const f = e.target.files[0]; if (f) this.load(f, f.name); e.target.value = ''; },
      onDrop(e) { const f = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/')); if (f) this.load(f, f.name); },
      onPaste(e) {
        if (e.target.closest?.('input, textarea')) return;
        const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
        if (f) { e.preventDefault(); this.load(f, 'pasted.' + f.type.split('/')[1]); }
      },
      async pasteButton() {
        try {
          for (const it of await navigator.clipboard.read()) {
            const t = it.types.find(t => t.startsWith('image/'));
            if (t) return this.load(await it.getType(t), 'pasted.' + t.split('/')[1]);
          }
          this.toast('No image on the clipboard', true);
        } catch (e) { this.toast('Paste blocked here · use Ctrl/Cmd-V or Open', true); }
      },

      // ── Text recognition ─────────────────────────────────────────────────
      async recognize(blob) {
        this.ocr = { busy: true, progress: 0, status: 'loading' };
        log = m => { this.ocr.status = m.status; this.ocr.progress = m.progress || 0; };
        try {
          const w = await ocrWorker();
          return (await w.recognize(blob, {}, { blocks: true, text: true })).data;
        } finally { this.ocr.busy = false; }
      },
      async findText() {
        try {
          const data = await this.recognize(raw.src);
          this.boxes = this.boxes.filter(b => b.line < 0);
          this.lines = linesOf(data);
          this.tab = 'text';
          if (!this.lines.length) this.toast('No text found', true);
        } catch (e) { this.toast('Text recognition failed: ' + e.message, true); }
      },

      // ── Boxes ────────────────────────────────────────────────────────────
      boxOfWord(w) { return this.boxes.find(b => b.line === w.line && b.from <= w.i && w.i <= b.to); },
      fit(b) {
        const ws = this.lines[b.line].words.slice(b.from, b.to + 1);
        const x0 = Math.min(...ws.map(w => w.bbox.x0)), y0 = Math.min(...ws.map(w => w.bbox.y0));
        const x1 = Math.max(...ws.map(w => w.bbox.x1)), y1 = Math.max(...ws.map(w => w.bbox.y1));
        const pad = Math.max(2, Math.round((y1 - y0) * 0.12));
        Object.assign(b, snap(x0 - pad, y0 - pad, x1 + pad, y1 + pad, this.W, this.H),
                      { src: ws.map(w => w.text).join(' ') });
        return b;
      },
      addBox(b) {
        b = { id: ++this.seq, line: -1, from: 0, to: 0, src: '', ...this.style, ...b };
        if (b.line >= 0) this.fit(b);
        this.boxes.push(b);
        this.sel = b.id;
      },
      // A change lands on the selected box AND becomes the style for the next
      // one, the way Paint's current colour does.
      setStyle(k, v) {
        if (this.selBox) this.selBox[k] = v;
        this.style[k] = v;
      },
      styleAll() { for (const b of this.boxes) Object.assign(b, { ...this.style }); },
      ink,
      swatch: (c) => ({ background: c.fill, borderColor: c.border === 'none' ? 'transparent' : c.stroke,
                        borderStyle: c.border === 'none' ? 'solid' : c.border }),
      removeBox(id) {
        this.boxes = this.boxes.filter(b => b.id !== id);
        if (this.sel === id) this.sel = null;
      },
      toggleWord(w) {
        const hit = this.boxOfWord(w);
        if (hit) {
          if (hit.from === hit.to) return this.removeBox(hit.id);
          if (w.i === hit.from) hit.from++;
          else if (w.i === hit.to) hit.to--;
          else { this.sel = hit.id; return; }
          return this.fit(hit);
        }
        // A neighbour is joined only when it would carry the same label, so a
        // name tapped beside a boxed email does not vanish into "[email]".
        const label = w.kind ? labelOf([w.kind]) : this.lastLabel;
        const left = this.boxes.find(b => b.line === w.line && b.to === w.i - 1 && b.label === label);
        const right = this.boxes.find(b => b.line === w.line && b.from === w.i + 1 && b.label === label);
        if (left && right) { left.to = right.to; this.removeBox(right.id); this.fit(left); this.sel = left.id; return; }
        if (left) { left.to = w.i; this.fit(left); this.sel = left.id; return; }
        if (right) { right.from = w.i; this.fit(right); this.sel = right.id; return; }
        this.addBox({ line: w.line, from: w.i, to: w.i, label });
      },
      boxLine(ln) {
        const line = ln.words[0].line;
        this.boxes = this.boxes.filter(b => b.line !== line);
        this.addBox({ line, from: 0, to: ln.words.length - 1, label: this.lastLabel });
      },
      boxFlagged() {
        for (const ln of this.lines) {
          let run = [];
          const flush = () => {
            if (run.length) this.addBox({ line: run[0].line, from: run[0].i, to: run.at(-1).i, label: labelOf(run.map(w => w.kind)) });
            run = [];
          };
          for (const w of ln.words) (w.kind && !this.boxOfWord(w)) ? run.push(w) : flush();
          flush();
        }
        this.sel = null;
      },
      // A boxed word wears its box's own fill and border, so the list reads as
      // the image does; the rest keep a transparent border to hold their size.
      wordClass(w) {
        if (this.boxOfWord(w)) return '';
        return w.kind ? 'bg-warning/30 border-transparent' : 'hover:bg-base-200 border-transparent';
      },
      wordStyle(w) {
        const b = this.boxOfWord(w);
        return b ? { ...this.swatch(b), color: this.ink(b.fill) } : {};
      },

      // ── Pointer ──────────────────────────────────────────────────────────
      pt(e) {
        const r = this.$refs.cv.getBoundingClientRect();
        return { x: (e.clientX - r.left) * this.W / r.width, y: (e.clientY - r.top) * this.H / r.height, cx: e.clientX, cy: e.clientY };
      },
      // Which part of a rectangle a point is on: an edge or corner (resize),
      // the middle (move), or nothing. An edge counts along its whole length,
      // not just at its grip, since a fingertip is wide. `tol` is in image px.
      grip(r, p, tol) {
        if (p.x < r.x - tol || p.x > r.x + r.w + tol || p.y < r.y - tol || p.y > r.y + r.h + tol) return null;
        const dl = Math.abs(p.x - r.x), dr = Math.abs(p.x - r.x - r.w);
        const dt = Math.abs(p.y - r.y), db = Math.abs(p.y - r.y - r.h);
        const e = { l: dl <= tol && dl < dr, r: dr <= tol && dr <= dl, t: dt <= tol && dt < db, b: db <= tol && db <= dt };
        if (e.l || e.r || e.t || e.b) return { kind: 'resize', e };
        return p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h ? { kind: 'move' } : null;
      },
      // What a press at `p` would take hold of: the crop frame in Crop, and in
      // Draw the selected box first, then the others top-down. A press on none
      // of them draws: a new crop (replacing any) or a new box.
      grab(p) {
        const tol = 22 * this.W / (this.$refs.cv.getBoundingClientRect().width || this.W);
        const at = (r) => this.grip(r, p, Math.min(tol, Math.min(r.w, r.h) / 3));
        if (this.mode === 'crop') {
          const r = this.crop, g = r && at(r);
          return g ? { ...g, target: 'crop', from: { x: r.x, y: r.y, w: r.w, h: r.h } } : null;
        }
        if (this.mode !== 'draw') return null;
        for (const b of [this.selBox, ...[...this.boxes].reverse()].filter(Boolean)) {
          const g = at(b);
          if (g) return { ...g, target: b.id, from: { x: b.x, y: b.y, w: b.w, h: b.h } };
        }
        return null;
      },
      cursorOf(op) {
        if (!op) return this.mode === 'draw' ? 'cursor-crosshair' : 'cursor-default';
        if (op.kind === 'move') return 'cursor-move';
        const { l, r, t, b } = op.e;
        if ((l && t) || (r && b)) return 'cursor-nwse-resize';
        if ((r && t) || (l && b)) return 'cursor-nesw-resize';
        return l || r ? 'cursor-ew-resize' : 'cursor-ns-resize';
      },
      // Move or resize from where the press began, so the rectangle follows
      // the finger exactly and never drifts. Clamped to the image, never
      // smaller than 8 image pixels a side.
      apply(op, dx, dy) {
        dx = Math.round(dx); dy = Math.round(dy);
        const f = op.from, W = this.W, H = this.H, min = 8;
        let x0 = f.x, y0 = f.y, x1 = f.x + f.w, y1 = f.y + f.h;
        if (op.kind === 'move') {
          dx = Math.max(-x0, Math.min(W - x1, dx)); dy = Math.max(-y0, Math.min(H - y1, dy));
          x0 += dx; x1 += dx; y0 += dy; y1 += dy;
        } else {
          if (op.e.l) x0 = Math.max(0, Math.min(x1 - min, x0 + dx));
          if (op.e.r) x1 = Math.min(W, Math.max(x0 + min, x1 + dx));
          if (op.e.t) y0 = Math.max(0, Math.min(y1 - min, y0 + dy));
          if (op.e.b) y1 = Math.min(H, Math.max(y0 + min, y1 + dy));
        }
        const r = snap(x0, y0, x1, y1, W, H);
        if (op.target === 'crop') { this.crop = r.w === W && r.h === H ? null : r; return; }
        const b = this.boxes.find(b => b.id === op.target);
        // A word box that is moved or resized stops following its words: from
        // here it is a drawn box, and a later word tap will not refit it.
        if (b) Object.assign(b, r, { line: -1 });
      },
      down(e) {
        if (!raw.img) return;
        const p = this.pt(e);
        Object.assign(this, { start: p, drag: null, dragging: false, op: null });
        if (this.mode === 'tap') return;
        e.target.setPointerCapture(e.pointerId);
        this.op = this.grab(p);
        if (this.op && this.op.target !== 'crop') this.sel = this.op.target;
      },
      // Travel is measured in screen pixels from the press and scaled once,
      // so a drag stays true even if something above the image changes height.
      move(e) {
        if (this.mode === 'tap') return;
        const s = this.start;
        if (!s) { this.hover = this.cursorOf(this.grab(this.pt(e))); return; }
        if (!this.dragging && Math.hypot(e.clientX - s.cx, e.clientY - s.cy) < 6) return;
        this.dragging = true;
        const sc = this.W / this.$refs.cv.getBoundingClientRect().width;
        const dx = (e.clientX - s.cx) * sc, dy = (e.clientY - s.cy) * sc;
        if (this.op) return this.apply(this.op, dx, dy);
        this.drag = snap(s.x, s.y, s.x + dx, s.y + dy, this.W, this.H);
      },
      up() {
        const s = this.start, d = this.drag, op = this.op, dragged = this.dragging;
        Object.assign(this, { start: null, drag: null, dragging: false, op: null });
        if (!s) return;
        // A tap outside the crop clears it, to try again; a tap inside keeps it.
        if (!dragged) {
          if (this.mode !== 'crop') return this.tap(s);
          if (!op) this.crop = null;
          return;
        }
        if (op || !d || d.w < 4 || d.h < 4) return;
        if (this.mode === 'crop') this.crop = d;
        else this.addBox({ ...d, label: this.lastLabel });
      },
      cancel() { Object.assign(this, { start: null, drag: null, dragging: false, op: null }); },
      tap(p) {
        const inside = r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
        const b = [...this.boxes].reverse().find(inside);
        if (b) { this.sel = this.sel === b.id ? null : b.id; return; }
        const w = this.words.find(w => p.x >= w.bbox.x0 && p.x <= w.bbox.x1 && p.y >= w.bbox.y0 && p.y <= w.bbox.y1);
        if (w) return this.toggleWord(w);
        this.sel = null;
      },
      // In the overlay every key stops here, so the page underneath (the
      // Stage's reader deck pages on arrows and closes on Escape) never sees
      // one; a field still edits normally, since nothing is prevented.
      onKey(e) {
        if (this.embedded) e.stopPropagation();
        if (e.target.closest?.('input, textarea')) return;
        if (e.key === 'Escape') { this.sel = null; this.cancel(); }
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel) { e.preventDefault(); this.removeBox(this.sel); }
      },

      // ── Drawing the working view ─────────────────────────────────────────
      render() {
        const cv = this.$refs.cv;
        void this.imgKey;
        const boxes = this.boxes.map(b => ({ ...b })), sel = this.sel, drag = this.drag, crop = this.crop, mode = this.mode;
        const words = this.words.filter(w => (this.showWords || w.kind) && !this.boxOfWord(w));
        if (!raw.img || !cv || cv.width !== this.W) return;
        const g = cv.getContext('2d');
        const k = this.W / (cv.getBoundingClientRect().width || this.W);
        g.drawImage(raw.img, 0, 0);
        g.lineWidth = 2 * k;
        for (const w of words) {
          const { x0, y0, x1, y1 } = w.bbox, p = 2 * k;
          g.strokeStyle = w.kind ? this.colors.warn : 'rgba(0,0,0,.18)';
          g.strokeRect(x0 - p, y0 - p, x1 - x0 + 2 * p, y1 - y0 + 2 * p);
        }
        boxes.forEach(b => paint(g, b, this.base));
        const dashed = (r, fill) => {
          g.save();
          if (fill) { g.fillStyle = fill; g.fillRect(r.x, r.y, r.w, r.h); }
          g.setLineDash([6 * k, 4 * k]);
          g.strokeStyle = '#fff'; g.lineWidth = 3 * k; g.strokeRect(r.x, r.y, r.w, r.h);
          g.strokeStyle = '#000'; g.lineWidth = 1.5 * k; g.strokeRect(r.x, r.y, r.w, r.h);
          g.restore();
        };
        // Black square grips at the four corners, edged in white so they show
        // on a dark image. They only mark the spot: an edge takes a drag along
        // its whole length (see grip()).
        const grips = (r) => {
          const z = Math.min(12 * k, Math.min(r.w, r.h) * 0.6);
          g.save(); g.fillStyle = '#000'; g.strokeStyle = '#fff'; g.lineWidth = 1.5 * k;
          for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            const x = Math.min(this.W - z, Math.max(0, r.x + u * r.w - z / 2));
            const y = Math.min(this.H - z, Math.max(0, r.y + v * r.h - z / 2));
            g.fillRect(x, y, z, z); g.strokeRect(x, y, z, z);
          }
          g.restore();
        };
        const s = boxes.find(b => b.id === sel);
        if (s) {
          dashed({ x: s.x - 3 * k, y: s.y - 3 * k, w: s.w + 6 * k, h: s.h + 6 * k });
          if (mode === 'draw') grips(s);
        }
        // A crop being drawn previews as the crop itself, dimmed outside.
        const cr = mode === 'crop' && drag ? drag : crop;
        if (cr) {
          g.save();
          g.fillStyle = 'rgba(0,0,0,.5)';
          g.beginPath(); g.rect(0, 0, this.W, this.H); g.rect(cr.x, cr.y, cr.w, cr.h); g.fill('evenodd');
          g.restore();
          dashed(cr);
          if (mode === 'crop' && !drag) grips(cr);
        }
        if (drag && mode === 'draw') dashed(drag, 'rgba(0,0,0,.6)');
      },

      // ── Result ───────────────────────────────────────────────────────────
      async done() {
        try {
          const r = await exportVerified(raw.img, this.boxes.map(b => ({ ...b })), this.crop, this.W, this.H, this.base);
          raw.out = r.blob;
          if (this.out.url) URL.revokeObjectURL(this.out.url);
          this.out = { url: URL.createObjectURL(r.blob), checks: r.checks, w: r.w, h: r.h, size: r.blob.size, reread: '' };
          this.sel = null;
          this.view = 'result';
          (this.embedded ? this.$el : window).scrollTo(0, 0);
        } catch (e) { this.toast('Export failed: ' + e.message, true); }
      },
      // Synchronous up to clipboard.write: Safari accepts the write only
      // inside the tap, so nothing may be awaited before it.
      copy() {
        try {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': raw.out })])
            .then(() => this.toast('Copied'), () => this.toast('Copy blocked here · use Save', true));
        } catch (e) { this.toast('Copy blocked here · use Save', true); }
      },
      save() {
        const a = Object.assign(document.createElement('a'), {
          href: this.out.url, download: 'redacted-' + new Date().toISOString().slice(0, 10) + '.png' });
        a.click();
      },
      async reread() {
        try { this.out.reread = (await this.recognize(raw.out)).text.trim() || '(no text found)'; }
        catch (e) { this.toast('Text recognition failed: ' + e.message, true); }
      },
      // The overlay's two ways out. Only a verified result is handed back.
      use() { if (this.verified && raw.out) raw.cfg.onDone?.(raw.out); },
      quit() { raw.cfg.onCancel?.(); },

      toast(text, bad = false) {
        this.note = { text, bad };
        clearTimeout(this._t);
        this._t = setTimeout(() => { this.note.text = ''; }, 2600);
      },
    };
  };

  // Squared corners: daisyUI reads these three, and the theme sets them on
  // :root, so the editor root's own values win for everything inside it.
  const ROOT = 'text-base-content [--radius-box:0rem] [--radius-field:0rem] [--radius-selector:0rem]';

  // The editor's markup. A page of its own also takes paste and drop from
  // anywhere on the window; the overlay takes neither, since its image came
  // from the host.
  const markup = (embedded) => `
<header class="sticky top-0 z-20 bg-base-100 border-b border-base-300">
  <div class="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2">
    <i class="ph ph-eye-slash text-2xl text-base-content/70"></i>
    <h1 class="text-lg font-bold">Redact</h1>
    <span class="badge badge-ghost badge-sm" x-show="isSample">sample</span>
    <span class="hidden sm:inline text-xs font-mono text-base-content/60 min-w-0 truncate" x-text="figure"></span>
    <div class="ml-auto flex gap-2">${embedded ? `
      <button class="btn btn-sm btn-ghost" @click="quit()">Cancel</button>` : `
      <button class="btn btn-sm" @click="pasteButton()" aria-label="Paste"><i class="ph ph-clipboard-text"></i><span class="hidden sm:inline">Paste</span></button>
      <label class="btn btn-sm" aria-label="Open"><i class="ph ph-folder-open"></i><span class="hidden sm:inline">Open</span>
        <input type="file" accept="image/*" class="hidden" @change="onFile($event)"></label>`}
      <button class="btn btn-sm btn-neutral" x-show="view === 'edit'" @click="done()" :disabled="!boxes.length && !crop">
        <i class="ph ph-check"></i>Done</button>
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-2 px-4 pb-2" x-show="view === 'edit'">
    <div class="join">
      <button class="btn btn-sm join-item" :class="mode === 'tap' && 'btn-active'" @click="mode = 'tap'" aria-label="Tap"><i class="ph ph-hand-pointing"></i><span class="hidden sm:inline">Tap</span></button>
      <button class="btn btn-sm join-item" :class="mode === 'draw' && 'btn-active'" @click="mode = 'draw'" aria-label="Draw"><i class="ph ph-rectangle"></i><span class="hidden sm:inline">Draw</span></button>
      <button class="btn btn-sm join-item" :class="mode === 'crop' && 'btn-active'" @click="mode = 'crop'" aria-label="Crop"><i class="ph ph-crop"></i><span class="hidden sm:inline">Crop</span></button>
    </div>
    <button class="btn btn-sm" @click="findText()" :disabled="!!ocr.busy">
      <i class="ph ph-text-aa"></i><span x-text="lines.length ? 'Find again' : 'Find text'"></span></button>
    <details class="dropdown dropdown-end" @click.outside="$el.removeAttribute('open')">
      <summary class="btn btn-sm"><span class="w-4 h-4 border-2 shrink-0" :style="swatch(cur)"></span>Style</summary>
      <div class="dropdown-content z-30 mt-1 w-72 bg-base-100 border border-base-300 shadow p-3 space-y-3">
        <div class="text-xs font-mono text-base-content/60" x-text="curName"></div>
        <div class="space-y-1">
          <div class="text-xs text-base-content/60">Fill</div>
          <div class="flex items-center gap-1">
            <button class="w-8 h-8 border-2 bg-[#ffffff]" :class="cur.fill === '#ffffff' ? 'border-base-content' : 'border-base-300'" @click="setStyle('fill', '#ffffff')" aria-label="White"></button>
            <button class="w-8 h-8 border-2 bg-[#000000]" :class="cur.fill === '#000000' ? 'border-base-content' : 'border-base-300'" @click="setStyle('fill', '#000000')" aria-label="Black"></button>
            <button class="w-8 h-8 border-2 bg-[#9ca3af]" :class="cur.fill === '#9ca3af' ? 'border-base-content' : 'border-base-300'" @click="setStyle('fill', '#9ca3af')" aria-label="Gray"></button>
            <button class="w-8 h-8 border-2 bg-[#fde047]" :class="cur.fill === '#fde047' ? 'border-base-content' : 'border-base-300'" @click="setStyle('fill', '#fde047')" aria-label="Yellow"></button>
            <input type="color" class="w-8 h-8 p-0 border-2 border-base-300 bg-base-100 cursor-pointer ml-auto" :value="cur.fill"
                   @input="setStyle('fill', $event.target.value)" aria-label="Fill colour">
          </div>
        </div>
        <div class="space-y-1">
          <div class="text-xs text-base-content/60">Border</div>
          <div class="join w-full">
            <button class="btn btn-xs join-item flex-1" :class="cur.border === 'none' && 'btn-active'" @click="setStyle('border', 'none')">None</button>
            <button class="btn btn-xs join-item flex-1" :class="cur.border === 'solid' && 'btn-active'" @click="setStyle('border', 'solid')">Solid</button>
            <button class="btn btn-xs join-item flex-1" :class="cur.border === 'dashed' && 'btn-active'" @click="setStyle('border', 'dashed')">Dashed</button>
            <button class="btn btn-xs join-item flex-1" :class="cur.border === 'dotted' && 'btn-active'" @click="setStyle('border', 'dotted')">Dotted</button>
          </div>
          <div class="flex items-center gap-1" x-show="cur.border !== 'none'">
            <input type="color" class="w-8 h-6 p-0 border-2 border-base-300 bg-base-100 cursor-pointer" :value="cur.stroke"
                   @input="setStyle('stroke', $event.target.value)" aria-label="Border colour">
            <div class="join flex-1">
              <button class="btn btn-xs join-item flex-1" :class="cur.bw === 1 && 'btn-active'" @click="setStyle('bw', 1)">Thin</button>
              <button class="btn btn-xs join-item flex-1" :class="cur.bw === 2 && 'btn-active'" @click="setStyle('bw', 2)">Medium</button>
              <button class="btn btn-xs join-item flex-1" :class="cur.bw === 4 && 'btn-active'" @click="setStyle('bw', 4)">Thick</button>
            </div>
          </div>
        </div>
        <button class="btn btn-sm w-full" @click="styleAll()" :disabled="!boxes.length">Apply to all boxes</button>
      </div>
    </details>
    <button class="btn btn-sm btn-ghost" x-show="mode === 'crop' || !!crop" :disabled="!crop" @click="crop = null"><i class="ph ph-x"></i>Uncrop</button>
  </div>

  <div class="flex items-center gap-2 px-4 pb-2" x-show="view === 'edit'">
    <span class="text-xs font-mono text-base-content/60 shrink-0">label</span>
    <input class="input input-sm w-full" list="redact-labels" :placeholder="selBox ? 'none' : 'no box selected'" x-model="selLabel" :disabled="!selBox"
           @keydown.enter="$event.target.blur()">
    <button class="btn btn-sm btn-ghost" @click="removeBox(sel)" :disabled="!selBox" title="Remove box" aria-label="Remove box">
      <i class="ph ph-trash"></i></button>
  </div>

  <div class="flex flex-wrap items-center gap-2 px-4 pb-2" x-show="view === 'result'">
    <button class="btn btn-sm" @click="view = 'edit'"><i class="ph ph-arrow-left"></i>Edit</button>
    <button class="btn btn-sm ml-auto" @click="save()"><i class="ph ph-download-simple"></i>Save</button>${embedded ? `
    <button class="btn btn-sm" @click="copy()" :disabled="!verified"><i class="ph ph-copy"></i>Copy image</button>
    <button class="btn btn-sm btn-neutral" @click="use()" :disabled="!verified"><i class="ph ph-check"></i><span x-text="useLabel"></span></button>` : `
    <button class="btn btn-sm btn-neutral" @click="copy()" :disabled="!verified"><i class="ph ph-copy"></i>Copy image</button>`}
  </div>

  <div class="flex items-center gap-2 px-4 pb-2" x-show="!!ocr.busy">
    <progress class="progress w-full" :value="ocr.progress" max="1"></progress>
    <span class="text-xs font-mono text-base-content/60 shrink-0" x-text="ocr.status"></span>
  </div>
</header>

<main x-show="view === 'edit'" class="grid gap-4 p-4 items-start lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
  <div class="min-w-0 flex justify-center">
    <canvas x-ref="cv" class="block max-w-full max-h-[70dvh] lg:max-h-[calc(100dvh-9rem)] w-auto h-auto border border-base-300 bg-base-100"
            :class="mode === 'tap' ? 'cursor-pointer' : (hover || 'cursor-crosshair') + ' touch-none select-none'"
            @pointerdown="down($event)" @pointermove="move($event)" @pointerup="up($event)"
            @pointercancel="cancel()"></canvas>
  </div>

  <section class="card bg-base-100 border border-base-300 min-w-0 lg:sticky lg:top-32 lg:max-h-[calc(100dvh-9rem)] lg:overflow-auto">
    <div class="tabs tabs-border px-2">
      <button class="tab gap-2" :class="tab === 'text' && 'tab-active'" @click="tab = 'text'">Text
        <span class="badge badge-sm" x-show="lines.length" x-text="words.length"></span></button>
      <button class="tab gap-2" :class="tab === 'boxes' && 'tab-active'" @click="tab = 'boxes'">Boxes
        <span class="badge badge-sm" x-text="boxes.length"></span></button>
    </div>

    <div class="p-4" x-show="tab === 'text'">
      <button class="btn" x-show="!lines.length" @click="findText()" :disabled="!!ocr.busy">
        <i class="ph ph-text-aa"></i>Find text</button>
      <div class="space-y-3" x-show="lines.length">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-mono text-base-content/60" x-text="flagged.length + ' flagged · ' + flaggedOpen + ' open'"></span>
          <label class="flex items-center gap-1 text-xs text-base-content/60 ml-auto">
            <input type="checkbox" class="toggle toggle-xs" x-model="showWords">outline</label>
          <button class="btn btn-xs" @click="boxFlagged()" :disabled="!flaggedOpen">
            <i class="ph ph-selection-plus"></i>Box flagged</button>
        </div>
        <template x-for="ln in lines" :key="ln.words[0].id">
          <div class="flex items-start gap-1">
            <div class="flex flex-wrap gap-1 min-w-0 flex-1">
              <template x-for="w in ln.words" :key="w.id">
                <button class="px-1 border-2 text-base leading-7" :class="wordClass(w)" :style="wordStyle(w)" @click="toggleWord(w)" x-text="w.text"></button>
              </template>
            </div>
            <button class="btn btn-ghost btn-xs mt-1" @click="boxLine(ln)" title="Box the line" aria-label="Box the line">
              <i class="ph ph-arrows-horizontal"></i></button>
          </div>
        </template>
      </div>
    </div>

    <div class="p-4" x-show="tab === 'boxes'">
      <template x-for="(b, i) in boxes" :key="b.id">
        <div class="flex items-center gap-2 py-2 px-1" :class="{ 'border-t border-base-200': i, 'bg-base-200': sel === b.id }">
          <button class="w-7 h-7 border-2 text-xs font-mono shrink-0" @click="sel = b.id" x-text="i + 1"
                  :style="{ ...swatch(b), color: ink(b.fill) }"></button>
          <div class="min-w-0 flex-1 space-y-1">
            <div class="text-xs font-mono text-base-content/60 truncate" x-text="b.src || 'drawn'"></div>
            <input class="input input-sm w-full" list="redact-labels" placeholder="no label" x-model="b.label"
                   @focus="sel = b.id" @input="lastLabel = b.label">
          </div>
          <button class="btn btn-ghost btn-sm" @click="removeBox(b.id)" title="Remove box" aria-label="Remove box">
            <i class="ph ph-trash"></i></button>
        </div>
      </template>
    </div>
  </section>
</main>

<main x-show="view === 'result'" class="grid gap-4 p-4 items-start lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
  <div class="min-w-0 flex justify-center">
    <img :src="out.url || null" alt="Redacted result" class="block max-w-full max-h-[70dvh] lg:max-h-[calc(100dvh-9rem)] w-auto h-auto border border-base-300">
  </div>
  <section class="card bg-base-100 border border-base-300 min-w-0 p-4 space-y-4">
    <div role="alert" class="alert" :class="verified ? 'alert-success' : 'alert-error'">
      <i class="ph text-xl" :class="verified ? 'ph-shield-check' : 'ph-warning'"></i>
      <span x-text="verdict"></span>
    </div>
    <div class="text-xs font-mono text-base-content/60" x-text="out.w + '×' + out.h + ' PNG · ' + Math.round(out.size / 1024) + ' KB'"></div>
    <table class="table table-sm" x-show="out.checks.length">
      <thead><tr><th>#</th><th>Label</th><th class="text-right">Bytes</th><th class="text-right">Differ</th></tr></thead>
      <tbody>
        <template x-for="c in out.checks" :key="c.n">
          <tr>
            <td class="font-mono" x-text="c.n"></td>
            <td x-text="c.label || '(blank)'"></td>
            <td class="text-right font-mono" x-text="c.cropped ? 'cropped out' : c.bytes.toLocaleString()"></td>
            <td class="text-right font-mono" :class="c.diff && 'text-error'" x-text="c.cropped ? '' : c.diff"></td>
          </tr>
        </template>
      </tbody>
    </table>
    <div class="space-y-2">
      <button class="btn btn-sm" @click="reread()" :disabled="!!ocr.busy"><i class="ph ph-text-aa"></i>Read the result</button>
      <div class="text-sm whitespace-pre-wrap bg-base-200 p-3" x-show="!!out.reread" x-text="out.reread"></div>
    </div>
  </section>
</main>

<datalist id="redact-labels">
  <option value="[Name removed]"></option>
  <option value="[removed]"></option>
  <option value="[email removed]"></option>
  <option value="[phone removed]"></option>
  <option value="[account removed]"></option>
  <option value="[address removed]"></option>
</datalist>

<div class="toast toast-center z-30" x-show="!!note.text" x-transition.opacity>
  <div class="alert" :class="note.bad ? 'alert-error' : 'alert-success'"><span x-text="note.text"></span></div>
</div>`;

  // The editor in place. Alpine initialises it on start, or a caller that
  // mounts after start runs Alpine.initTree itself (as open() does).
  const mount = (el, cfg = {}) => {
    el._redact = cfg;
    // x-on:, not @: setAttribute refuses a name that starts with "@".
    el.setAttribute('x-data', 'redactEditor');
    el.setAttribute('x-on:keydown' + (cfg.embedded ? '' : '.window'), 'onKey($event)');
    if (!cfg.embedded) {
      el.setAttribute('x-on:paste.window', 'onPaste($event)');
      el.setAttribute('x-on:dragover.window.prevent', '');
      el.setAttribute('x-on:drop.window.prevent', 'onDrop($event)');
    }
    el.classList.add(...ROOT.split(' '));
    el.innerHTML = markup(!!cfg.embedded);
    return el;
  };

  // The editor over the current page, above the Stage's reader deck (z-[70],
  // its menus z-[80]). Resolves with the verified PNG, or null on Cancel.
  const open = (blob, opts = {}) => new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'fixed inset-0 z-[90] overflow-auto bg-base-200 outline-none';
    el.tabIndex = -1;
    const finish = (v) => { window.Alpine.destroyTree(el); el.remove(); resolve(v); };
    mount(el, { ...opts, blob, embedded: true, onDone: finish, onCancel: () => finish(null) });
    document.body.append(el);
    window.Alpine.initTree(el);
    el.focus();
  });

  const register = () => window.Alpine.data('redactEditor', editor);
  if (window.Alpine) register(); else document.addEventListener('alpine:init', register);

  window.Redact = { open, mount, kindOf, labelOf, snap, ink };
})();
