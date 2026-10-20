"""The owner/repo[@ref]:path address, for the Python side.

The same grammar lib/kits/repo-address.js reads, and the same encoding its
RepoAddress.github builders use, so an address and its GitHub URL mean one
thing whichever language reads them. Until 2026-10-20 three scripts carried a
pattern each, and they disagreed on what a repo name, a ref and a path may hold.

Imported by python/scheduled-tasks.py (whose folder Python puts on the path)
and by the python/annotate/ scripts (which add this folder). The portable
scripts in python/ do not import it: another repo fetches one of those as a
single file, where a sibling module would not resolve.
"""

import re
from urllib.parse import quote

# ':' cannot appear in a git ref name, which is what makes the split
# unambiguous. The repo half is non-greedy so a/b@feat/x:p splits at the first
# '@', leaving a slashed ref intact. lib/kits/repo-address.js ADDR_RE.
ADDR_RE = re.compile(r"^([\w.-]+/[\w.-]+?)(?:@([^:]+))?:(.+)$")

GITHUB = "https://github.com/"


def parse(spec):
    """'owner/repo[@ref]:path' -> {'repo', 'ref', 'path'}, or None when the
    string is not one. A missing ref is '' (unspecified), never a guess."""
    m = ADDR_RE.match(str(spec or "").strip())
    return {"repo": m.group(1), "ref": m.group(2) or "", "path": m.group(3)} if m else None


def enc(s):
    """Per path segment, as encodeURIComponent does it, so slashes survive."""
    return "/".join(quote(seg, safe="!*'()") for seg in str(s or "").split("/"))


def github_blob(repo, ref, path):
    """The file's page on GitHub. An empty ref is HEAD, the default branch."""
    return f"{GITHUB}{repo}/blob/{enc(ref) if ref else 'HEAD'}/{enc(str(path).lstrip('/'))}"
