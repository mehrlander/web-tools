/**
 * tokenize.js
 *
 * Stage 1 of the Wring pipeline for general text: segment a document into a
 * token stream that grammar induction (Stage 2) operates on. This defines the
 * alphabet, the granularity at which repeats and slots are discovered.
 *
 * Every tokenizer here is LOSSLESS: `tokenize(text, mode).join('') === text`.
 * That property is what lets the pipeline reconstruct the original document
 * exactly, including whitespace.
 *
 * Dependency-free; runs in Node and the browser.
 */

/**
 * @param {string} text
 * @param {'punct'|'word'|'char'|'line'} [mode='punct']
 *   - 'punct': runs of letters, runs of digits, runs of whitespace, and each
 *     other character individually. Balanced default: fields stay whole, but
 *     punctuation becomes its own boundary. Recommended for logs/structured text.
 *   - 'word':  runs of non-whitespace and runs of whitespace.
 *   - 'char':  every character.
 *   - 'line':  each line including its trailing newline.
 * @returns {string[]} Tokens; concatenating them reproduces `text` exactly.
 */
export function tokenize(text, mode = 'punct') {
  switch (mode) {
    case 'char':
      return [...text];
    case 'word':
      return text.match(/\S+|\s+/g) || [];
    case 'line':
      return text.match(/[^\n]*\n|[^\n]+$/g) || [];
    case 'punct':
    default:
      return text.match(/[A-Za-z]+|[0-9]+|\s+|[^A-Za-z0-9\s]/g) || [];
  }
}

// ─── Node.js / browser compatibility ────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tokenize };
}
