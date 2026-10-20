// kits/term-marks.js — a glossary's terms marked where a text first names them (window.TermMarks).
//
// A user call that names a glossary marks the entities its decision tree,
// question and brief name, so a reader can ask what each one is: the first
// occurrence of each entity's terms, matched whole and ignoring case, wrapped in
// a span carrying the entity's id. Longer terms go first, so "topic follow-up"
// wins over "topic". Text already inside a mark, or in a connective the host
// set apart with data-glue, is left alone. The mark draws nothing, no underline
// and no cursor: what a marked term looks like, and what opens from it, is the
// host's (alpineComponents/user-call-form.js).
//
//   TermMarks.mark(el, entities)   mark el in place for entities [{ id, terms }];
//                                  returns el
(function () {
  function mark(el, entities) {
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

  window.TermMarks = { mark };
})();
