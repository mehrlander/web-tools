---
name: wayback
description: Read the Internet Archive's Wayback Machine for material a site no longer serves or never listed. Enumerate the archive's captures under an address prefix through its CDX index, then read the captures themselves. Use when the user wants past versions of a page, postings or documents a site has taken down, everything an archive holds under a path, or says "wayback", "Internet Archive", "archive.org", "archived copy", "what did the site say in 2019". Covers which machines reach the archive (a Claude Code cloud sandbox usually does not), the recipes that worked, the failures that each cost a round trip, and the tools that already do it.
---

# Wayback

Two reads: the **index** says which captures exist under an address, and a
**capture** is the page as the archive took it on that date. Enumerating by
index is free of search calls and reaches pages no search engine lists.

## First: which machine reaches the archive

| From | `web.archive.org` | Measured |
|---|---|---|
| Claude Code cloud sandbox, Bash | refused at the proxy (curl exit 35, `000`), per container; one container allowed it for five minutes on 2026-08-13 | 2026-08-13, 2026-10-17 |
| Claude Code cloud sandbox, WebFetch | named refusal: "Claude Code is unable to fetch from web.archive.org" | 2026-08-13, 2026-10-17 |
| Home laptop, through the Gemini daemon | reaches it | 2026-10-17 |
| GitHub-hosted runner | reaches it | 2026-08-09 |

**The model makes no difference.** A Sonnet subagent and an Opus session in the
same container fail byte for byte alike (2026-08-13 and 2026-10-17).
`archive.org` itself answers from the sandbox. But its availability API
(`archive.org/wayback/available`) returned "no snapshots" for addresses the
index holds thousands of, and a "Temporarily Offline" page, so an empty answer
there is not evidence. Probe before planning, and treat `000` as plan without
the sandbox:

```bash
curl -s -o /dev/null -w "%{http_code}\n" --max-time 20 "https://web.archive.org/cdx/search/cdx?url=example.com&limit=1"
```

The environment record is web-tools
[`docs/environment/capabilities.md`](../../docs/environment/capabilities.md),
section "`web.archive.org` is gated per container".

## Routes that reach it

- **An errand to the laptop** (web-tools-private `errands/README.md`). An `ask`
  errand gives a Gemini agent the laptop's shell. Two patterns, both learned
  from runs whose output was lost:
  - **Short work:** have the script write to a file whose last line is
    `DONE`, and tell the agent to reply only once that line is there and to
    send the file whole. Otherwise the agent can reply when the script
    starts, the errand settles on that reply, and the output never arrives.
  - **Long work:** have the agent start the job detached (PowerShell
    `Start-Process -PassThru -WindowStyle Hidden`) and let the job commit its
    own batches to a branch. Then the commits are the result, whenever the
    reply comes.
- **A GitHub runner:** budget-wa's `sources/wayback-url-corpora/` harvests whole
  `wa.gov` domains with standard-library scripts. Its README says to dispatch
  `.github/workflows/wayback-fetch.yml`, but on 2026-10-17 that workflow lived
  only in home and still wrote to the folder it held before the corpora moved to
  budget-wa, so it would fail. Move it to budget-wa before relying on it.

## The index (CDX)

`https://web.archive.org/cdx/search/cdx?` with:

- `url=<host/path/>&matchType=prefix` for everything under a path. A whole host
  (`matchType=host`) is often far larger. For a shared platform it is every
  customer: `governmentjobs.com` is thousands of employers, and Washington's
  postings sit under `governmentjobs.com/careers/washington/`.
- `fl=timestamp,original,statuscode,length` picks the fields. `length` is the
  archived body's size, a good proxy for which capture carries content.
- `filter=statuscode:200` keeps captures of a page rather than redirects.
- `collapse=urlkey` keeps one row per address, its first capture.
- `limit=25000&showResumeKey=true` pages. The resume key follows a blank line
  after the rows; pass it back as `resumeKey`.
- `showNumPages=true` sizes a prefix without reading it.

**The index answers with an HTML error page now and then** ("We apologize",
"Temporarily Offline"). A parser that splits lines took those for rows and
reported eleven print views that were really HTML fragments. Accept only lines
matching `^\d{14} \S+ \S+`, and retry an HTML answer with growing pauses.

## A capture

`https://web.archive.org/web/<timestamp>id_/<original>` returns the page as
captured, without the archive's toolbar. Follow redirects (`curl -L`). Pass
`curl -g`, or an address with `[` or `]` in its query fails with exit 3
("bad range").

Not every capture holds content. A page that built its body with script can be
archived as a shell. Keep up to three candidates per item, best first: a
server-rendered view (a print view, where the site has one), then the largest
`length`. Fall through to the next when one carries none of the fields.

**Pace:** one capture every 1.5 to 3 seconds, and a 60-second pause on a 429 or
503. The target site's robots.txt governs crawling that site, not reading the
archive's copies; the archive's own capacity is the limit to respect.

## On the laptop

- The first `python.exe` on its PATH is Inkscape's bundled 3.11, and its
  console writes cp1252. A script that prints an invisible byte-order mark died
  with `UnicodeEncodeError`. Call `sys.stdout.reconfigure(encoding="utf-8",
  errors="replace")` and open every file with `encoding="utf-8"`.
- `curl` resolves to Windows' `curl.exe` (8.21, Schannel), so certificates come
  from the Windows store and need no Python bundle.

## Worked instance

home `projects/budget-offices/tools/archived-postings.py` covers Washington
State job bulletins:

- **`index`:** every capture under a prefix, one row per posting number, with
  three captures to read, best first.
- **`read`:** budget and finance titles first; header fields from the
  capture's text.
- **`harvest`:** the batch loop that commits and pushes.
- **`--check`:** holds the record to its shape.

On 2026-10-17 the index held 25,011 addresses for 14,735 posting numbers, most
first captured from 2020 on. 14 of 16 captures sampled carried the whole
bulletin (department, pay, dates, duties). Copy its retry, candidate and
encoding handling rather than rediscovering them.
