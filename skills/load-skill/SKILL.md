---
name: load-skill
description: Fetch a named skill by URL, from Marcus's library at mehrlander/web-tools/skills/ or another declared source, and follow it in the current session. Only for a session without the portable plugin, which already carries every skill in that library as /portable:<name>, or for a skill from another source. Use when the user says "load skill X", "load my X skill", "fetch the X skill", "load-skill X", "/load-skill", or names a skill and asks for it to be loaded.
---

# load-skill

Fetch a named skill from a defined source and apply its instructions. The mechanism is source-agnostic: the default source is `mehrlander/web-tools/skills/`, but any `<source>/<name>/SKILL.md` shape works.

**Check the plugin first.** The `portable` plugin carries every skill in the default source as `/portable:<name>`. Use that when the plugin is installed. Fetch only without the plugin, or from another source.

## Default source

```
https://raw.githubusercontent.com/mehrlander/web-tools/main/skills
```

The repo is public, so fetching needs no auth.

## Discovery

A catalog of available skills is at:

```
https://raw.githubusercontent.com/mehrlander/web-tools/main/skills/manifest.csv
```

It is a CSV with the columns `name`, `group` and `description`, one row per skill.

If the user asks "what skills are available?" or "list my skills," fetch and summarize this file.

## Load a specific skill

Given a skill name (e.g. `atomic-decomposition`), the SKILL.md URL is:

```
<source>/<name>/SKILL.md
```

Fetch it, follow its instructions in the current session. Companion files (scripts, data, additional docs) live at sibling paths under the same skill folder; fetch them on demand when the SKILL.md refers to them.

## Fetch mechanism, in order of preference

1. **`curl` in the sandbox shell**
   ```bash
   curl -fsSL <url>
   ```
   Works in Claude Code on the web (raw.githubusercontent.com is allowlisted).

2. **WebFetch** on the same raw URL, for environments without shell.

3. **GitHub MCP** (`mcp__github__get_file_contents` with owner `mehrlander`, repo `web-tools`, path `skills/<name>/SKILL.md`) if the raw URL is blocked.

## When to fire

Only on an explicit signal from the user, such as the phrases in the description, "use my X skill for this", or "load skill X from source Y". Do not fire on general topic overlap.

## Third-party skills

Anthropic's document and authoring skills are not in this library; the
[marketplace](https://github.com/mehrlander/web-tools/blob/main/docs/MARKETPLACE.md)
notes say how they reach a session. Use the installed or host-provided skill
first. Without either, fetch the complete official skill folder, including its
scripts and references; a link alone does not supply those resources. Retired
personal skills are in the
[archive](https://github.com/mehrlander/web-tools/tree/main/archive/skills),
outside the active library.

## Custom sources

If the user names a source other than the default, use that as the base URL. Example: "load skill X from `https://raw.githubusercontent.com/other/repo/main/skills`".

Any URL that resolves to `<base>/<name>/SKILL.md` is a valid source.

## Installing this skill without the plugin

- **A repo:** from a session in it, fetch this file into place, then commit and
  push; skills register at session start, so it is invocable in sessions
  started from a branch that contains it.

  ```bash
  mkdir -p .claude/skills/load-skill
  curl -fsSL https://raw.githubusercontent.com/mehrlander/web-tools/main/skills/load-skill/SKILL.md \
    -o .claude/skills/load-skill/SKILL.md
  ```

- **The claude.ai account:** copy this SKILL.md into Settings > Capabilities as
  a new skill named `load-skill`; every chat and Cowork session provisioned from
  the account can then invoke it.
