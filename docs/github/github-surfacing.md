# Surfacing work on GitHub

GitHub provides several native ways to expose repository state. This page is the mechanical reference for those surfaces: branches, commits, compare views, pull requests, permalinks, and serialized diffs. For how this repository hands one of them to a reader in chat, the ⭐/🥏/📦 link vocabulary and the per-file caption format, see the surfacing primitives in [SURFACING.md](../SURFACING.md).

The appropriate surface depends on whether the work is mutable, whether discussion is required, and whether the recipient needs a web view or serialized text.

## Branch

A branch exposes the current file tree. It is mutable and does not by itself show what changed relative to another ref.

## Commit

A commit exposes an immutable repository state and the diff introduced by that commit. Use a commit URL when the reviewed unit is one recorded change.

## Compare view

A [compare view](https://docs.github.com/en/pull-requests/committing-changes-to-your-project/viewing-and-comparing-commits/comparing-commits) shows the difference between two branches, tags, or commits without creating a pull request.

```text
https://github.com/<owner>/<repo>/compare/<base>...<head>
```

GitHub pull requests use a [three-dot comparison](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-comparing-branches-in-pull-requests): the merge base through the head ref.

A compare view is sufficient when the work only needs to be inspected. It also provides the path for creating a pull request from a pushed branch.

## Pull request

A [pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests) turns a comparison into a persistent review object. It adds a description, discussion, line comments, reviews, checks, and merge state.

Use a draft pull request when the work should remain visible and discussable before it is ready to merge.

## File permalink

A [file permalink](https://docs.github.com/en/repositories/working-with-files/using-files/getting-permanent-links-to-files) identifies an exact file version. A [code-snippet permalink](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-a-permanent-link-to-a-code-snippet) can identify a line or line range.

Branch-based file links move as the branch changes. Commit-based links remain fixed.

## Diff and patch

GitHub can return commits and pull requests as [diff or patch representations](https://docs.github.com/en/rest/commits/commits). These are portable change records suitable for tools or external review.

A diff contains changes but not necessarily enough surrounding repository context for independent review. Supply full files, supporting files, or a tree listing separately when required.

## Surfacing an added repository's work

A repository added mid-session with `add_repo` has full Git access through the proxy but no web-interface branch or pull-request controls (see [container.md](../environment/container.md#added-repositories)). Two consequences follow.

A pull request needs a source branch distinct from its target. A direct push to the default branch lands the work but leaves nothing to propose, so commit the work to a separate branch.

With no create-pull-request button, the compare view is the bridge. Push the branch and hand the owner the compare URL:

```text
https://github.com/<owner>/<repo>/compare/<default-branch>...<branch>
```

The signed-in owner sees the diff and a Create pull request control, and the resulting pull request carries their identity. The MCP tools can open the pull request directly instead, but then it is authored by the integration identity, so that step should follow an explicit request.
