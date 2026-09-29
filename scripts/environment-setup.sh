#!/bin/bash
# environment-setup.sh: the Claude Code web environment's setup script.
# claude.ai's environment settings fetch and run it with one line:
#   curl -fsSL https://raw.githubusercontent.com/mehrlander/web-tools/main/scripts/environment-setup.sh | bash
# It installs the portable plugin, then saves its own text, the commit it came
# from, and when it ran to ~/.claude/environment-setup.ran, which the plugin's
# environment-report hook reads at the start of every session.
claude plugin marketplace add mehrlander/web-tools || claude plugin marketplace update web-tools
claude plugin install -s user portable@web-tools || true
claude plugin update  -s user portable@web-tools || true
sha=$(git ls-remote https://github.com/mehrlander/web-tools refs/heads/main | cut -f1)
mkdir -p ~/.claude
{ date -u +'# ran %Y-%m-%dT%H:%M:%SZ'; echo "# commit $sha"
  curl -fsSL "https://raw.githubusercontent.com/mehrlander/web-tools/$sha/scripts/environment-setup.sh"
} > ~/.claude/environment-setup.ran
