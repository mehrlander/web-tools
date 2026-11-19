# Inspection: the envelope contract

An **inspection** asks the owner to judge, one at a time, the outputs a model or a script made from its inputs. Each output is anchored to a passage of an input. The owner gives it one verdict from a declared set and may add a note.

An `inspection/1` payload holds the inputs and outputs as [runs](#the-payload), one input to a run. 🔷 [pages/inspection.html](https://mehrlander.github.io/web-tools/pages/inspection.html) draws each output under its passage. It appends the verdicts to the payload's [answers file](#answers), which the session that made the inspection reads.

The first producer is [`flag_inspection.py`](https://github.com/mehrlander/home/blob/main/projects/text/runs/2026-11-06-prompt-sentiment/src/flag_inspection.py) in [home](https://github.com/mehrlander/home). The script's outputs are the preferences a model flagged in the owner's messages, each anchored at the sentence it quotes.

## Delivery

The page reads `#gz=` before `?src=`:

| channel | form | use when |
| --- | --- | --- |
| `?src=<spec>` or `#src=<spec>` | `owner/repo[@ref]:path`, read through the viewer's GitHub token | a committed payload, private ones included |
| `#gz=<base64url>` | a gzipped `inspection/1` payload in the fragment | a small payload with no commit |
| (none) | the page's embedded sample: two runs over rules 1, 2, 9 and 15 of the [house style](../../skills/html-style/SKILL.md#the-rules) | a look at the page |

## The payload

| Field | Holds |
| --- | --- |
| `kind` | `inspection/1` |
| `title` | What is being inspected |
| `question` | What a verdict answers, such as *is this flag right?* |
| `verdicts` | In order, each with `verdict` (the value written), `label` (the button) and `gloss` (its meaning, in a line) |
| `tags` | Optional: the values an output's `tag` takes, each with `tag`, `label` and optionally an `icon` and a `tone` |
| `answers` | Optional: the answers file, as a repo path or an `owner/repo[@ref]:path` address |
| `made` | Optional: `by` (the producer's address) and `from` (the addresses it read) |
| `runs` | In order |

A verdict may also have an `icon`, a Phosphor class such as `ph-check`, and a `tone`, the colour of its chosen button and of its marks: `success`, `error`, `warning`, `info` or `neutral`. A tag may have a `tone` too, the colour of its badge. Without one, `like` is `success`, `dislike` is `error`, and any other tag is neutral.

A **run** is one input and the outputs made from it. It has an `id` unique in the payload, a `title`, a `meta` line (a date and a count, say), a `source` and its `outputs`. `source` holds `blocks`, each with `id`, `label` and `text`, and optionally an `address` where the input lives.

An **output** has an `id` unique in its run and a `text`. It may have a `tag`, a `note` (the producer's remark, shown under the output) and an `anchor`. An anchor is `{block, start, end}`: offsets into that block's text, in code points, with `end` exclusive. Where no span applies it is `{block}` alone. An output that rests on several passages has `anchors`, a list of anchors, in place of `anchor`; the page marks each and scrolls to the first.

## Answers

Where the answers file is, and the ref each save commits to:

| `answers` | The file | The commit lands on |
| --- | --- | --- |
| absent | the payload's path, `.json` replaced by `.answers.jsonl` | the payload's ref, else `main` |
| a repo path | that path in the payload's repository | the payload's ref, else `main` |
| an `owner/repo[@ref]:path` address | that file | the address's ref, else `main` |

A `#gz=` payload has no path, and saves only to an address.

Each save appends one JSON line per output whose verdict or note changed, in one commit:

| Field | Holds |
| --- | --- |
| `at` | When the verdict was given, ISO 8601 |
| `run`, `output` | The output's ids |
| `verdict` | One of `verdicts`, or `null` for a verdict withdrawn |
| `note` | The owner's note, `""` for none |
| `by` | The GitHub login that saved it |

Lines are not edited. An output's latest line holds its verdict, for the page on load and for any session reading the file. The write is `postAnswer` in [`user-call-form.js`](../../lib/alpineComponents/user-call-form.js).
