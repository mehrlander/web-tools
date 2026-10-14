# wsldocs.sos.wa.gov

The Washington State Library's document repository, run by the Secretary of
State. It holds state agency publications past the point where the agency's own
site drops them: DRS keeps its last five financial reports and its
[Chapter 15 page](https://www.drs.wa.gov/employer/ch15/) sends the rest here, and
the parallel OFM index on this host spans 2000 to 2017.

**The host's one governing fact: it is behind a Cloudflare interstitial.** Any
client that does not run the interstitial's JavaScript gets a 403 page titled
"Just a moment...": a Claude Code web session's `curl` and WebFetch, host-wide,
the sandbox's headless Chromium (measured 2026-10-13), and a command-line fetch
from the home laptop through the Gemini daemon (errand
`daemon-2026-10-14-ask-a2701b`). The block follows the client, not the network,
so the daemon is no route here either. A browser navigating normally passes it
without noticing. Everything here therefore runs **on the page**, in your
browser, and nothing here should be written as though a session could fetch this
host.

The interstitial sends `Cross-Origin-Opener-Policy: same-origin`. Whether the
real page behind it does is not known. If it does, the courier's popup at a Web
Tools address opens but cannot read or message the page
([`bookmarklets/README.md`](../../bookmarklets/README.md#where-bookmarklets-fit)),
and `wsl-drs-cafr-index` needs another route.

## Contents

- `courier/list-cafr.js`: the [courier](../../courier/README.md) errand
  `wsl-drs-cafr-index`. Collects every document link on the index and returns it
  as a table.

### Why that script is terse, and what its columns are for

An errand script is read in the courier's confirm panel before it runs, so the
reasoning goes here and the file stays short enough to take in at a glance. The
panel also drops a script's leading comment banner, which is why one worth
reading is a pointer rather than an essay.

Three decisions are in the code without saying so:

| In the script | Why |
| --- | --- |
| a **per-host count** in the header | which host the documents sit on decides whether a session can fetch them itself. The neighbouring `digitalarchives.wa.gov` answers a session fine; this host does not, so the count is the finding the caller is waiting on. |
| the **year** pulled from link text first, URL second | the caller addresses reports by fiscal year, and the page states one in prose more reliably than in a filename. |
| an empty result **reports its anchor and frame counts** | a page that yields nothing should say why. Zero anchors means the links are built after load; frames above zero means they live in a child document. Silence would send the caller back to guessing. |
