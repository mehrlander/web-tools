# Verdicts: wt-meta

## 1. Let `sandbox-traps` own the trap rules, and cut their restatements from environment/

**Verdict:** keep

**Checked:** Every cited duplicate holds. The 413 rule and its numbers are at `capabilities.md:80-95` and `sandbox-traps/SKILL.md:78-82`. The deny-header rule is at `capabilities.md:15-18`, `:207-213` and `SKILL.md:84-87`. The two gates and the 502 text are at `capabilities.md:200-205` and `SKILL.md:89-92`. The shallow-clone rule and its two commands are at `container.md:257` and `SKILL.md:60-66`. The added-repo affordance is at `container.md:283-293` and `SKILL.md:94-104`. `SKILL.md:115-121` does split action from evidence. The callout's rule 2 is covered by `capabilities.md:255-260` (the browser is already on disk). Rule 3 is partly in `capabilities.md:213-215` (the GCS bucket path). The skill ships in the plugin (`portable:sandbox-traps`).

One weak point, which does not change the verdict. The rationale says the `mcp-fail-hint.sh` hook met the "untested until it catches a real failure" condition. That hook delivers only the `-32003` trap. It says nothing about 413, the deny header, the shallow clone or added repositories. The argument that stands is simpler: the skill's own closing section assigns the operative text to the skill.

Keep the three origin behaviours at `capabilities.md:213-217` (`api.github.com` 403 without a user agent, the GCS path, the `docs.github.com` 503s) and the `probe` shell function. The skill does not carry either, and both are the evidence half.

**Corrected words removed:** about 620. The spans measure 182 + 150 + 179 + 120 + 140 = 771 (the 413 span is 150, not 172), less about 150 of kept evidence.

