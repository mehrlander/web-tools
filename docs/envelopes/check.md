# Check: the envelope contract

A **check** asks the owner to judge what an AI process made from some input, one output at a time. Each output rests on a passage of the input. The owner gives it one verdict from a declared set and may add a note.

A `check/1` file holds the input and the outputs. 🔷 [pages/check.html](https://mehrlander.github.io/web-tools/pages/check.html) draws each output beside its passage and appends the owner's verdicts to an answers file, which the session that made the check reads.

The first producer is [`flag_check.py`](https://github.com/mehrlander/home/blob/main/projects/text/runs/2026-11-06-prompt-sentiment/src/flag_check.py) in home. Its outputs are the sentences of the owner's messages that a model flagged as preferences.

## Delivery

The page reads `#gz=` before `?src=`, and shows its embedded sample when it has neither:

| channel | form | use when |
| --- | --- | --- |
| `?src=<spec>` or `#src=<spec>` | `owner/repo[@ref]:path`, read through the viewer's GitHub token | a committed payload, private ones included |
| `#gz=<base64url>` | a gzipped `check/1` payload in the fragment | a small payload with no commit; the page saves verdicts only when `answers` is a full address |

## The file

| Field | Holds |
| --- | --- |
| `kind` | `check/1` |
| `title` | What is being checked |
| `question` | What a verdict answers, such as *is this flag right?* |
| `verdicts` | In order, each with `verdict` (the value written), `label` (the button) and `gloss`, and optionally an `icon` (a Phosphor class such as `ph-check`) and a `tone`, the colour of the chosen button and its marks: `success`, `error`, `warning`, `info` or `neutral` |
| `tags` | Optional: the values an output's `tag` takes, each with `tag`, `label` and optionally an `icon` |
| `answers` | Optional: the answers file. A repo path is read in the payload's repository at the payload's ref; an `owner/repo[@ref]:path` address names its own. Default: the payload's path with `.json` replaced by `.answers.jsonl` |
| `made` | Optional: `by` (the producer's address) and `from` (the addresses it read) |
| `runs` | In order |

A **run** is one input and the outputs made from it. It has an `id` unique in the payload, a `title`, a `meta` line (a date and a count, say), a `source` and its `outputs`. `source` holds `blocks`, each with `id`, `label` and `text`, and optionally an `address` where the input lives.

An **output** has an `id` unique in its run and a `text`. It may have a `tag`, a `note` (the process's own remark) and an `anchor`: `{block, start, end}`, offsets into that block's text in code points with `end` exclusive, or `{block}` alone when no span applies.

## Answers

Each save appends one JSON line per output whose verdict or note changed, in one commit:

| Field | Holds |
| --- | --- |
| `at` | When the verdict was given, ISO 8601 |
| `run`, `output` | The output's ids |
| `verdict` | One of `verdicts`, or `null` for a verdict withdrawn |
| `note` | The owner's note, `""` for none |
| `by` | The GitHub login that saved it |

Lines are not edited. An output's latest line holds its verdict: the page restores verdicts that way on load, and a session reading the file counts them the same way. The write is `postAnswer` in [`user-call-form.js`](../../lib/alpineComponents/user-call-form.js).
