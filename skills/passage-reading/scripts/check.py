"""Check a passage-reading/1 file, print the cards a reader will see, and
optionally the link that opens it in the Passage reader.

usage: python3 -I check.py READING.json [--root DIR]... [--no-context] [--link]

  --root DIR     a git checkout holding the context documents; repeatable,
                 default the current directory. Each context quote is
                 checked against its document at the commit the reading names.
  --no-context   skip the context-quote check, for a venue with no checkout;
                 say so when handing the reading over.
  --link         after a clean check, print the #gz= link to the page.

The contract is docs/envelopes/passage-reading.md in mehrlander/web-tools.
Exit status 1 when the reading has errors; the cards still print, so a
broken reading can be read back while it is fixed.
"""
import base64, gzip, json, subprocess, sys

PAGE = "https://mehrlander.github.io/web-tools/pages/passage-reader.html"
TYPES = {"definition", "assertion", "judgment", "rule"}
KINDS = {"elaborates", "rests-on", "narrows", "contrasts", "supports"}
FORMS = {None, "anaphor", "ellipsis"}
BASES = {"passage", "context", "general"}
ENTITY_KINDS = {"thing", "record", "actor", "event", "measure", "condition", "concept"}

args = sys.argv[1:]
if not args or args[0].startswith("-"):
    sys.exit(__doc__)
path, roots, check_ctx, want_link = args[0], [], True, False
i = 1
while i < len(args):
    a = args[i]
    if a == "--root" and i + 1 < len(args): roots.append(args[i + 1]); i += 1
    elif a == "--no-context": check_ctx = False
    elif a == "--link": want_link = True
    else: sys.exit(f"unknown argument {a!r}\n\n{__doc__}")
    i += 1
roots = roots or ["."]

r = json.load(open(path, encoding="utf-8"))
errs = []
err = errs.append

def unique(q, text, where):
    c = text.count(q) if q else 0
    if c != 1:
        err(f"{where}: quote {q!r} occurs {c} times")

for f in ("format", "title", "made", "source", "gist", "entities", "sentences"):
    if f not in r: err(f"missing field {f!r}")
if r.get("format") != "passage-reading/1":
    err("format is not passage-reading/1")
if errs:
    print("ERRORS:", *errs, sep="\n", file=sys.stderr)
    sys.exit(1)

def squash(t):
    """Runs of whitespace as one space, so a context quote may cross a hard line break."""
    return " ".join(t.split())

def show(ref, p):
    for root in roots:
        try:
            return subprocess.run(["git", "-C", root, "show", f"{ref}:{p}"],
                                  capture_output=True, text=True, check=True).stdout
        except (subprocess.CalledProcessError, FileNotFoundError):
            continue
    return None

ctxdocs = {}
for c in r.get("context", []):
    if not check_ctx: break
    text = show(c.get("ref", ""), c.get("path", ""))
    if text is None:
        err(f'context {c.get("id")}: cannot read {c.get("path")} at {c.get("ref")} in {", ".join(roots)}; '
            'pass --root for a checkout that has it, or --no-context')
    else:
        ctxdocs[c["id"]] = text

ents = r["entities"]
if r.get("topic") and r["topic"] not in ents: err(f"topic {r['topic']} is not an entity")
for k, e in ents.items():
    if e.get("basis") not in BASES: err(f"entity {k}: basis {e.get('basis')!r}")
    if "kind" in e and e["kind"] not in ENTITY_KINDS: err(f"entity {k}: kind {e['kind']!r} is not one of {', '.join(sorted(ENTITY_KINDS))}")
    if (e.get("basis") == "context") != bool(e.get("ctx")): err(f"entity {k}: ctx must be present exactly when basis is context")
    for q in e.get("ctx", []):
        if q["doc"] not in {c["id"] for c in r.get("context", [])}:
            err(f"entity {k}: ctx names no context document {q['doc']!r}")
        elif q["doc"] in ctxdocs and squash(q["quote"]) not in squash(ctxdocs[q["doc"]]):
            err(f"entity {k}: context quote not found in {q['doc']}: {q['quote']!r}")

S = r["sentences"]
by_n = {s["n"]: s for s in S}
if [s["n"] for s in S] != list(range(1, len(S) + 1)): err("sentence n is not 1..N")

# The first mention of each entity, and the first that names it: (n, i), the
# mention's sentence and its place in that sentence's list, as the page takes them.
first_named, first_any = {}, {}
for s in S:
    for i, m in enumerate(s.get("mentions", [])):
        first_any.setdefault(m["e"], (s["n"], i))
        if m.get("form") is None:
            first_named.setdefault(m["e"], (s["n"], i))

for s in S:
    n, t = s["n"], s["text"]
    for f in ("mentions", "links", "atoms"):
        if not isinstance(s.get(f), list): err(f"s{n}: {f} must be a list, empty if there are none")
    if not s.get("atoms"): err(f"s{n}: every sentence has at least one atom")
    for m in s.get("mentions", []):
        if m["e"] not in ents: err(f"s{n}: unknown entity {m['e']}")
        if m.get("form") not in FORMS: err(f"s{n}: form {m.get('form')!r}")
        if m.get("in"):
            unique(m["in"], t, f"s{n} mention {m['e']} in")
            if m["in"].count(m["quote"]) != 1: err(f"s{n}: quote {m['quote']!r} is not once inside {m['in']!r}")
        else:
            unique(m["quote"], t, f"s{n} mention {m['e']}")
        if m.get("form") == "ellipsis" and not (m.get("fill") and m.get("slot")):
            err(f"s{n}: ellipsis of {m['e']} needs a slot (object of Write) and a fill")
        if m.get("form") and m["e"] in ents and m["e"] not in first_named and ents[m["e"]].get("basis") != "context":
            err(f"s{n}: {m['e']} has an {m['form']} mention but no named antecedent")
        if "ante" in m and not (1 <= m["ante"] <= n): err(f"s{n}: ante {m['ante']} is not this or an earlier sentence")
    for l in s.get("links", []):
        if l.get("kind") not in KINDS: err(f"s{n}: link kind {l.get('kind')!r}")
        if not 1 <= l.get("to", 0) < n: err(f"s{n}: link to s{l.get('to')} does not point back")
        unique(l.get("here"), t, f"s{n} link here")
        if l.get("to") in by_n: unique(l.get("there"), by_n[l["to"]]["text"], f"s{n} link there (s{l['to']})")
        # An end is a whole atom or a mention: an atom is never split, except to name an entity.
        for side, at in (("here", s), ("there", by_n.get(l.get("to")))):
            if not (at and l.get(side)): continue
            ends = {a.get("quote") for a in at.get("atoms", [])} | {m.get(k) for m in at.get("mentions", []) for k in ("quote", "in")}
            if l[side] not in ends:
                err(f"s{n} link {side}: {l[side]!r} is not an atom's or a mention's quote in s{at['n']}; widen it to the whole atom")
        if not l.get("gloss"): err(f"s{n}: link to s{l.get('to')} has no gloss")
    ids = [a.get("id") for a in s.get("atoms", [])]
    if len(set(ids)) != len(ids): err(f"s{n}: atom ids repeat")
    for a in s.get("atoms", []):
        aid = f"s{n}{a.get('id')}"
        if a.get("type") not in TYPES: err(f"{aid}: type {a.get('type')!r}")
        if not a.get("claim"): err(f"{aid}: no claim")
        unique(a.get("quote"), t, f"{aid} atom")
        if ("for" in a) != ("as" in a): err(f"{aid}: 'for' and 'as' go together")
        if "for" in a and (a["for"] not in ids or a["for"] == a.get("id") or a["as"] not in KINDS):
            err(f"{aid}: bad 'for'/'as'")
        for e in a.get("on", []):
            if e not in ents: err(f"{aid}: on names no entity {e!r}")

for k in ents:
    if k not in first_any: err(f"entity {k} is never mentioned")

# ---- the cards, as the page derives them -----------------------------------
# The rules of index() in pages/passage-reader.html. An anaphor or ellipsis
# resolves to its entity's first named mention, or to the first in sentence
# `ante`; an ellipsis of the topic is left out unless it has a note. One that
# resolves to an earlier sentence is carried in, one in its own sentence is
# within, and one whose entity the passage never names is not a connection at
# all: the page shows that entity only in the entity lists, with its gloss.
topic = r.get("topic")
carried_in = {s["n"]: [] for s in S}
within = {s["n"]: [] for s in S}
outside = {s["n"]: [] for s in S}
for s in S:
    n = s["n"]
    for m in s.get("mentions", []):
        if not m.get("form") or (m["e"] == topic and m["form"] == "ellipsis" and not m.get("note")):
            continue
        if "ante" in m:
            j = next((k for k, x in enumerate(by_n.get(m["ante"], {}).get("mentions", []))
                      if x["e"] == m["e"] and not x.get("form")), -1)
            f = (m["ante"], j) if j >= 0 else None
        else:
            f = first_named.get(m["e"])
        if not f or f[0] > n:
            outside[n].append(m)
            continue
        there = by_n[f[0]]["mentions"][f[1]]["quote"]
        item = ("refers", f[0], m["quote"], there, m["form"])
        (carried_in if f[0] < n else within)[n].append(item)
    for l in s.get("links", []):
        if l.get("to") in by_n:
            carried_in[n].append((l["kind"], l["to"], l["here"], l["there"], "implied" if l.get("implied") else "marked"))

forward = {s["n"]: [] for s in S}
for n, items in carried_in.items():
    for kind, to, here, there, how in items:
        forward[to].append((n, kind))

out = []
if r.get("lead"): out.append(f"**{r['lead']}** " + " ".join(s["text"] for s in S))
out.append(f"\n_Gist:_ {r['gist']}\n")
for s in S:
    n = s["n"]
    new = [ents[e]["label"] for e, (fn, _) in first_any.items() if fn == n and e in ents]
    # In play, as the page derives it: entities the sentence names (the topic
    # aside) and entities its atoms are about (the topic included).
    named_here = [m["e"] for m in s.get("mentions", []) if m["e"] != topic]
    about = [e for a in s.get("atoms", []) for e in a.get("on", [])]
    seen = [e for e in dict.fromkeys(named_here + about) if e in ents and first_any.get(e, (n,))[0] != n]
    atoms = s.get("atoms", [])
    out.append(f"### {n} · {atoms[0].get('type') if atoms else '?'}\n\n> {s['text']}\n")
    out.append("- **New here:** " + (", ".join(new) or "none"))
    if seen: out.append("- **In play:** " + ", ".join(ents[e]["label"] for e in seen if e in ents))
    if carried_in[n]:
        out.append("- **Carried in:**")
        for kind, to, here, there, how in carried_in[n]:
            tag = f"{kind}, {how}" if how else kind
            out.append(f"  - from {to} ({tag}): “{here}” ← “{there}”")
    if within[n]:
        out.append("- **Within:** " + "; ".join(f"“{here}” ← “{there}”" for _, _, here, there, _ in within[n]))
    if forward[n]:
        out.append("- **Carried forward:** " + "; ".join(f"{m} ({k})" for m, k in forward[n]))
    if outside[n]:
        out.append("- **Not a connection** (the passage never names it; shown with its gloss): "
                   + "; ".join(f"“{m['quote']}” → {ents[m['e']]['label'] if m['e'] in ents else m['e']}" for m in outside[n]))
    out.append("- **Atoms:**")
    for a in atoms:
        flag = " _(implied)_" if a.get("implied") else ""
        rel = f" {a['as']} {n}{a['for']}" if a.get("for") else ""
        on = f" [on {', '.join(ents[e]['label'] for e in a.get('on', []) if e in ents)}]" if a.get("on") else ""
        out.append(f"  - {n}{a.get('id')} {a.get('type')}{rel}{flag}: {a.get('claim')}{on}")
    out.append("")
print("\n".join(out))

if errs:
    print("ERRORS:", *errs, sep="\n", file=sys.stderr)
    sys.exit(1)
print("CHECK: clean" + ("" if check_ctx else " (context quotes not checked)"), file=sys.stderr)
if want_link:
    packed = gzip.compress(json.dumps(r, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), mtime=0)
    print(f"{PAGE}#gz={base64.urlsafe_b64encode(packed).decode().rstrip('=')}")
