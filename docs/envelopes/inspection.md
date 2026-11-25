# Inspection: the envelope contract

An **inspection** shows the owner model outputs, one by one. Each output is anchored to a passage of an input, or is a version of the whole input. The owner may add a note to each output. Where a set of verdicts is declared, the owner may also give each output one verdict from it.

An `inspection/1` payload holds its inputs and outputs as runs, where a run is one input and the outputs made from it. 🔷 [pages/inspection.html](https://mehrlander.github.io/web-tools/pages/inspection.html) shows a run's input with each output's passages marked, and the selected output below it, numbered to match. It appends the notes and verdicts to the payload's [answers file](#answers).

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
| `question` | Optional: what a verdict answers, such as *is this flag right?* |
| `verdicts` | Optional: in order, each with `verdict` (the value written), `label` (the button) and `gloss` (its meaning, in a line) |
| `tags` | Optional: the values an output's `tag` takes, each with `tag`, `label` and optionally an `icon` and a `tone` |
| `answers` | Optional: where the notes and verdicts are saved, as [Answers](#answers) describes |
| `made` | Optional: `by` (the producer's address) and `from` (the addresses it read) |
| `runs` | In order |

Without `verdicts`, each output has only a note field.

A verdict may also have an `icon`, a Phosphor class such as `ph-check`. Its `tone` is `success`, `error`, `warning`, `info` or `neutral`. The tone colours the verdict's button when chosen. It also colours the tab and the number of each output given that verdict.

A tag with an `icon` is drawn as that icon alone, in the tag's tone, with its label in a tooltip. A tag without one is a badge in its tone. The tone also colours the passages the tag's output rests on. Without a `tone`, `like` is `success`, `dislike` is `error`, and any other tag is neutral.

A **run** has an `id` unique in the payload, a `title`, a `meta` line (a date and a count, say), a `source` and its `outputs`. `source` holds `blocks`, each with `id`, `label` and `text`, and optionally an `address` where the input lives.

An **output** has an `id` unique in its run and a `text`, and may have:

| Field | Holds |
| --- | --- |
| `title` | A heading for an output that is a version, such as "Version 2" |
| `tag` | One of `tags` |
| `flair` | Short marks drawn after the text, each `{icon, label, tip}`. The `tip` is the mark's tooltip and says what the label marks. |
| `note` | The producer's remark, shown as the tooltip of an icon after the text |
| `anchor` | The passage the output rests on, as `{block, start, end}`. `start` and `end` are offsets into that block's text in code points, with `end` exclusive. Where no span applies, the anchor is `{block}` alone. |
| `anchors` | A list of anchors, in place of `anchor`, for an output that rests on several passages. The page marks each passage and scrolls to the first. |

**Versions.** When no output in the payload has an `anchor` or `anchors`, the page shows each run's input first and then its outputs side by side as cards. Each card carries its `title`, else "Output" and its number, and its verdict and note at its foot.

## Answers

| `answers` | The file | The commit lands on |
| --- | --- | --- |
| absent | the payload's path, `.json` replaced by `.answers.jsonl` | the payload's ref, else `main` |
| a repo path | that path in the payload's repository | the payload's ref, else `main` |
| an `owner/repo[@ref]:path` address | that file | the address's ref, else `main` |

A `#gz=` payload has no path. It saves only to an address.

Each save appends one JSON line per output whose verdict or note changed, in one commit:

| Field | Holds |
| --- | --- |
| `at` | When the verdict was given, else when the line was saved, ISO 8601 |
| `run`, `output` | The output's ids |
| `verdict` | One of `verdicts`, or `null` for none or a verdict withdrawn |
| `note` | The owner's note, `""` for none |
| `by` | The GitHub login that saved it |

Lines are not edited. An output's latest line holds its verdict and note, for the page on load and for any session reading the file. The write is `postAnswer` in [`user-call-form.js`](../../lib/alpineComponents/user-call-form.js).
