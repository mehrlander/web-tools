---
id: surplus-state-rate-reread-zyl265
title: Re-read the surplus closing-state rate against its baseline
status: backlog
opened: 2026-09-10
size: XS
---
# Re-read the surplus closing-state rate against its baseline

PR #646 added two rules meant to stop a session emitting more than one closing
state per user prompt. This task is the only thing that will say whether they
worked.

Run `python3 sessions/tools/search.py --surplus` in web-tools-private.

## The baseline, measured 2026-09-10 before the rules landed
- Whole corpus: 769 surplus of 4,934 states, 15.6%.
- Last 14 active days (2026-08-28 to 2026-09-10): 367 of 2,340, 15.7%, over 133
  sessions.
- Cluster-robust standard error, taking the session as the sampling unit,
  +/- 1.66 points. The design effect is 4.9x, so the naive binomial interval
  understates the spread by more than a factor of two and must not be quoted.

## Done when
A fortnight of fresh records has accrued and the rate is read against the
figures above, with the verdict written here in one line.

**The decision rule, fixed in advance so the read cannot be talked into a
result:** a re-read at or below **11.1%** is a real move at 95%. Anything
between 11.1% and 15.7% is inside the noise of two samples this size and means
the rules did not measurably work, which is a finding worth recording rather
than a reason to wait longer.

## Notes
Timing is about sample size, not delivery. The primitives reach a checked-out
session at its next start through the `@`-import, so the first rule is live as
soon as #646 merges. The course rides the `pr-subscribe-hint` hook, which runs
from the plugin pin installed at the previous session start, so the second rule
is live one session later. Neither lag is the reason to wait a fortnight; the
reason is that 133 sessions produce an interval of +/- 1.66 points and a
shorter window cannot separate a real move from noise.

## Progress log
- 2026-09-10: Filed with the baseline and the decision rule. Nothing to do
  until roughly 2026-09-24.
