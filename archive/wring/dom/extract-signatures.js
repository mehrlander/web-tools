/**
 * extract-signatures.js
 *
 * The DOM segmenter, Stage 1 of the Wring pipeline (ARCHITECTURE.md), for the
 * HTML use case. Turns raw HTML into the dot-delimited `tag#id.class.class`
 * signature strings that groupByTemplate (Stage 3) consumes.
 *
 * This is what makes the DOM path end-to-end: instead of hand-collecting
 * element signatures, you hand it a real document and it emits the segment
 * stream. It is one concrete *segmenter*; any function producing `string[]`
 * can feed Stage 3. A future general-text front-end (Tokenize → Sequitur)
 * would be a different segmenter feeding the same Stage 3.
 *
 * Dependency-free. Runs in Node and the browser. The HTML scan is tag-level
 * (regex over start tags), not a full parse: it is robust enough to extract
 * element signatures from real-world markup, but it does not build a tree and
 * does not execute scripts. In the browser, `extractSignaturesFromNodes` can
 * take a live DOM / DOMParser result for exact parsing instead.
 *
 * Signature format (matches the existing test corpus):
 *   tag                      e.g. "div"
 *   tag#id                   e.g. "div#root"
 *   tag.class.class          e.g. "button.font-base-bold.rounded-l-lg"
 *   tag#id.class.class       e.g. "div#main-content.w-full.relative"
 *
 * Classes keep their source order. Note that a class containing a "." (such as
 * Tailwind's `border-y-0.5`) will be fragmented by Stage 3's `.` split, but it
 * round-trips faithfully because Stage 3 is string-in / string-out.
 */

// ─── Public API ─────────────────────────────────────────────────────────────

const DEFAULT_SKIP_TAGS = new Set([
  'script', 'style', 'head', 'meta', 'link', 'title', 'base', 'noscript',
]);

/**
 * Extract DOM signatures from a raw HTML string.
 *
 * @param {string} html - Raw HTML source.
 * @param {Object} [options]
 * @param {boolean}       [options.requireClassOrId=true] - Skip elements with no class or id.
 * @param {boolean}       [options.includeId=true]        - Include `#id` in the signature.
 * @param {boolean}       [options.dedupe=false]          - Collapse identical signatures (first-seen order).
 * @param {Set<string>|string[]} [options.skipTags]       - Tag names to ignore (lowercased).
 * @param {Set<string>|string[]} [options.onlyTags]       - If set, only these tag names are emitted.
 * @returns {string[]} Signatures in document order.
 */
export function extractSignatures(html, options = {}) {
  const {
    requireClassOrId = true,
    includeId = true,
    dedupe = false,
    skipTags = DEFAULT_SKIP_TAGS,
    onlyTags = null,
  } = options;

  const skip = skipTags instanceof Set ? skipTags : new Set(skipTags);
  const only = onlyTags ? (onlyTags instanceof Set ? onlyTags : new Set(onlyTags)) : null;

  const out = [];
  const seen = dedupe ? new Set() : null;

  for (const el of scanStartTags(html)) {
    const tag = el.tag;
    if (skip.has(tag)) continue;
    if (only && !only.has(tag)) continue;

    const id = includeId ? getAttr(el.attrs, 'id') : null;
    const classes = splitClasses(getAttr(el.attrs, 'class'));

    if (requireClassOrId && !id && classes.length === 0) continue;

    const sig = buildSignature(tag, id, classes);
    if (seen) {
      if (seen.has(sig)) continue;
      seen.add(sig);
    }
    out.push(sig);
  }

  return out;
}

/**
 * Extract signatures from a live DOM tree (browser / DOMParser). Exact parsing,
 * no regex. Walks `root` and all descendant elements.
 *
 * @param {Element|Document} root - A DOM element or document to walk.
 * @param {Object} [options] - Same shape as {@link extractSignatures}.
 * @returns {string[]} Signatures in document order.
 */
export function extractSignaturesFromNodes(root, options = {}) {
  const {
    requireClassOrId = true,
    includeId = true,
    dedupe = false,
    skipTags = DEFAULT_SKIP_TAGS,
    onlyTags = null,
  } = options;

  const skip = skipTags instanceof Set ? skipTags : new Set(skipTags);
  const only = onlyTags ? (onlyTags instanceof Set ? onlyTags : new Set(onlyTags)) : null;

  const out = [];
  const seen = dedupe ? new Set() : null;
  const elements = root.querySelectorAll ? root.querySelectorAll('*') : [];

  for (const node of elements) {
    const tag = node.tagName.toLowerCase();
    if (skip.has(tag)) continue;
    if (only && !only.has(tag)) continue;

    const id = includeId && node.id ? node.id : null;
    // classList preserves source order; className may be an SVGAnimatedString.
    const classes = node.classList
      ? [...node.classList]
      : splitClasses(typeof node.className === 'string' ? node.className : '');

    if (requireClassOrId && !id && classes.length === 0) continue;

    const sig = buildSignature(tag, id, classes);
    if (seen) {
      if (seen.has(sig)) continue;
      seen.add(sig);
    }
    out.push(sig);
  }

  return out;
}

/**
 * Tally identical signatures into frequency counts, most frequent first.
 *
 * @param {string[]} signatures
 * @returns {{ signature: string, count: number }[]}
 */
export function countSignatures(signatures) {
  const counts = new Map();
  for (const s of signatures) counts.set(s, (counts.get(s) || 0) + 1);
  return [...counts.entries()]
    .map(([signature, count]) => ({ signature, count }))
    .sort((a, b) => b.count - a.count);
}


// ─── Tag scanning ───────────────────────────────────────────────────────────

// Matches a start tag, capturing the tag name and its raw attribute region.
// The attribute alternation `[^>"']` | "..." | '...' lets quoted attribute
// values legally contain ">" without prematurely ending the tag. Closing tags
// (</x>), comments (<!-- -->) and doctypes (<!...>) are not matched because the
// char after "<" must be a letter.
const START_TAG_RE = /<([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

/**
 * Iterate start tags in an HTML string, yielding { tag, attrs }.
 * @param {string} html
 * @returns {Generator<{ tag: string, attrs: string }>}
 */
function* scanStartTags(html) {
  START_TAG_RE.lastIndex = 0;
  let m;
  while ((m = START_TAG_RE.exec(html)) !== null) {
    yield { tag: m[1].toLowerCase(), attrs: m[2] };
  }
}

/**
 * Read a named attribute's value from a tag's raw attribute region.
 * Handles double-quoted, single-quoted, and unquoted values.
 * @returns {string|null}
 */
function getAttr(attrText, name) {
  if (!attrText) return null;
  const re = new RegExp(
    '(?:^|\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s"\'>]+))',
    'i',
  );
  const m = re.exec(attrText);
  if (!m) return null;
  return m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3];
}

/** Split a class attribute value into ordered class tokens. */
function splitClasses(classAttr) {
  if (!classAttr) return [];
  return classAttr.trim().split(/\s+/).filter(Boolean);
}

/** Assemble a signature string from its parts. */
function buildSignature(tag, id, classes) {
  let sig = tag;
  if (id) sig += '#' + id;
  for (const c of classes) sig += '.' + c;
  return sig;
}


// ─── Node.js / browser compatibility ────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractSignatures,
    extractSignaturesFromNodes,
    countSignatures,
  };
}
