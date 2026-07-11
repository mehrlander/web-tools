# Claude Code artifacts

How artifacts work and where they fit among the surfacing links. Distilled
from the [official documentation](https://code.claude.com/docs/en/artifacts)
plus a publish trial run 2026-07-11; the 📦 marker and its siblings are
defined in [CONVENTIONS.md](CONVENTIONS.md). Canonical source
`mehrlander/web-tools` at `docs/artifacts.md`.

## What an artifact is

A single self-contained web page that Claude Code publishes from a session to
a private URL on claude.ai (`claude.ai/code/artifact/{id}`). The page is
static: HTML, CSS, and inline JavaScript only. It is a capture of work, not
an application. There is no backend, so it cannot store form input, call an
API at view time, or serve multiple routes.

## Where it fits: the link-choice matrix

Mark artifact links **📦**, beside ⭐ (canonical hosted view) and 🥏 (toss
render). The chooser is viewer context, not just where the code lives. The
Claude app's in-app browser keeps its own storage, so the `ghToken` a 🥏
`#gh=` toss needs is absent there; the app is already signed in to claude.ai,
which is all an artifact needs.

| Situation | Link |
|---|---|
| Page on main | ⭐ deployed URL |
| Branch work in lib/dist only | ⭐ `?use=<sha>` on the deployed URL |
| Branch or private page; owner in a browser holding the token | 🥏 `#gh=` (live pointer) |
| Branch or private page; owner in the Claude app | 📦 artifact (baked); 🥏 `#gz=` when the page is small and no build is wanted |
| Branch or private page; any other reader | 🥏 `#gz=` (artifacts do not travel on Pro/Max) |

Interactive form of this matrix, itself the publish trial:
<https://claude.ai/code/artifact/f5ee6c4f-5474-4a77-9c3b-8a61b8d87e7c>
(source: [examples/which-link.html](examples/which-link.html); bake and
republish per Publishing below).

## Page constraints

| Constraint | Effect |
|---|---|
| No external requests | Strict CSP blocks external scripts, styles, fonts, images, fetch, XHR, WebSocket. Everything must be inlined; images as data URIs. |
| No backend | Static page only. |
| Single page | Relative links do not resolve; use in-page anchors. |
| File types | `.html`, `.htm`, or `.md` (markdown renders as styled HTML). |
| Size | Rendered page must be 16 MiB or smaller. |

## Publishing (pipeline verified 2026-07-11)

The house CDN stack survives the CSP once baked. The steps:

1. **Author in CDN form** (Tailwind, daisyUI, Alpine, Phosphor). This stays
   the editable source, per the `bake-page` skill (`skills/bake-page/` in the
   canonical repo).
2. **Bake self-contained:**
   `node skills/bake-page/scripts/bake.js in.html out.html`. The trial page
   baked to 83 KB, far under the 16 MiB cap; a headless `file://` load made
   zero external requests and Alpine interactions worked.
3. **Strip to a fragment.** The Artifact tool wraps the file in its own
   doctype/head/body skeleton, so publish page content, not a document: keep
   `<title>` and the `<style>` and `<script>` blocks, drop
   `<!DOCTYPE>`/`<html>`/`<head>`/`<body>`, and move the `<body>` element's
   classes onto a wrapper `<div>` or they are silently lost.
4. **Publish** with a stable favicon and a short version label.

**Theming is free with daisyUI.** The artifact viewer's light/dark toggle
stamps `data-theme="light"` / `data-theme="dark"` on the root element.
Compiled daisyUI emits `[data-theme=light]` and `[data-theme=dark]`
selectors plus a `prefers-color-scheme` default, so the toggle drives daisyUI
themes with no extra work.

## Identity and editing

- The URL is stable. Republishing updates the page in place at the same URL;
  anyone with the page open sees the update.
- Each publish becomes a numbered version. The viewer keeps the version
  history, so publishing is an edit with history, not a blind overwrite.
  Versions can carry short labels.
- Within the session that created it, Claude republishes by rewriting the
  underlying file and publishing the same path again.
- From a different session, Claude must be given the artifact's URL to update
  it. Without the URL, a new session mints a new artifact. Claude can also
  list the account's published artifacts to find a URL it was not handed.
- Concurrent updates from two sessions are conflict-checked rather than
  silently clobbered.

## Persistence and privacy

- Artifacts persist independently of the session that made them. The
  publishing session's container can be reclaimed; the URL keeps working
  until the artifact is deleted.
- Private by default, tied to the claude.ai account, viewable anywhere the
  owner is signed in. Gallery of all published artifacts:
  <https://claude.ai/code/artifacts>
- On Pro and Max plans artifacts stay private to the author; there is no
  share option. On Team and Enterprise plans a Share control grants access
  within the organization only, and viewers can see any published version.
  Viewers can never edit. To give the content to someone outside, share the
  underlying HTML file itself (or send a 🥏 `#gz=` toss).
- Team and Enterprise organizations can set retention policies that
  auto-delete artifacts after a period, so persistence is indefinite by
  default but not guaranteed under org policy.

## Conventions

1. **Repo is the source of record; artifact is the rendered view.** Data and
   tools live in the repo. An artifact presents them. Machine-readable state
   crosses sessions through commits, not artifacts.
2. **Commit the page source when it should be durable.** An artifact's HTML
   file otherwise lives only in the session's scratch space. Committing the
   CDN-form source (like [examples/which-link.html](examples/which-link.html))
   makes the view reproducible and reviewable; the artifact URL is then just
   a deployment of it.
3. **Embedded data is a snapshot.** The CSP means the page cannot read repo
   files live, so numbers are baked in at publish time and go stale when the
   data regenerates. If a page will be long-lived, have a repo tool
   regenerate its embedded data block, then republish.
4. **Record the URL.** A future session can read or update an artifact only
   if it can find the URL, so note it in the relevant README, PR, or task
   file, e.g. `📦 Rendered view: https://claude.ai/code/artifact/{id}
   (regenerate from <source> and republish to the same URL)`.
5. **Cross-session use.** Any later session, in any repo, can be pointed at
   the URL to read the page or publish a new version to it. Nothing notifies
   sessions of changes; a session sees updates only when told to look.

## Requirements worth knowing

Available on Pro, Max, Team, and Enterprise plans, only in sessions signed in
to claude.ai (not API-key sessions). Publishing a new artifact prompts for
permission once; republishing does not prompt again.

One failure mode observed in practice: with a stale claude.ai session, an
artifact you own renders as "Page not found" (claude.ai does not distinguish
missing from unauthorized). Refresh the sign-in before suspecting the link;
the "Sign in" button on the error page is the tell when it appears, but a
stale session can 404 without offering one.
