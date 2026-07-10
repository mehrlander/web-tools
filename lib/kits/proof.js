// kits/proof.js — sandboxed proof documents: code in, self-contained
// srcdoc HTML out. Lifted from vanilla-demo.js so the demo format and the
// chat renderer share one copy of the sandbox logic instead of drifting.
// Framework-free, DOM-free: this kit only builds strings; mounting the
// iframe (and sizing it from the reporter's postMessage) stays with the
// caller.
//
// After loading:
//
//   proof.doc(kind, code, opts)  // the one entry point
//     kind: 'render'   — code is body markup; the doc renders it.
//           'context'  — code is injected at {{slot}} inside opts.context.
//           'jsrender' — code is JS that builds nodes into the doc body.
//           'console'  — code is JS run in the doc; console output is
//                        posted to the parent as {__c:{level,text}}.
//     opts: { tw?, daisy?, inject?, base?, context? }
//           tw      — inject Tailwind into the frame
//           daisy   — Tailwind + daisyUI theme sheet + Phosphor (implies tw)
//           inject  — array of <script src> URLs loaded in the frame head,
//                     in order, before any body script runs
//           base    — URL prefix for repo-relative inject paths (so a page's
//                     ?use=<ref> carries into the frame); absolute http(s)
//                     entries are used verbatim
//           context — host template with a {{slot}} marker (kind 'context')
//
//   proof.head(opts)      // the <head> payload the docs share
//   proof.reporter        // height-reporter snippet ('render' family docs)
//   proof.guard(s)        // escape </script for embedding inside a script
//
// Every doc is meant for an iframe with sandbox="allow-scripts" (opaque
// origin): the framed code can run but reaches neither the host page nor
// its storage or token. 'render'/'context'/'jsrender' docs post their
// height as {__h:number} so the host can size the visible frame;
// 'console' docs are for hidden frames, streaming output instead.

(() => {
  const guard = s => String(s).replace(/<\/script/gi, '<\\/script');

  const resolveSrc = (s, base) =>
    /^https?:\/\//.test(s) ? s : `${String(base || '').replace(/\/$/, '')}/${String(s).replace(/^\//, '')}`;
  const injectTags = (list, base) =>
    (list || []).map(s => `<scr` + `ipt src="${resolveSrc(s, base)}"><\/scr` + `ipt>`).join('');

  const reporter = `<scr`+`ipt>const p=()=>parent.postMessage({__h:document.documentElement.scrollHeight},'*');addEventListener('load',p);new ResizeObserver(p).observe(document.documentElement);setTimeout(p,60);setTimeout(p,350);<\/script>`;

  // daisy implies tw and adds the daisyUI theme sheet + Phosphor; inject
  // scripts are blocking and ordered, so kit globals exist before any
  // body/console snippet script runs.
  const head = (o = {}) => {
    const tw = o.tw || o.daisy;
    return `<meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">`
      + (o.daisy ? `<link href="https://cdn.jsdelivr.net/combine/npm/daisyui@5/themes.css,npm/daisyui@5" rel="stylesheet">` : ``)
      + (tw ? `<scr` + `ipt src="https://cdn.jsdelivr.net/combine/npm/@tailwindcss/browser@4${o.daisy ? ',npm/@phosphor-icons/web' : ''}"><\/scr` + `ipt>` : ``)
      + `<style>html,body{margin:0}body{padding:12px;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#27272a;background:transparent;font-size:13px;line-height:1.5}</style>`
      + injectTags(o.inject, o.base);
  };

  const htmlOpen = o => `<!doctype html><html${o.daisy ? ' data-theme="nord"' : ''}>`;

  const docs = {
    render: (code, o) => `${htmlOpen(o)}<head>${head(o)}</head><body>${code}${reporter}</body></html>`,
    context: (code, o) => `${htmlOpen(o)}<head>${head(o)}</head><body>${String(o.context || '{{slot}}').replace('{{slot}}', code)}${reporter}</body></html>`,
    // reporter first: its ResizeObserver/listeners persist after execution, so
    // a snippet that replaces document.body (body.innerHTML = …) still resizes.
    jsrender: (code, o) => `${htmlOpen(o)}<head>${head(o)}</head><body>${reporter}<scr`+`ipt>(async()=>{try{${guard(code)}}catch(e){document.body.append(Object.assign(document.createElement('pre'),{textContent:e.message,style:'color:#dc2626;font:12px ui-monospace,monospace'}))}})()<\/script></body></html>`,
    console: (code, o) => `<!doctype html><html><head>${head(o)}</head><body><scr`+`ipt>`
      + `const ser=a=>{try{return a instanceof Error?a.message:typeof a==='object'?JSON.stringify(a):String(a)}catch(_){return String(a)}};`
      + `const send=(level,args)=>parent.postMessage({__c:{level,text:args.map(ser).join(' ')}},'*');`
      + `['log','info','warn','error','debug'].forEach(l=>{const o=console[l];console[l]=(...a)=>{send(l,a);try{o.apply(console,a)}catch(_){}}});`
      + `addEventListener('error',e=>send('error',[e.message]));addEventListener('unhandledrejection',e=>send('error',[String(e.reason)]));`
      + `(async()=>{try{${guard(code)}}catch(e){send('error',[e.message])}})()`
      + `<\/script></body></html>`,
  };

  const doc = (kind, code, o = {}) => {
    const build = docs[kind];
    if (!build) throw new Error(`proof.doc: unknown kind "${kind}"`);
    return build(code, o);
  };

  window.proof = { doc, head, reporter, guard };
})();
