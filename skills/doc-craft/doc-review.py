#!/usr/bin/env python3
"""Print a doc review: the chat block doc-craft's Review section describes.

The session writes the judgment, a briefing in JSON; this script supplies the
mechanics: each hunk of the proposed edits as a fenced diff under its label,
a caption per document with its 🥏 link, and the corrections one line each.

The edits are the working tree against --base, by default the commit where the
branch left origin's main, so the review shows what the merge would bring; the
opening links the commit, or the compare when there are several, and the same
changeset as pages/review.html draws it, side by side. Every hunk
must appear in the briefing, as an edit or a correction: a change left out of
the review would reach the merge unseen, so the script refuses rather than
skipping it.

Usage:
  doc-review.py --list [--base REF] [PATH...]         the hunk ids to key a briefing on
  doc-review.py BRIEFING.json [--base REF] [PATH...]  the doc review, to paste

Briefing:
  {"topic": "...", "opening": "...",
   "documents": {"<path>": {"name": "...", "covers": "..."}},
   "edits": [{"hunk": "<path>#<n>", "kind": "Fix|Alignment|Addition|Wording",
              "origin": "this session's work|the existing text", "text": "...",
              "describes": "...", "reviewed": "...", "alternatives": "..."}],
   "corrections": ["<path>#<n>", ...]}
"""

import argparse
import difflib
import json
import re
import subprocess
import sys
from pathlib import PurePosixPath

TOSS = "https://mehrlander.github.io/web-tools/pages/toss-render.html"
REVIEW = "https://mehrlander.github.io/web-tools/pages/review.html"
KINDS = ("Fix", "Alignment", "Addition", "Wording")
FIELDS = (("describes", "Describes"), ("reviewed", "Reviewed"),
          ("alternatives", "Alternative placements"))


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout


def hunks(base, paths, context):
    """{"path#n": {"path", "lines"}} in diff order, the @@ headers dropped."""
    out, path, n, header = {}, None, 0, False
    for line in git("diff", "--no-color", f"-U{context}", base, "--", *paths).splitlines():
        if line.startswith("diff --git "):
            path, n, header = None, 0, True
        elif header and line.startswith("+++ "):
            path = line[6:] if line.startswith("+++ b/") else None
        elif line.startswith("@@"):
            header = False
            if path:
                n += 1
                out[f"{path}#{n}"] = {"path": path, "lines": []}
        elif not header and path and n and line[:1] in " +-":
            out[f"{path}#{n}"]["lines"].append(line)
    for h in out.values():                      # a blank context line locates nothing
        while h["lines"] and not h["lines"][0].strip():
            h["lines"].pop(0)
        while h["lines"] and not h["lines"][-1].strip():
            h["lines"].pop()
    return out


def main_ref():
    for ref in ("origin/HEAD", "origin/main", "origin/master"):
        if subprocess.run(["git", "rev-parse", "-q", "--verify", ref], capture_output=True).returncode == 0:
            return ref
    return None


def default_base():
    """Where the branch left origin's main, or HEAD when there is no such ref."""
    ref = main_ref()
    return git("merge-base", "HEAD", ref).strip() if ref else "HEAD"


def repo_slug(repo):
    if repo:
        return repo
    url = git("remote", "get-url", "origin").strip()
    m = re.search(r"([^/:]+)/([^/]+?)(?:\.git)?/?$", url)
    return f"{m.group(1)}/{m.group(2)}" if m else "owner/repo"


def pushed():
    return bool(git("branch", "-r", "--contains", "HEAD").strip())


def toss_link(path, repo):
    """The 🥏 data-route link for the document as it stands: at HEAD once a remote
    holds HEAD, else at main, so the link opens on any phone."""
    ref = git("rev-parse", "--short=12", "HEAD").strip() if pushed() else "main"
    return f"{TOSS}#data={repo}@{ref}:{path}"


def commit_link(base, repo):
    """The commit the review shows, or the compare across several; none while the
    edits are uncommitted or HEAD is on no remote. Commits main already holds are
    left out: a merge of main brings them in, and a conflict resolved in that merge
    is the branch's own change, so the merge commit itself stays in. Beside it, the
    changeset in pages/review.html, by full SHAs: GitHub's compare API answers 404
    to abbreviated ones, so a short link would open on an error."""
    ref = main_ref()
    commits = git("rev-list", f"{base}..HEAD", *([f"^{ref}"] if ref else [])).split()
    if not commits or not pushed():
        return None
    b, h = git("rev-parse", base).strip(), git("rev-parse", "HEAD").strip()
    diff = f"[Changeset diff]({REVIEW}#gh={repo}@{h}&base={b})"
    if len(commits) == 1:
        return f"Commit [{commits[0][:7]}](https://github.com/{repo}/commit/{commits[0]}) · {diff}"
    return f"Commits [{b[:7]}…{h[:7]}](https://github.com/{repo}/compare/{b[:7]}...{h[:7]}) · {diff}"


def correction_line(h):
    """One line: the changed words with two words of context on each side."""
    old = " ".join(l[1:].strip() for l in h["lines"] if l[0] == "-").split()
    new = " ".join(l[1:].strip() for l in h["lines"] if l[0] == "+").split()
    ops = [o for o in difflib.SequenceMatcher(a=old, b=new, autojunk=False).get_opcodes() if o[0] != "equal"]
    if not ops:
        return '(no word changed)'
    a0, a1, b0, b1 = ops[0][1], ops[-1][2], ops[0][3], ops[-1][4]
    pre = max(0, min(2, a0, b0))
    post = max(0, min(2, len(old) - a1, len(new) - b1))
    return '"{}" becomes "{}"'.format(" ".join(old[a0 - pre:a1 + post]), " ".join(new[b0 - pre:b1 + post]))


def render(brief, found, repo, base):
    docs, errors, warnings = brief.get("documents", {}), [], []
    edits, corrections = brief.get("edits", []), brief.get("corrections", [])
    used = [e.get("hunk") for e in edits] + corrections
    for h in used:
        if h not in found:
            errors.append(f"no such hunk: {h} (run --list)")
    for h in sorted({h for h in used if used.count(h) > 1}):
        errors.append(f"hunk named twice: {h}")
    for h in found:
        if h not in used:
            errors.append(f"hunk missing from the briefing: {h}")
    for e in edits:
        if e.get("kind") not in KINDS:
            errors.append(f"{e.get('hunk')}: kind must be one of {', '.join(KINDS)}")
        if e.get("kind") == "Addition" and not e.get("alternatives"):
            warnings.append(f"{e.get('hunk')}: an Addition usually names its alternative placements")
    for p in {found[h]["path"] for h in used if h in found}:
        if not (docs.get(p, {}).get("name") and docs.get(p, {}).get("covers")):
            errors.append(f"{p}: documents needs a name and a covers line")
    if errors:
        return None, errors, warnings

    out = [f"📝 **Doc review: {brief['topic']}**", "", brief["opening"]]
    link = commit_link(base, repo)
    if link:
        out += ["", link]
    order = []
    for e in edits:
        p = found[e["hunk"]]["path"]
        if p not in order:
            order.append(p)
    n = 0
    for p in order:
        d = docs[p]
        out += ["", "---", "", f"**{d['name']}** · 🥏 [{PurePosixPath(p).name}]({toss_link(p, repo)})", d["covers"]]
        for e in (e for e in edits if found[e["hunk"]]["path"] == p):
            n += 1
            out += ["", f"**Edit {n} · {e['kind']} · {e['origin']}.** {e['text']}", "", "```diff",
                    *found[e["hunk"]]["lines"], "```"]
            fields = [f"*{label}:* {e[key]}" for key, label in FIELDS if e.get(key)]
            if fields:
                out += [""] + fields
    if corrections:
        out += ["", "---", "", "**Corrections**"]
        for h in corrections:
            p = found[h]["path"]
            name = docs.get(p, {}).get("name", p)
            out.append(f"- {name}: {correction_line(found[h])}")
    return "\n".join(out) + "\n", [], warnings


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("briefing", nargs="?", help="the briefing JSON, or - for stdin")
    ap.add_argument("paths", nargs="*", help="limit to these paths")
    ap.add_argument("--list", action="store_true", help="print the hunk ids and stop")
    ap.add_argument("--base", help="compare the working tree with this ref (default: where the branch left main)")
    ap.add_argument("--context", type=int, default=1, help="unchanged lines around each hunk")
    ap.add_argument("--repo", help="owner/repo for the 🥏 link, if origin does not say")
    a = ap.parse_args(argv)
    paths = a.paths if a.list or a.briefing else []
    if a.list and a.briefing:
        paths = [a.briefing, *a.paths]
    base = a.base or default_base()
    found = hunks(base, paths, a.context)
    if a.list or not a.briefing:
        for h, v in found.items():
            minus = sum(l[0] == "-" for l in v["lines"])
            plus = sum(l[0] == "+" for l in v["lines"])
            first = next((l[1:].strip() for l in v["lines"] if l[0] in "+-"), "")
            print(f"{h}\t-{minus} +{plus}\t{first[:70]}")
        if not found:
            print(f"doc-review: no changes against {base}", file=sys.stderr)
        return 0
    text = sys.stdin.read() if a.briefing == "-" else open(a.briefing, encoding="utf-8").read()
    out, errors, warnings = render(json.loads(text), found, repo_slug(a.repo), base)
    for w in warnings:
        print(f"doc-review: {w}", file=sys.stderr)
    if errors:
        for e in errors:
            print(f"doc-review: {e}", file=sys.stderr)
        return 1
    sys.stdout.write(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
