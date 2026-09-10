#!/bin/bash
# SessionStart hook: when the surfacing conventions did NOT arrive on their own,
# tell the session to invoke the skill that fetches them.
#
# THE QUESTION IS "DID IT ARRIVE", NOT "DOES THE REPO INTEND IT". That
# distinction is the whole reason this is a hook rather than a skill
# description, and it is also why this does not reuse
# lib/kits/portable-align.js's conventionsWired(). That function is a text
# heuristic on a repo's CLAUDE.md, reporting intent for the app's adoption
# column; a repo can name /web-tools in prose, as home does, and still start a
# session with none of the conventions in context. This asks the narrower
# question a session can actually answer: is there a resolved `@`-import of the
# primitives among the checkouts the harness read. Two different claims, so no
# owners.csv repetition is owed.
#
# WHY A DIRECTIVE RATHER THAN A DESCRIPTION. A skill enters context two ways:
# the user types /name, or the model reads its description and elects to. There
# is no frontmatter field that loads one at session start (checked against the
# skills reference 2026-09-10: disable-model-invocation and user-invocable
# govern WHO may invoke, never whether it fires unprompted). So the reliable
# form is an instruction delivered into context at the moment it applies, which
# is what this prints.
#
# WHY ITS OWN HOOK ENTRY rather than a line inside session-dispatch.sh. The
# harness output cap applies PER HOOK ENTRY, not across the SessionStart event:
# measured 2026-08-30, the dispatcher's 28,670-character payload was cut while a
# separate 298-character SessionStart hook in the same session arrived whole
# (see session-dispatch.sh's OUTPUT_BUDGET note). A nudge folded into the
# dispatcher would be the first thing truncated on a heavy session, which is the
# failure that retired the injection channel. Standing alone, it cannot be.
#
# Never fails into the session: every path exits 0 and prints nothing it is not
# sure of. Cost is a handful of small file reads, no network, no tree walk.
set -uo pipefail

# Drain stdin unconditionally: SessionStart delivers a JSON payload, and leaving
# it unread risks EPIPE upstream on the runs where we print nothing.
cat >/dev/null 2>&1

ROOT="${CLAUDE_PROJECT_DIR:-$PWD}" python3 <<'PY' 2>/dev/null || exit 0
import json, os, re, sys

root = os.environ.get("ROOT") or "."
if not os.path.isdir(root):
    sys.exit(0)

# The project root, its children, and its siblings: the three shapes a
# multi-repo session takes (root above the checkouts, root IS the checkout, root
# beside its siblings). Deliberately the same bounded search session-dispatch.sh
# and session-record.sh already use, so the three agree about what a checkout is.
cands, seen = [], set()
def add(p):
    try:
        rp = os.path.realpath(p)
    except OSError:
        return
    if os.path.isdir(rp) and rp not in seen:
        seen.add(rp)
        cands.append(rp)

add(root)
for base in (root, os.path.dirname(root)):
    if not base or base in ("/", ".") or not os.path.isdir(base):
        continue
    try:
        for name in sorted(os.listdir(base)):
            add(os.path.join(base, name))
    except OSError:
        pass

# A resolved `@`-import whose target carries the primitives. The marker is a
# heading rather than a filename, so renaming the document does not silently
# turn delivery off; the heading is what surfacing-manifest.test.mjs already
# parses the primitives out of.
MARKER = "## Surfacing primitives"
IMPORT = re.compile(r"^@(\S+)", re.M)

def reads(path, cap=200_000):
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return fh.read(cap)
    except OSError:
        return ""

delivered, needing = None, []
for repo in cands:
    claude_md = os.path.join(repo, "CLAUDE.md")
    if os.path.isfile(claude_md):
        for target in IMPORT.findall(reads(claude_md)):
            resolved = os.path.join(repo, target) if not os.path.isabs(target) else target
            if os.path.isfile(resolved) and MARKER in reads(resolved):
                delivered = os.path.basename(repo)
                break
    if delivered:
        break
    # Opting out is per repo and deliberate; the field is declared in
    # docs/manifest-fields.csv and has been in the schema since PR #222.
    cfg = os.path.join(repo, ".web-tools.json")
    optout = False
    if os.path.isfile(cfg):
        try:
            optout = (json.loads(reads(cfg)) or {}).get("conventions") == "optout"
        except (ValueError, AttributeError):
            optout = False
    # A CLAUDE.md is REQUIRED to be named, and a manifest is not enough. The
    # import is the delivery channel, so a checkout without a CLAUDE.md has no
    # channel to be missing and nothing to be nudged about. Found by running
    # this against a project root whose siblings were 42 scratch clones left by
    # scripts/showing.py, each carrying a .web-tools.json and no CLAUDE.md: the
    # first cut named six of them and read as though the session had 42 repos
    # out of step. The manifest still speaks, but only to opt a repo out.
    if not optout and os.path.isfile(claude_md):
        needing.append(os.path.basename(repo))

if delivered or not needing:
    sys.exit(0)

# One sentence: the instruction, and what invoking it gets. It deliberately does
# NOT say the conventions failed to arrive, though that is the condition it fires
# on. Naming what is missing is no use to the reader who is missing it: a session
# told it "did not get the surfacing conventions" has been handed a term it
# cannot resolve, which is the whole reason it is being nudged. A purpose clause
# resolves on its own.
#
# Two other things were here until 2026-09-10 and went for the same reason, that
# they addressed somebody else. The opt-out sentence is aimed at a person
# deciding, and that person is reading docs/manifest-fields.csv or
# environment/extending.md, not a session's startup output. The list of checked
# repos was showing the work; its one use is catching a false positive, and the
# skill already covers that, since its first instruction is to stop if the
# checkout is present.
print("Invoke /portable:default now for plugin context intended for all sessions.")
PY
exit 0
