# Proposals (`proposals/pending` → `proposals/applied`)

The write-side counterpart to errands, built by `lib/kits/repo-proposals.js` and
reviewed in the **Proposals** view (`?view=proposals`,
`lib/alpineComponents/proposals.js`). A session that cannot reach a repo drops a
proposed edit into the registry; the app shows it and commits it to the target
with the user's token, on a two-tap confirm. **Nothing is ever applied
automatically.**

## The record

A proposal record (`proposals/pending/<id>.json`) carries `id`, `kind`, `repo`,
`path`, `why`, and an optional `ref`. Three of the four kinds write a file:

- **`put-file`** replaces `path` with `content` in full. Use when the session
  knows the file end to end.
- **`set-json-field`** sets one top-level `field` to `value` in a JSON file,
  read-modify-write against the file at apply time. Use it when the session
  cannot read the target. Key order is preserved, a new key lands last, and the
  file is re-serialized with two-space indent and a trailing newline. **`field`
  is a literal top-level key, not a path**: `"a.b"` sets a key named `a.b`, and
  a JSON file whose top level is an array is refused. `value` may be any JSON.
- **`unset-json-field`** removes one top-level `field`, with the same
  literal-key limit. A record carrying a `value` is refused. **A removal that
  finds nothing to remove is done, not failed**, and a missing target file
  counts the same way, so a removal never creates a file.
- **`delete-issue`** deletes `issue` (a number) from `repo`, through GraphQL,
  which the app holds and a sandbox session cannot reach. It takes no `path`,
  `deliver` or `expectSha` (each is refused), has one apply route, and guards
  staleness with optional `expectComments` and `expectTitle`. GitHub keeps no
  tombstone: the deleted issue's URL and every link to it break.

The kind set is closed on purpose. A general mutation kind would let any record
reach anything the token can, so each new act gets its own named kind.

**Prose fields.** `why` is required: the detail worth reading once. An optional
`summary` is one line naming what this does to which repo, and an optional
`caution` is the judgment call a reviewer must not miss. Without a `summary`,
the first sentence of `why` stands in. Keep shared explanation in `why` and the
summary specific to the one repo.

**Provenance.** Optional `by` (who authored it), `session` (a link to the
session) and `authored` (the date) are copied into the applied record.

**`ref`** targets a branch, which must already exist; both the review and the
write use it. Omitted, it means the repo's default branch, whatever it is
named.

## Applying

**Delivery.** For the file kinds, a record may suggest `deliver`, but the
reviewer chooses:

| `deliver` | What the apply does |
| --- | --- |
| `commit` (default) | commits straight onto the target ref |
| `branch` | cuts `proposal/<id>` off the target ref and commits there |
| `pr` | the same branch, plus a draft pull request built from the record |

A PR is the only route onto a protected branch. Opening it needs
`pull_requests: write`, which a token may lack while holding `contents: write`;
then the branch and commit still land and the record says so.

**Preflight checks**, run live against the target before Apply is enabled:

| Check | Means |
| --- | --- |
| **Target is readable** | the file exists and parses (JSON, for the two `*-json-field` kinds) |
| **Change is still needed** | the target does not already carry this exact change |
| **Target unchanged since proposed** | `expectSha` still matches, skipped when none was recorded |
| **Declared premises** | each entry in the record's optional `expect: [{ field, equals }｜{ field, absent }]` |

A failing check disables Apply. A change the target already carries is
retired: the tombstone is written and the target is not, and `apply()` refuses
it even if called directly.

**`expectSha`** is the target's blob sha when the proposal was written. A
different sha, or a deleted target, refuses the write; the reviewer may then
Apply anyway, and the applied record is stamped `forced` with both shas. It
matters most for `put-file`, which replaces rather than merges. Without it,
the last write wins.

**Outcomes.** Only a success retires a proposal. `proposals/applied/<id>.json`
means it landed, and carries
`commit` and `commitUrl`. A failed apply is kept under
`proposals/attempts/<id>-<timestamp>.json` and the proposal stays pending.
`gh-store` has no delete, so the applied file is the tombstone, as for errands.

**A record is an instruction, not a patch.** No diff is stored. The review
computes the before and after against the target as it stands, and the landed
commit is the durable diff.
