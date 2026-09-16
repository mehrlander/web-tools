# Paragraph revision index — contract

This is the intended long-lived structure for ongoing documentation shortening across the estate. The overnight pass on 2026-09-16 (Chief of Staff / Grok) was a **first batch of proposals** under a file-keyed shape; this document is the target model future assistants should implement and extend.

Live docs are never edited by this mechanism. Accepting a proposal is a separate, deliberate docs PR.

## Idea

Pour spare compute into finding more succinct representations of prose that already exists. A paragraph is self-identifying: the text *is* the key. Locations are sightings, not identity. Each paragraph accumulates any number of **signed** rewrite proposals, each aimed at a **target reduction** (for example 0.75 keep / 0.50 keep / 0.25 keep — that is, ~25% / 50% / 75% shorter).

Succinctness is always welcome. Another attempt can always succeed where prior ones did not. Short paragraphs may still get proposals (even a shorter synonym for a one-word line is allowed and may be amusing); the only hard stop is empty text.

## Two layers

### 1. Observed paragraph (index entry)

Something actually seen in a repository file at inventory time.

| Field | Type | Meaning |
|-------|------|---------|
| `paragraphId` | string | Stable id: `sha256` hex of `normalizedOriginal` (see Normalization). |
| `original` | string | Exact paragraph text as observed (preserve for apply/search). |
| `normalizedOriginal` | string | Normalization used only for identity/dedup (see below). |
| `words` | int | Word count of `original`. |
| `chars` | int | Character count of `original`. |
| `kind` | `prose` \| `list` \| `blockquote` \| `other` | Structural hint from the parser. |
| `sightings` | array | Zero or more places this text was seen. |
| `proposals` | array | Zero or more rewrite proposals (grows over time). |
| `firstSeenAt` | string (ISO date) | First inventory that recorded it. |
| `lastSeenAt` | string (ISO date) | Most recent inventory that still saw it. |

**Sighting** object:

| Field | Type | Meaning |
|-------|------|---------|
| `repo` | string | e.g. `mehrlander/web-tools` |
| `ref` | string | Usually `main` |
| `path` | string | Repo-relative path |
| `startLine` | int | 1-based |
| `endLine` | int | 1-based inclusive |
| `observedAt` | string (ISO date) | |

Sightings are optional for *identity*. They exist so tools can jump to a file without grepping. If a paragraph moves or is copied, new sightings append; the `paragraphId` stays the same when the text matches.

### 2. Proposal (list entry under a paragraph)

| Field | Type | Meaning |
|-------|------|---------|
| `proposalId` | string | Stable id derived from paragraphId + targetRatio + agent + draft; uniqueness matters more than the exact formula. |
| `draft` | string | Proposed rewrite text. |
| `targetRatio` | number | Target `draftWords / originalWords`. Use `0.5` for half length, `0.25` for quarter keep (~75% cut), `0.75` for light trim. |
| `draftWords` | int | |
| `achievedRatio` | number | Actual `draftWords / originalWords`. |
| `agent` | string | Signer, e.g. `Chief of Staff (Grok)`. |
| `signedAt` | string (ISO date) | |
| `notes` | string | Optional method/quality notes. |
| `status` | `proposed` \| `accepted` \| `rejected` \| `superseded` | Default `proposed`. |

Multiple proposals per paragraph are expected. Same `targetRatio` from different agents (or different days) may coexist; do not overwrite — append.

## Normalization (identity only)

For `normalizedOriginal` / `paragraphId`:

1. Strip a single trailing newline.
2. Do **not** collapse internal whitespace (code spans and tables care).
3. Do **not** case-fold.
4. UTF-8 NFC recommended if cross-tool hashes must match.

Apply/search against files uses `original` (exact), not the normalized form.

## What enters the index

**In:** paragraphs observed in repo markdown (blank-line-separated blocks; skip fenced code and YAML frontmatter).

**Out (for now):** drafts do **not** become new index entries. Only text that appears in a live (or inventoried) file is an observed paragraph. Nesting “reduce the reductions” is deferred.

Archive trees may be inventoried; whether to spend proposals on them is a runner policy, not a schema rule.

## Background runner (intended loop)

Whenever there is capacity:

1. **Scan** configured repos/refs for `.md` files; parse paragraphs.
2. **Upsert** each into the index by `paragraphId`; refresh `sightings` / `lastSeenAt`.
3. **Select** paragraphs that lack a `proposed` proposal for a chosen `targetRatio` (policy may prefer high word count first; policy may still attempt very short lines).
4. **Generate** one draft aimed at that ratio; preserve meaning, links, identifiers; full sentences.
5. **Append** a signed proposal (`agent`, `signedAt`, `targetRatio`, `achievedRatio`).
6. **Never** edit the live doc in this loop.

Acceptance is human (or a later explicit apply tool): copy `draft` over `original` in the sighted file via an ordinary docs PR, then the next scan will observe the new text as its own paragraph.

## Mapping from the 2026-09-16 overnight shape

Overnight records looked like file-keyed rows with a single optional `draft` at ~0.5:

```text
id = "{path}:p{index}"
draft / draftWords / ratio / agent / signedAt
```

Migrate as:

- `original` ← `original`
- `paragraphId` ← hash(`normalizedOriginal`)
- `sightings` ← one sighting from `path` / `startLine` / `endLine`
- if `draft` present → one proposal with `targetRatio: 0.5`, `status: proposed`

Do not treat `path:pNNN` as the long-term primary key.

## Storage layout (suggested)

Under `docs/paragraph-rewrites/` (or a dedicated data repo later):

| Path | Role |
|------|------|
| `CONTRACT.md` | This file — hand to future assistants |
| `paragraphs.jsonl` | One observed paragraph per line |
| `proposals.jsonl` | One proposal per line keyed by `paragraphId` (preferred once volume grows; append-only) |
| `SUMMARY.md` | Rollup stats for humans |
| `by-file/` | Optional rendered review views |
| `runners/` | Optional scripts/policies for scan + select |

Prefer split `proposals.jsonl` so runners only append.

## Policies (not schema — runners may vary)

- Default targets to fill: `0.5` first; later `0.25` and `0.75` (not required in the same run).
- Prefer paragraphs with higher `words` when capacity is limited.
- Skipping one-word lines is optional amusement policy, not required.
- Dedup proposals: skip append if identical `draft` already exists for that `paragraphId`.

## Instruction to a future assistant

> Read `docs/paragraph-rewrites/CONTRACT.md`. Scan the configured markdown corpus. Upsert observed paragraphs into the revision index (content-addressed). Append signed rewrite proposals for missing target ratios — do not overwrite prior proposals; do not edit live docs. Report counts of new sightings and new proposals.
