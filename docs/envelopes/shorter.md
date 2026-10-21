# Shorter: the payload contract

⭐ [pages/shorter.html](https://mehrlander.github.io/web-tools/pages/shorter.html) compares a text with a shorter version of it. It word-diffs the two and shows each difference as an edit, accepted by default; you reject the cuts that went too far, rewrite or regenerate a span, and copy the result. An optional in-browser model (Llama-3.2-1B through web-llm, which needs WebGPU) drafts a shorter version or rewrites a span, and nothing is fetched from huggingface.co until a ✨ action is pressed, so review works without it.

## Delivery

First match wins:

| channel | form | use when |
| --- | --- | --- |
| `#shorter=<spec>` | the toss route: `…/toss-render.html#shorter=<owner>/<repo>[@<ref>]:<path>` | the shortest link to a committed document; resolves into this page's `?src=` |
| `?src=<spec>` | fetched through the GitHub contents API; a plain path is this repo, or `owner/repo[@ref]:path` | reaching the page directly |
| `#gz=<base64url>` | gzipped text or envelope in the fragment | a draft with no committed home, or a completed pair; private-safe, since the fragment never reaches a server |
| (none) | the empty form | pasting both sides by hand |

Each key is also read from the other half of the URL ([`lib/kits/url-params.js`](../../lib/kits/url-params.js)), so `?gz=` and `#src=` work too, but keep text in the fragment: GitHub Pages rejects a query string over about 8KB.

## Two shapes, no declaration

[`lib/kits/shorter-payload.js`](../../lib/kits/shorter-payload.js) decides what a payload is rather than asking:

**Bare** is any text. It fills the original column and leaves the shorter one empty, so the page opens on its input form. Bare text is the common case and needs no envelope.

**Envelope** is a JSON object carrying `original` and, optionally, `proposal`. Use it for a shortening someone already produced, so the link opens straight into review.

```jsonc
{
  "kind": "shorter/1",      // optional; settles an ambiguous payload outright
  "title": "Constellation architecture",
  "original": "The full text, at its original length…",
  "proposal": "The shorter version to adjudicate against it…"
}
```

[`pages/audit-render.html`](https://mehrlander.github.io/web-tools/pages/audit-render.html) produces one: its **adjudicate** link hands a document and its audited version over as `#gz=`.

Without `proposal`, an envelope opens like bare text, with its title set. Neither side is validated past being a string, and an empty proposal offers **Draft a shorter version** rather than an error. A payload fetched from an address takes its title from the file's path when it carries none.

**The discriminator is narrow on purpose.** Some text being shortened is JSON. An object counts as an envelope only when it declares `kind: "shorter/1"` or carries a string `original`, so a config file that merely parses is read as bare text. [`lib/kits/data-payload.js`](../../lib/kits/data-payload.js) is narrow for the same reason.

## Contract notes

- The page keeps no state between loads and writes nothing to a repo: a link or a paste is the whole input, and the result leaves by **Copy result**.
- A private `?src=` needs the viewer's stored token. GitHub answers 404, not 401, for a private file fetched without one, so the page reports the failure inline rather than showing an empty form.
