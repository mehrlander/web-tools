# skills

The source of the `portable` plugin: one folder per skill, plus the plugin's
hooks in `hooks/`. The plugin registers every skill that
[`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) lists,
as `/portable:<name>`, in every session that installs it.

`manifest.csv` has one row per skill: `name`, `group`, and the `description`
its `SKILL.md` carries. Each folder's `SKILL.md` is the skill; companion files
(`scripts/`, `references/`, `assets/`) sit beside it.

Without the plugin, `/load-skill` fetches a skill by URL from
`https://raw.githubusercontent.com/mehrlander/web-tools/main/skills`.

## Editing

Edit a skill in place. A session picks up the change at its next start, when the
plugin's refresher moves to `main`.

**A copy uploaded to claude.ai is not updated by edits here**, and in a session
that has both, either copy may fire. Re-upload after editing, or delete the
upload.

**Adding a skill** takes four entries: the folder with its `SKILL.md`
(frontmatter `name` and `description`), a row in `manifest.csv`, its path in the
`portable` roster in `marketplace.json`, and a row in `docs/portable.csv` with
`kind` `skill` and `use` `plugin`.
`tools/test/portable-manifest.test.mjs` and `tools/test/skills-registry.test.mjs`
fail until they agree. Every skill's description costs context in every session,
so add one only when it earns that. **Removing a skill** takes the same four
entries out; `tools/test/plugin-skill-refs.test.mjs` then fails on any skill that
still names it. Search `docs/` and the consumer repos for other mentions, and
delete any claude.ai upload of it.
