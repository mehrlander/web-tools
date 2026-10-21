// kits/redact.js — cover parts of an image with labelled boxes, crop it, and
// prove the covered pixels are gone before it is copied out. The Stage's
// image editor: a staged bitmap's slide in the reader is this editor.
//
//   Redact.mount(host, { blob, name, onDone, onChange, toast }) → root
//       the editor inside host, which sizes it. host.__redact is the
//       editor: `active` turns the tools on, copy() and apply() serve the
//       host's own buttons, `changed` and `meta` (the pixel size) its header.
//       apply() hands the checked PNG to onDone; onChange(changed) fires as
//       edits come and go and as the tools turn on or off; toast, when given,
//       reports in the host's voice.
//
// The image shows as it is until the host turns the tools on (the Stage's
// paint brush); then a row of tools sits over it, and nothing else does.
//
// FIND TEXT runs Tesseract.js on the device, imported on first use from
// jsDelivr (about 6 MB, cached after). The image never leaves the page. Words
// shaped like an email, a phone number, an amount or a run of digits are
// flagged; names are not, since no pattern tells a name from a word. OCR also
// misses small, faint text, so a word it did not find is not a word that is
// absent.
//
// BOX: a drag draws a box, a tap on a found word boxes it, and tapping the
// next word on the same line grows that box when the two would carry the
// same label, so "Jane" then "Doe" is one box while "Doe" beside an already
// boxed email stays its own. Flagged words are outlined, and the tools offer
// to box them all. A box's middle drags it and its edges and corners resize
// it, so a short box is fixed rather than redrawn; moving or resizing a word
// box detaches it from its words. A tap on a box selects it, a second tap
// edits its label in the box itself, and a tap off every box clears the
// selection. CROP is placed by a drag; then its edges and corners resize it
// and its middle moves it, a tap outside clears it, and a drag outside starts
// a new one. Grips are black squares at the four corners.
//
// STYLE sets a box's fill (white unless changed), its border (none, solid,
// dashed or dotted, with a colour and a width scaled to the image) and, by
// contrast, the label's ink. A change lands on the selected box and becomes
// the style for the next one, as Paint's current colour does. The colour
// input only yields opaque colours, so every fill is a full cover.
//
// COPY and APPLY each render a fresh PNG at full
// resolution and check it before it leaves: each box in the exported bytes
// must equal the same box painted alone on a blank canvas, byte for byte, so
// no pixel of the original survives under a box. A result that fails is not
// handed out, and the toast says how the check went either way. Box edges
// are snapped to whole pixels for that reason: a fractional edge would blend
// the original into the border pixels and the check would (rightly) fail.
// Labels are clipped to their box for the same reason.
//
// With the tools on, the canvas cancels touchstart/touchmove non-passively,
// per docs/ios-sheet-drags.md, so a drag inside an app's sheet does not
// dismiss it, nor page the reader; with them off it leaves touch alone, so a
// swipe over the image still pages and the page still scrolls. Drags
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

  // ── The editor ──────────────────────────────────────────────────────────
  // Its config rides on the root element (el._redact), set by mount().
  const editor = () => {
    // Held outside Alpine: a reactive proxy around an ImageBitmap or a Blob
    // is not one, and drawImage / ClipboardItem refuse it.
    const raw = { img: null, src: null, cfg: {}, ro: null };
    return {
      mode: 'box', active: false,
      name: '', W: 0, H: 0, imgKey: 0,
      lines: [],
      boxes: [], sel: null, seq: 0, lastLabel: '[removed]', base: 1,
      editing: null, prevSel: null,
      // `stroke`, not `line`: a word box already carries `line`, its OCR line index.
      style: { fill: '#ffffff', border: 'solid', stroke: '#111827', bw: 1 },
      crop: null, start: null, drag: null, dragging: false, op: null, hover: '',
      ocr: { busy: false, progress: 0, status: '' },
      out: { checks: [] },
      note: { text: '', bad: false },
      colors: {},

      async init() {
        raw.cfg = this.$el._redact || {};
        await this.$nextTick();
        const css = getComputedStyle(this.$el);
        this.colors = { warn: css.getPropertyValue('--color-warning').trim() || '#f59e0b' };
        const cv = this.$refs.cv;
        const block = e => { if (this.active) e.preventDefault(); };
        cv.addEventListener('touchstart', block, { passive: false });
        cv.addEventListener('touchmove', block, { passive: false });
        const fit = () => {
          this.render();
          if (this.editing && this.selBox) Object.assign(this.$refs.edit.style, this.editAt(this.selBox));
        };
        if (window.ResizeObserver) (raw.ro = new ResizeObserver(fit)).observe(this.$el);
        // Told after the effect, so the host's own reads are not tracked here:
        // on an edit coming or going, on the tools turning on or off, and once
        // the image has a size.
        let was = null;
        Alpine.effect(() => {
          const c = this.changed, key = c + ':' + this.W + ':' + this.active;
          if (key !== was) { was = key; queueMicrotask(() => raw.cfg.onChange?.(c)); }
        });
        // Tools off is a view: no selection, no edit in progress.
        this.$watch('active', on => { if (!on) { this.endEdit(); Object.assign(this, { sel: null, mode: 'box' }); } });
        Alpine.effect(() => this.render());
        if (raw.cfg.blob) await this.load(raw.cfg.blob, raw.cfg.name || 'image');
      },
      destroy() { raw.ro?.disconnect(); },

      get words() { return this.lines.flatMap(l => l.words); },
      get selBox() { return this.boxes.find(b => b.id === this.sel) || null; },
      // What the Style menu edits: the selected box, else the style new boxes take.
      get cur() { return this.selBox || this.style; },
      get curName() { return this.selBox ? 'Box ' + (this.boxes.indexOf(this.selBox) + 1) : 'New boxes'; },
      get selLabel() { return this.selBox?.label ?? ''; },
      set selLabel(v) { if (this.selBox) { this.selBox.label = v; this.lastLabel = v; } },
      get flagged() { return this.words.filter(w => w.kind); },
      get flaggedOpen() { return this.flagged.filter(w => !this.boxOfWord(w)).length; },
      // The pixel size, for a host's header.
      get meta() { return this.W ? this.W + ' × ' + this.H : ''; },
      get verdict() {
        const c = this.out.checks.filter(c => !c.cropped);
        if (!c.length) return 'No boxes in the result';
        const bytes = c.reduce((s, x) => s + x.bytes, 0), diff = c.reduce((s, x) => s + x.diff, 0);
        return `${c.length} box${c.length === 1 ? '' : 'es'} verified · ${diff.toLocaleString()} of ${bytes.toLocaleString()} bytes differ`;
      },
      get verified() { return this.out.checks.every(c => c.diff === 0); },
      // Something to hand out: a box or a crop.
      get changed() { return this.boxes.length > 0 || !!this.crop; },

      // ── Loading ──────────────────────────────────────────────────────────
      async load(blob, name) {
        try {
          const bmp = await createImageBitmap(blob);
          raw.img = bmp; raw.src = blob;
          Object.assign(this.$refs.cv, { width: bmp.width, height: bmp.height });
          Object.assign(this, { name, W: bmp.width, H: bmp.height, lines: [], boxes: [],
                                base: Math.max(1, Math.round(Math.min(bmp.width, bmp.height) / 400)),
                                sel: null, crop: null, drag: null });
          this.imgKey++;
        } catch (e) { this.toast('Not an image this browser can read', true); }
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
          this.toast(this.lines.length ? `${this.words.length} words found · ${this.flagged.length} flagged` : 'No text found', !this.lines.length);
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
        if (this.editing?.id === id) this.editing = null;
        this.boxes = this.boxes.filter(b => b.id !== id);
        if (this.sel === id) this.sel = null;
      },
      // A second tap on the selected box edits its label in the box itself:
      // an input laid over the box, focused inside the tap so a phone raises
      // its keyboard. Enter or a tap elsewhere keeps the text; Escape restores
      // what it opened with.
      editBox(b) {
        this.sel = b.id;
        this.editing = { id: b.id, was: b.label };
        const el = this.$refs.edit;
        Object.assign(el.style, this.editAt(b), { display: '' });
        el.value = b.label;
        el.focus(); el.select();
      },
      // The box's centre and size in the canvas wrapper's pixels.
      editAt(b) {
        const cv = this.$refs.cv, k = cv.clientWidth / this.W;
        return { left: cv.offsetLeft + cv.clientLeft + (b.x + b.w / 2) * k + 'px',
                 top: cv.offsetTop + cv.clientTop + (b.y + b.h / 2) * k + 'px',
                 width: b.w * k + 'px', height: b.h * k + 'px' };
      },
      endEdit(keep = true) {
        if (!keep && this.editing && this.selBox) this.selBox.label = this.editing.was;
        this.editing = null;
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
        if (this.mode !== 'box') return null;
        for (const b of [this.selBox, ...[...this.boxes].reverse()].filter(Boolean)) {
          const g = at(b);
          if (g) return { ...g, target: b.id, from: { x: b.x, y: b.y, w: b.w, h: b.h } };
        }
        return null;
      },
      cursorOf(op) {
        if (!op) return this.mode === 'box' ? 'cursor-crosshair' : 'cursor-default';
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
        if (!raw.img || !this.active) return;
        const p = this.pt(e);
        // A press on the canvas ends an edit even where touch is cancelled,
        // which on a phone keeps the input from blurring by itself.
        if (this.editing) { this.endEdit(); this.$refs.edit.blur(); }
        Object.assign(this, { start: p, drag: null, dragging: false, op: null, prevSel: this.sel });
        e.target.setPointerCapture(e.pointerId);
        this.op = this.grab(p);
        if (this.op && this.op.target !== 'crop') this.sel = this.op.target;
      },
      // Travel is measured in screen pixels from the press and scaled once,
      // so a drag stays true even if something above the image changes height.
      move(e) {
        if (!this.active) return;
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
        // A tap on a box leaves it selected, as the press made it.
        if (!dragged) {
          if (this.mode === 'crop') { if (!op) this.crop = null; }
          else if (!op) this.tap(s);
          else if (op.kind === 'move' && op.target === this.prevSel) this.editBox(this.selBox);
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
        if (b) { if (this.sel === b.id) this.editBox(b); else this.sel = b.id; return; }
        const w = this.words.find(w => p.x >= w.bbox.x0 && p.x <= w.bbox.x1 && p.y >= w.bbox.y0 && p.y <= w.bbox.y1);
        if (w) return this.toggleWord(w);
        this.sel = null;
      },

      // ── Drawing the working view ─────────────────────────────────────────
      render() {
        const cv = this.$refs.cv;
        void this.imgKey;
        const boxes = this.boxes.map(b => ({ ...b })), sel = this.sel, drag = this.drag, crop = this.crop, mode = this.mode;
        const words = this.active ? this.flagged.filter(w => !this.boxOfWord(w)) : [];
        if (!raw.img || !cv || cv.width !== this.W) return;
        const g = cv.getContext('2d');
        const k = this.W / (cv.getBoundingClientRect().width || this.W);
        g.drawImage(raw.img, 0, 0);
        g.lineWidth = 2 * k;
        for (const w of words) {
          const { x0, y0, x1, y1 } = w.bbox, p = 2 * k;
          g.strokeStyle = this.colors.warn;
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
          if (mode === 'box') grips(s);
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
        if (drag && mode === 'box') dashed(drag, 'rgba(0,0,0,.6)');
      },

      // ── Result ───────────────────────────────────────────────────────────
      // The PNG to hand out, rendered fresh and checked. It rejects, so
      // nothing leaves, unless every box in it matches the same box painted
      // alone.
      async result() {
        this.endEdit();
        const r = await exportVerified(raw.img, this.boxes.map(b => ({ ...b })), this.crop, this.W, this.H, this.base);
        this.out = { checks: r.checks };
        if (!this.verified) throw new Error('Check failed · ' + this.verdict);
        return r.blob;
      },
      // Rendered, checked and copied in one tap. Safari takes the write only
      // inside the tap, so the PNG goes in as a promise rather than awaited.
      copy() {
        const png = this.result();
        const blocked = () => png.then(() => this.toast('Copy blocked here', true),
                                       e => this.toast(e.message, true));
        try {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
            .then(() => this.toast(this.out.checks.length ? 'Copied · ' + this.verdict : 'Copied'), blocked);
        } catch (e) { blocked(); }
      },
      // The checked PNG to the host, which decides what keeping the edits
      // means: the Stage replaces the staged image with it.
      async apply() {
        try { raw.cfg.onDone?.(await this.result()); }
        catch (e) { this.toast(e.message, true); }
      },

      toast(text, bad = false) {
        if (raw.cfg.toast) return raw.cfg.toast(text, bad);
        this.note = { text, bad };
        clearTimeout(this._t);
        this._t = setTimeout(() => { this.note.text = ''; }, 2600);
      },
    };
  };

  // Squared corners: daisyUI reads these three, and the theme sets them on
  // :root, so the editor root's own values win for everything inside it. The
  // host sizes the root: the tools, when on, and the image under them.
  const ROOT = 'text-base-content [--radius-box:0rem] [--radius-field:0rem] [--radius-selector:0rem] h-full min-h-0 flex flex-col';
  const BTN = 'btn btn-sm';
  // A tool: its icon over a one-word label.
  const TOOL = 'btn btn-ghost h-auto min-h-12 flex-col gap-0.5 px-1 sm:px-3 py-1 text-xs font-normal whitespace-nowrap';
  const SWATCH = 'w-8 h-8 border-2';
  const SEG = 'btn btn-xs join-item flex-1';
  const tool = (mode, icon, name) => `
      <button class="${TOOL} join-item" :class="mode === '${mode}' && 'btn-active'" @click="mode = '${mode}'">
        <i class="ph ${icon} text-xl"></i>${name}</button>`;

  // The editor's markup: one row of tools, shown while editing, over the
  // image. Copy and keep belong to the host's header, which acts on the whole
  // file; a box's label is edited in the box.
  const markup = () => `
<header x-show="active" class="shrink-0 bg-base-100 border-b border-base-300 select-none">
  <div class="flex justify-center gap-2 px-2 py-1">
    <div class="join">${tool('box', 'ph-rectangle', 'Box')}${tool('crop', 'ph-crop', 'Crop')}
    </div>
    <button class="${TOOL}" @click="findText()" :disabled="!!ocr.busy">
      <i class="ph ph-text-aa text-xl"></i><span x-text="ocr.busy ? Math.round(ocr.progress * 100) + '%' : 'Find text'"></span></button>
    <button class="${TOOL}" x-show="flaggedOpen > 0" @click="boxFlagged()">
      <i class="ph ph-selection-plus text-xl"></i><span x-text="'Box ' + flaggedOpen"></span></button>
    <details class="dropdown dropdown-end" @click.outside="$el.removeAttribute('open')">
      <summary class="${TOOL} w-full"><span class="w-5 h-5 border-2 shrink-0" :style="swatch(cur)"></span>Style</summary>
      <div class="dropdown-content z-30 mt-1 w-80 max-w-[calc(100vw-2rem)] bg-base-100 border border-base-300 shadow p-3 space-y-3">
        <div class="text-xs font-mono text-base-content/60" x-text="curName"></div>
        <div class="space-y-1">
          <div class="text-xs text-base-content/60">Fill</div>
          <div class="flex items-center gap-2">
            <button class="${SWATCH} bg-[#ffffff]" :class="cur.fill === '#ffffff' ? 'border-base-content' : 'border-base-300'" @click="setStyle('fill', '#ffffff')" aria-label="White"></button>
            <button class="${SWATCH} bg-[#000000]" :class="cur.fill === '#000000' ? 'border-base-content' : 'border-base-300'" @click="setStyle('fill', '#000000')" aria-label="Black"></button>
            <button class="${SWATCH} bg-[#9ca3af]" :class="cur.fill === '#9ca3af' ? 'border-base-content' : 'border-base-300'" @click="setStyle('fill', '#9ca3af')" aria-label="Gray"></button>
            <button class="${SWATCH} bg-[#fde047]" :class="cur.fill === '#fde047' ? 'border-base-content' : 'border-base-300'" @click="setStyle('fill', '#fde047')" aria-label="Yellow"></button>
            <input type="color" class="${SWATCH} p-0 border-base-300 bg-base-100 cursor-pointer ml-auto" :value="cur.fill"
                   @input="setStyle('fill', $event.target.value)" aria-label="Fill colour">
          </div>
        </div>
        <div class="space-y-1">
          <div class="text-xs text-base-content/60">Border</div>
          <div class="join w-full">
            <button class="${SEG}" :class="cur.border === 'none' && 'btn-active'" @click="setStyle('border', 'none')">None</button>
            <button class="${SEG}" :class="cur.border === 'solid' && 'btn-active'" @click="setStyle('border', 'solid')">Solid</button>
            <button class="${SEG}" :class="cur.border === 'dashed' && 'btn-active'" @click="setStyle('border', 'dashed')">Dashed</button>
            <button class="${SEG}" :class="cur.border === 'dotted' && 'btn-active'" @click="setStyle('border', 'dotted')">Dotted</button>
          </div>
          <div class="flex items-center gap-2" x-show="cur.border !== 'none'">
            <input type="color" class="${SWATCH} p-0 border-base-300 bg-base-100 cursor-pointer" :value="cur.stroke"
                   @input="setStyle('stroke', $event.target.value)" aria-label="Border colour">
            <div class="join flex-1">
              <button class="${SEG}" :class="cur.bw === 1 && 'btn-active'" @click="setStyle('bw', 1)">Thin</button>
              <button class="${SEG}" :class="cur.bw === 2 && 'btn-active'" @click="setStyle('bw', 2)">Medium</button>
              <button class="${SEG}" :class="cur.bw === 4 && 'btn-active'" @click="setStyle('bw', 4)">Thick</button>
            </div>
          </div>
        </div>
        <button class="${BTN} w-full" @click="styleAll()" :disabled="!boxes.length">Apply to all boxes</button>
      </div>
    </details>
    <button class="${TOOL} hover:text-error" x-show="!!selBox" @click="removeBox(sel)">
      <i class="ph ph-trash text-xl"></i>Delete</button>
  </div>

</header>

<main class="flex-1 min-h-0 min-w-0 overflow-auto p-3">
  <div class="relative h-full w-full flex justify-center items-start">
    <canvas x-ref="cv" class="block max-w-full max-h-full w-auto h-auto border border-base-300 bg-base-100"
            :class="active ? (hover || 'cursor-crosshair') + ' touch-none select-none' : 'cursor-default'"
            @pointerdown="down($event)" @pointermove="move($event)" @pointerup="up($event)"
            @pointercancel="cancel()"></canvas>
    <input x-ref="edit" x-show="!!editing" list="redact-labels" x-model="selLabel" aria-label="Label"
           class="absolute -translate-x-1/2 -translate-y-1/2 min-w-48 min-h-8 px-2 border-0 text-base text-center outline-2 outline-offset-2 outline-[var(--color-base-content)]"
           :style="editing && selBox ? { ...editAt(selBox), background: selBox.fill, color: ink(selBox.fill) } : {}"
           @keydown.enter.prevent="$el.blur()" @keydown.escape.prevent.stop="endEdit(false)" @blur="endEdit()">
  </div>
</main>


<datalist id="redact-labels">
  <option value="[Name removed]"></option>
  <option value="[removed]"></option>
  <option value="[email removed]"></option>
  <option value="[phone removed]"></option>
  <option value="[account removed]"></option>
  <option value="[address removed]"></option>
</datalist>

<div class="toast toast-top toast-center z-30" x-show="!!note.text" x-transition.opacity>
  <div class="alert" :class="note.bad ? 'alert-error' : 'alert-success'"><span x-text="note.text"></span></div>
</div>`;

  // The editor inside `host`. Its root is built whole and then appended, as
  // the Stage mounts its viewers: an x-data set on an element already in the
  // page reaches Alpine's mutation observer out of order, and the markup's
  // bindings then evaluate outside the editor's scope. The kit loads after
  // Alpine has started, so it initialises its own tree.
  const mount = (host, cfg = {}) => {
    const el = document.createElement('div');
    el._redact = cfg;
    el.className = ROOT;
    // A host deck that hides its chrome on a tap leaves a working surface be.
    el.setAttribute('data-sd-surface', '');
    el.setAttribute('x-data', 'redactEditor');
    el.innerHTML = markup();
    host.append(el);
    window.Alpine.initTree(el);
    host.__redact = window.Alpine.$data(el);
    return el;
  };

  const register = () => window.Alpine.data('redactEditor', editor);
  if (window.Alpine) register(); else document.addEventListener('alpine:init', register);

  window.Redact = { mount, kindOf, labelOf, snap, ink };
})();
