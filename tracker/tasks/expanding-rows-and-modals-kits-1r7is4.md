---
id: expanding-rows-and-modals-kits-1r7is4
title: Decide a shared component for expanding rows, and move the hand-built modals onto sheet-modal
status: backlog
opened: 2026-10-25
size: M
---
# Decide a shared component for expanding rows, and move the hand-built modals onto sheet-modal

The UI codebook's Reach dimension, retired on 2026-10-23 (web-tools #1071), recorded what a tap on a unit opens. Before it went, it showed two interactions the estate builds by hand:

- **Expanding rows: 28 units** open a row in place with code of their own. No shared component draws one, so no `hand_evidence` row flags them, and with Reach gone nothing else lists them.
- **Modals: 4 units** draw a dialog or sheet by hand, though `lib/alpineComponents/sheet-modal.js` (with `pages/demos/sheet-modal-demo.html` and its test) exists for it. Dictate's coding already cites one such sheet in `hand_evidence`.

The work: read the expanding rows side by side and decide whether one component would serve most of them (what they share: a toggle, a disclosure body, keyboard, what the address keeps), then build it or record why not; and move each modal onto `sheet-modal.js` or record what it needs that the component lacks.

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

Either a shared expanding-row component exists and the units that fit it use it, or a dated note here says why the rows stay as they are; and each listed modal uses `sheet-modal.js` or has its reason recorded.

## Progress log
- 2026-10-25: filed from the Reach codes as they stood when the dimension was retired on 2026-10-23. Two units in that snapshot have since left the app (Jot, and budget-drs's Fund Projection tab) and are not listed.
