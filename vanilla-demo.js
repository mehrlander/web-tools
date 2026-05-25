// vanilla-demo.js — the living-documentation demo format, distilled from
// pages/misc/live-docs-concept.html. A page hands it a `sections` config; it
// renders the whole literate document: numbered sections, each holding compact
// examples that pair prose with an editable snippet and a live proof (rendered
// markup, markup in a host context, JS drawing into a frame, or console output).
//
// Sibling to vanilla-bundle.js: a framework-free, DOM-rendering module loaded
// via gh.load. Not a logic kit (it renders), not an Alpine component (no
// framework). Depends on kits/cm6.js for the editor, and on Tailwind +
// daisyUI + Phosphor being present on the host page for styling. The proof
// iframes are isolated and bring their own minimal CSS (plus Tailwind when a
// block opts in via `tw: true`).
//
//   demo.mount({ sections, sectionsEl, displayEl?, legendEl? })
//
// Config shape:
//   sections: [{ title, intro?, examples: [example] }]
//   example:  { title, prose?, lang: 'html'|'js', code,
//               kind: 'render'|'context'|'jsrender'|'console',
//               tw?: bool,        // inject Tailwind into the proof frame
//               context?: string  // host template with a {{slot}} marker (kind:'context')
//             }
//
// The four kinds:
//   render    — the snippet is body markup; the proof is what it renders.
//   context   — the snippet is injected at {{slot}} inside a host template.
//   jsrender  — the snippet is JS that builds nodes into the frame body.
//   console   — the snippet is JS; the proof is captured console output (Run / Mod-Enter).

(() => {
  const h = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    for (const k of kids) n.append(k);
    return n;
  };
  const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const guard = s => s.replace(/<\/script/gi, '<\\/script');
  const copyText = async t => {
    try { await navigator.clipboard.writeText(t); }
    catch { const ta = h('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select(); try { document.execCommand('copy'); } finally { ta.remove(); } }
  };

  // ── shared editor settings, applied across every block via the Display control ──
  const settings = { size: 13, nums: false, wrap: true };
  const editors = [];
  const applyTo = ed => { ed.setFontSize(settings.size); ed.setLineNumbers(settings.nums); ed.setWrap(settings.wrap); };
  const applySettings = () => editors.forEach(applyTo);

  // ── isolated proof documents (theme-agnostic; daisyUI is NOT injected) ──
  const REPORTER = `<scr`+`ipt>const p=()=>parent.postMessage({__h:document.documentElement.scrollHeight},'*');addEventListener('load',p);new ResizeObserver(p).observe(document.documentElement);setTimeout(p,60);setTimeout(p,350);<\/script>`;
  const HEAD = tw => `<meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">`
    + (tw ? `<scr`+`ipt src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"><\/script>` : ``)
    + `<style>html,body{margin:0}body{padding:12px;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#27272a;background:transparent;font-size:13px;line-height:1.5}</style>`;

  const docRender   = (code, tw) => `<!doctype html><html><head>${HEAD(tw)}</head><body>${code}${REPORTER}</body></html>`;
  const docContext  = (code, ctx, tw) => `<!doctype html><html><head>${HEAD(tw)}</head><body>${ctx.replace('{{slot}}', code)}${REPORTER}</body></html>`;
  const docJsRender = (code, tw) => `<!doctype html><html><head>${HEAD(tw)}</head><body><scr`+`ipt>try{${guard(code)}}catch(e){document.body.append(Object.assign(document.createElement('pre'),{textContent:e.message,style:'color:#dc2626;font:12px ui-monospace,monospace'}))}<\/script>${REPORTER}</body></html>`;
  const docConsole  = code => `<!doctype html><html><body><scr`+`ipt>`
    + `const ser=a=>{try{return a instanceof Error?a.message:typeof a==='object'?JSON.stringify(a):String(a)}catch(_){return String(a)}};`
    + `const send=(level,args)=>parent.postMessage({__c:{level,text:args.map(ser).join(' ')}},'*');`
    + `['log','info','warn','error','debug'].forEach(l=>{const o=console[l];console[l]=(...a)=>{send(l,a);try{o.apply(console,a)}catch(_){}}});`
    + `addEventListener('error',e=>send('error',[e.message]));addEventListener('unhandledrejection',e=>send('error',[String(e.reason)]));`
    + `try{${guard(code)}}catch(e){send('error',[e.message])}`
    + `<\/script></body></html>`;

  const PROOF_META = {
    render:   { label: 'Render',           icon: 'ph-eye' },
    context:  { label: 'Render · context', icon: 'ph-frame-corners' },
    jsrender: { label: 'Render · JS',      icon: 'ph-chart-bar' },
    console:  { label: 'Console',          icon: 'ph-terminal-window' },
  };

  const iconBtn = (icon, label, onClick, accent = false) => {
    const b = h('button', { class: `btn btn-ghost btn-xs gap-1 font-mono text-[10px] ${accent ? 'text-base-content' : 'opacity-50 hover:opacity-100'}` });
    const ic = h('i', { class: `ph ${icon} text-[13px]` });
    const tx = h('span', {}, label);
    b.append(ic, tx);
    b.addEventListener('click', () => onClick({ ic, tx }));
    return b;
  };

  const copyBtn = getText => iconBtn('ph-copy', 'Copy', async ({ ic, tx }) => {
    await copyText(getText());
    ic.className = 'ph ph-check text-[13px]'; tx.textContent = 'Copied';
    setTimeout(() => { ic.className = 'ph ph-copy text-[13px]'; tx.textContent = 'Copy'; }, 1300);
  });

  // ── Display control: a small popover that drives every editor at once ──
  function buildDisplayControl(mount) {
    const wrap = h('div', { class: 'relative' });
    const btn = h('button', { class: 'btn btn-sm btn-ghost gap-1.5 font-mono text-[10px] tracking-widest uppercase bg-base-100/80 backdrop-blur-md border border-base-300 shadow-sm' },
      h('i', { class: 'ph ph-text-aa text-[13px]' }), h('span', {}, 'Display'));
    const pop = h('div', { class: 'absolute right-0 top-full mt-1 z-50 w-52 rounded-box bg-base-100 border border-base-300 shadow-lg p-3 hidden' });

    pop.append(h('p', { class: 'font-mono text-[9px] tracking-widest uppercase opacity-40 mb-2' }, 'All editors'));
    const row = (label, ctrl) => h('div', { class: 'flex items-center justify-between gap-3 py-1' },
      h('span', { class: 'text-[11px] opacity-70' }, label), ctrl);

    const sizes = [11, 13, 15];
    const seg = h('div', { class: 'join' });
    const segBtns = sizes.map(s => {
      const b = h('button', {}, String(s));
      b.addEventListener('click', () => { settings.size = s; applySettings(); paintSeg(); });
      seg.append(b); return [s, b];
    });
    const paintSeg = () => segBtns.forEach(([s, b]) =>
      b.className = 'btn btn-xs join-item font-mono ' + (s === settings.size ? 'btn-neutral' : 'btn-ghost'));
    paintSeg();

    const toggle = (get, set) => {
      const t = h('input', { type: 'checkbox', class: 'toggle toggle-sm' });
      t.checked = get();
      t.addEventListener('change', () => { set(t.checked); applySettings(); });
      return t;
    };

    pop.append(
      row('Code size', seg),
      h('div', { class: 'h-px bg-base-300 my-1.5' }),
      row('Line numbers', toggle(() => settings.nums, v => settings.nums = v)),
      row('Wrap lines', toggle(() => settings.wrap, v => settings.wrap = v)),
    );

    btn.addEventListener('click', e => { e.stopPropagation(); pop.classList.toggle('hidden'); });
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) pop.classList.add('hidden'); });

    wrap.append(btn, pop);
    mount.append(wrap);
  }

  // ── host-template dialog (kind:'context') — read-only CM6 view of the harness ──
  function buildHostDialog(context) {
    const dlg = h('dialog', { class: 'modal' });
    const closeBtn = h('button', { class: 'btn btn-ghost btn-xs btn-circle' }, h('i', { class: 'ph ph-x text-[14px]' }));
    const head = h('div', { class: 'flex items-center justify-between px-3 py-2 border-b border-base-300 sticky top-0 bg-base-100 z-10' },
      h('div', { class: 'flex items-center gap-2' },
        h('i', { class: 'ph ph-frame-corners text-[14px] opacity-60' }),
        h('span', { class: 'font-mono text-[10px] tracking-widest uppercase opacity-60' }, 'Host template')),
      h('div', { class: 'flex items-center gap-1' }, copyBtn(() => context), closeBtn));
    const cmHost = h('div', { class: 'rounded-box border border-base-300 overflow-hidden' });
    const note = h('p', { class: 'px-1 pt-2 text-[11px] leading-snug opacity-60', html: 'The snippet you edit is injected where <code class="font-mono text-[0.9em] bg-base-200 border border-base-300 rounded px-1">{{slot}}</code> appears.' });
    const box = h('div', { class: 'modal-box max-w-2xl p-0' }, head, h('div', { class: 'p-3' }, cmHost, note));
    dlg.append(box, h('form', { method: 'dialog', class: 'modal-backdrop' }, h('button', {}, 'close')));
    document.body.append(dlg);

    let made = false;
    closeBtn.addEventListener('click', () => dlg.close());
    return () => {
      dlg.showModal();
      if (!made) { made = true; cm6.create(cmHost, { value: context, language: 'html', readOnly: true, wrap: true, fontSize: 12 }); }
    };
  }

  // ── the live demo block: editor + proof. Returns the card synchronously;
  //    the CM6 editor mounts async and wires the proof once ready. ──
  function block(cfg) {
    const meta = PROOF_META[cfg.kind];
    const live = cfg.kind !== 'console';

    const card = h('div', { class: 'rounded-box overflow-hidden bg-base-100 border border-base-300 shadow-sm' });

    const langTag = h('div', { class: 'flex items-center gap-1.5 font-mono text-[9.5px] opacity-50' },
      h('span', { class: 'inline-block w-1.5 h-1.5 bg-base-content/30 rounded-sm' }),
      h('span', {}, cfg.lang === 'js' ? 'javascript' : 'html'));
    const codeActions = h('div', { class: 'flex items-center' });
    const topBar = h('div', { class: 'flex items-center justify-between bg-base-200/40 pl-2.5 pr-1 py-1 border-b border-base-300' }, langTag, codeActions);

    const editorHost = h('div', { class: 'bg-base-100 px-2 py-1.5' });

    const proofZone = h('div', { class: 'bg-base-200/40 border-t border-base-300' });
    const chip = h('span', { class: 'inline-flex items-center gap-1 rounded-box bg-base-100 border border-base-300 px-1.5 py-0.5 font-mono text-[9px] tracking-widest uppercase opacity-70 shadow-sm' },
      h('i', { class: `ph ${meta.icon} text-[11px]` }), h('span', {}, meta.label));
    const seamActions = h('div', { class: 'flex items-center' });
    const seam = h('div', { class: 'flex items-center gap-2 px-2 py-1.5' },
      chip, h('div', { class: 'h-px flex-1 bg-base-300' }), seamActions);

    if (cfg.kind === 'context') {
      chip.classList.add('cursor-pointer', 'hover:bg-base-200');
      chip.setAttribute('role', 'button');
      chip.setAttribute('title', 'View host template');
      chip.append(h('i', { class: 'ph ph-arrow-square-out text-[10px] opacity-50' }));
      chip.addEventListener('click', buildHostDialog(cfg.context));
    }

    const proofBody = h('div', {});
    proofZone.append(seam, proofBody);

    let ed = null;
    const getCode = () => ed ? ed.getValue() : cfg.code;

    if (live) {
      const frame = h('iframe', { class: 'w-full block bg-transparent', sandbox: 'allow-scripts', style: 'height:40px' });
      proofBody.append(frame);
      addEventListener('message', e => {
        if (e.source === frame.contentWindow && e.data && typeof e.data.__h === 'number')
          frame.style.height = Math.max(32, e.data.__h) + 'px';
      });
      const build = () => {
        const c = getCode();
        frame.srcdoc = cfg.kind === 'context' ? docContext(c, cfg.context, cfg.tw)
                     : cfg.kind === 'jsrender' ? docJsRender(c, cfg.tw)
                     : docRender(c, cfg.tw);
      };
      build();
      seamActions.append(iconBtn('ph-arrow-clockwise', 'Refresh', ({ ic }) => {
        ic.style.transition = 'transform .4s'; ic.style.transform = 'rotate(360deg)';
        setTimeout(() => { ic.style.transition = 'none'; ic.style.transform = 'none'; }, 420);
        build();
      }, true));
      cfg._rebuild = build;
    } else {
      const out = h('div', { class: 'mx-2 mb-2 rounded-box bg-base-100 border border-base-300 p-2 font-mono text-[11px] leading-relaxed min-h-[2.4rem] shadow-sm' });
      proofBody.append(out);
      const line = (level, text) => {
        const tone = { log: 'text-base-content', info: 'text-info', warn: 'text-warning', error: 'text-error', debug: 'opacity-50' }[level] || 'text-base-content';
        const mark = { log: '›', info: 'ℹ', warn: '⚠', error: '✗', debug: '·' }[level] || '›';
        const markTone = level === 'error' ? 'text-error' : level === 'warn' ? 'text-warning' : 'opacity-30';
        out.append(h('div', { class: 'flex gap-2 whitespace-pre-wrap break-words' },
          h('span', { class: 'select-none ' + markTone }, mark), h('span', { class: tone }, text)));
      };
      let runFrame = null;
      addEventListener('message', e => {
        if (runFrame && e.source === runFrame.contentWindow && e.data && e.data.__c)
          line(e.data.__c.level, e.data.__c.text);
      });
      const run = () => {
        out.replaceChildren();
        if (runFrame) runFrame.remove();
        runFrame = h('iframe', { sandbox: 'allow-scripts', style: 'display:none' });
        document.body.append(runFrame);
        runFrame.srcdoc = docConsole(getCode());
      };
      run();
      seamActions.append(iconBtn('ph-play-fill', 'Run', run, true));
      cfg._rebuild = run;
    }

    codeActions.append(copyBtn(getCode));
    codeActions.append(iconBtn('ph-arrow-counter-clockwise', 'Reset', () => {
      if (ed) ed.setValue(cfg.code);
      cfg._rebuild();
    }));

    cm6.create(editorHost, {
      value: cfg.code,
      language: cfg.lang === 'js' ? 'js' : 'html',
      wrap: settings.wrap, lineNumbers: settings.nums, fontSize: settings.size,
      onChange: debounce(() => cfg._rebuild(), 260),
      onRun: live ? undefined : () => cfg._rebuild(),
    }).then(handle => { ed = handle; editors.push(handle); applyTo(handle); });

    card.append(topBar, editorHost, proofZone);
    return card;
  }

  let exSeq = 0;
  function example(cfg, si, ei) {
    const sec = h('div', { class: 'mb-6' });
    const kicker = h('p', { class: 'font-mono text-[9px] tracking-widest mb-1 opacity-40' }, `${si + 1}.${ei + 1}`);
    const title = h('h3', { class: 'text-[1.05rem] leading-tight font-semibold' }, cfg.title);
    const prose = cfg.prose ? h('div', { class: 'mt-1 text-[0.9rem] leading-relaxed opacity-70 max-w-[66ch]', html: cfg.prose }) : null;
    const wrap = h('div', { class: 'mt-2.5' }, block(cfg));

    sec.append(kicker, title);
    if (prose) sec.append(prose);
    sec.append(wrap);
    sec.animate(
      [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
      { duration: 400, delay: 60 + exSeq++ * 50, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' }
    );
    return sec;
  }

  function section(cfg, si) {
    const wrap = h('section', { class: 'mb-10' });
    const head = h('header', { class: 'mb-5 pb-2 border-b border-base-300' },
      h('p', { class: 'font-mono text-[10px] tracking-widest opacity-40 mb-1' }, String(si + 1).padStart(2, '0')),
      h('h2', { class: 'text-[1.4rem] leading-tight font-bold tracking-tight' }, cfg.title));
    if (cfg.intro) head.append(h('p', { class: 'mt-1.5 text-[0.95rem] leading-relaxed opacity-70 max-w-[64ch]' }, cfg.intro));
    wrap.append(head);
    cfg.examples.forEach((ex, ei) => wrap.append(example(ex, si, ei)));
    return wrap;
  }

  function legend(mount) {
    for (const k of ['render', 'context', 'jsrender', 'console']) {
      const m = PROOF_META[k];
      mount.append(h('span', { class: 'inline-flex items-center gap-1.5 rounded-box bg-base-100 border border-base-300 px-2 py-0.5 font-mono text-[9.5px] tracking-widest uppercase opacity-70 shadow-sm' },
        h('i', { class: `ph ${m.icon} text-[11px]` }), h('span', {}, m.label)));
    }
  }

  function mount({ sections, sectionsEl, displayEl, legendEl }) {
    if (legendEl) legend(legendEl);
    if (displayEl) buildDisplayControl(displayEl);
    sections.forEach((cfg, si) => sectionsEl.append(section(cfg, si)));
  }

  window.demo = { mount, section, example, block, legend, displayControl: buildDisplayControl, PROOF_META, settings };
})();
