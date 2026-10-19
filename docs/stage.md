# The stage: the Web Tools app's working surface

The stage (`?view=stage`) is where a cross-repo fileset is assembled, read,
compared and sent. It is `store.stage`: a list of `{repo, ref, path}` refs, plus
local items from pastes, drops and dictation. Each item carries its own origin,
so one stage spans repos. The view, its intake (`StageIntake`) and its link
codec (`StageLink`) are in
[`lib/alpineComponents/stage.js`](../lib/alpineComponents/stage.js). The tests
are `node/test/stage*.mjs` and the `node/render/scenarios/stage-*.mjs`
scenarios. The app around the stage is documented in [APP.md](APP.md),
including the token requirement that every `#stage=` handoff states.

The stage does not save. `?view=surfaces` is a retired alias that lands on the
bench. A curated set is a `.surface` file, read by
[`lib/kits/surface.js`](../lib/kits/surface.js) under the contract in
[envelopes/surface.md](envelopes/surface.md).

## Intake

A paste reads every format on the clipboard; one spreadsheet copy holds
tab-separated text, an HTML table and an image. The paste stages a file if the
clipboard holds one, else the plain text, and every flavor appears on a
**flavor bar** above the staged list, the taken one ticked. A tap stages or
unstages each flavor. A form field keeps its native paste, and the bar lists
every flavor unticked. Hovering a pill opens the house hover card
([`kits/source-peek.js`](../lib/kits/source-peek.js)) on the flavor's text.

Each pill carries a menu of what can be done with its flavor. The menu offers
**Copy**, **Markdown** on markup, **Base64**, and **Decoded** where the text
decodes (`base64Info`, which also reads `data:` URIs). A conversion lands on the
bar as a new dashed pill, labelled by the conversion, without opening the
reader. The new pill carries its own menu, so conversions chain. A conversion's
markdown opens raw, where every other `.md` in the app renders, because it is a
payload to copy; `StageIntake.opensRaw` sets that rule for the reader and the
hover card alike.

The stage opens the transform workbench
([`lib/alpineComponents/transform-workbench.js`](../lib/alpineComponents/transform-workbench.js))
on items `StageIntake.transformKindOf` recognizes: a **bundle** (the
workbench's own `{fn, data}` output), **rows** (a `.csv`, a `.tsv` or a JSON
array of records), or a **transform** (a `rows => rows` function). The bench row
and the reader's header offer a chip that opens the workbench as a swipe-deck
takeover with the item's text loaded. It mounts fresh on each open; the
workbench keeps its tab sources but no data. A bundle is the one kind that skips
the offer and opens the tool directly, since its content is base64 gzip that
only the workbench reads.

**iOS Safari fires no `paste` event unless an editable is focused**, so a
window listener receives nothing on an iPhone. The app header (at every width)
and the bench each carry a Paste button. Both run `StageIntake.takeClipboard`,
which reads through [`kits/io.js`](../lib/kits/io.js); the header's button then
opens the Stage. Reading the clipboard needs the tap's own user activation:
awaiting anything before the read spends it, and the read then fails as though
the clipboard were unavailable. The [`ios-clipboard`](../skills/ios-clipboard/SKILL.md)
skill holds the measured recipe.

## The bench

The bench has one responsive split, between **Out** and the staged set. Below a
42rem container it is one column; above it, the two sit side by side with the
drag splitter from [`kits/dock-split.js`](../lib/kits/dock-split.js). The
breakpoint is on the Stage container rather than the window, because a docked
reader narrows the container alone. With nothing staged, the bench shows the
drop target and Add. A repo manifest's `stage.files` seeds an empty stage, and
its `stage.targets` fills the send field's suggestions
([manifest-fields.csv](manifest-fields.csv)).

- **Add** has three panes behind a segmented pill, each holding its own state:

  | Pane | Answers | Rows |
  | --- | --- | --- |
  | **Browse** | where does it live | repos, then folders, then files; crumbs walk back up |
  | **Recent** | what changed lately | the cross-repo sweep, narrowed by single-select repo badges |
  | **Search** | what is it called | filename-contains across every root repo |

  Browse and Search share one recursive tree read per repo. A file row stages
  on one tap and unstages on a second. Local files come in through the
  paperclip in the header.
- **Rename** applies to local items. The pencil turns the name into an input;
  Enter or a blur commits, Escape cancels. A slash makes a subpath under the
  destination. An extension guessed from the content (the item's `sniffed`
  flag) draws with a dotted underline until a rename, since the extension picks
  the reader's mode and the deposited file's type. Ref items do not rename,
  because a ref's path is its identity at its source.
- **Out** is the deposit surface. The concatenated bundle puts each file under
  a `// === owner/repo[@ref]:path ===` header and offers refresh, copy and
  download. The send to a repo takes a tap-through folder selector and a
  two-tap Send. The base...head branch compare is in the Branches view.
- **Persistent link** copies a `#stage=` URL that reopens the stage elsewhere.
  Pasted text rides in `&gz=`; a local binary is left out and has to be sent to
  a repo.

## The reader

Tapping a staged item opens the reader, an overlay that walks the staged set by
swipe, header arrows or arrow keys, with a GitHub jump-over to a ref's source.
Every position opens, so no step skips: a local binary renders as an image, and
a failed fetch renders a note.

- Copy, in the header, writes the item's text as staged rather than the
  viewer's display, which halves each run of four spaces.
- The overlay is a fixed height, `h-full` on a phone and `85vh` above. An auto
  height leaves the viewer no definite height, so long files stop scrolling;
  [`node/test/stage-reader-height.mjs`](../node/test/stage-reader-height.mjs)
  (`npm run test:reader-height`) holds the fixed height.
- The reader announces the file on screen on the subject channel
  ([`kits/subject-channel.js`](../lib/kits/subject-channel.js)), so the FAB
  drawer names that file, roots its path picker at the file's repo and ref, and
  aims its GitHub menu there. A local item announces `local`. No `base` is
  announced, since the drawer's compare bar would not change the reader's
  comparison. Choosing another ref in the drawer's ref bar stages that version
  and reads it, leaving the walked set in place.

## The comparison

With two or more items staged, the reader's header carries a Compare button,
titled with the pair (`Compare a.md ↔ b.md`). The comparison opens as a level
over the reader, through `swipeDeck.drill`: its dismiss is a back chevron, and
Escape and the phone Back button return to the reader. The comparison walks the
same set, and backing out lands at the position the walk reached.

Side A is the file on screen at every position. Side B defaults to the
neighbour and can be picked from the other staged items, each listed with its
origin (`owner/repo@ref`, or `local`). The pick is held by item key, so a paste
or a removal does not re-aim it. The pick lapses when the reader closes or the
picked item leaves the stage. A stage of one has nothing to compare.

The comparison offers three views of one alignment:

| View | Is | Default |
| --- | --- | --- |
| **Unified** | one column of tagged lines, full context | under 768px |
| **Split** | two columns, a changed line and its replacement on one row, with the moved words marked inside it | 768px and up |
| **Patch** | a real unified diff: `@@` hunks at three lines of context, the two file lines, copyable | never |

The default is read from the width once, at mount, as on
`pages/diff-tool.html`; a chosen view persists after the comparison closes.
The comparison carries Copy (the patch in Patch view, the tagged block
otherwise), the review prompts (a link's `&prompts=` asks first, then the fixed
six), and **Open in Diff**, which hands the pair to the Diff page for its
folding and its apply step. The diff is a patience diff over lines with a
word-level diff inside each changed pair, capped at 600 tokens a side, from
[`kits/text-diff.js`](../lib/kits/text-diff.js), which the Diff page shares.

## Standoff notes: a comment that is content

The speech bubble on a staged row opens a note editor above the staged set.
Committing a note stages a local item named `<subject>.note.md`, where
`<subject>` is the subject's deposit-relative path, so the pair lands side by
side. The note deposits, bundles and links like any other file:

```
---
about: rates.json
added: 2026-09-13
source: me/data@trunk:pulls/rates.json
---

The OFM rate pull. The last two columns are unlabelled.
```

`about:` names the subject by basename, which resolves from the folder the note
lands in. `source:` appears on a note about a ref and records the repo and ref
that the deposit would otherwise lose. A separate file works for every format,
including JSON, which takes no comment. Renaming the subject renames its note
and rewrites `about:`; removing the subject removes its note. An emptied note
removes the file. A `#gz=` link carries both files but not the binding, so a
reopened note is an ordinary staged file. In `mehrlander/home`, the `/drain`
skill reads a note before classifying its subject.

## The `#stage=` link grammar

```
#stage=owner/repo[@ref]:path1,path2;owner2/repo2:path3
```

Groups are `;`-separated, paths `,`-separated within a group, `@ref` optional
(absent means the source repo's default branch). Paths are URL-encoded per
component with `/` left readable. The link carries **refs only**; file content
stays behind the viewer's token. Full base:

```
https://mehrlander.github.io/web-tools/app/#stage=owner/repo@ref:path1,path2
```

Mint one by hand by grouping items by `repo@ref` and joining. Example: two files
from a branch of this repo plus one from another repo →

```
…/app/#stage=mehrlander/web-tools@my-branch:lib/gh-api.js,lib/stage.js;mehrlander/home:inbox/note.md
```

### The link is four parts

Of a stage link's four parts, only the refs are token-gated.

| Part | Params | What rides |
| --- | --- | --- |
| **Refs** | the `#stage=` spec above | pointers only, so the files stay behind the viewer's token |
| **Content** | `&gz=` | pasted text items in full, gzipped, needing no token |
| **Commentary** | `&prompts=` | a list of `{label, ask}` review asks |
| **Intent** | `&mode=`, `&cmp=`, `&view=`, `&dest=` | what to open on, which pair, which reading, where a send is aimed |

`StageLink.mint` and `StageLink.mintWithLocals` (async, which folds pasted text
into `&gz=`) write the link; `StageLink.parseLink` and `StageLink.read` read it.

### Content: the `&gz=` param

A local text item rides in the link as `[{name, text}]` JSON, gzipped and
base64url'd. The payload budget is `GZ_MAX` (24 KB), and `encodeLocals` throws
over it with both sizes. A local binary cannot ride. A stage holding only pasted
text leads with `#gz=` rather than an empty `#stage=`:

```
…/app/#gz=<base64url(gzip(JSON))>&mode=diff&prompts=<base64url(JSON)>
```

That form is the token-less review handoff: a before and an after that exist
only as text, compared by a reader with no token and no access to the source
repo. [`node/test/stage-gz-review.mjs`](../node/test/stage-gz-review.mjs)
(`npm run test:gz-review`) holds it with `api.github.com` blocked.

From a session, mint from local files:

```bash
npm run -s stage-link -- Do-Thing.ps1                # opens on the file (&mode=read)
npm run -s stage-link -- before.md after.md --diff   # opens on the comparison
```

[`node/stage-link.mjs`](../node/stage-link.mjs) prints the link on stdout and
the sizes on stderr. It carries UTF-8 text: it drops a leading byte-order mark
and refuses a file that is not UTF-8 or that exceeds `GZ_MAX`.

### Short text: the `#take=` param

`#take=<percent-encoded text>` carries one piece of text with no gzip, for an
iPhone shortcut, which can URL-encode but not gzip. `name=` optionally names
the text. `take` is always the last param and runs to the end of the fragment,
so a `name` goes before it. The text goes through the same fold as a paste, and
a reload of the same link does not stage it twice.

### Commentary: the `&prompts=` param

`prompts=` is a base64url'd JSON list of `{label, ask}` review asks. The asks
are authored text rather than pointers, so they ride the link whether the
content does or not:

```
…/app/#stage=owner/repo@ref:before.md;owner/repo@head:before.md&prompts=<base64url(JSON)>
```

The comparison lists these asks first, marked with a sparkle, above its six
fixed prompts. Each prompt copies both texts, the diff and the ask, for an
independent second opinion in a separate chat. Write two to four asks about
what is at stake in the particular edit (a number, a term, a claim that
changed); the fixed six cover the general reads. A soft cap of 24 entries keeps
the URL in bounds.

### Intent: `&mode=`, `&cmp=`, `&view=`, `&dest=`

`&mode=diff` opens the reader with its comparison drilled over it, so a review
link lands on the comparison. `&mode=read` opens the reader on the first staged
file, so a script carried in `&gz=` opens ready to copy. Without either, the
stage opens on the bench. `&cmp=` names the item for side B, and `&view=` picks
`unified`, `split` or `patch`; the stage ignores either one when it does not
resolve, since a link outlives the set it was minted from. `&dest=` prefills
the send field with `owner/repo[@ref][:dir]`; nothing sends without the user's
own taps.

### Where the object is read from

`StageLink.read(location)` reads the **hash first, then the `?query`**, with
the same keys (`stage`, `gz`, `prompts`, `mode`, `cmp`, `view`, `dest`). The
fragment is the default and the private form. The query form serves a context
that drops the `#`: a `toss-render` srcdoc, whose params shim answers `?query`
lookups, an email or chat that strips the fragment, or a deep link. When
minting a query-form link into a toss `#gh=` address, encode the inner `&`
separators as `%26` so the toss's hash parser keeps them inside the `gh=`
value.
