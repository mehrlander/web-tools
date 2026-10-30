---
id: expanding-rows-and-modals-kits-1r7is4
title: Decide a shared component for expanding rows, and replace the Idea board and ACFR modals
status: backlog
opened: 2026-10-25
size: M
---
# Decide a shared component for expanding rows, and replace the Idea board and ACFR modals

The UI codebook's Reach dimension, retired on 2026-10-23 (web-tools #1071), recorded what a tap on a unit opens. Before it went, it showed two interactions the estate builds by hand:

- **Expanding rows: 28 units** open a row in place with code of their own. No shared component draws one, so no `hand_evidence` row flags them, and with Reach gone nothing else lists them.
- **Modals: 4 units** draw a dialog or sheet over the page. The task first read that as built by hand beside `lib/alpineComponents/sheet-modal.js`; the 2026-10-30 assessment below found sheet-modal has no adopter and html-style rule 13 avoids modal dialogs, so two are replaced (Idea board, Spend: ACFR) and two stay (Dictate's bottom sheets, FN Explorer's side drawer).

The work: read the expanding rows side by side and decide whether one component would serve most of them (what they share: a toggle, a disclosure body, keyboard, what the address keeps), then build it or record why not; and replace Idea board's Brief dialog and ACFR's printed-page dialog, which the owner decided on 2026-10-30.

### Expanding rows, as coded at 9f1a1f7a

- `web-tools:map/scheduled` (Map: Harness › Automation › Scheduled)
- `web-tools:map/views` (Map: Browser › Views)
- `web-tools:view/config` (Config)
- `web-tools:view/lists` (Lists)
- `web-tools:view/proposals` (Proposals)
- `web-tools:view/state` (State)
- `web-tools:view/tending` (Tending)
- `web-tools:pages/shortcut-log.html` (Shortcut Log)
- `web-tools:pages/text-lab.html` (Text Lab)
- `web-tools:map/dimensions` (Map: Browser › Dimensions)
- `web-tools:map/watch` (Map: Watch › Triggers)
- `web-tools:map/public` (Map: Watch › Public)
- `web-tools:map/names` (Map: Watch › Names)
- `web-tools:pages/review.html` (Review)
- `home:budget-drs/reversions/+1st supp` (Reversions: +1st supp)
- `home:budget-drs/reversions/+2nd supp` (Reversions: +2nd supp)
- `home:budget-drs/reversions/Enacted` (Reversions: Enacted)
- `home:budget-drs/reversions/Final` (Reversions: Final)
- `home:budget-drs/spend/Vendors` (Spend: Vendors)
- `home:budget-drs/cem/Overview` (CEM: Overview)
- `home:budget-drs/cem/Reconciliation` (CEM: Reconciliation)
- `home:budget-drs/cem/Results` (CEM: Results)
- `home:projects/pension-landscape/display/explorer.html` (Pension systems)
- `home:budget-drs/submittal/Overview` (Submittal: Overview)
- `home:budget-drs/submittal/General` (Submittal: General)
- `home:budget-drs/submittal/Decision packages` (Submittal: Decision packages)
- `home:budget-drs/submittal/Filed before` (Submittal: Filed before)
- `home:budget-drs/submittal/Measures` (Submittal: Measures)

### Modals, as coded at 9f1a1f7a

- `web-tools:pages/dictate.html` (Dictate)
- `web-tools:pages/idea-board.html` (Idea board)
- `home:budget-drs/spend/ACFR` (Spend: ACFR)
- `fn-data:distill/explorer.html` (FN Explorer)

## Related

- `lib/alpineComponents/sheet-modal.js`: the existing sheet component the modals would use
- `docs/kits.csv`: the kit registry, where a new expanding-row kit would get its row
- `data/ui-units/coded.csv`: the units' `built_on` and `hand_evidence`; the retired `reach` column is at 9f1a1f7a and earlier
- web-tools #1071: the pull request that retired Reach and Binding

## Done when

Either a shared expanding-row component exists and the units that fit it use it, or a dated note here says why the rows stay as they are; and Idea board's brief and ACFR's printed pages no longer open in a dialog.

## Progress log
- 2026-10-25: filed from the Reach codes as they stood when the dimension was retired on 2026-10-23. Two units in that snapshot have since left the app (Jot, and budget-drs's Fund Projection tab) and are not listed.
- 2026-10-30: assessed the modal half; no code or codebook row changed. The premise, that the four "built by hand" because `sheet-modal.js` is missing from `built_on`, does not hold as stated: sheet-modal has no adopter outside its demo, the estate's working modal is a native `<dialog>` opened with `showModal()` in daisyUI's modal classes (10 files across `lib/`, `pages/` and the budget-drs app, 4 of them in `lib/`), its overlay for documents and records is the deck takeover (`swipeDeck.open`, `recordDeck`, `fileDeck`: 28 calling files), and html-style rule 13 with peeve P67 (3fe99ae8, 2026-10-30) now says to avoid modal dialogs. Per unit: Dictate's three bottom sheets (`pages/dictate.html:5473`, `:5552`, `:5700`) are a justified departure, since they bind live page state that sheet-modal's moved-slot defect can freeze, though none closes on Escape or moves focus; Idea board's Brief (`pages/idea-board.html:283`, a daisyUI `<dialog :open>`) duplicates sheet-modal's desktop form and is the plainest P67 case; Spend: ACFR's modal is a native dialog for the printed ACFR page (home `projects/budget-drs/app/view/views/acfr-evolution.js:100`, `:131`), and its `hand_evidence` cites the held schedule panel's Escape (now `composition.js:1684`), not the dialog; FN Explorer's side drawer (mehrlander/fn-data `distill/explorer.html:565`, `:1858`) is a justified departure on a page with no Alpine, Tailwind or daisyUI. Proposed, awaiting the owner: Idea board's brief becomes a panel-tip, ACFR's printed page opens in the deck takeover as budget-drs's Benefits view already does (`benefits.js:339`), Dictate and FN Explorer keep their own with these reasons recorded, the ACFR row's evidence is corrected, and sheet-modal is retired. The done-when line above ("uses `sheet-modal.js` or has its reason recorded") should change with that answer. Screenshots at 1280 and 390 are in session 55569b04.
- 2026-10-30: owner's direction on the modal half. Idea board's Brief dialog goes, replaced by another form (proposed: a Brief card at the head of the list and strip, mirroring the Selection card at its end). Spend: ACFR's printed page opens in the deck takeover, the standard for documents (proposed: the same section across FY2019 to FY2025, opening at the tapped year, as budget-drs's Benefits view does in `benefits.js:339`). FN Explorer's side drawer does not read as a modal in the shots, so it stays as it is. Dictate's bottom sheets are a special case and stay. sheet-modal's fate is not decided. With these, the modal half is two changes, one in web-tools and one in home, and the done-when line above should be rewritten to name them when the work is claimed.
- 2026-10-30: modal half delivered for review: mehrlander/web-tools#1164 (Idea board's brief as the first card of the list and strip) and mehrlander/home#899 (ACFR's printed pages as a deck of seven years, docked at lg), both on branch `claude/admiring-lovelace-5e00sf`, each with its UI-units row re-coded. Title, the modal bullet, the work and the done-when reframed to the owner's direction. sheet-modal's fate stays undecided; the expanding-rows half is untouched.
- 2026-10-30: modal half merged: mehrlander/web-tools#1164 (95938ce9) and mehrlander/home#899 (239e2e21), CI and the laptop's verify-artifacts green. Of the four modal units, Idea board and Spend: ACFR no longer open a dialog; Dictate and FN Explorer stay by the owner's decision. sheet-modal's fate is still undecided. What remains of this task is the expanding-rows half.
