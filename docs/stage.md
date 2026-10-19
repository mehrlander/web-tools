# The stage: the Web Tools app's working surface

The stage (`?view=stage`) is where a cross-repo fileset is assembled, read,
compared and sent. It is `store.stage`: a list of `{repo, ref, path}` refs, plus
local items from pastes, drops and dictation, so one stage spans repos. The view,
its intake (`StageIntake`) and its link codec (`StageLink`) are in
[`lib/alpineComponents/stage.js`](../lib/alpineComponents/stage.js). The app
around the stage is documented in [APP.md](APP.md), including the token
requirement that every `#stage=` handoff states.

The stage does not save. A curated set is a `.surface` file
([envelopes/surface.md](envelopes/surface.md)).

## Intake

A paste reads every format on the clipboard, each called a flavor. It stages a
file if the clipboard holds one, else the plain text, and every flavor appears as
a pill on a **flavor bar** above the staged list, the taken one ticked. Each pill
carries a menu of what can be done with its flavor: Copy, Markdown, Base64 and
Decoded. A conversion lands on the bar as a new pill rather than opening the
reader. A conversion's markdown opens raw, where every other `.md` in the app
renders, because it is a payload to copy.

A chip on a staged row, and in the reader's header, opens the transform workbench
([`transform-workbench.js`](../lib/alpineComponents/transform-workbench.js)) on an
item that `StageIntake.transformKindOf` recognizes: a workbench bundle, rows (a
`.csv`, a `.tsv` or a JSON array of records) or a `rows => rows` transform. The
workbench mounts fresh on each open. A workbench bundle opens in the workbench as
it arrives, where any other new item opens in the reader.

**iOS Safari fires no `paste` event unless an editable is focused**, so the app
header and the bench each carry a Paste button, which reads through
[`kits/io.js`](../lib/kits/io.js). Reading the clipboard needs the tap's own user
activation: awaiting anything before the read spends it, and the read then fails
as though the clipboard were unavailable. The
[`ios-clipboard`](../skills/ios-clipboard/SKILL.md) skill holds the recipe.

## The bench

The bench holds **Out** and the staged set, side by side in a wide Stage and
stacked in a narrow one. A repo manifest's `stage.files` seeds an empty stage,
and its `stage.targets` suggests send destinations
([manifest-fields.csv](manifest-fields.csv)).

- **Add** has three panes behind a segmented pill:

  | Pane | Answers | Rows |
  | --- | --- | --- |
  | **Browse** | where does it live | repos, then folders, then files |
  | **Recent** | what changed lately | the cross-repo sweep, narrowed by repo badges |
  | **Search** | what is it called | filename-contains across every root repo |

  Local files come in through the paperclip in the stage's header.
- **Rename**, the pencil on a local item's row, renames the item; a slash in the
  name makes a subpath under the send destination. An extension guessed from the
  content (the item's `sniffed` flag) draws with a dotted underline until a
  rename. Ref items do not rename, because a ref's path is its identity at its
  source.
- **Out** holds the concatenated bundle, each file under a
  `// === owner/repo[@ref]:path ===` header, and the send to a repo.
- **Persistent link** copies a `#stage=` URL that reopens the stage elsewhere.
  Pasted text rides in `&gz=`; a local binary is left out.

## The reader

Tapping a staged item opens the reader, an overlay that walks the staged set by
swipe, header arrows or arrow keys.

- Copy, in the reader's header, writes the item's staged text rather than the
  viewer's display, which halves each run of four spaces.
- The overlay has a fixed height, because an auto height stops long files from
  scrolling; `npm run test:reader-height` checks it.
- The reader announces the file on screen on the subject channel
  ([`kits/subject-channel.js`](../lib/kits/subject-channel.js)), so the FAB
  drawer describes that file.

## The comparison

With two or more items staged, the reader's Compare button opens the comparison
as a level over the reader, through `swipeDeck.drill`, so Back returns to the
reader at the position the comparison reached. Side A is the file on screen at
every position. Side B defaults to the neighbour and can be picked from the other
staged items; the pick is held by item key, so staging or removing items does not
re-aim it.

| View | Is | Default |
| --- | --- | --- |
| **Unified** | one column of tagged lines, full context | under 768px |
| **Split** | two columns, a changed line and its replacement on one row, with the moved words marked inside it | 768px and up |
| **Patch** | a real unified diff: `@@` hunks at three lines of context, copyable | never |

The comparison also carries Copy, the review prompts and **Open in Diff**, which
hands the pair to the Diff page. The comparison and the Diff page share
[`kits/text-diff.js`](../lib/kits/text-diff.js).

## Standoff notes: a comment that is content

The speech bubble on a staged row writes a note about that item: a local item
named `<subject>.note.md`, where `<subject>` is the item's deposit-relative path,
so the pair lands side by side. The note deposits, bundles and links like any
other file:

```
---
about: rates.json
added: 2026-09-13
source: me/data@trunk:pulls/rates.json
---

The OFM rate pull. The last two columns are unlabelled.
```

`about:` names the subject by basename. `source:` appears on a note about a ref
and records its repo and ref. Renaming or removing the subject renames or removes
its note. A `#gz=` link carries both files but not that binding.

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
base64url'd, within a payload budget of `GZ_MAX` (24 KB). A local binary cannot
ride. A stage holding only pasted text leads with `#gz=` rather than an empty
`#stage=`:

```
…/app/#gz=<base64url(gzip(JSON))>&mode=diff&prompts=<base64url(JSON)>
```

That form is the token-less review handoff: a before and an after that exist
only as text, compared by a reader with no token and no access to the source
repo.

From a session, mint from local files:

```bash
npm run -s stage-link -- Do-Thing.ps1                # opens on the file (&mode=read)
npm run -s stage-link -- before.md after.md --diff   # opens on the comparison
```

[`node/stage-link.mjs`](../node/stage-link.mjs) prints the link on stdout and
refuses a file that is not UTF-8 text or that exceeds `GZ_MAX`.

### Short text: the `#take=` param

`#take=<percent-encoded text>` carries one piece of text with no gzip, for an
iPhone shortcut, which can URL-encode but not gzip. `name=` optionally names the
text and goes before `take`, which runs to the end of the fragment.

### Commentary: the `&prompts=` param

`prompts=` is a base64url'd JSON list of `{label, ask}` review asks, which ride
the link whether the content does or not:

```
…/app/#stage=owner/repo@ref:before.md;owner/repo@head:before.md&prompts=<base64url(JSON)>
```

The comparison lists these asks above its six fixed prompts; each prompt copies
both texts, the diff and the ask, for a second opinion in a separate chat. Write
two to four asks about what is at stake in the particular edit (a number, a
term, a claim that changed); the fixed six cover the general reads.

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
the same keys, so a link survives a context that drops the `#`, such as a
`toss-render` srcdoc or an email. When minting a query-form link into a toss
`#gh=` address, encode the inner `&` separators as `%26` so the toss's hash
parser keeps them inside the `gh=` value.
