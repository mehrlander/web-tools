# Verdicts: home-contract

## 1. Move the budget-drs render routing out of CLAUDE.md

**Verdict:** keep

**Checked:** `sed -n 132,215p CLAUDE.md | wc -w` is 895, as claimed. The diagnosis at home `CLAUDE.md:153-176` matches web-tools `docs/SNAGS.md:274-297` point for point: 46 files, 9,692,313 bytes, inline `VIEWS`, the two candidates, the same console line, and the remedy "hand over the framed page on its own" (SNAGS:293). The fragment params at `CLAUDE.md:204-215` match `projects/budget-drs/app/view/README.md:69-75`. The `/caption` drift at `CLAUDE.md:121` is real: no `caption` skill exists in web-tools `.claude/skills/`, `skills/`, the marketplace clone, or `docs/portable.csv`. No script reads `CLAUDE.md`.

The reader's "move what the README lacks" clause is load-bearing, and the list is longer than it implies. The view README does not carry: the `msTab` gap ("Claims within Measures is not addressable", `CLAUDE.md:212-213`); the branch-preview rule that `window.__ref` beats the descriptor's `ref:"main"` (`CLAUDE.md:182`); `?tab=` reaching a tenant through `embedView` and `window.__embedOpen` (`CLAUDE.md:184-187`); the headless shot of a framed view through the API shim (`CLAUDE.md:187-195`); and why `appendix-render` stays a gated skip (`CLAUDE.md:197-202`). Grep of the view README for `__ref`, `fetchEmbedText`, `__embedOpen`, `msTab` and `appendix-render` returns nothing. All five must land in that README in the same change, or they exist only in git history.

**Corrected words removed:** about 830 (895 less a replacement of about 65).

## 2. Retire the retired-markers paragraph into the linter

**Verdict:** revise

**Checked:** `sed -n 74,76p CLAUDE.md | wc -w` is 247 (190 in the markers paragraph, 57 in the `.paths.json` paragraph). A grep for `**Update|Wrong|Frozen|Stale YYYY-` in `*.md` outside `chron/20*` finds no live use, so a check would land clean. The only near hit is `chron/sweeps.md:213`, which quotes a marker in italics and would not match a bold-only pattern.

Two specifics are wrong. First, the retired-terms block at `tools/lint-conventions.py:172-215` is not a place to "add a pattern". Its `UMBRELLA_RE` runs only under `UMBRELLA_SCOPE = "projects/budget-drs/"` with a budget-drs exemption list. A repo-wide marker check needs its own pattern, scope and dated-record exemption, and the Enforcement-split bullet (`CLAUDE.md:80`) must name it in the same commit. Second, the one-line replacement drops a judgment rule the linter cannot hold: "no dated lead-in replaces the markers; a classifying word belongs inside the writer's own sentence". That rule is stated only here and in the dated record, and it is the point of the retirement.

**Revised proposal:** Add a separate repo-wide check in `lint-conventions.py` for `**(Frozen|Stale|Wrong|Update) YYYY-MM-DD` outside dated records, and list it in the Enforcement-split bullet. Cut the paragraph to two sentences: the fix-the-sentence rule, plus "no dated or labelled lead-in at the head of a paragraph; a word like Corrected goes inside your own sentence", with the chron record linked. Fold the `.paths.json` paragraph into the Enforcement-split bullet as the reader proposes, keeping its two readers named.

**Corrected words removed:** about 160.

## 3. Cut "Cross-repo conventions" to the home-local facts

**Verdict:** revise

**Checked:** The section is 319 words (`sed -n 262,301p | wc -w`), in paragraphs of 92, 105, 48 and 74. The claimed duplicates partly hold. `claude plugin list` as the load check and per-directory status are in web-tools `docs/environment/extending.md:162-169`. The cache path `cache/<marketplace>/<plugin>/<sha>/` is at `extending.md:171`. The session lag is discussed at `container.md:130-150`. `MARKETPLACE.md:14` covers the missing `version`, though it says "consumers track the tip" and not "pinned to the SHA, one session late", so the two are not the same claim.

The "Two independent copies" paragraph (`CLAUDE.md:273-285`) is not stated upstream. A grep of web-tools `docs/` and `.claude/skills/` for `plugins/marketplaces`, "marketplace clone" and `refresh-portable.log` finds nothing outside `docs/delivery.json`. The paragraph says it names "the recurring mistake", and it explains why `plugin_script()` in home's `verify-artifacts.sh` prefers the newer copy. The only other statement is a dated chron record. Cutting it removes a rule stated nowhere else in the living set. The fourth paragraph (no `SessionStart` hooks, add a `session-*.sh` file) is home-local and the reader keeps it.

**Revised proposal:** Keep paragraphs 2 and 4. Cut paragraph 1 to the subscription and the `/load-skill` line, and cut paragraph 3 to a link to `docs/portable.csv` and `docs/MARKETPLACE.md`. To cut paragraph 2 as well, first move it into web-tools `docs/environment/extending.md` beside the `plugin list` material, then replace it here with one sentence and a link.

**Corrected words removed:** about 85 as revised; about 175 if the two-copies paragraph moves upstream first.
