<!-- Append this section to web-tools/lib/kits/README.md under "Current kits". -->

### wring.js

Single-document template induction: give it one document with repeated
structure (a log, raw HTML, structured records) and it returns the recurring
**templates** (fixed boilerplate with variable **slots**) plus the values that
fill each slot. Lossless: templates + slot values reconstruct the original
exactly. Ported from [`mehrlander/wring`](https://github.com/mehrlander/wring)
— the full source modules, test suite, and research record live at
`archive/wring/`; the design doc is `archive/wring/ARCHITECTURE.md` (a
five-stage pipeline: Tokenize → Grammar → Bookend Merge → Selection →
Extraction). The kit is generated from those modules by
`archive/wring/export/build-kit.mjs` — regenerate there rather than editing
by hand.

After loading:

```js
// End-to-end on text: one call, templates out
const run = window.wring.induce(logText, { group: 'align' });
run.result.groups     // [{ template: '192.168.1.${0} - - [...] ${5} ${6}', members, score }]
run.fidelity          // { pass, total } — reconstruction check

// DOM: repeated components from a live document or DOMParser result
const sigs = wring.extractSignaturesFromNodes(document);   // tag#id.class.class strings
const res  = wring.groupByTemplate(sigs, { maxSlots: 2 }); // templates + slot values

// The stages individually
wring.tokenize(text, 'punct')         // Stage 1: lossless tokenizers (punct/word/char/line)
wring.induceGrammar(tokens)           // Stage 2: Re-Pair grammar of exact repeats
wring.groupByTemplate(strings, opts)  // Stage 3-4: Bookend Merge + greedy MDL
wring.groupByAlignment(records, opts) // Stage 3 alternative: positional alignment
wring.selectTemplates(input)          // Stage 4: full MDL + weighted interval scheduling
wring.reconstruct(template, slots)    // Stage 5: exact reconstruction
```

Demo pages: `pages/wring-text.html` (logs/records → templates) and
`pages/wring-dom.html` (DOM signatures or pasted HTML → repeated components).
Kit liveness test: `node tools/test-wring.mjs` (loads the kit the way
`gh.load` does and checks the pipeline invariants end-to-end).
