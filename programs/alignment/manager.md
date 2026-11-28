# Alignment manager

The session holding the Alignment manager role, taken on with `/portable:programs alignment` ([programs skill](../../skills/programs/SKILL.md)), answers the processes [the README](README.md) lists as below.

First read the owner's rulings, the [notes](../../skills/notes/SKILL.md) addressed to `mehrlander/web-tools:programs/alignment/README.md` or its earlier path `mehrlander/web-tools:programs/organization/README.md`. Name any source you could not read.

## Landing

Inputs: the subject, repositories and period. Read three sources, starting with the pull requests:

- **Pull requests:** a GitHub search on the subject, asking for numbers and titles only, gives each pull request and whether it merged.
- **Branches:** [`in-flight.py`](../../skills/in-flight/in-flight.py)` <repo path> ... --fetch`, run from the web-tools checkout, lists the branches holding commits `main` lacks. It also lists stale tasks: tracker tasks still marked in progress whose branch has merged or gone. In a shallow checkout its counts of commits ahead are unreliable, and its pull request column does not replace the search.
- **Session records:** [`search.py`](https://github.com/mehrlander/web-tools-private/blob/main/sessions/tools/search.py) in web-tools-private finds the session behind a branch. Narrow a broad subject with `--since` and `--file <path>`; `--grep` alone matches most sessions.

Return one line for each pull request, or for each branch that has none, newest first, then one for each stale task:

```
<what the work was> · merged | open | branch only | not found · <pull request or branch> · <date merged, or of the last commit> · <first eight characters of the session id>
stale task · <task id> · <the branch it names>
```
