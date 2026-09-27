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

## 4. Cut README.md to orientation: drop its Tools, Skills, Style and per-folder sections

**Verdict:** revise

**Checked:** Section counts hold: lines 64-94 are 1,003 words, Skills (95-113) 361, Tools (114-138) 1,067, Style (139-145) 42. The drifts are real. `stale-flags.sh` and the retired `/markers` sit at `README.md:123` (not 125). `README.md:97` names `/web-tools` and `/caption`, and neither skill exists. The tree at `README.md:59-60` puts `assignments/` under `created/`. `tools/generate-full-picture.sh:31` calls README "the full spec". A grep finds no inbound anchor links to `README.md#tools`, `#skills` or `#style`.

Two claims fail. First, the Tools section is not a pure duplicate. `tools/README.md` has no entry for `archive-session.py`, `heatmap.ps1`, `repo-constellation.html`, `news/tools/news-state.sh` or `generate-tracker-registry.py` (grep count 0 for each). `README.md:114-138` is the only description of those five tools. Deleting the section without moving them first loses them. Second, the per-folder paragraphs are not only restated rules. `CLAUDE.md` says README is "the human-facing account of what this repo is and why it is shaped this way", and several paragraphs carry a "why" stated nowhere in `CLAUDE.md`: a dated chron file never moves (`README.md:71`), classifying at capture asks for a decision when it costs most (`README.md:75`), and a topic graduates to its own repo when its commit history matters on its own (`README.md:91`). A grep of `CLAUDE.md` for those ideas finds nothing. Also, the `full-picture.md` paragraph the reader means to keep is at line 69, not 62; line 62 is inside the tree.

**Revised proposal:** Move the five missing tool entries into `tools/README.md`, then replace README's Tools section with a link. Replace Skills with a link to `.claude/skills/README.md`. Delete Style. In the per-folder paragraphs, cut the procedure that restates `CLAUDE.md` (thread link format, dump promotion steps, blog filename rules) and keep one or two sentences of rationale per folder. Fix the tree and the `generate-full-picture.sh:31` wording as proposed.

**Corrected words removed:** about 1,900 from `README.md`, with about 300 added to `tools/README.md`, so about 1,600 net.

## 5. One owner per procedure: let the skills own drain, blog and farm-out

**Verdict:** revise

**Checked:** Counts: `CLAUDE.md:228-231` (bulk-add) 50, `:233-240` (Dump promotion) 170, `:254-261` (Blog) 171, `:303-310` (run a skill) 71. The drain skill (`.claude/skills/drain/SKILL.md:13-40`) carries routing, move-and-rename, trend toward empty, and the blog-after-drain call. The blog skill carries filename, `# Title`, index regeneration and draft promotion (`blog/SKILL.md:18-26`, `:51`). So the duplicates hold. The preserved-material rule at `CLAUDE.md:236` is not in the drain skill, as the reader says.

Two specifics are wrong. First, "When asked to run a skill" is not generic harness behaviour. Its step 4, "Commit and push", is the only commit instruction that reaches `/drain`, `/review-threads` and `/update-full-picture`: a grep for "commit" across `.claude/skills/*/SKILL.md` finds commit steps only in `blog`, `farm-out` and `news`. Deleting the section drops the commit step for three skills. Second, the Lifecycle section of `chron/assignments/README.md` (107 words) is addressed to the human who does the collect step ("You run the prompt against each tool"). The skill cannot own that, because the human collects between two skill runs. Its section counts are Lifecycle 107, Conventions 109 and The analysis 293. The reader's "216" is Lifecycle plus Conventions. The analysis section adds one rule the skill lacks: "a run that wants a new section writes it and notes why".

**Revised proposal:** Replace Dump promotion and Blog in `CLAUDE.md` with one line each naming the skill file path, and move the preserved-material rule into the drain skill. Keep bulk-add. Cut "When asked to run a skill" to one line: "Repo skills live in `.claude/skills/`; commit and push what a skill writes." Alternatively, add a commit step to the three skills that lack one. In `chron/assignments/README.md`, keep Lifecycle, cut Conventions to what the skill does not state, and move the analysis repertoire into `farm-out/SKILL.md:28`, including the new-section rule. Then delete the skill's "see README for the fuller description".

**Corrected words removed:** about 340 from `CLAUDE.md` and about 330 net from `chron/assignments/README.md`.

## 6. Trim .claude/skills/README.md to what no generated list carries

**Verdict:** keep

**Checked:** Section counts: lines 20-47 are 191 words, 70-78 are 97, 87-100 are 150, 113-143 are 360. `/caption` at line 125 does not exist upstream. The "35 skills" at line 126 is stale: web-tools `skills/manifest.csv` has 45 rows and `skills/` has 45 folders. `tools/declare-skills.py` exists and the pre-commit hook gates the generated key, as lines 11-18 say. The "six and six" and "six of the seven" counts are correct today, but they are hand counts of what the frontmatter already records.

Keep two things the proposal does not target, because they are stated only here. Keep the `/blog` exception rationale at lines 53-58: the flag would stop `/drain` from reaching `/blog`. Keep the sentence at lines 34-36 that always-on reference lives in `CLAUDE.md` and `me/`, deliberately not as skills. If "Current docs" is cut to two links, that sentence should move up into the intro.

**Corrected words removed:** about 680.

## 7. Replace me/README's governance table and its incident story with two sentences

**Verdict:** keep

**Checked:** `me/README.md:20-54` is 335 words. The drift is real. Line 38 says SURFACING.md is "imported by that CLAUDE.md", and web-tools cut that import on 2026-09-12. Line 39 sends style questions to `docs/HTML-STYLE.md`, which home `CLAUDE.md:30` calls a pointer since 2026-08-31. `CLAUDE.md:32` is 54 words and tells the stat-cards story. That story is also held at web-tools `docs/SNAGS.md:1795` (`house-style-not-consulted`). No living file links `me/README.md`; every grep hit was a `runs/.../README.md` path. `tools/build-home-app.py:14` reads `me/*` as content, so a shorter file only renders shorter.

One caution. The replacement sentence repeats `me/README.md:5-6` ("Nothing here is the operating contract"). Name the style owner (`daisy-alpine`) in the replacement, since a session looking for style rules is the one this section was written to redirect. In `CLAUDE.md:32`, the clause that the HTML rule "has to point at the half that forbids things" explains why the rule names two files. That clause can survive as eight words on line 30.

**Corrected words removed:** about 290 in `me/README.md` and about 45 in `CLAUDE.md`.

## 8. Move the Prose clarity block out of home's CLAUDE.md

**Verdict:** revise

**Checked:** `sed -n 37,66p CLAUDE.md | wc -w` is 482. The 2026-08-28 session record exists at `web-tools-private/sessions/2026/08/2026-08-28-54923707.json`. It records the choice of `CLAUDE.md` over the hook channel because that channel was over its byte budget, so the placement constraint has lapsed as the reader says. QUALIFIED-WRITING rules 1 and 2 overlap "Resolve pronouns" and "Define jargon".

Option (a) is not the same rule in a new place. `google-style-clarity` is a library skill (`web-tools/skills/manifest.csv:13`), not part of the `portable` plugin, so it appears in no session's skill list and loads only through an explicit `/load-skill`. Replacing the block with a pointer to it means the pass stops running, and the block's first sentence says it must run before any drafting. Option (b) has a cost the reader understates. `QUALIFIED-WRITING.md` is 224 words and ships as a byte-matched copy beside the default skill (`.claude/skills/default/QUALIFIED-WRITING.md`, per the header of `docs/QUALIFIED-WRITING.md`). Adding about 300 words more than doubles a file every repo loads, and it changes the rules for web-tools and shortcut-tools sessions, which is a policy decision and not a simplification.

**Revised proposal:** Drop option (a). Offer the owner a choice between keeping the block and option (b). Under option (b), merge the overlapping principles into QUALIFIED-WRITING rules 1 and 2, keep the table, and update both copies in one commit.

**Corrected words removed:** 482 from home `CLAUDE.md` under option (b), with about 250 added upstream, so about 230 net across the estate. Zero under option (a) as revised away.

## 9. Re-status the created/ doctrine that has been superseded, and stop citing it as current

**Verdict:** reject

**Checked:** Word counts hold: 4,230, 1,925 and 1,429. The drift is real but narrow. `constellation-architecture.md:62-92` (Principles 3 and 4) prescribes a committed fetch hook copied into each repo, and `constellation-mechanics.md:23-36` (section 2, 277 words) labels the runtime fetch hook "current pattern". Neither document mentions the plugin or the marketplace.

The rest of the claim fails. First, the documents are mostly still correct. The architecture document's Principles 1, 2 and 5, the ephemeral-clone constraint and the hub-is-public argument all still hold, and `CLAUDE.md:72` cites the mechanics document for LFS, tokens, history rewrite and the size guard. Those four sections (1, 3, 4, 5) still describe live mechanisms: the size guard is in `.githooks/pre-commit:49`. The commit-discipline bullet at `CLAUDE.md:72` states the rules in one sentence, not the mechanics, so re-classing would leave the cited mechanics in a record. Second, `organizing-the-constellation.md` does not replace the base document. Its own summary says it "Extends the constellation doctrine". Third, `record` is not a status used in `created/`: the values in use are `current`, `draft`, `living` and `working`. Fourth, the 2026-09-21 rule at `CLAUDE.md:74` says a wrong claim in a living document gets its sentence fixed. Re-classing 6,000 words to hide about 400 wrong ones does the opposite.

For `source-anchoring.md`, the check the reader deferred refutes the proposal. `web-tools/skills/source-anchoring/SKILL.md` (920 words) has no "parsimony" anywhere (grep count 0). It has no provenance-versus-lineage "records" section and no worked-instances list. The draft's "Why parsimony lives inside" (lines 60-74), "The records" (103-119) and "Worked instances" (159+) exist only in the draft. `parsimony.md`, `favoring-the-mechanical.md` and `gold-sets.md` link the draft as the umbrella doctrine. The draft is the fuller statement and is not superseded.

**Corrected words removed:** 0. The honest fix is to rewrite the Principle 3 hook bullets, Principle 4 and the mechanics section 2 table to name the plugin marketplace, and to link `chron/2026/07/2026-07-11-adopting-the-plugin-marketplace.md`. That fix would change a few hundred words and cut few.

## 10. Collapse tools/README.md bullets that narrate rather than describe

**Verdict:** revise

**Checked:** The reader swapped two counts: the dead-link bullet (`tools/README.md:49`) is 303 words and `screenshot.mjs` (`:51`) is 317. `duplicated-claims.py` (`:48`) is 127, the markers bullet (`:43`) is 56, and "Not swept" (`:26-32`) is 56. The dead-link bullet also carries drift the reader missed: "Two more were in dated records and carry a `Stale` marker", which the 2026-09-21 retirement made false.

The screenshot bullet is mostly behaviour, not history. It says what the tool does with a `.pdf` output path, how it serves CDN libraries, `/gh/` paths and the contents API from disk, why in-repo pages get a loopback origin, and that it never tests the token path. That bullet is the one living owner of the contents-API fact that proposal 1 cuts from `CLAUDE.md:187-195`. Cutting it to two failure lines would remove the fact from both places at once. The "Not swept" paragraph is an exception list for the naming rule. It stops a later session from renaming the NASBO and AWB "survey" documents or web-tools' `dead-links.py`, so it is a standing rule and not a record.

**Revised proposal:** Delete the markers bullet. Cut the dead-link bullet to what the script checks, the unverifiable class, the `hub_script()` gate and "the internal class is not gated", and drop the counts, the budget-wa copy story, the 8/10/3 split and the `Stale` sentence. Trim `duplicated-claims.py` to behaviour and scope. In `screenshot.mjs`, drop only the dates and the "since 2026-09-05" history. Keep "Not swept".

**Corrected words removed:** about 350.

## Missed

**The retired-channels parenthetical in the first Working-style bullet.** `CLAUDE.md:20-29` is about 90 words of delivery history: the injection hook from 2026-07-31 to 2026-09-09, and the web-tools `@`-import cut in #652. Web-tools `CLAUDE.md`, "Delivery is the plugin", tells the same story, and the chron record `2026-08-26-the-injection-delivers-five-percent.md` holds the measurement. The operative rule ("no second channel; a reply with no caption means the prod failed") is the sentence before the parenthetical, and it stands without it. Cut to a link to the chron record, saving about 80 words in every home session.

**The hand-kept tree in README.md.** `README.md:41-67` (about 200 words) is a tree with glosses, and it is already wrong: it puts `assignments/` under `created/`. `full-picture.md` "Structure" (line 9) is a generated tree of the same folders, with file counts. Replace the hand tree with a link, or keep only the glosses the generated tree lacks. This also removes the one drift proposal 4 fixes by hand.

**A dead skill reference in a gate script.** `tools/verify-artifacts.sh:102` cites "Recipe: web-tools .claude/skills/markers/SKILL.md", and no `markers` skill exists in web-tools `.claude/skills/` or the marketplace clone. It is a comment, so nothing breaks. It is the same drift class as `/caption`, and it belongs in the same cleanup. The web-tools `CLAUDE.md` default "run `/markers`" has the same problem, but that file is outside this slice.
