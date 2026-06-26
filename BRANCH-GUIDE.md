# Branch guide: claude/web-tools-sync-fetch-invoke-wgoyjh

Sharpening the sync docs so adopters can't wire *fetch* without *invoke*: a
`SessionStart` hook that writes the loader skill to disk makes it available, not
invoked, so on its own it never loads `CONVENTIONS.md`. A downstream repo
(`mehrlander/home`) hit exactly this and silently no-op'd.

⭐ [docs/PORTABLE.md — "Staying current: refresh at session start"](https://raw.githubusercontent.com/mehrlander/web-tools/claude/web-tools-sync-fetch-invoke-wgoyjh/docs/PORTABLE.md)

**Changed:**
- docs/PORTABLE.md — names the fetch≠invoke failure mode in the refresh section; pairs the hook with the always-on CLAUDE.md line; adds a stronger `additionalContext`-injector variant that collapses fetch+invoke.
- .claude/skills/web-tools-conventions/SKILL.md — fetch≠invoke caveat in the installer section; widened trigger vocabulary ("file card"/"file chip"/"send the file", show-pixels, hand-over) so the model-invocation path catches the terms users actually say.

**Next steps / open threads:**
- `docs/CONVENTIONS.md` intentionally left unchanged: its content was never the gap, only its delivery. Revisit only if we decide the conventions doc should self-describe how it gets loaded.
- The injector variant assumes `jq` (python3 fallback noted). If a target sandbox has neither, it degrades fail-soft to "no injected conventions" — acceptable, but worth a real-world check on the next adopter.
