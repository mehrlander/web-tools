# General-Text Pipeline: Tokenize, Grammar, Bookend Merge

The first end-to-end Wring pipeline on **arbitrary text** (not pre-segmented DOM
signatures). Takes a raw document and induces slotted templates for its repeated
records.

```bash
node general/induce.js general/fixtures/access.log --records lines --max-slots 8
# or
cat somefile.txt | node general/induce.js --records anchor
```

For an interactive version, open [`demo.html`](demo.html) in a browser: paste a log,
choose the tokenizer, record split, and `align` vs `bookend` grouping, and watch the
templates (and the reconstruction check) update live.

## The stages

| Stage | Module | What it does |
|---|---|---|
| 1. Tokenize | [`tokenize.js`](tokenize.js) | Lossless segmentation (`punct` / `word` / `char` / `line`). `tokens.join('') === text`. |
| 2. Grammar | [`grammar.js`](grammar.js) | **Re-Pair** grammar induction, producing a hierarchy of *exact* repeats. (See note below.) |
| Bridge | [`bridge.js`](bridge.js) | Turns the grammar into "records" (near-repeated spans) and feeds them to Stage 3 at token granularity. Also hosts the end-to-end `induce()`; [`induce.js`](induce.js) is the CLI shell over it. |
| 3-4. Merge + Select | [`../core/group-by-template.js`](../core/group-by-template.js) | Bookend Merge + greedy MDL selection (shared engine). |
| 5. Reconstruct | `bridge.js` | Verifies every grouped record round-trips exactly. |

### Why Re-Pair instead of Sequitur?

`ARCHITECTURE.md` names **Sequitur** for Stage 2. We implement **Re-Pair**
(Larsson & Moffat) instead, behind a neutral `{ start, rules, ruleUses }`
interface. Both produce a hierarchical grammar of exact repeats, which is the only
thing Stage 3 needs. Re-Pair is offline and greedily replaces the globally most-frequent
digram, which is far simpler to implement *correctly* and tends to surface the
dominant repeated structure first. An online Sequitur can be dropped in later
behind the same interface. (An initial Sequitur attempt was abandoned because its
incremental pointer surgery was error-prone; correctness of Stage 2 matters more
than which algorithm in the family provides it.)

### The bridge is the open question

Stage 3 compares whole records. Getting from a grammar to "records" is the part
ARCHITECTURE leaves open, so `bridge.js` offers two strategies to compare:

- **`lines`** splits the token stream on newlines. The record boundary is given, so
  the grammar is used only for diagnosis. This is robust for logs.
- **`anchor`** splits the start rule at its most frequently referenced rule (the
  dominant repeat), so the record boundary *emerges from repetition* with no
  delimiter told in advance. It falls back to `lines` if nothing repeats at the top level.

## What this experiment taught us (honest findings)

Run on an 8-line Apache-style access log:

1. **The pipeline works and is lossless.** Tokenizers round-trip, the grammar
   regenerates the exact stream, and every grouped record reconstructs exactly
   (verified in `test-induce.js`). The plumbing is sound.

2. **Field extraction with multi-slot is surprisingly decent.** With
   `--max-slots 8`, the LCS multi-slot refinement separates timestamp, status
   (`200/404/500`), and byte-count fields into distinct slots.

3. **Grouping quality is the ceiling, and it's a Stage-3 limitation.** Bookend
   Merge anchors on the *longest shared literal* prefix/suffix. For log lines that
   is the client IP (`192.168.1.10`), an incidental field rather than the structural
   skeleton. So lines that share an IP get grouped together regardless of method,
   and one logical template (the combined-log-format line) fractures into several.
   With a single slot (`--max-slots 1`) the entire varying middle collapses into
   one useless slot.

4. **`anchor` segmentation mis-aligns when the dominant repeat doesn't coincide
   with the record boundary.** Records then span across newlines. Discovering the
   record unit purely from the grammar remains genuinely unsolved here.

**Takeaway:** the missing capability is *structural* grouping, meaning aligning
records by their shared skeleton (multi-field and order-aware) rather than by the
single longest literal bookend.

## Update: structural grouping (`--group align`)

That takeaway is now implemented in [`align-group.js`](align-group.js) and selectable
with `--group align`. It buckets records by token count, then within a bucket clusters
by *positional agreement*; positions that disagree become slots (still discovered from
variance, never declared by type). Adjacent slot positions merge.

The difference on the same 8-line log is stark:

```
# --group bookend --max-slots 8  →  2 messy templates, split on the client IP,
#   with boilerplate spilled into slots:
192.168.1.10 - - [05/Jun/2026:10:00:${0}0000${1}GET${2}api${3}users${4}HTTP${5} ${6} ${7}
192.168.1.${0}Jun${1}2026${2}10${3}00${4}0000${5}api${6}HTTP${7}

# --group align  →  one clean structural template, fields cleanly separated:
192.168.1.${0} - - [05/Jun/2026:10:00:${1} +0000] "${2} /api/${3}/${4} HTTP/1.1" ${5} ${6}
#   slot 0: IP octet   slot 1: seconds   slot 2: method (GET/DELETE)
#   slot 3: resource   slot 4: id        slot 5: status   slot 6: bytes
```

```bash
node general/induce.js general/fixtures/access.log --group align
```

Honest limits that remain: length bucketing separates records whose field *count*
differs (the `POST /api/orders` line has a shorter path, so it lands in its own
bucket and is left ungrouped here). Two questions remain open: reconciling records
of differing length, and discovering the record boundary itself (the `anchor`
strategy).

## Files

| File | Description |
|---|---|
| [`tokenize.js`](tokenize.js) | Lossless tokenizers (Stage 1) |
| [`grammar.js`](grammar.js) | Re-Pair grammar induction (Stage 2) + `expandRule`, `reconstructTokens` |
| [`align-group.js`](align-group.js) | Structural Stage 3: positional-agreement grouping (`groupByAlignment`) |
| [`induce.js`](induce.js) | Bridge + end-to-end CLI + `induce(text, options)`; `--group bookend\|align` |
| [`demo.html`](demo.html) | Interactive browser demo (DaisyUI + Alpine.js): paste a log/records, pick tokenizer + record split + `align`/`bookend`, see templates and the reconstruction check live |
| [`fixtures/access.log`](fixtures/access.log) | Apache-style log sample with multi-field variation |
| [`test-grammar.js`](test-grammar.js) | Grammar invariants: reconstruction, no-repeats-remain, rule utility |
| [`test-induce.js`](test-induce.js) | Tokenizer losslessness + end-to-end reconstruction fidelity |
| [`test-align.js`](test-align.js) | Structural grouping: slot discovery, reconstruction, beats bookend on the log |

```bash
node general/test-grammar.js
node general/test-induce.js
node general/test-align.js
```
