---
name: wayback
description: Read the Internet Archive's Wayback Machine for pages a site no longer serves or never listed, by enumerating its captures under an address and reading them. Use when the user wants past versions of a page, postings or documents a site has taken down, everything the archive holds under a path, or says "wayback", "Internet Archive", "archive.org", "archived copy", or "what did the site say in 2019".
---

# Wayback

## Premise

The Wayback Machine holds pages their sites no longer serve, and its index lists every capture under an address prefix, so a whole path can be enumerated without search calls. Most Claude Code cloud sandboxes are refused `web.archive.org`; the home laptop and GitHub-hosted runners reach it.

## Goal and output

A list of captures for the addresses in question, then the captures read: each page as the archive served it, and what was parsed from it.

## Process

1. **Probe.** From the machine that will do the work:
   `curl -s -o /dev/null -w "%{http_code}\n" --max-time 20 "https://web.archive.org/cdx/search/cdx?url=example.com&limit=1"`.
   `000` means this machine is refused.
2. **Index** the prefix into a file of captures.
3. **Read** each address from its best capture, keeping the page as served when it may be parsed again.

## Key insights

- **Reach.** In a refused sandbox, Bash gets `000` from the proxy and WebFetch names `web.archive.org` as refused, whatever the model; a subagent does not get around it. `archive.org` answers, but its availability API (`archive.org/wayback/available`) reports no snapshots for addresses the index holds, so an empty answer there is not evidence. The environment record is web-tools [`docs/environment/capabilities.md`](../../docs/environment/capabilities.md).
- **The laptop.** Reach it by errand (web-tools-private `errands/README.md`). Start long work detached so it commits its own batches; the commits are the result. Tell the agent to leave nothing watching the process, or a wrapper relaunches it when it exits.
- **The laptop's Python** is Inkscape's 3.11 and its console writes cp1252: call `sys.stdout.reconfigure(encoding="utf-8", errors="replace")` and open files with `encoding="utf-8"`. Its `curl` is Windows' `curl.exe`, which needs no certificate bundle.
- **A GitHub runner** reaches it too. home's `.github/workflows/wayback-fetch.yml` writes to a folder that moved to budget-wa's `sources/wayback-url-corpora/`, so repoint it before dispatching.
- **The index** is `https://web.archive.org/cdx/search/cdx?` with `url=<host/path/>&matchType=prefix`; `fl=timestamp,original,statuscode,length` (`length` is the archived body's size); `filter=statuscode:200`; `collapse=urlkey` for one row per address; `limit=25000&showResumeKey=true`, passing the key after the blank line back as `resumeKey`; `showNumPages=true` to size a prefix. A whole host on a shared platform is every customer: Washington's postings are under `governmentjobs.com/careers/washington/`, not `governmentjobs.com`.
- **The index sometimes answers with an HTML error page.** Accept only lines matching `^\d{14} \S+ \S+`, and retry anything else after a pause.
- **A capture** is `https://web.archive.org/web/<timestamp>id_/<original>`, without the toolbar. Use `curl -L -g`: `-g` stops `[` or `]` in a query failing with exit 3.
- **Captures come gzip-compressed, with or without a header saying so.** Decode both, or a full page reads as empty.
- **A capture can be an empty shell** built by script. Keep up to three per address, best first: a print view where the site has one, then the largest `length`; fall through when one carries nothing.
- **Pace** at one capture every 1.5 to 3 seconds. When the archive refuses connections (curl exit 7) or answers 429 or 503, pause (1, 5, then 15 minutes), then ask the index: if it answers, only that capture is failing; if not, the archive is refusing everything, so end the batch without counting a try against the address.
- **Keep each page as served** (mehrlander/page-captures holds them) so a parser fix costs a reparse, not a second harvest.
- **Worked instance:** budget-wa `research/budget-offices/tools/archived-postings.py`, which indexes, reads, keeps and reparses Washington's job bulletins and fetches the stylesheets and images their pages name. Copy its retry, decoding and candidate handling.
