# Reduction swarm

A test bed for shortening a passage by rounds of readers who add to a shared
ledger, with a harvest per round. [`roles.md`](roles.md) holds the briefs,
[`swarm.py`](swarm.py) the ledger mechanics, and
[`pages/swarm.html`](../../pages/swarm.html) shows a run: the rounds, the
harvest with a word diff against the round before, the ledger by reader, and
each payload item across rounds. Each run lives in `runs/<slug>/`.

## A run

```bash
python3 python/swarm/swarm.py init python/swarm/runs/<slug> <file> <first-line> <last-line> --title "<title>"
```

Then, for each round `N`:

1. For each role, `python3 python/swarm/swarm.py context python/swarm/runs/<slug> N <role>`,
   and start one Agent per role, in parallel, told to read its context file
   and follow it. Round 1 takes `distiller`, `tactician` and `drafter`; later
   rounds take `challenger` and `builder`.
2. `python3 python/swarm/swarm.py merge python/swarm/runs/<slug> N`.
3. `context … N harvester`, one Agent, then
   `python3 python/swarm/swarm.py harvest python/swarm/runs/<slug> N`.

Commit and push the run's `ledger.json` after each round; it holds every entry,
vote and harvest, and the rest of the run directory is ignored scratch. The
page follows it:
`?src=mehrlander/web-tools@<branch>:python/swarm/runs/<slug>/ledger.json`,
with ↻ to re-read. `swarm.py status` prints the same rounds as text, and
`swarm.py gz` the ledger as a `#gz=` payload for a run with no commit.
