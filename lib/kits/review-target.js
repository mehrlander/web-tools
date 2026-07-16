// kits/review-target.js — parse and mint the address grammar for the review
// page (pages/review.html). Pure string logic, no DOM, no fetch: the page (and
// anything else that wants to speak the grammar) calls these; unit tests cover
// them via tools/test/bootstrap.mjs loadKit.
//
// The grammar extends the family the repo already speaks — toss-render's
// #gh=owner/repo[@ref]:path address and show-repo's #stage= refs — with a
// comparison base:
//
//   #gh=owner/repo                       whole repo, ref/base resolved later
//   #gh=owner/repo@branch                changeset: base...branch
//   #gh=owner/repo@branch:path/to/file   one file at branch, diffed vs base
//   ...&base=main                        explicit base ref (else default branch)
//
// The ':' before the path is unambiguous because git forbids ':' in ref
// names. Pasted GitHub URLs are accepted too and normalize into the same
// shape: /compare/a...b, /blob/<ref>/<path>, /tree/<ref>, /pull/<n> (returned
// as kind:'pull' for the caller to resolve via the API), and a bare repo URL.
// A blob URL with a slashed branch name is ambiguous (the URL does not mark
// where the ref ends and the path begins); parse takes the first segment as
// the ref, so prefer the #gh= form for slashed branches.
//
// parse(input) -> null | { kind:'ref', repo, ref?, path?, base? }
//              |        { kind:'pull', repo, number }
//   input may be a location.hash ('#gh=...&base=...'), a bare fragment body,
//   a 'gh=...' pair list, a github.com URL, or a bare 'owner/repo[@ref][:path]'.
//
// mint({ repo, ref?, path?, base? }) -> 'gh=owner/repo[@ref][:path][&base=...]'
//   (fragment body only; the caller prefixes '#' and the page URL). Path and
//   refs are encoded per segment with '/' left readable, same policy as
//   show-repo's #stage= links.

(() => {
  const enc = (s) => String(s).split('/').map(encodeURIComponent).join('/');
  const dec = (s) => {
    try { return String(s).split('/').map(decodeURIComponent).join('/'); }
    catch { return String(s); }
  };

  // owner/repo[@ref][:path] — ref may contain slashes; ':' cannot appear in a
  // ref, so the first ':' after the '@' (or after the repo) starts the path.
  function parseSpec(spec) {
    const m = String(spec).match(/^([^/@:\s]+\/[^/@:\s]+)(?:@([^:]+))?(?::(.+))?$/);
    if (!m) return null;
    const out = { kind: 'ref', repo: m[1] };
    if (m[2]) out.ref = dec(m[2]);
    if (m[3]) out.path = dec(m[3]);
    return out;
  }

  function parseGithubUrl(u) {
    const seg = u.pathname.split('/').filter(Boolean).map(s => {
      try { return decodeURIComponent(s); } catch { return s; }
    });
    if (seg.length < 2) return null;
    const repo = seg[0] + '/' + seg[1];
    const rest = seg.slice(2);
    if (!rest.length) return { kind: 'ref', repo };
    const [verb, ...tail] = rest;
    if (verb === 'pull' && /^\d+$/.test(tail[0] || '')) {
      return { kind: 'pull', repo, number: Number(tail[0]) };
    }
    if (verb === 'compare' && tail.length) {
      const m = tail.join('/').match(/^(.+?)\.{2,3}(.+)$/);
      if (m) return { kind: 'ref', repo, base: m[1], ref: m[2] };
      return null;
    }
    if ((verb === 'blob' || verb === 'raw') && tail.length >= 2) {
      // Ambiguous when the branch name contains '/'; first segment wins.
      return { kind: 'ref', repo, ref: tail[0], path: tail.slice(1).join('/') };
    }
    if (verb === 'tree' && tail.length) {
      return { kind: 'ref', repo, ref: tail.join('/') };
    }
    if (verb === 'commits' && tail.length) {
      return { kind: 'ref', repo, ref: tail.join('/') };
    }
    return { kind: 'ref', repo };
  }

  function parse(input) {
    let s = String(input || '').trim();
    if (!s) return null;

    // Full URL: github.com normalizes into the grammar; a review-page URL
    // recurses on its own fragment/query.
    if (/^https?:\/\//i.test(s)) {
      let u;
      try { u = new URL(s); } catch { return null; }
      if (u.hostname === 'github.com' || u.hostname === 'www.github.com') return parseGithubUrl(u);
      if (u.hash && u.hash.includes('gh=')) return parse(u.hash);
      if (u.search && u.search.includes('gh=')) return parse(u.search);
      return null;
    }

    s = s.replace(/^[#?]/, '');

    // Pair-list form: gh=<spec>&base=<ref>&... (order-independent). Split by
    // hand rather than URLSearchParams: that class would decode a second time
    // (parseSpec/dec already decode) and turns '+' into a space, corrupting
    // paths that contain either.
    if (/(^|&)gh=/.test(s)) {
      let spec = null, base = null;
      for (const part of s.split('&')) {
        const i = part.indexOf('=');
        if (i < 0) continue;
        const k = part.slice(0, i), v = part.slice(i + 1);
        if (k === 'gh') spec = v;
        else if (k === 'base') base = v;
      }
      if (!spec) return null;
      const out = parseSpec(spec);
      if (!out) return null;
      if (base) out.base = dec(base);
      return out;
    }

    // Bare spec: owner/repo[@ref][:path]
    return parseSpec(s);
  }

  function mint(t) {
    if (!t || !t.repo) return '';
    let s = 'gh=' + t.repo;
    if (t.ref) s += '@' + enc(t.ref);
    if (t.path) s += ':' + enc(t.path);
    if (t.base) s += '&base=' + enc(t.base);
    return s;
  }

  window.reviewTarget = { parse, mint };
})();
