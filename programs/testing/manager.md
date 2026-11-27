# Testing manager

The session holding the Testing manager role, taken on with `/portable:programs testing` ([programs skill](../../skills/programs/SKILL.md)), answers the processes [the README](README.md) lists as below.

First read the owner's rulings, the [notes](../../skills/notes/SKILL.md) addressed to `mehrlander/web-tools:programs/testing/README.md`. Name any source you could not read.

## Pull request checks

Inputs: the repository and the pull request or branch. Read three sources, starting with the pull request:

- **Pull request checks on GitHub:** the pull request's check runs and workflow runs on its head commit separate a failed job from a workflow that never started. A workflow can also sit queued because the account's hosted-runner minutes are spent.
- **Lenovo check logs** ([venues](../../docs/machines.md)): [`state/pr-checks/`](https://github.com/mehrlander/web-tools-private/tree/background/state/pr-checks) and [`state/scheduled-daemon.json`](https://github.com/mehrlander/web-tools-private/blob/background/state/scheduled-daemon.json) on web-tools-private's `background` branch record `state`, `exit`, `took`, `where` and log output for each Lenovo leg. The legs are `verify-artifacts` in WSL and `windows-regressions` on Windows. `scheduled-daemon.json` also records when the daemon last polled.
- **Check declarations:** the repository's `.web-tools.json` (`checking` and `checks`), its workflow files under `.github/workflows/`, and [`scheduled-tasks.csv`](https://github.com/mehrlander/web-tools-private/blob/main/data/design/scheduled-tasks.csv) in web-tools-private state which venue is meant to run each check.

Return one line for each expected check leg on the head commit:

```
<check leg> · <venue> · passed | failed | queued | never started · <duration, or last daemon poll> · <pull request or commit[:8]> · <first failing step or log clue>
```

## Coverage

Inputs: the repository and paths. Read three sources:

- **Test registries:** [`tests.csv`](../../docs/tests.csv) and [`tests-authored.csv`](../../docs/tests-authored.csv) in web-tools list each test file's `runner` (`suite` in `npm test`, or a named script run on demand) and what behavior the test file protects.
- **Surface registries:** [`components.csv`](../../docs/components.csv), [`kits.csv`](../../docs/kits.csv) and [`harness.csv`](../../docs/harness.csv) record `tested` status for web-tools files; in another repository, list that repository's test and `verify-*` scripts on disk.
- **Test files:** the matching files under [`node/test/`](../../node/test/) (with sandbox limits in [`testing.md`](../../docs/environment/testing.md)) or the target repository's check folder show which assertions reach the named path.

Return one line for each check that reaches the path, or one `unguarded` line when none does:

```
<check path> · suite | on-demand script | repo verify · <venue> · <what the check asserts on the path>
unguarded · <target path> · <nearest check surface>
```

## Cost and selection

Inputs: a repository, revision or changed paths, and the intended behavior.

Settle the required evidence first, through Coverage: the behavior the existing assertions check and the cases they miss. Where a mutation audit (a deliberate break of the code under test) exists, name the assertion that caught the break.

Then weigh cost against the README's [measures](README.md#measures). Compare only runs that match on source, runtime, installed dependencies, concurrency and mode. Each compared run must have exited cleanly with complete observations. Read costs from the [private dated run records](https://github.com/mehrlander/web-tools-private/tree/background/data/tests/runs) and observed dependencies from the public [reach snapshot](../../data/tests/reach.json).

For a local selection, `npm run test:diff -- --list` prints its baseline, the files it picks and why. Report where it falls back to the full suite and which tests have no observed reads. Its local history under `node/.test-observations/runs/` covers only commands run through it.

Return a checking plan with:

- the protected behavior and the test files that check it;
- missing assertions or venue checks;
- the selection procedure, with comparable observations and their limits.

Count a test as safe to omit only when the reach snapshot records every file it read and none is a changed path. Propose a selection experiment only when a full run of the same revision exists to compare it with. A change to the selection procedure itself is a proposed change to this file, through the README's reviewers.
