#!/bin/bash
# environment-setup.sh: the Claude Code web environment's setup script.
# claude.ai's environment settings fetch and run it with this line, then check
# that the plugin installed (docs/environment/container.md quotes both lines):
#   curl -fsSL --retry 5 --retry-all-errors -o /tmp/s https://raw.githubusercontent.com/mehrlander/web-tools/main/.claude/environment-setup.sh && bash /tmp/s
# It installs the portable plugin and allows add_repo in user settings, then
# saves its own text, the commit main was at, and when it ran to
# ~/.claude/environment-setup.ran, which the plugin's
# environment-report hook reads at the start of every session. The text comes
# from "$0", the downloaded file, so the record is the text that ran. Piped into
# bash instead, the script has no file and the record would carry no text.
claude plugin marketplace add mehrlander/web-tools || claude plugin marketplace update web-tools
claude plugin install -s user portable@web-tools || true
# Allow add_repo in every session, so /portable:sessions can attach the session
# archive in auto mode; the classifier otherwise refuses an attach that another
# session asked for. Merged into the file the install just wrote; idempotent.
python3 - <<'PY'
import json, pathlib
p = pathlib.Path.home() / ".claude" / "settings.json"
s = json.loads(p.read_text()) if p.exists() else {}
allow = s.setdefault("permissions", {}).setdefault("allow", [])
if "mcp__claude-code-remote__add_repo" not in allow:
    allow.append("mcp__claude-code-remote__add_repo")
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text(json.dumps(s, indent=2) + "\n")
PY
sha=$(git ls-remote https://github.com/mehrlander/web-tools refs/heads/main | cut -f1)
mkdir -p ~/.claude
{ date -u +'# ran %Y-%m-%dT%H:%M:%SZ'; echo "# commit $sha"; cat "$0"; } > ~/.claude/environment-setup.ran
