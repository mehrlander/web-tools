// The `#gz=` payload, in one place: text gzipped, then base64url, so a page,
// a document or a data envelope rides in a link with nothing hosted and no
// token needed to open it.
//
// The form is the estate's (docs/CONVERSATION.md, "Content in the link"). Until
// 2026-10-20 seventeen pages and components decoded it and nine encoded it,
// each with a copy of its own. They agreed on the format and drifted at the
// edges: six re-padded the base64 and the rest relied on atob forgiving its
// absence, one page decoded through a second gzip library, and none but the
// renderer tolerated whitespace a chat client wraps into a long link. This is
// the one codec, and node/test/gz-payload.test.mjs fails on a new copy.
//
// Encoding emits base64url ('-' and '_', no padding): a fragment value read
// through URLSearchParams turns '+' into a space (kits/url-params.js).
// Decoding accepts both alphabets, padded or not, and whitespace, as
// pages/toss-render.html's decoder does, since links already handed over
// carry every one of those. The renderer keeps that copy on purpose: its
// critical render path loads no lib.
//
// Attaches to window.GzPayload, loaded via gh.load('kits/gz-payload.js').
(() => {
  // The base64 halves are gh-api.js's (GH.toBase64url, GH.decodeBytes), which
  // every page boots first: decodeBytes reads either alphabet, padded or not,
  // with any whitespace.
  const toB64url = (bytes) => window.GH.toBase64url(bytes);
  const fromB64url = (s) => window.GH.decodeBytes(s);

  const gzip = async (text) => new Uint8Array(await new Response(
    new Blob([typeof text === 'string' ? new TextEncoder().encode(text) : text]).stream()
      .pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  const gunzip = async (bytes) => new Response(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();

  const encode = async (text) => toB64url(await gzip(text));
  const decode = async (s) => gunzip(fromB64url(s));
  const encodeJson = async (value) => encode(JSON.stringify(value));
  const decodeJson = async (s) => JSON.parse(await decode(s));

  window.GzPayload = { encode, decode, encodeJson, decodeJson, gzip, gunzip, toB64url, fromB64url };
})();
