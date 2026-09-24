# courier

A deferred read **from a page**, run by you in the browser you already have.

An **errand** is anything a session needs your browser for, and there is one
kind of record for all of them
([`lib/kits/errands.js`](../lib/kits/errands.js)). A courier errand is an errand
whose run block names `method: courier-bookmark`: a script to run on a **web
page a session cannot reach**, answered when you visit that page and tap one
bookmark. The courier is the mechanism; the errand is one job it runs.

Every errand waits on the Stage for a tap; nothing is answered on load. A
session files one as `errands/requests/<id>.json` in the private registry and
hands you `?view=stage&errand=<id>`, which opens the Stage on that errand's
card. The card says in one line whether the errand got what it came for, graded
against its `expect` field, and its one green button completes it. Closing
writes `errands/results/<id>.json`, with a reason required on a decline.

## A courier errand

```json
{
  "id": "wsl-drs-cafr-index",
  "note": "what it collects, and why the session cannot",
  "purpose": "get-data",
  "url": "http://wsldocs.sos.wa.gov/library/docs/drs/cafr_home.aspx",
  "run": {
    "script": "mehrlander/web-tools@main:sites/wsldocs.sos.wa.gov/courier/list-cafr.js",
    "method": "courier-bookmark",
    "venue": "browser",
    "outputType": "text"
  },
  "dest": "mehrlander/web-tools-private@main:courier/results",
  "file": "wsl-drs-cafr-index.md",
  "for": "who is waiting on it"
}
```

`url` is the page you go to, and its hostname is the errand's host. `run.script`
is the exact code, as `owner/repo@ref:path`. `run.outputReturn` is
`courier-message` for this method and is filled in when omitted; the method's
row in [`docs/run-methods.csv`](../docs/run-methods.csv) owns that. `dest` and
`file` say where the result is staged to be sent.

## Why it works where a background fetch does not

CORS is the **server's** decision. A page on `mehrlander.github.io` cannot read
`wsldocs.sos.wa.gov`, because that host sends no
`Access-Control-Allow-Origin`. Nothing in the app can fix that.

Turn the request around and the wall is not there:

| Direction | Verdict |
| --- | --- |
| Web Tools page reads a state website | blocked, no `Access-Control-Allow-Origin` |
| script **on** the state website reads its own host | same-origin, nothing to refuse |
| the state website and a Web Tools window exchange `postMessage` | allowed; each side checks the other's origin |

So the script runs **on the target page**, where you already cleared any
Cloudflare interstitial by navigating like a person. A same-origin `fetch()` from
the script carries the clearance cookie; a sandboxed session gets a 403.

## The route

[`bookmarklets/courier-stage.js`](../bookmarklets/courier-stage.js) is the whole
bookmark. Tapped on a page, it opens the Web Tools Stage as a popup at
`?view=stage&courier=1`, and the two windows talk by `postMessage`:

1. The Stage says `courier-ready` to the window that opened it.
2. The page sends `courier-page`: its URL, title, selection and links.
3. The Stage stages the links as `<host>-<date>-links.md`, and looks for an open
   `courier-bookmark` errand whose host is the **sender's origin**, as the
   browser reports it. The URL in the message is never used to choose.
4. If one exists, the Stage reads its script with your token and sends
   `courier-run`, to that origin only.
5. The page runs the script and sends `courier-ran` with the text it returned.
6. The Stage stages the result under the errand's `file`, aimed at its `dest`,
   and writes nothing until you tap send.

A page with no errand is one send from saved: the links file is aimed at
`web-tools-private` `courier/captures/`.

**No token goes near the visited page.** A bookmarklet's code runs inside the
page's JavaScript context, where a hostile page could wrap `fetch` and read an
Authorization header. Here the token stays in the Stage's window, a realm the
page never executed code in, and the page receives only the one script its own
origin is owed. So the errand list and the scripts can live in the private
registry; nothing about an errand has to be public.

**The window is opened by the bookmark, synchronously.** A popup is permitted
only while the user-gesture token is live, and the first `await` spends it. The
bookmark therefore opens the window before it does anything else.

The Stage hears only the window that opened it, stages what arrives without
sending it, and takes the destination from the errand record, never from a
message. Held by `tools/test/stage-courier.test.mjs`.

## Where it does not work

- **A blocked popup.** The bookmark alerts and stops; allow popups for the site.
- **A site that sends `Cross-Origin-Opener-Policy`** cuts the link between the
  windows, and nothing arrives.
- **A Content Security Policy that forbids `eval`** refuses the script, which
  runs through `new Function`. The page's links still arrive.

Until 2026-09-24 a second, tokenless route (`bookmarklets/courier.js` reading a
public `courier/errands.json`) covered the first two cases. It was retired when
errands moved to one private folder, since it needed the list and the scripts
to be public. No page in use has needed it; if one does, a deliberately public
errand is the way back, not a standing public list.

## An errand script

The body of a function called with one argument, `ctx` (`{errand}`), returning a
string or a promise of one. It **reads and returns**: it does not navigate,
submit a form, or write. That is a rule about what belongs here rather than a
sandbox, since the script has the page's full authority while it runs; the
protection is that you read it on the errand card before it runs, which is the
Proposals rule ("show the bytes, not a description of them") applied to code.

Two habits earn their place. Report the shape of what was found, not only the
findings, since the caller cannot see the page: the DRS script returns a count
of links per host, which is what decides whether the session can fetch the
documents itself. And **make an empty result diagnostic**: a page that yields
nothing should say how many anchors and frames it had, so "the links are built
after load" and "the links are in a child document" arrive as answers rather
than as silence.

Scripts live at `sites/<hostname>/courier/<id>.js`, in whichever repo the
errand's `run.script` names.

## What it is not for

A page you can read from a session already. A file behind a login you would not
otherwise open. Anything where the honest answer is to download it and hand it
over, which for a few large binaries is faster than any mechanism here: bulk
PDFs want the Stage's upload intake instead.

## Testing an errand before it ships

The sandbox browser cannot reach external hosts, so the exchange is exercised in
jsdom (`tools/test/stage-courier.test.mjs`) with the registry reads stubbed. Run
the errand script alone against a saved copy of the page first, then the
courier end to end in a real browser.
