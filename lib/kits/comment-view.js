// comment-view.js: a code file read through its comments: each docstring and comment block laid out as prose in file order, with the code between them folded to one-line bars.
//
//   commentView.blocks(src, ext, { display })  [{ line, end, kind, text, own, doc }] in line order
//   commentView.segments(src, ext)  [{ t: 'prose', ...block, owner } | { t: 'code', a, b }],
//                                   covering every line of the file once
//   commentView.prose(text, mark)   a block's text as HTML
//   commentView.render(el, src, ext, { mark, counts })  draws the view into el,
//                                   `mark` a global RegExp to mark in the prose and
//                                   `counts: false` to leave the counts to the host;
//                                   returns { marks, blocks, share }
//   commentView.stats(src, ext)     { blocks, share }: comment blocks, and the share
//                                   of non-blank lines they hold, as a percent
//
// Blocks are found as python/embedded-prose.py finds them, so a block here is
// a block in data/comments/: one HTML comment, one /* */, a run of `//` or `#`
// lines, or a Python docstring, kept when it reads as prose and has three
// words or more. node/test/comment-view.test.mjs holds the two to the same
// lines, kinds and words across the repository.
//
// kind is header (a module docstring, or a file's first comment with only
// wrapper lines above it), docstring (a def or class docstring) or comment.
// A block with code on its own lines, such as a comment after a statement,
// stays inside its code bar: `own` is false for it. With `display` such a
// comment is a block of its own rather than joining the `//` run above it.
//
// prose() keeps every word and changes only line breaks: a paragraph's wrapped
// lines join, a run whose later lines hang under a term on its first line is a
// definition list, `- ` and `1. ` lines are a list, an indented run that reads
// as a command or code stays preformatted, and `inline` backticks are code.
// Anything it cannot place is a plain paragraph.
(function () {
  const WORD = /[A-Za-z][A-Za-z'’-]+/g;
  const words = (s) => (s.match(WORD) || []).length;
  // vanilla-bundle.js's window.esc, the one escape, first in the boot chain.
  const esc = (s) => window.esc(String(s));
  const lineOf = (src, i) => { let n = 1; for (let k = src.indexOf('\n'); k !== -1 && k < i; k = src.indexOf('\n', k + 1)) n++; return n; };

  function prosey(s) {
    s = s.trim();
    if (s.length < 3) return false;
    if (s.length > 60 && ((s.match(/ /g) || []).length + (s.match(/\n/g) || []).length) / s.length < 0.08) return false;
    const toks = s.split(/\s+/).filter(Boolean);
    return toks.length > 0 && toks.reduce((a, t) => a + t.length, 0) / toks.length <= 14;
  }
  const keep = (body) => prosey(body) && words(body) >= 3;

  // ── JavaScript: a walk that respects strings, templates and regex literals.
  const PREV_OPERAND = /[\p{L}\p{N}_$)\]]$/u;
  const KEYWORD_BEFORE_REGEX = /\b(return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await)$/;
  function tail(src, i) {
    let j = i - 1;
    while (j >= 0 && /\s/.test(src[j])) j--;
    return src.slice(Math.max(0, j - 63), j + 1);
  }
  function skipRegex(src, i, n) {
    let j = i + 1, inClass = false;
    while (j < n) {
      const ch = src[j];
      if (ch === '\\') { j += 2; continue; }
      if (ch === '\n') break;
      if (ch === '[') inClass = true;
      else if (ch === ']') inClass = false;
      else if (ch === '/' && !inClass) return j + 1;
      j++;
    }
    return j;
  }
  function skipQuoted(src, i, n, q) {
    let j = i + 1;
    while (j < n) {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === q || src[j] === '\n') break;
      j++;
    }
    return j + 1;
  }
  function skipTemplate(src, i, n) {
    let j = i + 1, depth = 0;
    while (j < n) {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === '$' && j + 1 < n && src[j + 1] === '{') { depth++; j += 2; continue; }
      if (depth && src[j] === '}') depth--;
      else if (src[j] === '`' && !depth) break;
      j++;
    }
    return j + 1;
  }
  // [line, kind, body, at, to]: at/to are offsets of the whole comment.
  function jsComments(src, base) {
    const out = [], n = src.length;
    let i = 0, line = base;
    while (i < n) {
      const c = src[i];
      if (c === '\n') { line++; i++; }
      else if (c === '/' && src[i + 1] === '/') {
        let j = src.indexOf('\n', i); j = j < 0 ? n : j;
        out.push([line, 'line', src.slice(i + 2, j), i, j, !src.slice(src.lastIndexOf('\n', i - 1) + 1, i).trim()]);
        i = j;
      } else if (c === '/' && src[i + 1] === '*') {
        let j = src.indexOf('*/', i + 2); j = j < 0 ? n - 2 : j;
        const body = src.slice(i + 2, j);
        out.push([line, 'block', body, i, j + 2, !src.slice(src.lastIndexOf('\n', i - 1) + 1, i).trim()]);
        line += (body.match(/\n/g) || []).length;
        i = j + 2;
      } else if (c === '/' && !(PREV_OPERAND.test(tail(src, i)) && !KEYWORD_BEFORE_REGEX.test(tail(src, i)))) {
        i = skipRegex(src, i, n);
      } else if (c === '"' || c === "'") {
        const j = i; i = skipQuoted(src, i, n, c); line += (src.slice(j, i).match(/\n/g) || []).length;
      } else if (c === '`') {
        // An HTML comment in a template literal is an Alpine component's own
        // comment, as embedded-prose.py counts it.
        const j = i; i = skipTemplate(src, i, n);
        for (const m of src.slice(j, i).matchAll(/<!--([\s\S]*?)-->/g)) {
          const at = j + m.index;
          out.push([line + (src.slice(j, at).match(/\n/g) || []).length, 'html', m[1], at, at + m[0].length, !src.slice(src.lastIndexOf('\n', at - 1) + 1, at).trim()]);
        }
        line += (src.slice(j, i).match(/\n/g) || []).length;
      } else i++;
    }
    return out;
  }
  // A run of `//` lines is one block, as embedded-prose.py counts them, and
  // there a comment after a statement joins the run above it. For display
  // (`own` only) it starts a block of its own, or its statement would vanish
  // into the prose.
  function coalesce(cs, display) {
    const out = [];
    for (const c of cs) {
      const p = out[out.length - 1];
      if (p && c[1] === 'line' && p[1] === 'line' && c[0] === p[0] + (p[2].match(/\n/g) || []).length + 1 && (!display || (p[5] && c[5]))) {
        out[out.length - 1] = [p[0], 'line', p[2] + '\n' + c[2], p[3], c[4], p[5] && c[5]];
      } else out.push(c);
    }
    return out;
  }

  // ── Python: `#` runs and docstrings, strings stepped over whole.
  const PY_STRING = /(?<q>"""|'''|"|')(?<v>(?:\\.|(?!\k<q>)[\s\S])*?)\k<q>/y;
  function pySpans(src) {
    const out = [], n = src.length;
    let i = 0;
    while (i < n) {
      const c = src[i];
      if (c === '#') {
        const j = src.indexOf('\n', i);
        out.push([i, j < 0 ? n : j, 'comment']);
        i = j < 0 ? n : j;
      } else if (c === '"' || c === "'") {
        PY_STRING.lastIndex = i;
        const m = PY_STRING.exec(src);
        if (m) { out.push([i, i + m[0].length, 'string']); i += m[0].length; } else i++;
      } else i++;
    }
    return out;
  }
  // Whether the code before a triple-quoted string makes it a docstring:
  // nothing but comments above it (the module's), or a def or class header
  // ending just before it (that function's or class's).
  function docKind(src, at, spans) {
    let start = at;
    while (start > 0 && /[rRbBuUfF]/.test(src[start - 1])) start--;
    let before = src.slice(0, start);
    for (let k = spans.length - 1; k >= 0; k--) {
      const [a, z, kind] = spans[k];
      if (z > start || kind !== 'comment') continue;
      before = before.slice(0, a) + ' '.repeat(z - a) + before.slice(z);
    }
    const trimmed = before.trimEnd();
    if (!trimmed.trim()) return 'header';
    if (!trimmed.endsWith(':')) return '';
    const heads = [...trimmed.matchAll(/(^|\n)[ \t]*(async[ \t]+)?(def|class)\b/g)];
    const h = heads[heads.length - 1];
    if (!h) return '';
    let depth = 0, colon = -1;
    const sig = trimmed.slice(h.index);
    for (let k = 0; k < sig.length; k++) {
      const ch = sig[k];
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
      else if (ch === ':' && depth === 0) { colon = k; break; }
    }
    return colon === sig.length - 1 ? 'docstring' : '';
  }
  function pyBlocks(src) {
    const spans = pySpans(src), found = [];
    let run = null;
    const flush = () => { if (run) { found.push(run); run = null; } };
    for (const [a, z, kind] of spans) {
      if (kind !== 'comment') continue;
      const line = lineOf(src, a), lineStart = src.lastIndexOf('\n', a - 1) + 1;
      const own = !src.slice(lineStart, a).trim();
      if (own && run && run.own && line === run.end + 1) { run.body += '\n' + src.slice(a + 1, z); run.end = line; continue; }
      flush();
      run = { line, end: line, body: src.slice(a + 1, z), kind: 'comment', own };
      if (!own) flush();
    }
    flush();
    for (const [a, z, kind] of spans) {
      if (kind !== 'string' || !['"""', "'''"].includes(src.slice(a, a + 3))) continue;
      const body = src.slice(a + 3, z - 3);
      if (words(body) < 12) continue;
      const k = docKind(src, a, spans);
      if (!k) continue;
      const line = lineOf(src, a);
      found.push({ line, end: line + (src.slice(a, z).match(/\n/g) || []).length, body, kind: k, own: true, doc: true });
    }
    return found;
  }

  const DELIM = { line: '//', block: '/*', html: '<!--' };
  function jsBlocks(src, ext, display) {
    let found = [];
    if (ext === 'html') {
      for (const m of src.matchAll(/<!--([\s\S]*?)-->/g)) {
        const line = lineOf(src, m.index);
        found.push([line, 'html', m[1], m.index, m.index + m[0].length]);
      }
      const masked = src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
      for (const s of masked.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
        const off = s.index + s[0].indexOf(s[1]);
        found = found.concat(coalesce(jsComments(s[1], lineOf(masked, off)), display).map((c) => [c[0], c[1], c[2], c[3] + off, c[4] + off, c[5]]));
      }
    } else found = coalesce(jsComments(src, 1), display);
    return found.map(([line, k, body, at, to, pre]) => {
      const lineStart = src.lastIndexOf('\n', at - 1) + 1;
      let lineEnd = src.indexOf('\n', to); lineEnd = lineEnd < 0 ? src.length : lineEnd;
      const own = (pre ?? true) && !src.slice(lineStart, at).trim() && !src.slice(to, lineEnd).trim();
      return { line, end: line + (body.match(/\n/g) || []).length, body, kind: 'comment', own, delim: DELIM[k] };
    });
  }

  // python/comment-blocks.py's clean(): the block's words without delimiters
  // or common indent.
  function cleandoc(text) {
    const lines = text.replace(/\t/g, '        ').split('\n');
    let margin = Infinity;
    for (const l of lines.slice(1)) { const s = l.trimStart(); if (s) margin = Math.min(margin, l.length - s.length); }
    const out = [lines[0].trimStart(), ...lines.slice(1).map((l) => (margin < Infinity ? l.slice(margin) : l))];
    while (out.length && !out[out.length - 1].trim()) out.pop();
    while (out.length && !out[0].trim()) out.shift();
    return out.join('\n');
  }
  function clean(body, doc) {
    if (doc) return cleandoc(body);
    let lines = body.split('\n');
    if (lines.length > 1 && lines.slice(1).every((l) => !l.trim() || l.trimStart().startsWith('*'))) {
      lines = [lines[0], ...lines.slice(1).map((l) => l.replace(/^\s*\*( ?)/, ''))];
    }
    if (lines[0].trim() === '*') lines[0] = '';
    return cleandoc(lines.map((l) => l.trimEnd()).join('\n').replace(/^\n+|\n+$/g, ''));
  }

  const PRELUDE = /^\s*(#!.*|['"]use strict['"];?|<!doctype[^>]*>|<\/?(html|head|body)\b[^>]*>|<meta\b[^>]*>|document\.addEventListener\(\s*['"]alpine:init['"].*\{|\(\s*(async\s*)?(function\b.*|\(\)\s*=>)\s*\{|\{)\s*$/i;
  const SHEBANG = /^(!|-\*-|(vim?|coding)[:=])/;
  function blocks(src, ext, o = {}) {
    ext = String(ext || '').toLowerCase();
    const py = ext === 'py';
    const raw = (py ? pyBlocks(src) : ['js', 'mjs', 'cjs', 'html'].includes(ext) ? jsBlocks(src, ext, o.display) : [])
      .filter((b) => keep(b.body) && !(b.line <= 2 && SHEBANG.test(b.body.trim())))
      .sort((a, b) => a.line - b.line);
    const lines = src.split('\n');
    const bodyAt = ext === 'html' ? lines.findIndex((l) => /<body/i.test(l)) + 1 : 0;
    const prelude = (line) => lines.slice(0, line - 1).every((l) => !l.trim() || PRELUDE.test(l));
    const hasModule = py && raw.some((b) => b.kind === 'header');
    return raw.map((b, i) => {
      let kind = b.kind;
      if (!b.doc) kind = i === 0 && !hasModule && (prelude(b.line) || (bodyAt && b.line < bodyAt)) ? 'header' : 'comment';
      return { line: b.line, end: b.end, kind, text: clean(b.body, b.doc), own: b.own, doc: !!b.doc, delim: b.delim };
    });
  }

  function segments(src, ext) {
    const lines = src.split('\n'), out = [];
    let at = 1;
    // A run of nothing but a shebang or an encoding line at the top is not
    // code worth a bar.
    const code = (a, b) => {
      const body = lines.slice(a - 1, b).filter((l) => l.trim());
      if (b < a || !body.length || (a === 1 && body.every((l) => /^#!|^#.*coding[:=]/.test(l.trim())))) return;
      out.push({ t: 'code', a, b });
    };
    for (const b of blocks(src, ext, { display: true })) {
      if (!b.own || b.line < at) continue;
      code(at, b.line - 1);
      let owner = '';
      if (b.kind === 'docstring') {
        for (let k = b.line - 2; k >= Math.max(0, b.line - 16) && !owner; k--) if (/^\s*(async\s+)?(def|class)\b/.test(lines[k])) owner = lines[k].trim();
        for (let k = b.line - 2; k >= 0 && !owner; k--) if (lines[k].trim()) owner = lines[k].trim();
      }
      out.push({ t: 'prose', ...b, owner });
      at = b.end + 1;
    }
    code(at, lines.length);
    return out;
  }

  // ── Prose: the block's words, with its own layout recognized.
  const ind = (l) => l.match(/^\s*/)[0].length;
  function inline(t, mark) {
    return t.split(/(`[^`\n]+`)/).map((p, k) => {
      const code = k % 2 === 1, s = code ? p.slice(1, -1) : p;
      let h = '';
      if (mark) {
        let last = 0;
        mark.lastIndex = 0;
        for (const m of s.matchAll(mark)) {
          if (!m[0]) continue;
          h += esc(s.slice(last, m.index)) + '<mark class="rounded-sm bg-primary/10 text-base-content">' + esc(m[0]) + '</mark>';
          last = m.index + m[0].length;
        }
        h += esc(s.slice(last));
      } else h = esc(s);
      return code ? '<code class="rounded bg-base-200 px-1">' + h + '</code>' : h;
    }).join('');
  }
  function defItems(ls) {
    const i0 = ind(ls[0]);
    let col = 0;
    const m = ls[0].match(/^(\s*\S.{0,40}?)\s{2,}(\S)/);
    if (m) col = m[0].length - 1;
    if (ls.length > 1 && ind(ls[1]) > i0 + 3) col = col && Math.abs(col - ind(ls[1])) <= 1 ? col : ind(ls[1]);
    if (!col) return null;
    const items = [];
    let cur = null;
    // A term longer than the column pushes its first line's text past it,
    // behind a gap of two spaces or more.
    for (const l of ls) {
      const k = ind(l), gap = k < col - 1 ? l.match(/^(\s*)(\S.{0,40}?)\s{2,}(\S.*)$/) : null;
      if (k < col - 1 && l.length > col && /\s/.test(l[col - 1]) && l.slice(k, col).trim()) {
        cur = { term: l.slice(k, col).trim(), paras: [l.slice(col).trim()] };
        items.push(cur);
      } else if (gap && gap[1].length + gap[2].length >= col - 1) {
        cur = { term: gap[2].trim(), paras: [gap[3].trim()] };
        items.push(cur);
      } else if (cur && k >= col - 1) cur.paras[cur.paras.length - 1] += ' ' + l.trim();
      else return null;
    }
    return { col, items };
  }
  const LIST = /^\s*([-*•]|\d+[.)])\s/;
  const CODEY = /^\s*(python3 |node |npm |\$ |[\w.]+\(.*\)\s*$|[\w.]+ = )/;
  function prose(text, mark) {
    const nodes = [];
    for (const p of String(text).replace(/^\s*[─━=]{3,}.*$/gm, '').split(/\n\s*\n/)) {
      let ls = p.split('\n').filter((l) => l.trim());
      if (!ls.length) continue;
      // A title drawn between rules (── Title ─────) is a heading.
      const rule = ls[0].match(/^\s*[─━=-]{2,}\s*(.+?)\s*[─━=-]{2,}\s*$/);
      if (rule) { nodes.push({ t: 'h', text: rule[1] }); ls = ls.slice(1); if (!ls.length) continue; }
      // A line ending in a colon over indented lines heads them: it is a
      // paragraph of its own, and what it introduces is read on its own.
      if (ls.length > 1 && /:\s*$/.test(ls[0]) && ind(ls[1]) > ind(ls[0])) {
        nodes.push({ t: 'p', text: ls[0].trim() });
        ls = ls.slice(1);
      }
      const last = nodes[nodes.length - 1];
      if (last?.t === 'dl' && ls.every((l) => ind(l) >= last.col - 1)) {
        last.items[last.items.length - 1].paras.push(ls.map((l) => l.trim()).join(' '));
        continue;
      }
      const d = ind(ls[0]) < 8 && !LIST.test(ls[0]) ? defItems(ls) : null;
      if (d) { if (last?.t === 'dl') last.items.push(...d.items); else nodes.push({ t: 'dl', ...d }); continue; }
      if (LIST.test(ls[0])) {
        const items = [];
        for (const l of ls) {
          if (LIST.test(l)) items.push(l.replace(LIST, ''));
          else items[items.length - 1] += ' ' + l.trim();
        }
        nodes.push({ t: 'ul', items });
        continue;
      }
      if (ls.every((l) => ind(l) >= 2) && ls.some((l) => CODEY.test(l))) {
        const k = Math.min(...ls.map(ind));
        nodes.push({ t: 'pre', text: ls.map((l) => l.slice(k)).join('\n') });
        continue;
      }
      nodes.push({ t: 'p', text: ls.map((l) => l.trim()).join(' ') });
    }
    return nodes.map((n) => {
      if (n.t === 'h') return '<p class="font-semibold">' + inline(n.text, mark) + '</p>';
      if (n.t === 'p') return '<p>' + inline(n.text, mark) + '</p>';
      if (n.t === 'ul') return '<ul class="list-disc pl-5 flex flex-col gap-0.5">' + n.items.map((i) => '<li>' + inline(i, mark) + '</li>').join('') + '</ul>';
      if (n.t === 'pre') return '<pre class="overflow-x-auto rounded-box bg-base-200/60 px-2 py-1 font-mono text-xs leading-5">' + inline(n.text, mark) + '</pre>';
      return '<dl class="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-[minmax(0,max-content)_minmax(0,1fr)] sm:gap-y-1.5">'
        + n.items.map((it) => '<dt class="text-base-content/60 max-sm:mt-1">' + inline(it.term, mark) + '</dt>'
          + '<dd class="flex flex-col gap-1.5">' + it.paras.map((x) => '<p>' + inline(x, mark) + '</p>').join('') + '</dd>').join('') + '</dl>';
    }).join('');
  }

  const LANG = { py: 'python', js: 'javascript', mjs: 'javascript', cjs: 'javascript', html: 'markup' };
  const MARKER = { py: '#', js: '//', mjs: '//', cjs: '//', html: '<!--' };
  // How much of a file is comment: its blocks, and the share of its
  // non-blank lines that comment blocks hold.
  function stats(src, ext, segs = segments(src, ext)) {
    const lines = src.split('\n'), filled = (a, b) => lines.slice(a - 1, b).filter((l) => l.trim()).length;
    const prose = segs.filter((s) => s.t === 'prose');
    const comment = prose.reduce((n, s) => n + filled(s.line, s.end), 0), total = filled(1, lines.length);
    return { blocks: prose.length, share: total ? Math.round((100 * comment) / total) : 0 };
  }
  function statsHtml(st) {
    return '<span class="inline-flex items-center gap-1 whitespace-nowrap tabular-nums" data-title-tip="Comment blocks"><i class="ph ph-chat-centered-text text-base" aria-hidden="true"></i>'
      + st.blocks + '</span><span class="whitespace-nowrap tabular-nums" data-title-tip="Share of the file\'s non-blank lines that are comments">' + st.share + '%</span>';
  }
  function render(el, src, ext, o = {}) {
    ext = String(ext).toLowerCase();
    const lines = src.split('\n'), segs = segments(src, ext), lang = LANG[ext] || 'none';
    const st = stats(src, ext, segs);
    // A two-column grid: the line number in a gutter, then the comment as a
    // comment (monospace, a rule down its side, its marker under the number)
    // or the code it folds as one faint line.
    const gutter = (n, mark) => '<div class="text-right text-xs leading-[1.375rem] tabular-nums text-base-content/35">' + n
      + (mark ? '<span class="block leading-4 text-primary/60">' + esc(mark) + '</span>' : '') + '</div>';
    const bar = (s) => {
      const body = lines.slice(s.a - 1, s.b), first = body.find((l) => l.trim()) || '', n = s.b - s.a + 1;
      return gutter(s.a) + '<div class="min-w-0" data-cv-cell><button type="button" data-cv-code="' + s.a + '-' + s.b + '" aria-expanded="false"'
        + ' class="flex w-full min-w-0 items-center gap-1.5 text-left text-xs leading-6 text-base-content/40 hover:text-base-content">'
        + '<i class="ph ph-caret-right shrink-0" aria-hidden="true"></i><code class="min-w-0 truncate font-mono">' + esc(first.trim()) + '</code>'
        + (n > 1 ? '<span class="shrink-0 tabular-nums text-base-content/30">+' + (n - 1) + '</span>' : '') + '</button></div>';
    };
    const block = (s) => {
      const tag = s.kind === 'comment' ? '' : '<div class="flex min-w-0 items-baseline gap-2 text-xs text-primary/70"><span class="shrink-0">' + s.kind + '</span>'
        + (s.owner ? '<code class="min-w-0 truncate text-base-content/45">' + esc(s.owner) + '</code>' : '') + '</div>';
      return gutter(s.line, s.doc ? '"""' : s.delim || MARKER[ext]) + '<div class="flex min-w-0 flex-col gap-1.5 border-l-2 border-primary/30 pl-2 font-mono text-[13px] leading-[1.375rem] sm:pl-3 sm:text-sm text-base-content">'
        + tag + prose(s.text, o.mark) + '</div>';
    };
    el.innerHTML = '<div class="flex min-w-0 flex-col gap-2" data-cv>'
      + (o.counts === false ? '' : '<div class="flex items-center gap-3 text-sm text-base-content/50">' + statsHtml(st) + '</div>')
      + '<div class="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-1.5 gap-y-1 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-x-2">' + segs.map((s) => s.t === 'code' ? bar(s) : block(s)).join('') + '</div></div>';
    const open = (btn, on) => {
      const [a, b] = btn.dataset.cvCode.split('-').map(Number);
      btn.setAttribute('aria-expanded', String(on));
      btn.querySelector('i').className = 'ph shrink-0 ' + (on ? 'ph-caret-down' : 'ph-caret-right');
      let pre = btn.nextElementSibling?.matches?.('[data-cv-pre]') ? btn.nextElementSibling : null;
      if (on && !pre) {
        pre = el.ownerDocument.createElement('pre');
        pre.setAttribute('data-cv-pre', '');
        pre.className = '!m-0 !mb-1 overflow-x-auto rounded-box !bg-base-200/50 px-3 py-1.5 text-xs leading-5';
        pre.innerHTML = '<code class="language-' + lang + '">' + esc(lines.slice(a - 1, b).join('\n')) + '</code>';
        btn.after(pre);
        if (el.ownerDocument.defaultView?.Prism) el.ownerDocument.defaultView.Prism.highlightElement(pre.firstChild);
      }
      if (pre) pre.hidden = !on;
    };
    el.onclick = (e) => {
      const btn = e.target.closest('[data-cv-code]');
      if (btn && el.contains(btn)) open(btn, btn.getAttribute('aria-expanded') !== 'true');
    };
    return { marks: el.querySelectorAll('mark').length, ...st };
  }

  window.commentView = { blocks, segments, prose, render, stats, statsHtml };
})();
