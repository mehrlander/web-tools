# Check: the envelope contract

A **check** asks the owner to judge, one at a time, the outputs a model or a script made from its inputs. Each output is anchored to a passage of an input. The owner gives it one verdict from a declared set and may add a note.

A `check/1` payload holds them as runs, one input and its outputs to a run. 🔷 [pages/check.html](https://mehrlander.github.io/web-tools/pages/check.html) draws each output beside its passage. It saves the owner's verdicts where the session that made the check reads them: the [answers file](#answers).

The first producer is [`flag_check.py`](https://github.com/mehrlander/home/blob/main/projects/text/runs/2026-11-06-prompt-sentiment/src/flag_check.py) in [home](https://github.com/mehrlander/home). Its outputs are the preferences a model flagged in the owner's messages, each anchored at the sentence it quotes.

## Delivery

The page reads `#gz=` before `?src=`:

| channel | form | use when |
| --- | --- | --- |
| `?src=<spec>` or `#src=<spec>` | `owner/repo[@ref]:path`, read through the viewer's GitHub token | a committed payload, private ones included |
| `#gz=<base64url>` | a gzipped `check/1` payload in the fragment | a small payload with no commit |
| (none) | the page's embedded sample: two runs over rules 1, 2, 9 and 15 of the [house style](../../skills/html-style/SKILL.md#the-rules) | a look at the page |

## The payload

| Field | Holds |
| --- | --- |
| `kind` | `check/1` |
| `title` | What is being checked |
| `question` | What a verdict answers, such as *is this flag right?* |
| `verdicts` | In order, each with `verdict` (the value written), `label` (the button) and `gloss` (its meaning, in a line) |
| `tags` | Optional: the values an output's `tag` takes, each with `tag`, `label` and optionally an `icon` |
| `answers` | Optional: the answers file, as a repo path or an `owner/repo[@ref]:path` address |
| `made` | Optional: `by` (the producer's address) and `from` (the addresses it read) |
| `runs` | In order |

A verdict may also have an `icon`, a Phosphor class such as `ph-check`, and a `tone`, the colour of its chosen button and of its marks: `success`, `error`, `warning`, `info` or `neutral`.

A **run** is one input and the outputs made from it. It has an `id` unique in the payload, a `title`, a `meta` line (a date and a count, say), a `source` and its `outputs`. `source` holds `blocks`, each with `id`, `label` and `text`, and optionally an `address` where the input lives.

An **output** has an `id` unique in its run and a `text`. It may have a `tag`, a `note` (the process's own remark) and an `anchor`. An anchor is `{block, start, end}`: offsets into that block's text, in code points, with `end` exclusive. Where no span applies it is `{block}` alone.

## Answers

A repo path in `answers` is read in the payload's repository, at the payload's ref. Without `answers`, the file is the payload's path with `.json` replaced by `.answers.jsonl`. A `#gz=` payload has no path, and saves only to an address. The commit lands on the ref the answers file is read at: the payload's ref for a repo path, the address's own ref otherwise, and `main` when neither names one.

Each save appends one JSON line per output whose verdict or note changed, in one commit:

| Field | Holds |
| --- | --- |
| `at` | When the verdict was given, ISO 8601 |
| `run`, `output` | The output's ids |
| `verdict` | One of `verdicts`, or `null` for a verdict withdrawn |
| `note` | The owner's note, `""` for none |
| `by` | The GitHub login that saved it |

Lines are not edited. An output's latest line holds its verdict. On load, the page restores each output's verdict from its latest line. A session reading the file counts by the latest line too. The write is `postAnswer` in [`user-call-form.js`](../../lib/alpineComponents/user-call-form.js).
