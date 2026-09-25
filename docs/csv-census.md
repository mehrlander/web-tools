# CSV census

An estate repository opts into Map's Data tab by declaring
`"data": {"census": "data/csv-census.csv"}` in `.web-tools.json` and committing
the generated inventory at that repository-relative path. Each repository
owns its inventory. The hub reads declarations through the config cache and
fetches one inventory per declaration; source CSVs are fetched when opened
in Files. The hub follows the preview's `?use=` ref; other repositories are
read at `main`. Without a token, only the public hub inventory is read.

Use the standalone `scripts/csv-census.py` from Web Tools, either copied into
the repository or invoked with `--root <checkout>`. Stage source CSV changes
before generating, then stage the output alongside them:

```sh
python scripts/csv-census.py
python scripts/csv-census.py --check
```

The script reads the checkout's manifest for the output path and
`git ls-files --stage -z -- '*.csv'` for membership and mode validation. Source measurements come from
Git index blobs, so unstaged edits and checkout line-ending conversion do
not change them. The inventory includes itself, with its byte count solved
to a fixed point. Generation permits the first untracked output; `--check`
requires it to be tracked and compares the working inventory's bytes with
the expected result. Run the check in the adopting repository's verification
hook or CI. Declaring a path alone does not arrange generation or checks.

| Column | Value |
| --- | --- |
| `path` | Repository-relative CSV path. |
| `rows` | CSV records after the header; embedded newlines stay in their record. |
| `columns` | Number of fields in the first record. |
| `bytes` | Indexed blob's byte length. |
| `headers` | JSON array of the parsed header strings, preserving blanks and duplicates. |

Empty files have zero rows and columns. Invalid UTF-8, malformed CSV,
missing checkout files, source-file symlinks and paths outside the repository
are rejected. Output must also remain inside the checkout. The inventory
records physical properties only; it supplies no purpose, ownership or provenance.

Data distinguishes an absent declaration, an inventory containing no other
CSVs, and an unavailable or invalid inventory. Refresh rereads declarations
and inventories. Auth changes and refreshed repository configs invalidate
the loaded inventory; a failed request can also be retried by revisiting Data.
Opening a CSV uses Files at the inventory's repo and ref, with the shared
table explorer's Data, Columns and Pivot views.
