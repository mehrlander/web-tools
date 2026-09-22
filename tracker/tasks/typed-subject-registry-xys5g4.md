---
id: typed-subject-registry-xys5g4
title: Type the subject on screen, and give the showing axis a registry
status: in-progress
opened: 2026-09-22
session: claude/serene-einstein-dyr03b
project: show-repo
size: M
---
# Type the subject on screen, and give the showing axis a registry

The FAB drawer's top strip names what carries the view (app, renderer,
page) and not what the reader is looking at. On the deployed Web Tools app
the one-layer strip reads `app PAGE`, and the Render tab under it offers a
file picker and a branch dropdown, so the app reads as one more file being
rendered and picking a JSON file swaps the app for a data view with nothing
saying a category was crossed.

What is on screen is a subject of one type, and the type is what the strip
should say. `docs/routes.json` already carries the type list as the showing
frame's `subject` axis (a page renders itself, a file needs a renderer, data
needs a viewer, a fileset needs an envelope, a repo needs a browser), and two
registries key on it: `routes-kinds.subject` by test, `showing-mechanisms.subject`
by paraphrase. Promote that axis to `docs/subjects.csv`, extend it with the
estate's objects (estate, project, branch, session), and join the two
registries to it by key. Views are not subjects: they are the app's own
closed vocabulary over the estate or a repo, so a view rides as the label
under the subject (Estate · Activity › Sessions, Repo · home › Atlas).
Promotion (`appView`) and estate membership are attributes of a page or repo
subject, not types, and the Tools view names no type the model has.

The FAB derives the type from the address the same way `readLayers` derives
the stack from the frames: the one-layer strip captions the subject's type
instead of `page`, the Render tab's identity block leads with the typed
subject, and each layer row's glyph takes the type's icon from the registry.

## Related

- `docs/routes.json`: the `showing.axes.subject` list this promotes; the version and viewer axes stay.
- `docs/routes-kinds.csv`, `docs/showing-mechanisms.csv`: the two `subject` columns that become keys.
- `docs/app-routes.csv`: its `group` column (estate, repo, shell) is the subject type a view takes; re-glossed, not renamed.
- `docs/show-repo.md`: the sidebar paragraph listed files and branches among a repo's views while its own list below says Files is a route out; the model exposes that wobble.
- `lib/alpineComponents/fab.js`: `readLayers`, `layerIcon`, the Render tab identity block.
- `tools/test/routes-manifest.test.mjs`, `tools/test/fab-layers.test.mjs`: the checks that hold the join and the derivation.

## Done when

`docs/subjects.csv` is a registered registry with a test; routes-kinds and
showing-mechanisms carry subject keys checked against it; the Map's Showing
tab renders the axis from it; the FAB's one-layer strip and identity block
name the typed subject on the deployed app, a repo, a project, a branch
brief, a session brief, a tossed file, and a promoted page; the show-repo.md
sidebar sentence agrees with its own list.

## Progress log
- 2026-09-22: filed and claimed on claude/serene-einstein-dyr03b after a design pass in chat that settled the model (subject types, views as labels, promotion as an attribute).
