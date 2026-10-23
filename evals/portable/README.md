# Portable plugin evals

Cases for `claude plugin eval`, which runs each case in a fresh `claude -p`
session with the `portable` plugin and again without it, and reports the score
difference. The question they answer: does the plugin change what a session's
reply looks like, on the conventions a grader can check?

Run them with [`python/portable-eval.py`](../../python/portable-eval.py), which
turns this checkout's `skills/` into a plugin the eval can load. Options pass
through, for example `--runs 5 -j 4 --model opus`.

| Grader | Checks | Source of the rule |
| --- | --- | --- |
| `closing-state` | the reply's last line is a closing state: a glyph and a bold lead | [`docs/CONVERSATION.md`](../../docs/CONVERSATION.md), "Closing state" |
| `no-em-dash` | no em dash, and no en dash between spaces | [`docs/QUALIFIED-WRITING.md`](../../docs/QUALIFIED-WRITING.md); peeve P07 |
| `plain-dry` | a Haiku judge finds no P04 trip | [`skills/peeves/peeves.csv`](../../skills/peeves/peeves.csv), P04 |
| `default-fired` | the session invoked `portable:default` (reported, not scored) | [`skills/hooks/invoke-default.sh`](../../skills/hooks/invoke-default.sh) |

P04 is the one judgment peeve graded here because it is where a Haiku judge
scored best against an independently labelled sample of 200 session replies:
precision about 0.87, and the same verdict on about nine replies in ten when run
twice. Most peeves scored far lower; the scorecard is in web-tools-private,
`sessions/peeves/gold/2026-10-23-scorecard.md`.

Each case's `scaffold.sh` creates a small git repository, because
`invoke-default.sh` adds its instruction only where it finds a checkout. The
sessions see no `CLAUDE.md` and none of the account's settings or other plugins.
