// kits/md-unwrap.js — join hard-wrapped markdown lines into one line per paragraph.
//
// Markdown written at a fixed width puts a newline every 72 or 80 characters,
// and inside a paragraph that newline is a SOFT break: CommonMark renders it as
// a space. So joining those lines changes the source and not the rendered
// document, which is what makes this a rule and not a judgment. The work is
// telling a soft break from one that carries structure, and every structure
// that could be damaged is listed below and left as written.
//
// Joined: a line with text onto the line before it, when that line is a
// paragraph line or a list item's text, and neither is one of the kept kinds.
//
// Kept exactly, and never joined to or from:
//   frontmatter            a leading --- block
//   fenced code            ``` or ~~~, to the matching fence
//   indented code          4+ spaces or a tab after a blank line, outside a list
//   HTML blocks            a line opening with a tag or <!--, to the next blank
//                          line (or to --> for a comment)
//   headings               # lines, and a setext underline (=== or ---)
//   tables                 a header row, its delimiter row, and the rows after
//   block quotes           > lines, left alone rather than joined inside
//   rules                  ***, ---, ___
//   reference definitions  [label]: target, which covers [//]: # (comments)
//
// A break that falls inside an inline code span (an odd count of backticks so
// far in the paragraph) is left alone: CommonMark turns it into a space and then
// strips a space from each end of the span, so a join there can move one.
//
// A list marker line starts a new item, and an indented line under it joins
// that item. A line ending in two spaces or a backslash is a HARD break: the
// next line is not joined to it, though lines after that may join the next.
//
// Exposed as window.mdUnwrap.unwrap(text) -> { text, joined }, joined being the
// number of line breaks removed.

(() => {
  const FENCE = /^ {0,3}(`{3,}|~{3,})/;
  const HEADING = /^ {0,3}#{1,6}(\s|$)/;
  const RULE = /^ {0,3}([-*_])(\s*\1){2,}\s*$/;
  const SETEXT = /^ {0,3}(=+|-+)\s*$/;
  const QUOTE = /^ {0,3}>/;
  const LIST = /^\s*([-*+]|\d{1,9}[.)])(\s+|$)/;
  const HTML = /^ {0,3}<(\/?[A-Za-z][\w-]*[\s>/]|\/?[A-Za-z][\w-]*$|!--)/;
  const REFDEF = /^ {0,3}\[[^\]]+\]:/;
  const DELIM = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
  const HARD = /( {2,}|\\)$/;
  const indentOf = (s) => {
    let n = 0;
    for (const c of s) { if (c === ' ') n++; else if (c === '\t') n += 4 - (n % 4); else break; }
    return n;
  };

  const unwrap = (input) => {
    const src = String(input ?? '');
    const nl = src.includes('\r\n') ? '\r\n' : '\n';
    const lines = src.split(/\r?\n/);

    // Table rows, found first: a row is only recognizable as one by the
    // delimiter row under the header, which a single forward pass sees late.
    const table = new Set();
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].includes('|') || !DELIM.test(lines[i]) || !lines[i - 1].includes('|')) continue;
      table.add(i - 1);
      for (let j = i; j < lines.length && lines[j].trim(); j++) table.add(j);
    }

    const out = [];
    let open = -1;          // out index of the line that accepts a join, or -1
    let openHard = false;   // that line ends in a hard break
    let fence = null;       // the opening fence run while inside one
    let html = null;        // 'blank' or 'comment' while inside an HTML block
    let list = false;       // an indented line after a blank continues a list
    let ticks = 0;          // backticks so far in the open paragraph
    let joined = 0;
    const keep = (line) => { out.push(line); open = -1; };
    const tickCount = (l) => (l.replace(/\\`/g, '').match(/`/g) || []).length;

    let i = 0;
    if (/^---\s*$/.test(lines[0] || '')) {
      const end = lines.findIndex((l, k) => k > 0 && /^(---|\.\.\.)\s*$/.test(l));
      if (end > 0) { for (; i <= end; i++) out.push(lines[i]); }
    }

    for (; i < lines.length; i++) {
      const line = lines[i];
      const blank = !line.trim();

      if (fence) {
        out.push(line);
        const m = FENCE.exec(line);
        if (m && m[1][0] === fence[0] && m[1].length >= fence.length && !line.slice(m[0].length).trim()) fence = null;
        continue;
      }
      if (html) {
        out.push(line);
        if (html === 'comment' ? line.includes('-->') : blank) html = null;
        continue;
      }
      if (blank) {
        out.push(line); open = -1;
        continue;
      }

      const m = FENCE.exec(line);
      if (m) { keep(line); fence = m[1]; continue; }
      if (HTML.test(line)) {
        keep(line);
        if (/^ {0,3}<!--/.test(line)) { if (!line.includes('-->')) html = 'comment'; }
        else html = 'blank';
        continue;
      }
      if (table.has(i) || HEADING.test(line) || QUOTE.test(line) || REFDEF.test(line)) { keep(line); list = false; continue; }
      if (open >= 0 && SETEXT.test(line)) { keep(line); continue; }
      if (RULE.test(line)) { keep(line); list = false; continue; }
      if (LIST.test(line)) {
        out.push(line); open = out.length - 1; openHard = HARD.test(line); list = true;
        ticks = tickCount(line);
        continue;
      }

      const ind = indentOf(line);
      if (open < 0 && ind >= 4 && !list) { keep(line); continue; }   // indented code
      if (ind === 0) list = false;

      if (open >= 0 && !openHard && ticks % 2 === 0) {
        // Left-trimmed only: trailing spaces on this line may be a hard break.
        out[open] = out[open].replace(/\s+$/, '') + ' ' + line.replace(/^\s+/, '');
        joined++;
      } else {
        if (open < 0) ticks = 0;
        out.push(line); open = out.length - 1;
      }
      openHard = HARD.test(line);
      ticks += tickCount(line);
    }

    return { text: out.join(nl), joined };
  };

  window.mdUnwrap = { unwrap };
})();
