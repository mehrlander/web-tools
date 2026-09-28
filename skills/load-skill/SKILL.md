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

That URL is publicly accessible; the web-tools repo is public and `raw.githubusercontent.com` is on the Claude Code sandbox allowlist, so fetching needs no auth.

## Discovery

A catalog of available skills is at:

```
https://raw.githubusercontent.com/mehrlander/web-tools/main/skills/manifest.csv
```

Shape:

```json
{
  "source": "https://raw.githubusercontent.com/mehrlander/web-tools/main/skills",
  "skills": [
    { "name": "arriving-together", "description": "Apply the 'arriving together' framework..." },
    { "name": "atomic-decomposition", "description": "Break a document into the claims it makes..." },
    ...
  ]
}
```

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

## Trigger phrases

Only fire this skill on explicit signals from the user. Examples:

- "load skill arriving-together"
- "load-skill arriving-together"
- "/load-skill arriving-together"
- "fetch the arriving-together skill"
- "load my arriving-together skill"
- "use my arriving-together skill for this"
- "load skill X from source Y" (custom source)

Do not fire on general topic overlap.

## Custom sources

If the user names a source other than the default, use that as the base URL. Example: "load skill X from `https://raw.githubusercontent.com/other/repo/main/skills`".

Any URL that resolves to `<base>/<name>/SKILL.md` is a valid source. This makes the mechanism reusable if the user standardizes another location later.

## Installing this skill into another repo

The mechanism itself installs the same way `web-tools` does. From a session in the target repo:

```bash
mkdir -p .claude/skills/load-skill
curl -fsSL https://raw.githubusercontent.com/mehrlander/web-tools/main/skills/load-skill/SKILL.md \
  -o .claude/skills/load-skill/SKILL.md
```

Then commit and push. Skills register at session start, so `load-skill` becomes invocable in sessions started from a branch that contains it.

## Installing into the claude.ai account

Copy the contents of this SKILL.md into Settings > Capabilities as a new skill named `load-skill`. Then every chat session and every Cowork session provisioned from the account can invoke it.

## Why this exists

It reaches a skill where the portable plugin is not installed, such as claude.ai chat, or where the skill comes from another library.
