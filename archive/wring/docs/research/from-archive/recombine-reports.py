#!/usr/bin/env python3
"""Assemble one complete copy of each Gemini research report.

Neither copy of a report in this estate is complete. The five committed
`../0N-*/gemini-report.md` files were made by pasting a Gemini Canvas build
into a file, which kept the numbered source list and lost the inline `[n]`
markers, the heading structure and every display-math block. The other copy is
the canvas document's own Markdown source, which Google Takeout does export:
every `Created Gemini Canvas titled …` activity record carries it in
`subtitles[0].name`, and the private `mehrlander/chat-histories` archive renders
it inline in its conversation files byte-identically (checked on all five:
24,835, 25,743, 23,303, 28,385 and 32,999 characters). That source kept the
structure, the math and the markers, and it has no bibliography: no `Works
cited`, no URLs, and inline `[n]` markers with nothing to resolve against. The
source list therefore survives only in the paste, and the body only in the
export.

This script joins the two: canvas source plus committed source list.

It needs the private archive checked out as a sibling of this repo, so it
cannot run for a public reader. The generated files are therefore the durable
artifact and this script is the auditable method behind them, not a build step
anything depends on.

    python3 recombine-reports.py --check     verify only, write nothing
    python3 recombine-reports.py --write     regenerate the report files

Verified 2026-09-16: after absorbing the six classes of paste damage listed in
`normalize`, the two bodies are word-for-word identical in four reports. The
fifth, 04-objective-selection, differs by ten words the paste dropped from one
table cell, which the canvas copy supplies.
"""
import argparse, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
RESEARCH = HERE.parent
ARCHIVE = Path("/home/user/chat-histories")
THREAD = (ARCHIVE / "2026-06-01-gemini-export/conversations/2025-12"
          / "0376-2025-12-20-discuss-how-we-could-use-an-arrow-function-and-"
            "template-lite.md")
DEEP_RESEARCH = (ARCHIVE / "2026-06-01-gemini-export/deep-research/reports"
                 / "2025-12"
                 / "2025-12-20-algorithmic-foundations-for-unsupervised-"
                   "template-induction.md")

SESSION = "gemini-session/177"
SNAPSHOT = "2026-06-01-gemini-export"

# Canvas title (as the activity log recorded it) -> committed folder
CANVAS_TO_FOLDER = {
    "Template Induction: Tokenization and Typing": "01-tokenization-typing",
    "Repeat Primitives and Candidate Control":     "02-repeat-primitives",
    "Template Formation Research Strategy":        "03-template-formation",
    "Research Question 4: Objective and Selection":"04-objective-selection",
    "Adjacent Domains Research Synthesis":         "05-adjacent-domains",
}

DISPLAY_MATH = re.compile(r"\$\$.*?\$\$", re.S)
MARKER = re.compile(r"\[(\d+(?:,\s*\d+)*)\]")


def canvas_blocks():
    """Each canvas build in the thread render, as (title, time, body)."""
    parts = re.split(r"^\*\*\d+\. 🎨 Gemini Canvas titled (.+?) — (\S+) UTC\*\*$",
                     THREAD.read_text(encoding="utf-8"), flags=re.M)
    out = []
    for i in range(1, len(parts), 3):
        title, time, body = parts[i], parts[i + 1], parts[i + 2].strip()
        if body.startswith("```"):
            body = body.split("```", 2)[1]
        out.append((title, time, body.strip("\n")))
    return out


def split_committed(text):
    """A committed report as (body, raw bibliography)."""
    i = text.rindex("Works cited")
    return text[:i].rstrip(), text[i + len("Works cited"):].strip()


def parse_bibliography(raw):
    """Entries from the committed run-on list '1. Title, URL 2. Title, URL ...'.

    Walked number by number in order, so a digit inside a title cannot split
    an entry.
    """
    spans, pos, n = [], 0, 1
    while True:
        m = re.compile(r"(?:(?<=\s)|^)%d\.\s" % n).search(raw, pos)
        if not m:
            break
        spans.append((n, m.end()))
        pos, n = m.end(), n + 1
    out = []
    for idx, (num, start) in enumerate(spans):
        end = (spans[idx + 1][1] - len("%d. " % (num + 1))
               if idx + 1 < len(spans) else len(raw))
        entry = raw[start:end].strip()
        urls = re.findall(r"https?://\S+", entry)
        if urls:
            url = urls[-1].rstrip(".,")
            title = entry[:entry.rindex(urls[-1])].strip().rstrip(",").strip()
        else:
            url, title = None, entry
        out.append((num, title, url))
    return out


def normalize(s, drop_display_math=False):
    """Reduce a copy to bare words so the two can be compared.

    Pasting the canvas into a file flattened six things: headings and bold,
    bullet glyphs, horizontal rules, table separator rows, the period after an
    ordered-list number, and inline math delimiters. It also dropped every
    display-math block. This absorbs exactly those classes, so anything left
    over is a real content difference.
    """
    if drop_display_math:
        s = DISPLAY_MATH.sub(" ", s)
    s = MARKER.sub("", s)
    s = re.sub(r"^[ \t]*-{3,}[ \t]*$", " ", s, flags=re.M)
    s = re.sub(r"\|?\s*:?-{3,}:?\s*(?=\||$)", " ", s, flags=re.M)
    s = re.sub(r"[#*`$\\_|•]", "", s)
    s = re.sub(r"(?<=\d)\.(?=\s|$)", "", s)
    return re.sub(r"\s+", " ", s).strip()


def note(folder, time, bib, unresolved):
    """The provenance block inserted under each report's own title."""
    lines = [
        "> **Assembled from two partial copies, neither of them complete.**",
        "> Body, headings, display math and the inline `[n]` markers are the"
        " Gemini",
        f"> Canvas document's own Markdown source, built 2025-12-20 {time} UTC"
        " and",
        "> exported by Takeout in its activity record's `subtitles[0].name`,"
        " read here",
        f"> from the private `mehrlander/chat-histories` archive (`{SNAPSHOT}`,"
        f" `{SESSION}`),",
        "> whose conversation render of it is byte-identical to that field.",
        f"> The {len(bib)} sources under Works cited come from this repo's own",
        f"> [`../{folder}/gemini-report.md`](../{folder}/gemini-report.md),"
        " which kept",
        "> the bibliography and lost the markers, the headings and the display"
        " math",
        "> when the canvas was pasted into a file. Method, checks and the"
        " limits of",
        "> this join: [README.md](README.md).",
    ]
    if unresolved:
        refs = ", ".join("[%d]" % n for n in unresolved)
        verb = "does" if len(unresolved) == 1 else "do"
        lines += [
            ">",
            f"> **{refs} {verb} not resolve.** The prose cites"
            f" {len(bib) + len(unresolved)} sources",
            f"> and the list holds {len(bib)}, ending on a complete entry."
            " Whether the paste",
            "> truncated it or Gemini numbered past its own list cannot be"
            " settled from",
            "> either copy.",
        ]
    return lines


def build_report(title, time, body, folder):
    committed = (RESEARCH / folder / "gemini-report.md").read_text(encoding="utf-8")
    cbody, raw = split_committed(committed)
    bib = parse_bibliography(raw)
    refs = sorted({int(x) for m in MARKER.findall(body) for x in m.split(",")})
    unresolved = [r for r in refs if r > len(bib)]

    head, _, rest = body.partition("\n")
    out = [head.strip(), ""]
    out += note(folder, time, bib, unresolved)
    out += ["", rest.strip("\n"), "", "## Works cited", ""]
    for n, t, url in bib:
        out.append(f"{n}. [{t}]({url})" if url else f"{n}. {t}")
    return "\n".join(out) + "\n", bib, refs, unresolved, body, cbody


def check_and_build():
    rows, ok = [], True
    for title, time, body in canvas_blocks():
        folder = CANVAS_TO_FOLDER[title]
        text, bib, refs, unresolved, cv, cm = build_report(title, time, body, folder)
        same = normalize(cv, drop_display_math=True) == normalize(cm)
        # the generated file must carry the canvas body verbatim, minus the
        # inserted note
        stripped = "\n".join(l for l in text.split("\n")
                             if not l.startswith(">"))
        embedded = normalize(stripped.split("## Works cited")[0])
        ok &= normalize(cv) == embedded
        rows.append((folder, time, same, len(bib), len(refs), unresolved,
                     len(DISPLAY_MATH.findall(cv)), text))
    return rows, ok


def deep_research_report():
    """The sixth report: a Deep Research run this repo never received."""
    text = DEEP_RESEARCH.read_text(encoding="utf-8")
    i = text.index("\n---\n")
    head, body = text[:i], text[i + 5:]
    title = head.split("\n", 1)[0].lstrip("# ").strip()
    prompt = re.search(r"\*\*Originating prompt \(inferred\):\*\*(.*?)\n\n",
                       head, re.S)
    prompt = prompt.group(1).strip() if prompt else ""
    src = re.search(r"\*\*Source:\*\*(.*?)\n", head)
    src = src.group(1).strip() if src else ""
    body, n = re.subn(r"^- (\d+)\. (.*?) (https?://\S+)\s*$",
                      lambda m: "%s. [%s](%s)" % (m.group(1), m.group(2).strip(),
                                                  m.group(3)),
                      body, flags=re.M)
    body = re.sub(r"^1\. \[", "## Works cited\n\n1. [", body, count=1,
                  flags=re.M)
    out = [
        f"# {title}",
        "",
        "> **A sixth report, recovered rather than recombined.** This is a"
        " Gemini",
        "> **Deep Research** run from 2025-12-20 17:29 UTC, four hours before"
        " the five",
        "> Canvas reports beside it, and it answers the whole strawman"
        " pipeline rather",
        "> than one research question. It was never committed to this repo,"
        " and is",
        "> extracted from the private `mehrlander/chat-histories` archive"
        f" (`{SNAPSHOT}`),",
        "> whose activity record holds the finished report in full:",
        f"> {src}",
        ">",
        "> A Deep Research record and a Canvas record arrive in opposite"
        " formats, which",
        "> is why this one needed no repair: Takeout exported it as HTML in the"
        " activity",
        "> record's `safeHtmlItem`, carrying its own source list, where a Canvas"
        " arrives as",
        "> Markdown in `subtitles` carrying no sources at all. Two edits: the"
        " `## Works",
        "> cited` heading above that list, and its"
        f" {n} entries turned into Markdown links.",
        "",
        "<details>",
        "<summary>Originating prompt, as the archive's extractor inferred"
        " it</summary>",
        "",
        "> " + prompt.replace("\n", "\n> "),
        "",
        "</details>",
        "",
        body.strip("\n"),
    ]
    return "\n".join(out) + "\n", title



# The ChatGPT half of the same problem, which cannot be recombined.

GPT_CHATS = [
    ("01-tokenization-typing", "69470c9f-e820-8330-881f-21787eb7d734",
     "Tokenization and Typing Analysis"),
    ("02-repeat-primitives",   "69470cfa-3498-832e-b79d-dba8207ec50e",
     "Research question clarification"),
    ("03-template-formation",  "6947117e-d900-8333-8071-2d068eee64fb",
     "Template formation research"),
    ("04-objective-selection", "6947124b-0244-8328-a313-c59fd865ee35",
     "Objective selection analysis"),
    ("05-adjacent-domains",    "69471334-cb64-832c-9d31-7b61f76705db",
     "Adjacent domain analysis"),
]


def gpt_sources():
    """Per-report external sources named by each ChatGPT record's metadata.

    This is a list, not a bibliography, and the difference is the point. The
    committed `gpt-report.md` files carry U+FFFC object-replacement characters
    where the browser's citation chips sat, but the export's stored message
    text has no placeholder at all, so nothing ties a reference to a position
    in the prose. Ordering the references and numbering them against those
    U+FFFC marks would look like a reconstruction and would not be one.
    """
    sys.path.insert(0, str(ARCHIVE / "tools"))
    import json, subprocess
    out = ["# Sources behind the ChatGPT reports", "",
           "The five [`../0N-*/gpt-report.md`](..) files lost their citations"
           " the other way",
           "round from the Gemini ones: each keeps the prose and has no source"
           " list at all,",
           "carrying U+FFFC object-replacement characters where the browser's"
           " citation chips",
           "sat. The chats themselves are supersets of the committed copies,"
           " and the export",
           "holds each reference in message metadata"
           " (`metadata.content_references`).",
           "",
           "**But the stored message text carries no placeholder for a"
           " reference**, so nothing",
           "ties one to a position in the prose. What follows is therefore the"
           " set of external",
           "sources each chat's metadata names, in first-appearance order, not"
           " a reconstructed",
           "bibliography. A large share of every chat's references point at the"
           " Wring README",
           "uploaded into the chat rather than at anything on the web, which is"
           " why these",
           "lists are short where the Gemini ones run to 29 and 52 entries.",
           "",
           "Generated by [`recombine-reports.py`](recombine-reports.py); see"
           " [README.md](README.md).",
           ""]
    for folder, uuid, title in GPT_CHATS:
        raw = subprocess.run(
            ["python3", str(ARCHIVE / "tools/extract_chat.py"),
             "2026-07-06-chatgpt-export", uuid, "--json"],
            capture_output=True, text=True, cwd=ARCHIVE).stdout
        chat = json.loads(raw)
        seen, srcs, uploaded, total = set(), [], 0, 0
        for node in chat["mapping"].values():
            msg = node.get("message") or {}
            for ref in ((msg.get("metadata") or {}).get(
                    "content_references") or []):
                url = (ref.get("url") or "").strip()
                if not url:
                    continue
                total += 1
                if url.startswith("file:"):
                    uploaded += 1
                    continue
                key = url.split("#")[0]
                if key in seen:
                    continue
                seen.add(key)
                srcs.append(((ref.get("title") or "").strip(), key))
        chips = (RESEARCH / folder / "gpt-report.md").read_text(
            encoding="utf-8").count("\ufffc")
        out += [f"## {folder}", "",
                f"[{title}](https://chatgpt.com/c/{uuid}) · {total} references"
                f" in the record, {uploaded} of them to the uploaded README ·"
                f" {len(srcs)} distinct external sources ·"
                f" {chips} U+FFFC marks in the committed copy", ""]
        for n, (t, u) in enumerate(srcs, 1):
            out.append(f"{n}. [{t}]({u})" if t else f"{n}. <{u}>")
        out.append("")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    if not THREAD.is_file():
        sys.exit(f"the private archive is not here: {THREAD}")

    rows, ok = check_and_build()
    for folder, time, same, nbib, nrefs, unres, dm, _ in rows:
        print(f"{folder:<24} {time}  bodies identical: {str(same):<5} "
              f"sources {nbib:>2}  refs {nrefs:>2}  unresolved {unres}  "
              f"display-math blocks recovered {dm:>2}")
    print(f"\ncanvas body embedded verbatim in every generated file: {ok}")

    if a.write:
        for folder, _, _, _, _, _, _, text in rows:
            (HERE / f"{folder}.md").write_text(text, encoding="utf-8")
            print("wrote", (HERE / f"{folder}.md").name)
        text, title = deep_research_report()
        (HERE / "00-algorithmic-foundations.md").write_text(text, encoding="utf-8")
        print("wrote 00-algorithmic-foundations.md")
        (HERE / "gpt-report-sources.md").write_text(gpt_sources(),
                                                    encoding="utf-8")
        print("wrote gpt-report-sources.md")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
