---
name: tree
description: >-
  Render a repository file tree in chat as a linked markdown table: folders
  and files as tappable GitHub blob/tree links, depth carried by an inline
  code-span connector prefix (the classic box art) or by invisible braille
  indentation, filetype icons as anchors, an optional gloss column.
  Table-first because nested bullets balloon vertically on mobile. Use when the
  user says "tree", "show the repo structure", "file tree", "map the repo",
  "lay out the folders", "/tree", or names a subtree/depth to render.
  Answers "what is here" (structure); CONVERSATION.md answers
  "what moved" (change).
---

# tree

An orientation view: the shape of a repo or a subtree, rendered for a chat
reader on a phone. A tree answers *what is here* (the filesystem);
[`CONVERSATION.md`](https://github.com/mehrlander/web-tools/blob/main/docs/CONVERSATION.md)
answers *what moved* (the git diff) and owns PR bodies. A tree carries no change
state and no diff links: when the ask is "what did I touch", follow
CONVERSATION.md, and treat a tree that also marks change as a deliberate
combined view, not the default.

Substitute the current repo into all URL templates. The rendering rules
below are the applied form of [`claude-markdown`](../claude-markdown/SKILL.md),
which owns which characters survive a table cell.

## The generator

[`python/build-tree.py`](https://github.com/mehrlander/web-tools/blob/main/python/build-tree.py)
(python3 stdlib, argv-parameterized, raw-URL fetchable) emits the table:
structure, links, and icons. It leaves the gloss column empty, because a
one-line "what this is" needs judgement the walker lacks; write it yourself when a gloss is wanted.

```
python3 python/build-tree.py <root> [--repo owner/repo] [--ref REF]
    [--depth N] [--mode codespan|braille|ascii] [--all]
    [--ignore GLOB] [--gloss] [--indent N]
```

Defaults: `--mode codespan`, `--ref main`, repo inferred from
`git remote get-url origin`, tracked files only (`git ls-files`),
`.git`/`node_modules`/`dist` always pruned, depth unlimited. Fetch it in
another repo from
`https://raw.githubusercontent.com/mehrlander/web-tools/main/python/build-tree.py`.

The flow: run the script for the skeleton (the skill passes `--depth 1` for
the bare view), then append the curated **Major folders** block below it
(next section). The gloss column is a separate, per-row option; for a plain
subtree with neither block nor gloss, the raw output is the deliverable.

## Parameterization

Bare `/tree` renders a **dense default**: the repo root as the table
header, its top level one deep, and a curated **Major folders** block
beneath (see below). Depth is opt-in from there; ask to go deeper.
Free-form arguments refine it; interpret them into these dimensions:

| Dimension | Bare default | Example phrasing |
|---|---|---|
| scope | repo root | "tree of `lib`", "the pages folder" |
| depth | 1 (top level) | "depth 3", "expand", "go deeper", "all the way down" |
| filter | tracked, noise pruned | "only markdown", "include untracked" |
| mode | codespan | "braille", "as ascii", "pasteable" |
| ref | main | "on my branch", "at `<sha>`" |
| major | on | "just the tree", "skip the notes" |
| gloss | off | "annotate it", "with a note per folder" |

## The two recorded formats

The root is the table **header**: the repo (or subtree) name, linked, no
folder icon and no literal "Tree" label. A header cell renders bold and
still holds a link, so the reader stands in that folder with its contents
listed below. Everything under it is one node per table row, filetype icon
as the color anchor, name linked to its GitHub blob (files) or tree
(folders) URL. The two formats differ only in how depth is drawn: codespan
keeps the box-art rail, so the first level hangs off the header the way a
classic `tree` hangs off its root; braille indents it one step.

### A. codespan (default): box art in an inline code span

The connector prefix (`├─ │ └─`, the exact string `tree` already emits)
goes inside backticks. A code span preserves its whitespace and renders
monospace, so the rails align column-to-column and the corner art survives
the cell trim; the icon and link sit outside the span, so they stay
tappable.

| [skills](https://github.com/mehrlander/web-tools/tree/main/skills) | What it is |
|---|---|
| `├─ `📁 [hooks](https://github.com/mehrlander/web-tools/tree/main/skills/hooks) | the plugin's hooks |
| `│  └─ `📄 [hooks.json](https://github.com/mehrlander/web-tools/blob/main/skills/hooks/hooks.json) | registers them |
| `└─ `📁 [tasks](https://github.com/mehrlander/web-tools/tree/main/skills/tasks) | the tracker protocol |
| `   └─ `📄 [SKILL.md](https://github.com/mehrlander/web-tools/blob/main/skills/tasks/SKILL.md) | the skill |

### B. braille: invisible indent + icons

No connectors: depth is pure indentation built from the braille blank
(U+2800), which survives the cell trim where ASCII space, nbsp, and tab do
not. The icon carries the folder-vs-file signal. Cleaner and quieter than
box art; best for shallow trees where the eye does not need a rail to peg
depth.

| [skills](https://github.com/mehrlander/web-tools/tree/main/skills) |
|---|
| ⠀⠀⠀📁 [tasks](https://github.com/mehrlander/web-tools/tree/main/skills/tasks) |
| ⠀⠀⠀⠀⠀⠀📄 [SKILL.md](https://github.com/mehrlander/web-tools/blob/main/skills/tasks/SKILL.md) |

Pick A when depth or alignment matters, or a gloss column is wanted; pick B
for a quiet, shallow orientation view. When unsure, A is the default.

## The Major folders block

The dense default closes with a short curated block naming the folders
worth knowing, appended as rows in the **same** table (a second table would
spend the vertical margin a table exists to avoid). It is the judged tier:
the script emits the tree, this block is authored from what the tree shows.

Form: a `🧳 **Major folders**` header row, then one row per folder as
`**[name](url)** › Headline`. The chevron reads as "leads to"; the bold
name is its own left anchor, so no bullet is needed.

The note describes **structure, not content**: the shape of the subtree
(`One Folder Per Skill`, `Flat, Two Shell Scripts`), not what the folder is
for. Structure is exactly what a depth-1 view stops short of showing, and
it sits nearer the deterministic tier, so it is harder to get wrong than a
content judgement. Content, the "what it is for," goes in the gloss column
when a caller wants it.

Curate, do not enumerate: name the few folders that orient a newcomer, cite
one anywhere in the tree (not only the top level), and drop the block when
the tree is small enough to read whole or the caller asks for the bare
tree.

| [.claude](https://github.com/mehrlander/web-tools/tree/main/.claude) |
|---|
| `├─ `📁 [hooks](https://github.com/mehrlander/web-tools/tree/main/.claude/hooks) |
| `└─ `⚙️ [settings.json](https://github.com/mehrlander/web-tools/blob/main/.claude/settings.json) |
| 🧳 **Major folders** |
| **[hooks](https://github.com/mehrlander/web-tools/tree/main/.claude/hooks)** › Two Shell Scripts, Flat |

The `└─ ` last row separates cleanly from the `🧳` header below; the note
rows carry no connector, so they read as a distinct block, not tree nodes.

## The fallback: ascii code block

`--mode ascii` emits a plain fenced code block: aligned box art, no links.
For when links are noise, or the reader wants something pasteable into a
terminal or another editor. It is a fallback, not a default, because it
drops the navigation that is the point of rendering in chat.

## Rendering rules

- **Never nested bullets.** Chat renders each list item with paragraph
  margin, and nesting compounds it, so a deep bullet tree is mostly
  whitespace on a phone. Use a table (or a code block).
- **Depth needs a surviving character,** because a table cell trims leading
  whitespace and collapses internal runs of spaces: a visible glyph, a code
  span, or the braille blank U+2800
  ([`claude-markdown`](../claude-markdown/SKILL.md)).
- **A code span cannot hold a link,** so the structure prefix goes in
  backticks and the name/icon stay outside it.
- **Icons** come from the filetype map in `build-tree.py`; extend it there,
  not per-render.
