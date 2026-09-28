# Proposals (`proposals/pending` → `proposals/applied`)

The write-side counterpart to errands, built by `lib/kits/repo-proposals.js` and
reviewed in the **Proposals** view (`?view=proposals`,
`lib/alpineComponents/proposals.js`). A session that cannot reach a repo drops a
proposed edit into the registry; show-repo shows it and commits it to the target
with the user's token, on a two-tap confirm.

A proposal writes to a repo the session could not reach, so **nothing is ever
applied automatically**: page load costs one
directory listing to count what is pending, and the count is all that happens
without a gesture. The nav entry appears only while something is pending, so an
empty channel costs no attention.

A proposal record (`proposals/pending/<id>.json`) carries `id`, `kind`, `repo`,
`path`, `why`, and an optional `ref`. Three of the four kinds write a file:

- **`put-file`** replaces `path` with `content` in full. Use when the session
  knows the file end to end.
- **`set-json-field`** sets one top-level `field` to `value` in a JSON file,
  read-modify-write against whatever the file says at apply time. This is the
  honest kind when the session cannot read the target: it proposes a field, not
  a guess at the rest of the file. Key order is preserved, a new key lands last,
  and the file is re-serialized with two-space indent and a trailing newline.
  **`field` is a literal top-level key, not a path**: there is no dot or bracket
  notation, so `"a.b"` sets a key named `a.b` rather than descending, and a JSON
  file whose top level is an array is refused. The `value` may be any JSON, so a
  key can be set to a whole nested structure; what is missing is addressing into
  one.
- **`unset-json-field`** removes one top-level `field`, the same
  read-modify-write with a delete in place of the assignment, and the same
  literal-key limit. It exists because absence is not expressible any other way:
  `set-json-field` can only assign, and `put-file` needs the rest of the file,
  which a session scoped out of the target repo does not have. A record carrying
  a `value` is refused rather than ignored, since it almost always means a set
  was intended. **A removal that finds nothing to remove is done, not failed**:
  the end state is what was asked for, so it reports through the same *Already
  applied* path below and is retired rather than written again. A missing target
  file counts the same way, so a removal never creates a file.

**The fourth kind performs an act instead**, and the split runs through
everything below. **`delete-issue`** deletes `issue` (a number) from `repo`. It
exists because GitHub REST cannot delete an issue at all: only the GraphQL
`deleteIssue` mutation can, and a sandbox session cannot POST GraphQL, since the
proxy serves pinned operations only. The app holds `GH.graphql` and the user's
token, so the act belongs on the surface that already reviews proposals.

**The kind is named, not general.** A `graphql-mutation` kind carrying an
arbitrary query would let any record reach any mutation the token can reach,
which is capability escalation wearing a data field. One kind per act is what
lets the validator say what a record does, and lets the card show it.

What follows from a mutation having no bytes:

| | |
| --- | --- |
| **no `path`** | nothing on disk is addressed; `path`, `deliver`, and `expectSha` are refused rather than ignored |
| **no delivery** | a commit or a branch is meaningless for an act that touches no file, so the card offers one button, not two |
| **no diff** | the card shows the object it will destroy, read live, in place of a before/after |
| **staleness in issue currency** | optional `expectComments` and `expectTitle` against a live read, since there is no blob sha to pin |

The three preflight checks still run, read in the same order and meaning the
same things: the issue is readable, the deletion is still needed (an issue
already gone reports *Already done, retire it*), and the issue is unchanged
since the record was written. The card says the deletion is permanent, because
GitHub keeps no tombstone: a deleted issue's number is not reused and its URL
404s, so every link and cross-reference to it dies with it. That is worth
saying on the card rather than in a doc nobody has open.

**Three deliveries, and the tap decides.** For the file kinds: a record may
suggest one with `deliver`, but both routes are always on the card, because the
person holding the token knows whether this repo wants a PR today and the
proposing session does not:

| `deliver` | What the apply does |
| --- | --- |
| `commit` (default) | commits straight onto the target ref, the original behavior |
| `branch` | cuts `proposal/<id>` off the target ref and commits there, leaving the target untouched |
| `pr` | the same branch, plus a **draft** pull request |

The PR's title and body are authored from the record: the `why` becomes the
body, a `*-json-field` kind gets its before/after as a fenced block (a removal
showing `(removed)` on the after side), and the
signature and record path go in a footer. It opens as a draft, since marking a
PR ready is the reviewer's move.

PR delivery is the only route that works against a **protected branch**, and it
is the honest one for a code change, since GitHub's diff view reads better than
any card and the PR survives as the durable record. A one-key config edit is
usually better off as a commit.

Two implementation notes worth knowing. Creating the branch needs the Git Data
API (`createRef` in `gh-transfer.js`), since the Contents API can write to a ref
but not make one; an existing `proposal/<id>` is treated as a resume rather than
a collision. And **opening the PR is a separate permission** from writing: a
fine-grained token can carry `contents: write` without `pull_requests: write`,
so a PR failure never erases the branch and commit that already landed. The
record reports both and hands over a compare link.

**Preflight checks, on the card, before the tap.** Every row answers the
premises the proposal rests on, live against the target:

| Check | Means |
| --- | --- |
| **Target is readable** | the file exists and parses (JSON, for the two `*-json-field` kinds) |
| **Change is still needed** | the target does not already carry this exact change |
| **Target unchanged since proposed** | `expectSha` still matches, skipped when none was recorded |
| **declared premises** | each entry in the record's optional `expect: [{ field, equals }｜{ field, absent }]` |

A failing check disables Apply, so a proposal whose premises no longer hold
cannot be tapped through by mistake. **Already applied is a state, not a
failure**: when the target already carries the change, the row says so and
offers **Already done, retire it**, which writes the tombstone without touching
the target. `apply()` refuses such a proposal even if called directly.

**Only a success retires a proposal.** A failed apply used to write the same
`applied/` tombstone as a successful one, so a write that failed marked the
record spent and it vanished from the list without ever landing. A failure is
now kept under `proposals/attempts/<id>-<timestamp>.json`, and the proposal
stays pending. When reading the channel's state, `applied/` means it landed,
`attempts/` means it did not.

**The list drops a row without waiting for the API.** The contents listing is
eventually consistent, so a read a second after the tombstone lands often still
reports the proposal pending, which made applied rows appear to linger. The view
remembers what it retired for the life of the page and filters those names out
of every reload.

**The staleness guard.** A record may carry **`expectSha`**, the blob sha of the
target as it stood when the proposal was written. At apply time a different sha
refuses the write, with the two shas named, and a target that has since been
deleted refuses the same way. This matters most for `put-file`, which replaces
rather than merges and would otherwise erase a change nobody reviewed; the
`*-json-field` kinds merge into current content, so they are safer without one. The
refusal is not the end: the card offers an explicit **Apply anyway**, and a
forced write is stamped `forced` in the applied record along with both shas, so
a deliberate override stays distinguishable from a clean apply. A record with no
`expectSha` behaves as before, last write wins, which is the honest default for
a session that never read the file.

**Provenance.** Three optional fields ride along and are copied into the applied
record: **`by`** (who or what authored it), **`session`** (a link back to the
session that did), and **`authored`** (the date). A proposal is an instruction
to write to a repository, so who issued it, and from where, is part of what a
reviewer is judging. The card shows them under the diff.

A record's optional **`ref` targets a branch**. Both halves honor it: the review
pane reads the target at that ref, so the before/after is that branch's file,
and the write commits to that branch. The branch must already exist, since the
Contents API can write to a ref but not create one. Omitted, `ref` means the
repo's **default branch**, whatever it is named, rather than literally `main`.

Every row **resolves against the live target before it can be applied**, and the
view shows the resulting bytes (a before/after on the key for the JSON kinds; a
line diff for `put-file`, via the shared `kits/text-diff.js`, with side-by-side
panes as the fallback for a new file or a pair past the diff cap), so a reviewer
confirms what will happen rather than what was promised.
A target that cannot be read, or is not the JSON it claims to be, lists as
unresolved with its error and no Apply. The write goes through `gh-transfer.js`'s
`saveRaw` (lazy-loaded, stale-SHA retry), and the outcome is written to
`proposals/applied/<same-name>.json`, which is what marks a proposal spent:
`gh-store` has no delete, so a result file is the tombstone, exactly as for
errands. A successful record carries the landed commit as both `commit` (the
sha) and **`commitUrl`** (the github.com address), so a reader holding only the
JSON can open what actually landed without building the URL by hand.

**A record is an instruction, not a patch.** Nothing in the channel carries a
diff in any format, and none is stored. The before/after in the review pane is
computed when the card renders, against the target as it stands at that moment,
which is why a `(not set)` line is a live fact about the target rather than a
claim made when the proposal was written. A stored diff would describe the file
as it was on the day it was authored and quietly go wrong afterwards. Once
applied, the resulting bytes are an ordinary commit in the target repo, which is
where a durable diff belongs; the `applied/` record keeps the outcome and that
commit's sha.

**Three prose fields, three jobs.** A record is read cold, weeks later, on a
phone, by someone deciding whether to write to a repository. The first attempt
at that put everything in one `why`, which rendered as a wall of text repeating
the same explanation on every card, so they are split:

| Field | Job | On the card |
| --- | --- | --- |
| `summary` | one line: what this does to which repo | always visible |
| `why` | the detail worth reading once: context, provenance, consequence | behind the **Why** toggle |
| `caution` | the judgment call the reader must not scroll past | always visible, amber |

Only `why` is required, and validation still refuses a record without one before
the network is touched. A record carrying just a `why` reads correctly anyway:
its first sentence stands in as the summary and the remainder becomes the
detail, so nothing written before the split needs rewriting. Keep the shared
explanation (what a `scope` field is, say) in `why`, where it collapses, and
keep `summary` specific to the one repo, since that is the line that repeats
down the list.
