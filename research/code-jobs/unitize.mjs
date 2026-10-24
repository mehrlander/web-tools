// Split source files into function units for the code-jobs pilot.
//
//   node research/code-jobs/unitize.mjs <out.jsonl> <file>...
//
// A unit is a function of five or more lines. Each nested function of five or
// more lines is cut out of its parent and replaced by a one-line stub naming it,
// so a component's own unit is its glue rather than everything it contains.
// What sits outside every function (constants, templates, top-level calls) is
// one more unit per block, named "(top level)", so every line of code belongs
// to exactly one unit. Inline <script> blocks of an HTML page are read with
// their line offsets. A unit longer than PART_LINES is split into parts rather
// than cut short, since a template's markup can sit far down a long function.
// `sha` hashes a part's text, so a later run can skip a part that has not
// changed.
//
// Code held in a string literal (a worker body, an emitted recipe) is not a
// function to the parser, so it stays inside the unit that builds the string.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as acorn from 'acorn';

const MIN_LINES = 5;
const PART_LINES = 150;

const parse = (src) => {
  for (const sourceType of ['script', 'module']) {
    try {
      return acorn.parse(src, {
        ecmaVersion: 'latest', sourceType, locations: true,
        allowHashBang: true, allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
      });
    } catch {}
  }
  return null;
};

// One {code, line} per parseable block: the file itself, or a page's inline scripts.
const blocks = (file, text) => {
  if (!file.endsWith('.html')) return [{ code: text, line: 1 }];
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(text))) {
    if (/\bsrc\s*=/.test(m[1]) || /type\s*=\s*["'](?!module|text\/javascript)/i.test(m[1])) continue;
    const before = text.slice(0, m.index + m[0].indexOf('>') + 1);
    out.push({ code: m[2], line: before.split('\n').length });
  }
  return out;
};

const isFn = (n) => /Function/.test(n?.type || '');
const span = (n) => n.loc.end.line - n.loc.start.line + 1;

const keyName = (k) => k?.type === 'Identifier' ? k.name : k?.type === 'Literal' ? String(k.value) : null;
const lastProp = (e) => e?.type === 'MemberExpression' ? keyName(e.property) : e?.type === 'Identifier' ? e.name : null;

// The name a function is known by, read from where it sits.
const nameOf = (fn, parent) => {
  if (fn.id?.name) return fn.id.name;
  if (!parent) return null;
  if (parent.type === 'MethodDefinition' || parent.type === 'Property' || parent.type === 'PropertyDefinition') return keyName(parent.key);
  if (parent.type === 'VariableDeclarator') return parent.id?.name || null;
  if (parent.type === 'AssignmentExpression') return lastProp(parent.left);
  if (parent.type === 'CallExpression') {
    const callee = lastProp(parent.callee) || 'call';
    const label = parent.arguments.find((a) => a.type === 'Literal' && typeof a.value === 'string');
    return label ? `${callee}(${label.value})` : `${callee}(…)`;
  }
  return null;
};

function unitsOf(file, text) {
  const units = [];
  for (const { code, line: base } of blocks(file, text)) {
    const ast = parse(code);
    if (!ast) { units.push({ file, error: `unparsed block at line ${base}` }); continue; }
    const fns = [];
    // Walk with a parent pointer and the chain of enclosing unit names.
    (function visit(n, parent, chain, owner) {
      if (!n || typeof n.type !== 'string') return;
      let nextChain = chain, nextOwner = owner;
      if (isFn(n) && span(n) >= MIN_LINES) {
        const name = nameOf(n, parent) || `anonymous@${n.loc.start.line + base - 1}`;
        const rec = { node: n, name: [...chain, name].join(' > '), owner, kids: [] };
        if (owner) owner.kids.push(rec);
        fns.push(rec);
        nextChain = [...chain, name];
        nextOwner = rec;
      }
      for (const k in n) {
        if (k === 'loc' || k === 'start' || k === 'end') continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach((c) => visit(c, n, nextChain, nextOwner));
        else if (v && typeof v.type === 'string') visit(v, n, nextChain, nextOwner);
      }
    })(ast, null, [], null);

    // Cut the direct children out of [from, to) and stub each one.
    const cut = (from, to, kids) => {
      let own = '', at = from;
      for (const kid of kids) {
        own += code.slice(at, kid.node.start);
        const s = kid.node.loc.start.line + base - 1, e = kid.node.loc.end.line + base - 1;
        own += `/* nested: ${kid.name.split(' > ').pop()}, lines ${s}-${e} */`;
        at = kid.node.end;
      }
      return own + code.slice(at, to);
    };
    const emit = (name, start, end, own, total, nested) => {
      const lines = own.split('\n');
      const parts = Math.ceil(lines.length / PART_LINES);
      for (let k = 0; k < parts; k++) {
        const text = lines.slice(k * PART_LINES, (k + 1) * PART_LINES).join('\n');
        units.push({
          id: parts > 1 ? `${file}:${start}#${k + 1}` : `${file}:${start}`,
          file, start, end, name: parts > 1 ? `${name} (part ${k + 1} of ${parts})` : name,
          lines: total, own_lines: lines.length, nested,
          sha: crypto.createHash('sha256').update(text).digest('hex').slice(0, 12),
          text,
        });
      }
    };
    for (const f of fns) {
      const { node } = f;
      const own = cut(node.start, node.end, f.kids);
      // A wrapper whose whole body is one nested function starting on its own
      // line (`x => list.forEach(...)`) is a single line once that function is
      // cut out: it says nothing, and it would share the inner unit's id. The
      // 2026-10-24 batches predate this rule and carry six such wrappers.
      if (!own.includes('\n')) continue;
      emit(f.name, node.loc.start.line + base - 1, node.loc.end.line + base - 1,
        own, span(node), f.kids.length);
    }
    const tops = fns.filter((f) => !f.owner);
    const top = cut(0, code.length, tops);
    if (top.split('\n').filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l)).length >= MIN_LINES)
      emit('(top level)', base, base + code.split('\n').length - 1, top, code.split('\n').length, tops.length);
  }
  return units;
}

const [out, ...files] = process.argv.slice(2);
const all = files.flatMap((f) => unitsOf(f, fs.readFileSync(f, 'utf8')));
fs.writeFileSync(out, all.map((u) => JSON.stringify(u)).join('\n') + '\n');
const ok = all.filter((u) => !u.error);
const byFile = {};
for (const u of ok) byFile[u.file] = (byFile[u.file] || 0) + 1;
console.log(JSON.stringify({ units: ok.length, errors: all.filter((u) => u.error), byFile }, null, 1));
