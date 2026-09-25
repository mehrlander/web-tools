# Writes

`?view=writes`, a pane of the Activity stop, classifies the estate's commits by
what wrote them, using [`lib/kits/write-kinds.js`](../../lib/kits/write-kinds.js)
(whose header explains the reading). It renders from the activity cache's newest
thirty commits per repo, states the window those rows cover, and offers one
control to read a hundred per repo.

| | Kinds | Signal |
| --- | --- | --- |
| development history | session, merge, CI, authored | the author the platform sets, or a merge subject |
| application state | crawl, tap, device | a subject this estate writes on purpose |

`device` is the one heuristic and is marked `?`. `authored` is the residual.

## The app's commit-subject contract

The app, the phone (`Log-Repo` in `mehrlander/shortcut-tools`) and PR merges all
commit as the account owner, so **the subject line is the only signal**, and
its shape is a contract that `write-kinds.js` reads:

- **`via Web Tools`** marks a write a person made by tapping in the app: a jot,
  to-do or pin, a `.web-tools.json` save, an estate join or set-aside, a
  proposal applied or retired, an errand closed, a stage deposit. Add it to
  any new person-initiated write.
- **Crawl writes carry no trailer.** The cache refreshes (`state/configs.json`,
  `state/activity.json`, `state/sessions.json`, `state/calls.json`) run on a tab
  arrival as well as on Refresh, and their subjects name the derived file.

Changing a subject shape means changing `write-kinds.js` in the same commit.
