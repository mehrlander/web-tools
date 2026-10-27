# node/render/fixtures/

Captured GitHub API responses, so a `--script` render can exercise a page's real
network path instead of stubbing over it. A render resolves own-code contents
calls to local files, cannot count on the rest of `api.github.com`, and holds no
token; stubbing a page's own methods instead asserts nothing about the call
itself.

A `--script` routes the API URL to the fixture with `page.route`, which
registers after the harness's catch-all and so takes precedence, and the page's
own `gh.repos()` / `gh.req()` / `fetch` chain runs unmodified. What stays unverified is the wire and the token, which no
sandbox test can cover.

| File | What it is | Captured |
|---|---|---|
| `user-repos.json` | `GET /user/repos?sort=updated&per_page=100`, the listing behind `gh.repos()`. Trimmed to the fields the code reads plus `visibility`/`archived`/`pushed_at` for realism. | 2026-07-30, via the session's repo-listing tool |
| `tree-web-tools.json` | `GET /repos/mehrlander/web-tools/git/trees/HEAD?recursive=1`, the call behind `pathPicker.loadRepo()`. Generated from `git ls-tree -r -t HEAD` in this repo, which is the same shape the API returns. | 2026-07-30, from the working tree |

Re-capture when a shape question comes up, not on a schedule: a fixture that
drifts in irrelevant ways is churn, and these are shape tests, not data tests.

Two rules for a consuming script:

- **Route both `gh.repos()` endpoints.** `/user/repos` fires when authenticated
  and `/users/<owner>/repos` when not, which is the one that fires here; a route
  matching only the authenticated form returns 404 and leaves the picker on its
  one-repo fallback. A token-less viewer gets the narrower public listing.
- **Descend into the repo the tree fixture came from.** One tree fixture answers
  every tree call, so otherwise the rows on screen belong to one repo while the
  crumb names another.

`errand-list.ps1` is not an API capture: it is the PowerShell errand script
[`node/render/scenarios/stage-errand-card.mjs`](../scenarios/stage-errand-card.mjs)
shows on an errand card.
