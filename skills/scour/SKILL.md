---
name: scour
description: "Fan out agents to acquire source material that does not exist locally, mapping who says what about a subject across the open web. Use when the user wants to survey a field, find the actors or institutions in some arena, gather primary sources at breadth, build a corpus to delve into later, or says \"scour\", \"find everything about\", \"map the landscape\", \"who talks about X\", \"cast a wide net\". This is acquisition fan-out, not judgment fan-out: the agents go get material rather than generate opinions about material already present. Not for reviewing an artifact you already have (use a review panel), and not for answering a question you could answer from one search."
---

# Scour

Acquisition fan-out. Point many agents at the open web to bring back **what is
said and where**, organized so it can be delved into later.

**The output is a corpus, not a report.** Do not produce an agent-written
synthesis that argues a conclusion: synthesis discards the addresses, the
disagreements, and the genres, which are the durable part. Report what each
source says, attribute it, and let structure carry the meaning. When several
sources conflict, map the conflict as a finding; do not resolve it.

## The budget, which is the whole design constraint

| Tool | Metered? | Answers |
| --- | --- | --- |
| **WebSearch** | **Yes.** 200 calls per session window, shared across every subagent. Raise with `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` | "what exists that I don't know about" |
| **WebFetch** | No | "what does this known URL say" |
| **Wayback CDX** | No | "every URL this domain has ever served" |

The numbers behind this table, the 20-subagent concurrency cap, and the
per-container gate on `web.archive.org` are measured in
[`docs/environment/capabilities.md`](https://github.com/mehrlander/web-tools/blob/main/docs/environment/capabilities.md).
The four operative consequences for a scour:

1. **Only new-domain discovery needs search.** Reading is free and enumerating
   a known domain is free, so spend search on seeds and nothing else.
2. **Expect the wall without being able to predict it.** Plan against 200 in a
   window, degrade gracefully, and record which items ran after it hit.
3. **Reconcile the roster against what actually launched.** The concurrency
   cap's real cost is an item that never dispatched and therefore never
   reports.
4. **Probe Wayback CDX before planning around it**, and treat `000` as
   plan-without-it.

### Wayback CDX, when it answers

CDX enumerates every capture of a host without a search call and reaches pages
that no longer exist:

```
https://web.archive.org/cdx/search/cdx?url=<host>&matchType=domain\
&collapse=urlkey&fl=original,timestamp,statuscode,mimetype&limit=100000&output=text
```

`matchType=prefix` with a path scopes it to a section, which replaces "site:"
search once a domain is known to matter. Query the bare host: `www.` returns
the same captures. The probe, paging and capture reading are in the
[`wayback` skill](../wayback/SKILL.md).

**It is not a substitute for search.** CDX enumerates *within* a host you
already know and cannot tell you a host exists. New-domain discovery is either
a search call or a link followed from a page you already have, which is why
lead-harvesting matters.

## Allocation: spread, do not deepen

**Many seeds read shallowly beat few seeds read deeply, for discovery.** On
this estate's 20 sources, leads grew with pages read at an exponent of 0.63
(fit in [PRIOR-ART.md](PRIOR-ART.md)): each further page of the same source
yields fewer organizations not already seen, so 32 pages spent as 8 sources at
4 pages each return roughly 20 leads, against 9 from one source read 32 deep.
Go deep only after a source is known to matter, and treat that as extraction
rather than discovery. Buy *seeds*, plural and cheap: one search
returning eight plausible domains is worth more than eight searches refining
one.

**The limit on that rule is tunneling.** The exponent was measured inside
neighborhoods already known to be relevant, so it says nothing about reaching
one you have not entered, and a relevant cluster can sit behind a page that
scores low on its own. When a promising path runs through an unpromising page,
take it anyway. See [PRIOR-ART.md](PRIOR-ART.md).

## Propose before spending

A scour costs dozens of agents and the session's whole search budget. Loading
this skill is not authorization to run one. State the intended scale (how many
seeds, how many agents, roughly how much search) and get a go, unless the user
already named the scale. Work the session conceives is a proposal.

## The loop

1. **Seed** with search. Spend a small, fixed number of calls to get an initial
   spread of domains. Record the budget you intend to spend before starting.
   Pick seeds for spread across kinds of actor, not for the best single answer:
   seed selection largely decides the run's efficiency.
2. **Enumerate** each seed with CDX where the domain matters, free.
3. **Read** shallowly across many seeds with WebFetch, capturing outbound links
   and their anchor text (see Instrumentation).
4. **Harvest leads** from what was read. These are free seeds, and they are how
   the run grows without more search.
5. **Promote** a lead to a full source when two independent reads surface it.
   Independent corroboration is the cheapest available relevance filter, and
   it is the specific defence against homophily (below).
6. Return to 3 with the promoted leads. Stop when a round promotes nothing.

### Hunt hubs deliberately. Measured at 10x to 93x

A **hub**, in Kleinberg's sense, is a page that points to many good sources:
a member directory, a partners or funders page, a board list, a coalition
sign-on. One of them can substitute for many searches. Hubs are recognizable
from URL slugs without a model (`/members`, `/partners`, `/board`,
`/resources`, `/coalition`, `/affiliates`), so sort those to the front of any
queue.

**The predictor is organisational form, not publishing genre.** Ask: *does
this body have a roster, and is publishing it part of what it is?* Across 14
domains, three hub fetches each returned 87x to 93x the organizations of the
same domains' article pages on membership associations, 30x to 47x on resource
bodies and think tanks, 2x to 11x on unions, and 0 to 20x on state agencies,
whose "resources" point inward at their own programs. Hub-hunting is worth
almost nothing on government domains and almost everything on associations. A
hub page that names nobody is a real answer, not a failed fetch.

**Count entities, but do not conflate them.** A membership roster yields
member companies, not policy actors, so raw hub yield is not the same unit as
a curated lead. And a *declared* partners page differs in epistemic status
from board members' *employer* affiliations, which is an inferred tie; keep
them apart in the corpus.

Seeding on hubs and collecting authorities are different targets. Say which
one a given round is doing.

### Four ways a search-free traversal dies, and only one is a real null

Across 14 domains, 6 did not return a clean result. Tell the shapes apart,
because they call for different responses.

- **403 at the homepage** ends everything. Traversal is *binary*: every later
  step depends on the entry page, so a block there yields nothing, not a
  partial. This is the case search exists to cover. Budget a search call per
  blocked domain.
- **Cloudflare** may yield to a readability proxy (`https://r.jina.ai/<url>`),
  but budget two fetches, since one gets you only the homepage.
- **Client-rendered and empty**: the fetch *succeeds* with no extractable
  text. Not a block, and not a null. Diagnose it separately or you will record
  a false zero.
- **Genuine null**: hub pages exist and name nobody. Record it as a finding.

The WebFetch summarizer sometimes returns `Anthropic` or
`Anthropic's Claude Agent SDK` as page content. Instruct entity-counting
precisely enough that an agent notices and excludes it.

### Lead-following is snowball sampling, and inherits its bias

Chain-referral sampling has a documented pathology: **homophily**, where
referrals resemble their referrer. Leads harvested from a business
association return more business associations, and the resulting roster
encodes the politics of its seeds while looking complete from the inside.

Two mitigations, both borrowed from respondent-driven sampling:

- **Cap leads taken per source** so one well-connected node cannot flood the
  roster. Roughly 3 to 10 is the range this estate ran at.
- **Require independent corroboration** before promotion, per step 5.

And state the seed set in the output. A reader cannot discount a bias that is
not disclosed.

## Instrumentation

Agents summarize prose and drop link structure unless asked for it, and
WebFetch returns a small model's answer rather than the page's markdown, so the
link graph is lost unless collected at fetch time.

**Require of every fetched page:** the URL, the outbound links with their
target domains, **the anchor text of each link**, and which targets were
already known. That turns hub-scoring from an estimate into a computation, and
it is free at collection time. Anchor text is the oldest and cheapest relevance
predictor in the crawling literature, available *before* deciding whether to
fetch a link.

When the agents' output drops it, the fetch sequence (though not the link
structure) is still recoverable after the fact from the subagent transcripts
([capabilities.md](https://github.com/mehrlander/web-tools/blob/main/docs/environment/capabilities.md#subagent-transcripts-are-durable-greppable-and-outside-every-repo)).
They die with the environment, so distil what matters into a committed
artifact while it is alive (`projects/wa-budget-landscape/analysis/extract_agent_trace.py`
in `mehrlander/home` is the worked example).

**Track harvest rate**, the crawler field's standard measure: relevant pages
fetched over all pages fetched, which needs relevance recorded per fetch. Two
numbers make a run comparable to the next one: harvest rate, and
new-domains-discovered per search call.

## Prompting the agents

**Name the null result as an acceptable answer, explicitly.** A requested
section will be filled: asked for "any connection to X," 49 of 49 agents
produced one and none cited anything; given "if you find one, don't force it
if there isn't one," 32 of 42 marked the comparison unsourced. For every field you ask
for, either supply the escape hatch or expect confabulation in that field, and
treat an unhedged claim in a prompted section as the lowest-trust sentence in
the document.

Give each agent: one subject, the output shape, the honesty rules (mark
anything not directly fetched, never present a search snippet as a page read),
and an explicit instruction not to run git.

## Running the fan-out

- **Dispatch in waves under the concurrency cap**, and after each wave
  reconcile your roster against what actually launched. An item that never
  dispatched never reports, and nothing surfaces it.
- **Commit after each wave.** Agent output exists only in the container.
- **Expect uneven sourcing across a large batch** as the search budget drains,
  and record which items ran degraded. The damage is per-claim, not per-source.

## Shape on disk

```
roster.json              the registry; content_status derived from disk, never authored
<source-slug>/
  README.md              what this source says, its positions, what it links out to
  content/*.md           one file per page fetched: YAML frontmatter
                         (url, title, org, domain, fetched, topics, outbound[])
                         then the actual text
  leads.md               organizations surfaced while reading this source
analysis/                scripts that measure the corpus, each with --check
```

Keep a superseded pass rather than deleting it: a second run under a different
prompt is only measurable against the first if both survive. Mark the old one.

## Reporting back

Build **source maps**, not conclusions. When a corpus holds several published
figures for one quantity, the artifact is a table of figure, publisher, basis,
date, and location, with **no figure marked correct**. A source map is a check,
not only a display: a column of figures exposes a file that inverted its
source, which prose hides.
