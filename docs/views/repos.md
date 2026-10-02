# Repos

`?view=repos` (`lib/alpineComponents/estate.js`) is the grid of estate repos.
The older `?view=estate` still opens it.
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
  nav and the activity crawl without touching the repo.
- `conventions: 'optout'` is the repo saying it is not part of the estate;
  `hidden` is the viewer declining to look. Keep them distinct, and keep the
  session-start nudge for unconfigured repos on the same `optout` field.
- An `owner/foo-private` repo shares `owner/foo`'s card, matched by name.

## Cards and the unfiled list

A card's portable-alignment verdict is computed by `lib/kits/portable-align.js`
during the config crawl and read from the cache, never probed live.

Account repos that are not members list below the grid: archived ones (set by
GitHub), ones the repo set aside with `optout`, and the rest. Adopting and
setting aside both write the repo's manifest through `patchRepoConfig`.
Retiring is a link to GitHub, not a write, because the token is `repo`-scoped
on purpose and deleting would need `delete_repo`.
