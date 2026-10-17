// kits/design-fill.js — a design from the template route, filled, themed and shown (window.DesignFill).
//
// A design is a folder holding template.html, an HTML fragment whose every word
// comes from a field, and content.json, its words. Fields are named by a dotted
// path into the words: data-text, data-value and data-icon show one; data-each
// repeats an element per item of a list (a path starting with "." is then
// relative to the item); data-if keeps an element only where its path has a
// value; data-form asks a text field for a second length of the same words;
// data-glue marks the template's own connectives. A theme is a set of values
// for the --c8-* CSS variables every such template reads.
//
// The contract is web-tools-private
// sessions/segments-gold/full/page-design/crazy8/templates/TEMPLATES.md, and
// fill, fields, pick and expand are a port of that folder's template.js, so a
// page here can show a design without the session's files. Keep the two in step.
//
//   DesignFill.fill(el, content, { names })  fill el (holding a template) in place;
//                                            one report row per field filled. With
//                                            names, a text field shows its name.
//   DesignFill.fields(el)                    the fields a template declares, unfilled
//   DesignFill.mark(el, prefix)              ring the line of the block whose fields'
//                                            paths start with prefix (a call's own
//                                            question); returns the ringed element, or
//                                            null where the block's fields are spread
//                                            through the whole design
//   DesignFill.lineOf(el, prefix)            that block's line, unmarked, or null on the
//                                            same terms: where a link to it can hang
//   DesignFill.focus(el, prefix)             show that block's line with its detail, fixed
//                                            open, and reduce every other to its line
//   DesignFill.annotate(el, entities)        mark the first occurrence of each entity's
//                                            terms ([{ id, terms }]) with data-entity
//   DesignFill.load(spec, { token })         { html, content, vars } for
//                                            spec { design: 'owner/repo@ref:folder',
//                                                   words: 'owner/repo@ref:file.json',
//                                                   theme: 'owner/repo@ref:file.json#name' };
//                                            words, when given, stand in for the design's
//                                            own content.json
//   DesignFill.render(spec, { token, at, entities, vars })
//                                            the design filled and themed, focused and
//                                            ringed on block `at`, entities marked, as HTML;
//                                            vars override the theme's values (a host that
//                                            wants the design smaller sets --c8-text)
(function () {
  const steps = (path) => path.replace(/\[(\d*)\]/g, '.$1').split('.').filter(Boolean);
  const get = (obj, path) => steps(path).reduce((o, k) => (o == null ? o : o[k]), obj);
  const set = (obj, path, v) => {
    const s = steps(path);
    s.slice(0, -1).reduce((o, k, i) => (o[k] ??= /^\d+$/.test(s[i + 1]) ? [] : {}), obj)[s[s.length - 1]] = v;
  };
  const generic = (full) => full.replace(/\[\d+\]/g, '[]');
  const short = (full) => full.replace(/\[\d*\]/g, '').split('.').pop();
  const empty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);

  // Every place a path occurs in the words: decide.paths[].name gives
  // decide.paths[0].name and decide.paths[1].name, each with its value.
  function expand(doc, path) {
    const i = path.indexOf('[]');
    if (i < 0) { const v = get(doc, path); return v === undefined ? [] : [{ full: path, v }]; }
    const list = get(doc, path.slice(0, i));
    return Array.isArray(list) ? list.flatMap((_, n) => expand(doc, path.slice(0, i) + '[' + n + ']' + path.slice(i + 2))) : [];
  }

  function pick(v, form) {
    if (v == null || v === '') return { text: '', missing: true };
    if (typeof v !== 'object') return { text: String(v), fallback: !!form };
    if (form && v[form] != null) return { text: String(v[form]) };
    return { text: v.text != null ? String(v.text) : '', fallback: !!form, missing: v.text == null };
  }

  const scoped = (path, scope) => (path.startsWith('.') ? { obj: scope.item, key: path.slice(1), full: scope.path + path } : { obj: scope.content, key: path, full: path });

  function fill(el, content, o = {}) {
    const report = [];
    const one = (node, scope) => {
      if (node.hasAttribute('data-if')) {
        const r = scoped(node.getAttribute('data-if'), scope);
        if (!o.names && empty(get(r.obj, r.key))) { node.remove(); return; }
      }
      if (node.hasAttribute('data-icon')) {
        const r = scoped(node.getAttribute('data-icon'), scope), v = get(r.obj, r.key);
        if (v) node.classList.add('ph', 'ph-' + v);
        node.dataset.field = r.full;
      }
      for (const kind of ['text', 'value']) {
        const attr = 'data-' + kind;
        if (!node.hasAttribute(attr)) continue;
        const r = scoped(node.getAttribute(attr), scope), form = kind === 'text' ? node.getAttribute('data-form') || '' : '';
        const p = pick(get(r.obj, r.key), form), max = +node.getAttribute('data-max') || 0;
        node.textContent = !o.names ? p.text : kind === 'value' && p.text ? p.text : '{' + short(r.full) + (form ? '@' + form : '') + '}';
        node.dataset.field = r.full + (form ? '@' + form : '');
        report.push({ path: r.full, form, kind, max, text: p.text, length: p.text.length, missing: !!p.missing, fallback: !!p.fallback, over: !!(max && p.text.length > max) });
      }
      kids(node, scope);
    };
    const kids = (node, scope) => {
      for (const child of [...node.children]) {
        if (!child.hasAttribute('data-each')) { one(child, scope); continue; }
        const r = scoped(child.getAttribute('data-each'), scope), list = get(r.obj, r.key);
        const items = Array.isArray(list) && list.length ? list : o.names ? [null] : [];
        items.forEach((item, i) => {
          const c = child.cloneNode(true), path = r.full + '[' + i + ']';
          c.removeAttribute('data-each'); c.dataset.item = path;
          child.parentNode.insertBefore(c, child);
          one(c, { content: scope.content, item, path });
        });
        child.remove();
      }
    };
    kids(el, { content, item: null, path: '' });
    return report;
  }

  // The fields a template declares, read without filling: path (with [] inside a
  // repeat), kind, form, max. A repeat (list) and a condition (if) are listed too.
  function fields(el) {
    const out = [], rel = (p, base) => (p.startsWith('.') ? base + p : p);
    const walk = (node, ctx) => {
      for (const child of node.children) {
        let here = ctx;
        if (child.hasAttribute('data-each')) { const p = rel(child.getAttribute('data-each'), ctx); out.push({ path: p, kind: 'list', form: '', max: 0 }); here = p + '[]'; }
        if (child.hasAttribute('data-if')) out.push({ path: rel(child.getAttribute('data-if'), here), kind: 'if', form: '', max: 0 });
        for (const kind of ['text', 'value', 'icon'])
          if (child.hasAttribute('data-' + kind)) out.push({ path: rel(child.getAttribute('data-' + kind), here), kind,
            form: kind === 'text' ? child.getAttribute('data-form') || '' : '', max: +child.getAttribute('data-max') || 0 });
        walk(child, here);
      }
    };
    walk(el, '');
    return out;
  }

  // The block a call decides: ring the smallest element holding every field whose path
  // starts with `prefix.`. Where that element is a disclosure, the ring goes on the first
  // element of its summary, the line a reader sees, so the detail below stays outside it.
  // A block that is one field rings that field's parent; a block spread through the whole
  // design (a sentence that runs every question together) gets no ring. Nothing is dimmed:
  // the rest of the chain is read, not skipped.
  function mark(el, prefix) {
    const a = lineOf(el, prefix);
    if (!a) return null;
    a.classList.add('outline-2', 'outline-offset-2', 'outline-[var(--color-primary)]');
    a.setAttribute('aria-current', 'step');
    return a;
  }

  // The line a reader sees for a block: the smallest element holding all of its
  // fields, or for a disclosure (or a block focus() has reduced) its summary's
  // line. Null when the prefix names nothing, or only the whole design.
  function lineOf(el, prefix) {
    const mine = [...el.querySelectorAll('[data-field]')].filter((n) => n.dataset.field.startsWith(prefix + '.'));
    if (!mine.length) return null;
    let a = mine[0].parentElement;
    while (a && a !== el && !mine.every((n) => a.contains(n))) a = a.parentElement;
    if (!a || a === el || a === el.firstElementChild) return null;
    if (a.tagName === 'DETAILS') a = a.querySelector(':scope > summary')?.firstElementChild || a;
    else if (a.dataset.fold) a = a.firstElementChild?.firstElementChild || a;
    return a;
  }

  // A design shown around one block: no disclosure is left to open or close. The one
  // holding that block's fields becomes its line with its detail always under it, and every
  // other becomes the line its summary shows, so the chain reads whole at a glance and only
  // the block in question carries its detail. Neither has a caret, and neither collapses
  // under a tap beside its line. Each is a div marked data-fold ("open" or "line").
  function focus(el, prefix) {
    const own = (d) => [...d.querySelectorAll('[data-field]')].some((n) => n.closest('details') === d && n.dataset.field.startsWith(prefix + '.'));
    for (const d of [...el.querySelectorAll('details')]) {
      const mine = own(d), s = d.querySelector(':scope > summary'), block = document.createElement('div'), line = document.createElement('div');
      block.className = d.className;
      block.dataset.fold = mine ? 'open' : 'line';
      if (d.getAttribute('style')) block.setAttribute('style', d.getAttribute('style'));
      line.className = (s?.className || '').replace(/\bcursor-pointer\b/g, '');
      if (s) { line.append(...s.childNodes); s.remove(); }
      line.querySelectorAll('i[class*="caret"]').forEach((i) => i.remove());
      block.append(line);
      if (mine) block.append(...d.childNodes);
      d.replaceWith(block);
    }
  }

  // The entities a text names, marked so a reader can ask what each one is: the first
  // occurrence of each entity's terms, matched whole and ignoring case, wrapped in a span
  // carrying the entity's id. Longer terms go first, so "topic follow-up" wins over "topic".
  // Text already inside a mark, or in the template's own connectives, is left alone. The
  // mark draws nothing, no underline and no cursor: what a marked term looks like, and
  // what opens from it, is the host's.
  function annotate(el, entities) {
    const terms = (entities || []).flatMap((e) => (e.terms || []).map((t) => ({ id: e.id, t }))).sort((a, b) => b.t.length - a.t.length), done = new Set();
    for (const { id, t } of terms) {
      if (done.has(id)) continue;
      const re = new RegExp('(^|[^\\w])(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?!\\w)', 'i');
      const it = document.createTreeWalker(el, 4);
      for (let n = it.nextNode(); n; n = it.nextNode()) {
        if (n.parentElement?.closest('[data-entity],[data-glue]')) continue;
        const m = re.exec(n.data);
        if (!m) continue;
        const mid = n.splitText(m.index + m[1].length), span = document.createElement('span');
        mid.splitText(m[2].length);
        span.dataset.entity = id;
        span.textContent = mid.data;
        mid.replaceWith(span);
        done.add(id);
        break;
      }
    }
    return el;
  }

  // owner/repo@ref:path, read through the viewer's token, since designs usually
  // live in the private store.
  const at = (s) => { const m = String(s || '').match(/^([^/@:\s]+\/[^@:\s]+)@([^:\s]+):([^#\s]+)(?:#(\S+))?$/); return m && { repo: m[1], ref: m[2], path: m[3], name: m[4] || '' }; };
  const read = async (where, path, token) => (await new window.GH({ token: token ?? window.TOKEN, repo: where.repo, ref: where.ref }).get(path)).text;

  async function load(spec, o = {}) {
    const d = at(spec?.design);
    if (!d) throw new Error('design must read owner/repo@ref:folder');
    const base = d.path.replace(/\/$/, '');
    const w = spec?.words ? at(spec.words) : null;
    if (spec?.words && !w) throw new Error('words must read owner/repo@ref:file.json');
    const [html, words] = await Promise.all([read(d, base + '/template.html', o.token), w ? read(w, w.path, o.token) : read(d, base + '/content.json', o.token)]);
    let vars = {};
    const t = at(spec?.theme);
    if (t) {
      const themes = JSON.parse(await read(t, t.path, o.token));
      vars = themes[t.name] || {};
    }
    return { html, content: JSON.parse(words), vars };
  }

  async function render(spec, o = {}) {
    const { html, content, vars } = await load(spec, o);
    const box = document.createElement('div');
    box.innerHTML = html.trim();
    fill(box, content);
    if (o.at) { focus(box, o.at); mark(box, o.at); }
    if (o.entities) annotate(box, o.entities);
    const style = Object.entries({ ...vars, ...(o.vars || {}) }).map(([k, v]) => k + ':' + v).join(';');
    return '<div style="' + window.esc(style) + '">' + box.innerHTML + '</div>';
  }

  window.DesignFill = { fill, fields, mark, lineOf, focus, annotate, expand, pick, get, set, generic, load, render };
})();
