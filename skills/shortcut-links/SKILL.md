---
name: shortcut-links
description: Hand over a tappable shortcuts:// link that installs, runs, or opens something on the user's iPhone. Use when delivering a shortcut to install, running one remotely, opening an iOS settings page, or asking a device question whose answer should come back on its own. Covers which route to pick, which receiver each needs, and the emitter for each, so no link is ever typed. For composing the action cards themselves, see apple-shortcuts-actions.
---

# Handing over a shortcut link

A `shortcuts://run-shortcut` link runs a **receiver** already on the device.
Everything below is one receiver plus one emitter. Run the emitter; never type a
link. A retyped payload keeps its actions and loses its label, so it works and
misreports at once.

Commands are `mehrlander/shortcut-tools`.

## The routes

| Payoff | Receiver | Emit with |
| --- | --- | --- |
| Paste action cards | `Copy-ActionFromClaude` | `pack.py <chain> --url` |
| Install a shortcut, signed here | `Library-Fetch` | `plist.py <chain> --link --fetch --ref <sha>` |
| Run one, input baked in | any | `run.py <Name> --text '<input>'` |
| Run and return the result | `Run-Steps` then `Log-Repo` | `run.py <Name> --log` |
| Open an iOS settings page | `Open-URL` | `run.py Open-URL --text '<prefs URL>'` |

`Library-Import` is the older install route: the phone gzips a plist and POSTs
it to a signing worker. Prefer `--fetch`, which signs in the repo instead.

## Four rules

**Pre-flight an install.** `plist.py <chain> --sign` before the link goes out.
The worker signs through Apple's iCloud service and answers an outage with a
46-byte text body, which the phone reports as "Unrecognized archive format", a
message that names the file for a fault two services away. Retrying here costs
nothing; a tap spent on an outage is wasted.

**Re-installing breaks a binding.** Back Tap and the AssistiveTouch button hold
a reference the save-over import does not preserve, so the gesture silently
stops working. A handover that replaces a bound shortcut carries the settings
link in the same message:

| Setting | `prefs:` path |
| --- | --- |
| Back Tap | `root=ACCESSIBILITY&path=TOUCH_REACHABILITY_TITLE/BackTap` |
| AssistiveTouch | `root=ACCESSIBILITY&path=TOUCH_REACHABILITY_TITLE/AIR_TOUCH_TITLE` |

Send these through `Open-URL`, not as bare links: a chat client swallows the
scheme, and Shortcuts does not.

**A diagnostic returns itself.** End it in `Log-Repo` rather than a question, and
read the answer with `log.py`. Ask the device only what the repo cannot answer,
which is what the screen did.

**A link makes Shortcuts the current app**, so anything routing on
`Get Current App` takes the Shortcuts branch every time and a tap proves nothing
about the others.

## The card

One table per tap, never several links in one table. Settled by screenshot
against the reader's client over ten rounds on 2026-09-15 and 2026-09-16; the
renderer findings behind each choice are in
[`docs/markdown-in-chat.md`](https://github.com/mehrlander/web-tools/blob/main/docs/markdown-in-chat.md).

**Every link is one receiver and one payload.** All four emitters build the same
URL, `run-shortcut?name=<receiver>&input=text&text=<payload>`, so an install is
not a different kind of link: it is `Library-Import` being run with a payload
that names a workflow. The header says which kind of tap this is, the body
unpacks the payload, and **the payload is the last thing in the card**.

So there are three shapes, and the payload picks which.

### A workflow: the install card

| 📲 [NEW: Double-BackTap](shortcuts://run-shortcut?name=Library-Import&input=text&text=…) |
| --- |
| *Says* `double-back` *to the router, nothing else.* |
| `⁰ │ text "double-back"`<br>`¹ │ run Route-Gesture ← «0»` |
| ⚡[`/workflows/double-backtap.json`](https://mehrlander.github.io/web-tools/pages/shortcuts.html?name=Double-BackTap) |

### Names: the sequence card

`Run-Steps` and `Run-Pick` take a payload of shortcut names, one per line, so the
names are the whole content of the tap and the header is just the receiver.

| 📲 [Run-Steps](shortcuts://run-shortcut?name=Run-Steps&input=text&text=…) |
| --- |
| `▸ Check-🎟️GitHubToken`<br>`↳ Log-Repo` |

`▸` is what runs first and `↳` is each step after, which is exactly what
`Run-Steps` does: it pipes each result into the next. No sentence and no gloss;
the names carry it. (Unverified: that `▸` and `↳` share an advance width in the
reader's monospace. If a screenshot shows them drifting, use a bare `→` on every
row and lose the pipe.)

### Anything else: the plain run

| 📲 [Open-URL: prefs:root=ACCESSIBILITY&path=…](shortcuts://run-shortcut?name=Open-URL&input=text&text=…) |

One row. The payload is data rather than a reference to anything, so there is
nothing to unpack and no body.

### The rules behind them

**The header is the tap**, and the whole row is the link, so the target is the
full width. It is the query string made legible: the colon is the `&`, the left
side is `name=`, the right side is `text=`.

**`NEW` and `REPLACE` are read, never assumed.** They are claims about the phone,
and this is the correction to the 2026-09-15 rule that banned the word outright.
It was right then, because `run.py`'s audit reports anything installed since the
last dump as absent and so called two shortcuts missing that had been imported
that afternoon. The claim is available now: `index.json`, the newest
`manifests/*.txt` and the log together are what
[`pages/shortcuts.html`](https://mehrlander.github.io/web-tools/pages/shortcuts.html)
joins to say `current`, `stale`, `on device` or `not on device`. Read those three
or print neither word and give the name alone. One residual risk, the same one
the audit carries and states: a shortcut installed since both the last dump and
the newest manifest still reads `NEW`.

**One italic sentence** for what it does, on the install card only, since that is
the one tap that leaves something behind. This client italicises a code span, so
split the italic around any identifier: `*Says* ` + `` `double-back` `` + ` *to
the router.*`

**The listing is emitted, never typed.**
`python3 tools/sketch.py plists/<Name>.plist --card` prints the cell, reading the
published plist, which is the artifact the reader actually receives. A literal is
quoted, a reference to another shortcut is bare, and `← «N»` names the line an
action takes its input from.

**The index belongs to the listing and nowhere else.** There, a number is an
address: `«4»` points at line 4, and the chain page makes it tappable. In a step
list nothing refers back, so a number is decoration that looks exactly like the
thing that is not decoration.

**Every step prints, including `Log-Repo`.** With `--log` the last step is always
the logger, and by the third card it is furniture. Print it anyway: a display of
a payload that omits part of the payload is the failure this format exists to
prevent, and the day it matters is the day a probe has no `Log-Repo` and nothing
says so.

**The last row is the file, and only an install card has one.** The form is
`⚡` with no space, then the repo-relative path in a code span, linking to
`pages/shortcuts.html?name=<Name>`. Every part of that was chosen against
something else:

- **`⚡` is the shortcuts library's own mark**, not a decoration and not a verb.
  📲 means a tap that reaches the device; this row reaches a page, so it cannot
  carry the same glyph. An earlier 🧩 with the words "Chain page" was tried and
  refused: the glyph meant nothing and the label named a thing by a term the
  reader does not use.
- **The path is the label**, because the name is already in the header and a
  second copy of it says nothing. It is a code span so it sets in monospace,
  which is what marks it as a file rather than as prose.
- **The leading slash stays**, since a bare `workflows/…` could be any depth and
  the card offers no other context. The repo name and the owner do not appear:
  the slash is the repo root, and once an owner is at the front the slash has to
  go, which trades a character you can read at a glance for two words you
  already know.
- **The destination is the page, not the blob.** The path is the file's
  identity; the page is where its actions, its callers and its build state can
  be seen at once. A blob shows one file and answers none of that.

It is the **last** row because the payload ends the card, and the file is a
destination rather than part of the payload.

**A sequence card has no such row**, and a step name is never a link. A step is a
shortcut already on the phone, so a link invites reading where the card exists to
remove it, and half these names could not carry one anyway: a step can be a
shortcut this repo holds no file for, `Open-URL` and `Fav-Settings` among them. A
list where some names are tappable and some are not reads as an error rather than
as a distinction.

**The argument goes in the header when it is short** and drops to a gutter row
when it is not, which carries both a one-word input and a 52-name payload without
the card changing shape. A `%0A` in the payload is one row.

**Structure only where it recurs.** The three shapes recur and earn a fixed form.
A rename, a warning, what to watch for on screen, anything situational reads
better as a sentence beside the card. A marker row of `↻` plus a name was tried
and failed on its first reader, who could not decode the glyph; no invented
notation in a card whose job is to remove guesswork.

## Icons

📋 when the payoff is the clipboard, 📲 for anything else. Always
`[label](url)`; a custom scheme is not autolinked and a code span is dead text.
