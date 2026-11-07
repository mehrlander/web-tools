# Reduction swarm

Four ways to shorten one real passage with model agents (rounds, a plain or a bold edit ladder, and a dome), for a session testing how far a passage can shrink and what a reader loses. Each script prints its usage when run with no arguments. A run keeps everything its agents wrote, and each version of the passage, in `<run>/ledger.json`, where `<run>` is normally `python/swarm/runs/<slug>`, and [`pages/swarm.html`](../../pages/swarm.html) shows it at `?src=mehrlander/web-tools@<branch>:python/swarm/runs/<slug>/ledger.json`. Commit the ledger after each step to follow the run there; the rest of a run directory is git-ignored scratch. The `context` commands and `dome.py next` write context files: start one agent per file, in parallel, each told to read its file and follow it.

## Rounds

[`swarm.py`](swarm.py) runs rounds in which agents add entries to the ledger and a harvester agent assembles each round's shorter version, with briefs in [`roles.md`](roles.md).

```bash
python3 python/swarm/swarm.py init <run> <file> <first-line> <last-line> --title "<title>"
```

For each round `N`, run `swarm.py context <run> N <role>` for `distiller`, `tactician` and `drafter` in round 1, or for `challenger` and `builder` in later rounds; then `swarm.py merge <run> N`; then `swarm.py context <run> N harvester` and `swarm.py harvest <run> N`.

## Edit ladders

[`ladder.py`](ladder.py) collects single edits, has judges rate each one green, yellow or red by what a reader would lose, and orders them into a path the page steps through from the original toward the shortest version. A plain run uses the ladder briefs in `roles.md`. A bold run (`--bold`, briefs in [`bold.md`](bold.md)) first has an agent repair the passage, then has scouts propose ideas and builders turn them into edits. The script's usage lists each run's agents and merge order.

```bash
python3 python/swarm/ladder.py init <run> <file> <first-line> <last-line> [--bold]
```

## A dome

In a dome, agents called fighters edit one paragraph in bouts, and every edit in a bout lands on the same text. After each bout a referee agent checks that a reader of the paragraph alone can still answer the questions the original answers. [`dome.py`](dome.py) runs it, with briefs in [`dome.md`](dome.md).

```bash
python3 python/swarm/dome.py init <run> <file> <first-line> <last-line> --title "<title>" --about "<what the paragraph is>" --bouts 3 --fighters cutter,fuser,slugger
```

Then run `dome.py next <run>`, start the agents it prints, and repeat until it prints `ready for review`.
