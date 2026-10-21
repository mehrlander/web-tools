#!/usr/bin/env python3
"""machine-paths gate: refuse a commit that writes a path into one machine's
user folder into the repository.

WHAT THIS IS FOR. A file that names C:/Users/<someone>/... runs, or makes
sense, on one machine only. On 2026-10-08 PR #919 brought seven of them into
web-tools: a Gemini session's working scripts, each reading and writing that
conversation's own folder in Antigravity's directory under the owner's Windows
user folder. Nothing ran or named them, and they sat in node/render/ until a reader asked what the
Automation tab's "No route" count was. A session's working files belong in its
own scratch area (Claude Code's scratchpad, Antigravity's conversation folder),
and only a file that works from a checkout belongs in the repo. The path is the
mechanical sign of the first kind arriving where the second belongs.

WHAT IT MATCHES, in any text file:

  C:\\Users\\<name>\\ or C:/Users/<name>/   a Windows user folder
  /Users/<name>/                          a macOS user folder
  /home/<name>/                           a Linux home, except /home/user/
  antigravity/brain/                      an Antigravity conversation folder (machine-path-ok)

/home/user/ is the cloud sandbox's home, the same in every cloud session, so it
names no one's machine. A placeholder (C:\\Users\\<user>\\) is not a name and
does not match. A path segment inside a URL (/repos/<owner>/home/...) does not
match, since the match must not follow a word character, a dot, a colon, a
slash or a hyphen.

The last example names the folder itself, so its line carries the marker below,
which is how this file passes its own gate.

WHAT IT LETS THROUGH:

  docs/environment/        documents whose subject is the machines themselves
  research/**/source/      supplied material, kept verbatim
  a line carrying machine-path-ok, in a comment of the file's own kind, for a
                           path that means it (a test feeding a fake path to a
                           rejecter, say)

TWO MODES, one rule:

  machine-paths.py --staged   the lines this commit adds (git diff --cached);
                              .githooks/commit-msg calls it, so a commit that
                              matches never happens
  machine-paths.py --tree     every tracked text file; the suite runs it, so a
                              commit that skipped the hook still fails on the
                              pull request

Exit 1 with one line per finding, naming the file and line; exit 0 otherwise.
--no-verify bypasses the hook, as it does the consent gate beside it; the suite
does not.
"""
import os
import re
import subprocess
import sys

MARKER = 'machine-path-ok'
PATTERNS = [
    ('a Windows user folder', re.compile(r'(?<![A-Za-z0-9])[A-Za-z]:[\\/]{1,2}Users[\\/]{1,2}(?!<)[^\\/\s\'"`<>|]+[\\/]', re.I)),
    ('a macOS user folder', re.compile(r'(?<![\w.:/-])/Users/(?!<)[\w.-]+/')),
    ('a Linux home folder', re.compile(r'(?<![\w.:/-])/home/(?!<|user/)[a-z][\w-]*/')),
    ('an Antigravity conversation folder', re.compile(r'antigravity[\\/]brain[\\/]', re.I)),
]


def exempt(path):
    path = path.replace('\\', '/')
    if path.startswith('docs/environment/'):
        return True
    return path.startswith('research/') and '/source/' in path


def findings(path, lines):
    """(line number, kind, text) for each line of `path` that names a machine
    path, from (number, text) pairs."""
    if exempt(path):
        return []
    out = []
    for n, text in lines:
        if MARKER in text:
            continue
        for kind, pat in PATTERNS:
            if pat.search(text):
                out.append((n, kind, text.strip()))
                break
    return out


def git(root, *args):
    return subprocess.run(['git', '-C', root, *args], capture_output=True, text=True,
                          encoding='utf-8', errors='replace').stdout


def staged(root):
    """The added lines of the staged diff, by file, with their new line numbers."""
    diff = git(root, 'diff', '--cached', '--no-color', '--no-ext-diff', '-U0', '--diff-filter=ACMR')
    by, path, n = {}, None, 0
    for line in diff.split('\n'):
        if line.startswith('+++ '):
            path = line[6:] if line.startswith('+++ b/') else None
        elif line.startswith('@@'):
            m = re.search(r'\+(\d+)', line)
            n = int(m.group(1)) if m else 0
        elif path and line.startswith('+') and not line.startswith('+++'):
            by.setdefault(path, []).append((n, line[1:]))
            n += 1
    return by


def tree(root):
    """Every tracked text file's lines. git grep -I skips binary files."""
    out = git(root, 'grep', '-I', '-n', '-E', '-i', r'users|/home/|antigravity', '--', '.')
    by = {}
    for line in out.split('\n'):
        m = re.match(r'(.+?):(\d+):(.*)$', line)
        if m:
            by.setdefault(m.group(1), []).append((int(m.group(2)), m.group(3)))
    return by


def main(argv):
    mode = argv[1] if len(argv) > 1 else '--staged'
    root = git(os.getcwd(), 'rev-parse', '--show-toplevel').strip() or os.getcwd()
    by = staged(root) if mode == '--staged' else tree(root)
    hits = [(p, *f) for p, lines in sorted(by.items()) for f in findings(p, lines)]
    if not hits:
        return 0
    head = 'This commit writes' if mode == '--staged' else 'Tracked files hold'
    print(f'{head} a path into one machine\'s user folder, which works on that machine only:', file=sys.stderr)
    for p, n, kind, text in hits:
        print(f'  {p}:{n}  {kind}: {text[:120]}', file=sys.stderr)
    print('A session\'s working files belong in its own scratch area, not the repo. For a line that means\n'
          f'its path, add {MARKER} in a comment on that line.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
