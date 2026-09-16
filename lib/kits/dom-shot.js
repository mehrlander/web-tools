// kits/dom-shot.js - render a live DOM node to a PNG in the browser.
//
// This is deliberately named a DOM shot rather than a screenshot. modern-screenshot
// clones the DOM, copies computed styles, embeds available fonts and images, and
// asks the browser to paint that reconstruction through an SVG foreignObject.
// It does not read the browser's pixels. The distinction is also the limit:
// cross-origin media may be blank, embedded frames cannot be read, and very
// large trees can exceed browser canvas or data-URL limits.
//
// modern-screenshot is lazy and version-pinned. A page that never takes a shot pays
// no renderer cost. The repo carries the npm package as a development dependency
// so the headless harness can serve the same bytes through tools/render/cdn.mjs.
//
//   await DomShot.capture(node, { mode: 'element'|'viewport'|'page' })
//   await DomShot.save(node, { mode, filename? })
//   DomShot.download(blob, filename, document?)
//   DomShot.assess(node)

(() => {
  if (window.DomShot) return;

  const RENDERER = 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.7.0/dist/index.js';
  const VERSION = 'modern-screenshot 4.7.0';
  const DESKTOP_PIXELS = 16_000_000;
  const IOS_PIXELS = 4_800_000;
  const MAX_SIDE = 16_384;
  const rendererPromises = new WeakMap();

  const renderer = async (w) => {
    if (w.modernScreenshot?.domToCanvas) return w.modernScreenshot;
    if (!rendererPromises.has(w)) rendererPromises.set(w, new Promise((resolve, reject) => {
      const script = w.document.createElement('script');
      script.src = RENDERER;
      script.async = true;
      script.onload = () => w.modernScreenshot?.domToCanvas
        ? resolve(w.modernScreenshot)
        : reject(new Error('modern-screenshot did not load'));
      script.onerror = () => reject(new Error('modern-screenshot could not be loaded'));
      (w.document.head || w.document.documentElement).appendChild(script);
    }));
    return rendererPromises.get(w);
  };

  const isIos = (w) => {
    const ua = String(w.navigator?.userAgent || '');
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (w.navigator?.maxTouchPoints || 0) > 1);
  };

  const all = (node, selector) => {
    const out = [];
    if (node?.matches?.(selector)) out.push(node);
    if (node?.querySelectorAll) out.push(...node.querySelectorAll(selector));
    return out;
  };

  const crossOriginImages = (node) => {
    const doc = node.ownerDocument;
    const base = doc.location?.href || window.location.href;
    let origin = '';
    try { origin = new URL(base).origin; } catch {}
    return all(node, 'img[src]').filter(img => {
      try {
        const u = new URL(img.currentSrc || img.src, base);
        return /^https?:$/.test(u.protocol) && u.origin !== origin;
      } catch { return false; }
    }).length;
  };

  // These are warnings, not a preflight verdict. CORS may permit an external
  // image, and a same-origin canvas may be safe. Only rendering settles it.
  const assess = (node) => {
    if (!node?.ownerDocument) return [];
    const warnings = [];
    const images = crossOriginImages(node);
    const frames = all(node, 'iframe,frame').length;
    const canvases = all(node, 'canvas').length;
    if (images) warnings.push(images + ' cross-origin image' + (images === 1 ? '' : 's') + ' may be blank');
    if (frames) warnings.push(frames + ' embedded frame' + (frames === 1 ? '' : 's') + ' cannot be read');
    if (canvases) warnings.push(canvases + ' canvas' + (canvases === 1 ? '' : 'es') + ' may be unreadable');
    return warnings;
  };

  const pageSize = (doc) => {
    const de = doc.documentElement, body = doc.body;
    return {
      width: Math.max(de?.scrollWidth || 0, de?.offsetWidth || 0, body?.scrollWidth || 0, body?.offsetWidth || 0),
      height: Math.max(de?.scrollHeight || 0, de?.offsetHeight || 0, body?.scrollHeight || 0, body?.offsetHeight || 0),
    };
  };

  const geometry = (node, mode) => {
    const doc = node.ownerDocument;
    const w = doc.defaultView || window;
    if (mode === 'viewport') return {
      width: Math.max(1, Math.round(w.innerWidth)),
      height: Math.max(1, Math.round(w.innerHeight)),
      x: w.scrollX || 0, y: w.scrollY || 0,
    };
    if (mode === 'page') return { ...pageSize(doc), x: 0, y: 0 };
    const r = node.getBoundingClientRect();
    return {
      width: Math.max(1, Math.ceil(r.width)),
      height: Math.max(1, Math.ceil(r.height)),
      x: Math.round(r.left + (w.scrollX || 0)),
      y: Math.round(r.top + (w.scrollY || 0)),
    };
  };

  const scaleFor = (w, width, height, asked) => {
    const native = asked || w.devicePixelRatio || 1;
    const limit = isIos(w) ? IOS_PIXELS : DESKTOP_PIXELS;
    return Math.min(native, Math.sqrt(limit / Math.max(1, width * height)),
      MAX_SIDE / Math.max(1, width), MAX_SIDE / Math.max(1, height));
  };

  const blobOf = (canvas) => new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The rendered canvas could not be encoded as PNG')), 'image/png');
  });

  const included = el => !el.hasAttribute?.('data-dom-shot-ignore')
    && !el.hasAttribute?.('data-peek-ui');

  const pageCanvas = async (api, doc, w, g, scale, options, mode) => {
    const canvas = doc.createElement('canvas');
    canvas.width = Math.max(1, Math.round(g.width * scale));
    canvas.height = Math.max(1, Math.round(g.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot create the screenshot canvas');

    const bodyColor = w.getComputedStyle?.(doc.body).backgroundColor;
    const htmlColor = w.getComputedStyle?.(doc.documentElement).backgroundColor;
    ctx.fillStyle = (bodyColor && bodyColor !== 'rgba(0, 0, 0, 0)')
      ? bodyColor
      : ((htmlColor && htmlColor !== 'rgba(0, 0, 0, 0)') ? htmlColor : '#fff');
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const nodes = [...(doc.body?.children || [])].filter(el => included(el)
      && !['SCRIPT', 'STYLE', 'LINK'].includes(el.tagName));
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (mode === 'viewport' && (r.right <= 0 || r.bottom <= 0
          || r.left >= g.width || r.top >= g.height)) continue;
      const part = await api.domToCanvas(el, options);
      const dx = (r.left + (w.scrollX || 0) - g.x) * scale;
      const dy = (r.top + (w.scrollY || 0) - g.y) * scale;
      ctx.drawImage(part, dx, dy, r.width * scale, r.height * scale);
    }
    return canvas;
  };

  const capture = async (node, o = {}) => {
    if (!node?.ownerDocument) throw new Error('No DOM node to render');
    const mode = ['element', 'viewport', 'page'].includes(o.mode) ? o.mode : 'element';
    const doc = node.ownerDocument;
    const w = doc.defaultView || window;
    const root = mode === 'element' ? node : (doc.body || doc.documentElement);
    const g = geometry(root, mode);
    const scale = scaleFor(w, g.width, g.height, o.scale);
    const warnings = assess(root);
    if (scale + 0.01 < (o.scale || w.devicePixelRatio || 1)) warnings.push('downscaled to fit this browser\u2019s canvas');

    const modernScreenshot = await renderer(w);
    const options = {
      backgroundColor: null,
      scale,
      filter: included,
      features: { restoreScrollPosition: true },
    };
    if (mode === 'element') options.style = { margin: '0' };
    const canvas = mode === 'element'
      ? await modernScreenshot.domToCanvas(root, options)
      : await pageCanvas(modernScreenshot, doc, w, g, scale, options, mode);
    const expectedWidth = Math.round(g.width * scale);
    const expectedHeight = Math.round(g.height * scale);
    if ((canvas.width < expectedWidth || canvas.height < expectedHeight)
        && !warnings.some(x => x.startsWith('downscaled'))) {
      warnings.push('downscaled to fit this browser\u2019s canvas');
    }
    const blob = await blobOf(canvas);
    return {
      blob, mode, renderer: VERSION, warnings, scale,
      cssWidth: g.width, cssHeight: g.height,
      width: canvas.width, height: canvas.height,
    };
  };

  const stem = (doc) => {
    const raw = doc.title || doc.location?.pathname?.split('/').filter(Boolean).pop() || 'page';
    return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 56) || 'page';
  };

  const filename = (node, mode) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return stem(node.ownerDocument) + '-' + mode + '-' + stamp + '.png';
  };

  const download = (blob, name, doc = document) => {
    const a = doc.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.style.display = 'none';
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const save = async (node, o = {}) => {
    const result = await capture(node, o);
    result.filename = o.filename || filename(node, result.mode);
    download(result.blob, result.filename, o.downloadDocument || document);
    return result;
  };

  window.DomShot = { capture, save, download, assess, filename, version: VERSION };
})();
