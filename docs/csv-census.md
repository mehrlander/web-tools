# CSV census contract

Each estate repository may declare `"data": {"census": "data/csv-census.csv"}`
in its own `.web-tools.json`. The path points to a committed CSV generated in
that repository. Web Tools reads declarations from the existing config crawl,
then fetches one inventory per declaring repository. It does not enumerate
another repository's tree or fetch source CSVs until someone opens a file in
the shared Files viewer. Without a token, the public hub's census is still
available. The hub's aggregate is a reading, not a source of record.

Copy `scripts/csv-census.py` into a repository that opts in, add the declaration,
run `python scripts/csv-census.py`, and commit its output. Run
`python scripts/csv-census.py --check` in CI or the repository's existing
verification hook. `--root` accepts another checkout. The generator reads
`git ls-files -z -- '*.csv'`, so untracked CSVs are outside its population;
the gate compares the committed inventory with that exact tracked set. The
inventory includes its own row, with its own byte count computed to a stable
fixed point. Stage changed CSVs before generating: measurements come from the
Git index blobs, the tree the next commit will contain, so checkout line-ending
conversion cannot change them. A new inventory can be generated before its
first `git add`, but check mode requires it to be tracked.

The columns are `path`, `rows`, `columns`, `bytes`, and `headers`. Paths are
repository-relative; row count excludes the header record; column count is
the width of the first record; byte size is the committed file's physical
size; `headers` is a JSON array of the first record's strings. CSV quoting and
embedded newlines are parsed as records. Empty files have zero rows and zero
columns. The generator rejects invalid UTF-8, malformed quoting, missing
files, symlinks, and paths outside the repository. Check mode regenerates in
memory and compares bytes, which catches missing or extra rows, stale
measurements, path drift, and nondeterministic output.

No declaration, a valid declaration with no CSV besides the inventory, and a
declared inventory that cannot be read are separate Map states. The census
asserts no purpose, owner, provenance, grain, type, or importance. A future
curated browse catalog may select from these paths; repository-specific
semantic registries may describe some of them. Those authored layers should
name their source and be gated separately. Neither changes the exhaustive
census or the contents of a source CSV. Opening a source uses the existing
Files table mode, where the grid reads the committed CSV directly and its
header filters are visible.
