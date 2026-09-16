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
against the reader's client over eight rounds on 2026-09-15; the renderer
findings behind each choice are in
[`docs/markdown-in-chat.md`](https://github.com/mehrlander/web-tools/blob/main/docs/markdown-in-chat.md).

| 📲 [Library-Import: Double-BackTap](shortcuts://run-shortcut?name=Library-Import&input=text&text=…) |
| --- |
| *Says* `double-back` *to the router, nothing else.* |
| ⁰ `│ text "double-back"`<br>¹ `│ run Route-Gesture ← «0»` |

**The header is the tap**, and the whole row is the link, so the target is the
full width. 📲, the receiver actually being run, a colon, its argument. It is
the query string made legible: the colon is the `&`, the left side is `name=`,
the right side is `text=`.

**No badge.** `install` and `new` were invented words, and `new` asserted device
state from repo data that cannot carry it: `run.py`'s audit reports anything
installed since the last dump as absent, so it produced false negatives for
shortcuts imported the same afternoon. The receiver name already says which kind
this is. The header states what the link does, never what the phone holds.

**One italic sentence** for what it does. This client italicises a code span, so
split the italic around any identifier: `*Says* ` + `` `double-back` `` + ` *to
the router.*`

**The listing appears only on an install**, since that is when something
permanent joins the library. Emit it, never type it:
`python3 tools/sketch.py plists/<Name>.plist --card` prints the cell, reading the
published plist, which is the artifact the reader actually receives. A literal is
quoted, a reference to another shortcut is bare, and `← «N»` names the line an
action takes its input from.

**The argument goes in the header when it is short** and drops to a gutter row
when it is not, which is what carries both a one-word input and a 52-name
payload without the card changing shape. A `%0A` in the payload is one row.

**Structure only where it recurs.** The header and the listing recur and earn a
fixed shape. A rename, a warning, anything situational reads better as a sentence
beside the card. A marker row of `↻` plus a name was tried and failed on its
first reader, who could not decode the glyph; no invented notation in a card
whose job is to remove guesswork.

## Icons

📋 when the payoff is the clipboard, 📲 for anything else. Always
`[label](url)`; a custom scheme is not autolinked and a code span is dead text.
