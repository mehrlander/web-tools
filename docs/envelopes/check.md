# Check: the envelope contract

A **check** asks the owner to judge, item by item, what an AI process made from some input: each output item rests on a passage of the input, and takes one verdict from a declared set and an optional note. `check/1` carries the input and the output side by side so a page can draw them together, and names the file the verdicts are appended to, so the session or run that asked reads them back. 🔷 [pages/check.html](https://mehrlander.github.io/web-tools/pages/check.html) renders it. The first producer is home's `projects/text/runs/2026-11-06-prompt-sentiment/src/flag_check.py`, over the standing-preference flags of the session-topics daemon.

## Delivery

The page reads `#gz=` before `?src=`, and shows its embedded sample when it has neither:

| channel | form | use when |
| --- | --- | --- |
| `?src=<spec>` or `#src=<spec>` | `owner/repo[@ref]:path`, read through the viewer's GitHub token | a committed payload, private ones included; verdicts are saved beside it, on the same ref |
| `#gz=<base64url>` | a gzipped `check/1` payload in the fragment | a small payload with no commit; it saves only when `answers` is a full address |

## The file

| Field | Holds |
| --- | --- |
| `kind` | `check/1` |
| `title` | What is being checked |
| `question` | What a verdict answers, such as *is the flagged sentence a standing preference, with this stance?* |
| `verdicts` | In order, each with `verdict` (the value written), `label` (the button) and `gloss`, and optionally a Phosphor `icon` and a `tone`: `success`, `error`, `warning`, `info` or `neutral` |
| `tags` | Optional: the values an output's `tag` takes, each with `tag`, `label` and optionally a Phosphor `icon` |
| `answers` | Optional: where verdicts are appended. A repo path is read in the payload's repository at the payload's ref; an `owner/repo[@ref]:path` address names its own. Default: the payload's path with `.json` replaced by `.answers.jsonl` |
| `made` | Optional: `by` (the producer's address) and `from` (the addresses it read) |
| `runs` | In order |

A **run** is one input and what the process made from it: `id` (unique in the payload), `title`, `meta` (one short line, such as a date and counts), `source` and `outputs`. `source` holds `blocks`, each with `id`, `label` and `text`, and optionally `address`, where the input lives. An **output** has `id` (unique in its run), `text`, and optionally `tag`, `note` (the process's own remark) and `anchor`: `{block, start, end}`, offsets into that block's text in code points with `end` exclusive, or `{block}` alone when no span applies.

## Answers

Each save appends one JSON line per item whose verdict or note changed, in one commit:

| Field | Holds |
| --- | --- |
| `at` | When the verdict was given, ISO 8601 |
| `run`, `output` | The item's ids |
| `verdict` | One of `verdicts`, or `null` for a verdict withdrawn |
| `note` | The owner's note, `""` for none |
| `by` | The GitHub login that saved it |

Lines are never edited. The latest line for an item is its answer, which is how the page restores verdicts on load and how a reader should count them. The write goes through `UserCallForm.postAnswer`, the path a user call's answers take.
