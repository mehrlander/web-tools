# wsldocs.sos.wa.gov

The Washington State Library's document repository, run by the Secretary of
State. It holds state agency publications past the point where the agency's own
site drops them: DRS keeps its last five financial reports and its
[Chapter 15 page](https://www.drs.wa.gov/employer/ch15/) sends the rest here, and
the parallel OFM index on this host spans 2000 to 2017.

**The host's one governing fact: it is behind a Cloudflare interstitial.** Any
client that does not run the interstitial's JavaScript gets a 403 page titled
"Just a moment...": a Claude Code web session's `curl` and WebFetch, the
sandbox's headless Chromium, and a command-line fetch from the home laptop
(measured 2026-10-13 and 2026-10-14). The block follows the client, not the
network: a browser navigating normally passes it, including one an agent drives
headed on the laptop (Microsoft Edge with a temporary profile, over its
remote-debugging connection). Everything here therefore runs **on the page** in
a real browser, yours or the laptop's, and nothing here should be written as
though a session could fetch this host.

The interstitial sends `Cross-Origin-Opener-Policy: same-origin`; the real page
behind it sends none (observed 2026-10-14). So once the check has passed, the
courier's popup at a Web Tools address keeps its link with the page
([which route reaches a page](../../bookmarklets/README.md#which-route-reaches-a-page)).

The documents the index links to are on `digitalarchives.wa.gov`, which a
session fetches directly. The index uses two link shapes for them,
`ViewRecordMedia.aspx?RID=<id>` and, for FY2011 and FY2012,
`Record/ViewMedia/<id>` with no file extension; both redirect to the PDF, and
`list-cafr.js` keeps both. The collected index, FY2002 to FY2020, is
web-tools-private `courier/results/wsl-drs-cafr-index.md`.

## Contents

- `courier/list-cafr.js`: the [courier](../../courier/README.md) errand
  `wsl-drs-cafr-index`. Collects every document link on the index and returns it
  as a table.

### Why that script is terse, and what its columns are for

An errand script is read on the errand card before it runs and carries no
comments (the courier's rule), so the reasoning goes here. Three decisions are
in the code without saying so:

| In the script | Why |
| --- | --- |
| a **per-host count** in the header | which host the documents sit on decides whether a session can fetch them itself. The neighbouring `digitalarchives.wa.gov` answers a session fine; this host does not, so the count is the finding the caller is waiting on. |
| the **year** pulled from link text first, URL second | the caller addresses reports by fiscal year, and the page states one in prose more reliably than in a filename. |
| an empty result **reports its anchor and frame counts** | a page that yields nothing should say why. Zero anchors means the links are built after load; frames above zero means they live in a child document. Silence would send the caller back to guessing. |
