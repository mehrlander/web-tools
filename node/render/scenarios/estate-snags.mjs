// screenshot.mjs interaction scenario: the Lists view's Snag tab
// (kits/lists.js, lists/snag.json).
//
//   npm run shot -- app/index.html --query "view=lists&tab=snag" \
//     --script node/render/scenarios/estate-snags.mjs --width 1280 --height 1100
//
// The Lists view is token-gated and this renderer holds no token, so the seed
// flips `authed` and plants the lists straight into the component, as
// estate-lists.mjs does. The snags are five real items from the conversion of
// web-tools' docs/SNAGS.md, so the pixels carry real titles, counts and entry
// lengths. What they prove: the Snag tab's list,
// rows last-bitten first with the ×N badge on a repeat, and, with the query
// switches below, an entry opened in full and the add box filtering to a
// likely repeat with its Again control showing.
//
// Query switches, read from the page's own query string:
//   open=<id>        show that snag's entry
//   q=<words>        type into the add box
const SNAGS = [
    {
      "id": "rename-called-not-worth-it",
      "text": "a stale file name was kept because renaming it was called a migration that buys nothing",
      "note": "When the Lists view's labels went singular, the Jot section's comment kept the file at `lists/jots.json` \"since renaming a data file to match a label is a migration that buys nothing\", and To-do and Pin kept `todo.json` and `pins.json` the same way. On 2026-10-19 a session building created lists (web-tools #993) copied the rule: a renamed list kept its first title's file name, and the view's doc gained a sentence explaining the gap. The owner asked why, and the reason did not hold. A name that disagrees with its label confuses every later reader, which is the large cost. Measured, the rename of the three built-in files touched about 30 files in web-tools, most of them tests and screenshot scripts, and no note was addressed to their items. Suspected cause: a turn that is winding up presents the rename as unimportant rather than unfinished, and the next turn accepts the excuse as a rule. Corrected move: rename when the label changes; when a turn cannot finish the rename, say it is unfinished and leave it as the next step, never as a rule against doing it.\n\n→ [`lib/kits/lists.js`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/lists.js), where a renamed list moves its file (`move`) and the built-in files carry their labels' names",
      "repo": "mehrlander/web-tools",
      "seen": [
        "2026-10-19"
      ],
      "targets": [
        "mehrlander/web-tools:lib/kits/lists.js"
      ],
      "created_at": "2026-10-19T20:33:44.000Z"
    },
    {
      "id": "ci-run-silently-not-started",
      "text": "a commit sat in an open PR with no checks",
      "note": "A push to a PR branch produced no `synchronize` workflow run. Not a failure, not a cancellation, no run at all, so the PR's head commit carried zero checks and the only signal was a `get_check_runs` that returned an empty list. The next push to the same PR ran normally, so nothing is broken; what correlated was pushing the branch and then its base branch within the same minute, which moves the merge ref the `pull_request` event is computed against. **After a push you care about, confirm a run exists for the new head sha** instead of assuming the trigger fired. The general form is the one worth carrying: a green check and an absent check look the same from a distance, and only the first is evidence.\n\n**The cause is no longer unconfirmed**, and this entry said it was for a month while the answer sat in its own `→` target. Measured 2026-08-13 on PR #413 and again 2026-09-10 on PR #642: main moves under the branch, the merge goes `dirty`, and a `pull_request` run is computed against a merge ref a conflicted PR does not have, so no run starts. Pushing the base inside the same minute is one way to leave that ref unavailable; an outright conflict is the durable way. So the corrected move gains a second step: **when no run appears, read `mergeable_state` before anything else**, and if it is dirty, merge the base in, take the base's side on every derived artifact and regenerate rather than hand-merging, then push.\n\nWhat made the third trip expensive was not the missing run, it was reporting around it: four commits went out over an hour, each with a local suite result quoted in chat, while the platform had said nothing about any of them. A local run is evidence about the tree, never about the PR.\n\n**Fourth trip, and the corrected move above worked.** PR #677 sat with zero checks while sibling PRs opened minutes later ran normally; `mergeable_state` was `dirty`, main having merged #675 between the branch point and the push. One base merge, `docs/harness.csv` regenerated rather than hand-merged, and the run queued on the new head. What still cost two round trips was reading `get_status` twice before reading `mergeable_state` once: the entry says to read mergeability *first*, and an empty check list is not a state worth polling.\n\n**Fifth and sixth trips, both on one PR in one session, and the cause has a name.** #679 hit it twice in an hour: main merged underneath, `docs/docs.csv` conflicted, `mergeable_state` went `dirty`, and the head sat at zero checks. The new part is not the trip, it is the link: every conflict was a derived word count and nothing else, which makes `derived-field-conflicts-per-branch` below the *cause* of this entry in this estate rather than a separate annoyance. A branch that adds a test moves that count, so any two branches that each add one collide on a line neither wrote, and the collision spends its cost here. Reading `get_check_runs` first both times cost the round trip the fourth-trip note already warned about, which is the third session to pay it: an empty check list is not a state worth polling.\n\n**One CAUSE was removed on 2026-09-15 (#682), and this entry stays open anyway.** The merge driver at `derived-field-conflicts-per-branch` below ends the derived-count collisions that produced four of these six sightings. It does nothing for the rest: pushing a branch and its base inside the same minute still leaves no merge ref, and so does any conflict a person actually has to resolve. The corrected move is unchanged and is the durable part. **When no run appears, read `mergeable_state` before anything else**, because an empty check list is not a state worth polling.\n\n**Seventh trip, first filed as an entry of its own** (`conflicted-pr-queues-no-ci`). A PR at `mergeable_state: dirty` queued no `pull_request` run, and pushing again did not help. It added one fact: `workflow_dispatch` against the branch attaches a check without a push. Since 2026-10-06 `test.yml` also runs on a push to a session branch, so a pushed head gets a check whether or not GitHub can build its merge ref.\n\n→ [.github/workflows/test.yml](https://github.com/mehrlander/web-tools/blob/main/.github/workflows/test.yml), whose header carries the measured cause.",
      "repo": "mehrlander/web-tools",
      "seen": [
        "2026-08-06",
        "2026-09-10",
        "2026-09-10",
        "2026-09-14",
        "2026-09-14",
        "2026-09-14",
        "2026-09-16"
      ],
      "targets": [
        "mehrlander/web-tools:.github/workflows/test.yml"
      ],
      "created_at": "2026-08-06T15:03:58.000Z"
    },
    {
      "id": "untracked-file-invisible-to-the-suite",
      "text": "a local green over a file the scanner never enumerated",
      "note": "`npm test` passed twice, 2707/0, over a brand-new `docs/routes-paste.csv` carrying three column names the field vocabulary did not account for. CI caught it on the first push. Nothing was flaky and nothing differed about the runner: `python/text-carriers.py` enumerates the files it scans with `git ls-files`, which lists tracked files only, so an untracked new file is not absent from the check's answer, it is absent from its QUESTION. The suite was green by omission, and a green suite is the one thing that reads as permission to push. Any check that walks the repo through git inherits this, so the corrected move is to `git add` a new file before trusting a local suite run over it, which costs nothing and does not commit anything. The tell is a check that fails on the first push and on nothing you changed since. **Three sightings on three consecutive days**, in two branches that did not know about each other:\n\n| | new file | local | on push |\n| --- | --- | --- | --- |\n| 2026-08-28 | — | green | red |\n| 2026-08-29 | `docs/aims.json`, a field the vocabulary did not account for | 2804/0 | red |\n| 2026-08-30 | `skills/state-the-rule/runs/…/standoff.json` | 2810/0 | red |\n\n**The entry is not the fix, and the third sighting is the proof.** By then this was the newest entry in the log with its corrected move already written down, and the session that hit it had that move in context. Reading costs nothing and did not happen, twice. So it is now mechanical: [../node/test/untracked-carriers.test.mjs](https://github.com/mehrlander/web-tools/blob/main/node/test/untracked-carriers.test.mjs) fails when a governed file sits in the working tree and not in the index, which is the condition under which every other gate's green means nothing. Fixing the eleven enumerators would have been the wrong altitude, since they read the tracked set deliberately and two say so in their own docstrings; what was missing was the one check that notices they are reading a tree the push will not produce. Its own first run failed on itself. → [../python/text-carriers.py](https://github.com/mehrlander/web-tools/blob/main/python/text-carriers.py), and the gate at [../node/test/text-vocabulary-conformance.test.mjs](https://github.com/mehrlander/web-tools/blob/main/node/test/text-vocabulary-conformance.test.mjs)",
      "repo": "mehrlander/web-tools",
      "seen": [
        "2026-08-28",
        "2026-08-29",
        "2026-08-30"
      ],
      "targets": [
        "mehrlander/web-tools:python/text-carriers.py",
        "mehrlander/web-tools:node/test/text-vocabulary-conformance.test.mjs"
      ],
      "created_at": "2026-08-28T22:40:42.000Z"
    },
    {
      "id": "line-clamp-is-not-a-height",
      "text": "the utility collided with a display four times in one branch, then failed only on the phone",
      "note": "`line-clamp-N` sets `display`, so a second display utility on the same element silences it. Three sightings in `lib/kits/session-export.js` on 2026-09-01, hours apart: `block` beside the ask's clamp (measured at `display: block` with `-webkit-line-clamp: 2` side by side, and a 269px row), `flex` beside the reply preview's, and `hidden` reached for as the way to withdraw that preview. The corrected move for the third is an inline `display`, which beats both classes and restores the clamp's own on `''`. The fourth sighting is the one a desktop cannot show: the clamp counts LINE BOXES, so a container of `<p>` blocks is outside what it does. Chrome clamps anyway; iOS Safari keeps the box at the full height of every paragraph and hides only the spill, which is how the session brief's closing reply reached a phone as three lines over an inch of empty card. A container of blocks takes a `max-height` with a mask, never a clamp. That fourth case was removed with its block on 2026-09-06 and the rule is kept for the next container of blocks that wants clamping; the first three are live. → [`lib/kits/session-export.js`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/session-export.js) carries the worked cases, gated in `node/test/session-export-open.test.mjs`.",
      "repo": "mehrlander/web-tools",
      "seen": [
        "2026-09-02"
      ],
      "targets": [
        "mehrlander/web-tools:lib/kits/session-export.js"
      ],
      "created_at": "2026-09-02T03:51:27.000Z"
    },
    {
      "id": "house-style-not-consulted",
      "text": "built a page with stat cards, page prose, and small type, against a doc that forbids all three",
      "note": "The house style exists precisely because these corrections recur, and the `daisy-alpine` skill carries \"No stat cards\" as its first rule and is installed ambient so it fires on artifact work unprompted. It did not fire, and the session did not invoke it either, so the page was built and shipped before anyone looked at the rule. Availability is not invocation, which the estate already knows about `/web-tools`: **load the skill before writing a page, do not wait for it to trigger.** The tell is cheap, since `stats`, `stat-value`, or a tile grid in a diff is a defect by definition. The 2026-08-29 recurrence adds the mechanism: the session loaded the bundled `dataviz` skill, whose form heuristic offers \"a stat tile or hero number\" as a legitimate answer, so a general skill actively recommended the thing the house rule forbids while the local rule sat unloaded. **A bundled skill's defaults are not the house style; load the local rule before a general one that overlaps it.** Neither scanner covers the gap either: `stranded-titles.py` and `dead-opacity.py` default to `lib/`, `app/`, `pages/`, so a page built in `dump/` is checked by nothing. → [the house style](https://github.com/mehrlander/web-tools/blob/main/skills/html-style/SKILL.md)",
      "repo": "mehrlander/web-tools",
      "seen": [
        "2026-08-04",
        "2026-08-29"
      ],
      "targets": [
        "mehrlander/web-tools:skills/html-style/SKILL.md"
      ],
      "created_at": "2026-08-14T21:31:46.000Z"
    }
  ];

export default async function (page) {
  await page.waitForSelector('[x-data*="estate"]', { timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.evaluate(async (snags) => {
    if (!window.Lists && window.gh?.load) await window.gh.load('kits/lists.js');
    const q = new URLSearchParams(location.search);
    const data = Alpine.$data(document.querySelector('[x-data*="estate"]'));
    data.authed = true;
    data.hasToken = () => true;
    data.armPingPoll = () => {};
    data.todoLoading = data.jotLoading = data.pinLoading = data.snagLoading = data.createdLoading = data.pingLoading = false;
    data.pinItems = []; data.todoItems = []; data.jotItems = []; data.pingItems = []; data.createdLists = [];
    data.snagItems = snags;
    if (q.get('open')) data.snagOpen = q.get('open');
    if (q.get('q')) data.snagDraft = q.get('q');
    await new Promise(r => setTimeout(r, 500));
  }, SNAGS);
}
