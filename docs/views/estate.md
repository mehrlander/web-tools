# Repos

`?view=estate` (`lib/alpineComponents/estate.js`) is the grid of estate repos.
It reads the config cache (`state/configs.json`) and borrows the activity cache
for each card's rollup. [manifest.md](../manifest.md) owns the manifest fields
and the config cache.

## Membership lives on the repo

- A repo joins by setting `estate: true` in its **own** `.web-tools.json`, and
  every descriptive field (`group`, `note`, `icon`, `order`, `pins`, `landing`)
  is the repo's. The registry holds no per-repo config. Adding a repo and
  editing a card both write the repo's own manifest, never a registry list.
- **Hiding is the exception**: the `hidden` array in the private registry's own
  `.web-tools.json` keeps a member off the dashboard, the sidebar, the app-view
  nav and the activity crawl without touching the repo. The Hidden section
  folds at the foot of the grid, with Show per row.
- `conventions: 'optout'` is the repo saying it is not part of the estate;
  `hidden` is the viewer declining to look. Keep them distinct, and keep the
  session-start nudge for unconfigured repos on the same `optout` field.

## Cards

Grouped by `group`, ordered by `order`. An `owner/foo-private` repo folds into
`owner/foo`'s card by name, with the visibility glyph as the toggle between the
two faces. The gear opens the repo dialog (Info, Settings, Config tabs), which
writes the repo's manifest in place; with no repo, the account row opens the
same dialog as the token panel. Each card also carries its portable-alignment
verdict and four check chips, computed by `lib/kits/portable-align.js` during
the config crawl and read from the cache, not probed. A repo the crawl has not
reached shows no verdict.

## Unfiled

Below the grid, every account repo that is not a member, in three groups:

| State | Set by | Group |
| --- | --- | --- |
| archived | GitHub | Retired |
| `conventions: 'optout'` | the repo's manifest | Set aside |
| neither | | Unfiled |

Adopt routes into the Add form; Set aside writes `optout`; both go through
`patchRepoConfig` and write the repo. Retire is a link to GitHub, not a write,
because the token is `repo`-scoped on purpose and deleting would need
`delete_repo`. A write waits on the config cache's rebuild behind a local
override that retires itself once the cache agrees.

## Signed out

With no token the view shows the public default card and a banner offering a
token or Public browse. No activity, sessions or write controls.
