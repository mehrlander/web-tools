---
name: concept-index
description: >-
  Build a repo's declared vocabulary and check a piece of writing against it:
  which repo files it names without a link, and which terms of art it uses as
  though the reader already knows them. Use when the user asks what a reply
  assumed, says "get out of the weeds", asks for a glossary or entity list for a
  repo or a session, wants to know which terms are used but never defined, or
  invokes /concept-index.
---

# Concept index

Two commands over one artifact. `index` reads a repo's prose and writes the
vocabulary it declares. `check` reads a piece of writing and reports what it
named without giving the reader a handle.

The index is cheap enough to build on demand (1.7s over web-tools, 20s over a
1000-file repo), so it is **not committed and there is no workflow**. Build it,
use it, let it go.

```bash
V=skills/concept-index/vocab.py          # or $CLAUDE_PLUGIN_ROOT/...

python3 $V index . --output /tmp/vocab.json \
  --hub docs/CONVERSATION.md --hub docs/QUALIFIED-WRITING.md --hub CLAUDE.md \
  --exclude skills/

python3 $V check --index /tmp/vocab.json --repo mehrlander/web-tools < reply.md
```

`--hub` takes the **exact repo-relative path** of a governing doc, repeatable.
`--exclude` drops a path prefix from the corpus; use it for a vendored library
whose vocabulary is not this repo's.

## Tiers

A term's tier comes from how the repo declares it, not from how often it appears.
Frequency rankings reward rare vocabulary, and a repo's terms of art are its
shared vocabulary, so frequency is only a tiebreak.

| Tier | Means | Use |
| --- | --- | --- |
| `canonical` | declared in a hub doc | the working vocabulary; what `check` flags by default |
| `local` | declared anywhere, reused across files | a fuller glossary |
| `assumed` | never declared, but referenced as though it were | the risk list: "the X" with no X anywhere |
| `template` | in over 30% of files | frontmatter and template field names, not terms of art |

`assumed` is the one worth reading directly: it is where a term catches on and
starts doing work nobody defined.

## What `check` reports, and what it deliberately does not

Two findings, in confidence order:

1. **Repo files named without a link.** A path-shaped token that resolves to a
   real tracked file and sits outside any `[](…)`. Decidable, so it leads.
2. **Declared terms used without a handle.** A handle is a link, a code span, or
   an immediate parenthetical that *names the term*. Something merely nearby
   does not count, since in a well-linked document nearly every mention has a
   link somewhere near it.

Fenced code blocks are stripped before checking, since a block quoting a tool's
output is a demonstration and not prose.

A single ordinary word is flagged only when used referentially ("the stage
link", not "bare paths"), because nothing here can separate a repurposed common
word from its plain sense without a lexicon. Expect one to three flags on a
dense reply; a run with none is a normal result, not a broken tool.

## The reader's own grades: `--known`

`check` models the reader from the repo alone, which is the wrong reader when
the reply is addressed to the estate's owner. A common-ground table (the shape
is `mehrlander/home` `me/common-ground.md`: `kind,target,at,grade,…`, one grade
per topic, folder or term) corrects it:

```bash
python3 $V check --index /tmp/vocab.json --known me/common-ground.csv < reply.md
```

Only `term` rows with a blank `at` apply, since a located grade needs the
passage's own location. A term graded `bare` is never flagged; one graded
`by-location` or `unknown` is flagged whenever it appears without a handle,
whatever its tier or frequency, and the finding carries the grade as `reader`.
Estate coinages are not in that table by design (the index derives them), so
the canonical tier keeps flagging them. Replace a flagged term with plain words,
or define it where it first appears.

## Interpretation

The output is evidence, not a verdict. A term can be canonical, used bare, and
perfectly clear in context. Read the passage before changing anything.
