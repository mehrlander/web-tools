---
name: shortcut-links
description: Give the user a tappable link to install or run an iPhone shortcut, copy actions, open Settings, or run a diagnostic that reports its result. For building shortcut actions, see apple-shortcuts-actions.
---

# Shortcut links

A `shortcuts://run-shortcut` link runs a shortcut already installed on the
iPhone. That shortcut can then install another shortcut, copy actions, or
perform another task.

Generate links with the commands below and copy the output unchanged.
Do not construct or edit the URLs by hand.

## Choose a command

Run these commands from `mehrlander/shortcut-tools`.
`<chain>` is a workflow JSON file; `<Name>` is an installed shortcut's name.

| Task | Command | Required on the phone |
| --- | --- | --- |
| Copy actions for pasting | `python3 tools/pack.py <chain> --url` | `Copy-ActionFromClaude` |
| Install a shortcut | `python3 tools/plist.py <chain> --link --fetch --ref <sha>` | `Library-Fetch` |
| Replace an installed shortcut | `python3 tools/plist.py <chain> --link --replace --ref <sha>` | `Library-Replace` |
| Install by paste (no signing) | `python3 tools/pack.py <chain> --install --ref <sha>` | `Library-Paste` |
| Run a shortcut | `python3 tools/run.py <Name>` | The named shortcut |
| Run with text input | `python3 tools/run.py <Name> --text '<input>'` | The named shortcut |
| Run and report the result | `python3 tools/run.py <Name> --log` | The named shortcut, `Run-Steps`, and `Log-Repo` |
| Open Settings | `python3 tools/run.py Open-URL --text '<prefs URL>'` | `Open-URL` |

Installing over an existing name keeps both copies, and the older one keeps
the name.

For a sequence, give `run.py` several names. `Run-Steps` runs them in order,
passing each result to the next shortcut. `--log` adds `Log-Repo` at the end.
Do not combine `--text` with a sequence or `--log`.

## Prepare an installation

Prefer `Library-Fetch`, which downloads a file signed before the user taps.

1. Build the plist: `python3 tools/plist.py <chain>`.
2. Sign and save it: `python3 tools/plist.py <chain> --write-signed`.
3. Commit and push the workflow, plist, signed file, and signing manifest.
4. Generate the install link using the commit SHA containing those files.

`--fetch` only generates the link; it does not sign or publish the file.

The older `Library-Import` route sends the plist for signing from the phone.
If using that route, first run `python3 tools/plist.py <chain> --sign` and
confirm success. A signing-service failure can appear on the phone as
“Unrecognized archive format.”

## Replacing a shortcut assigned to a gesture

Settings binds only `Double-BackTap` and `Triple-BackTap`, two stubs that pass
a label to `Route-Gesture` and never change. Anything behind the router is
called by name, so replacing it costs no Settings visit. Replacing a stub, or
whatever AssistiveTouch is bound to (not yet recorded), breaks its assignment.
Tell the user to select the replacement in Settings, and include the
appropriate Settings link in the same message.

Generate the link through `Open-URL`; bare `prefs:` links do not work reliably
in chat.

| Setting | URL to pass to `Open-URL` |
| --- | --- |
| Back Tap | `prefs:root=ACCESSIBILITY&path=TOUCH_REACHABILITY_TITLE/BackTap` |
| AssistiveTouch | `prefs:root=ACCESSIBILITY&path=TOUCH_REACHABILITY_TITLE/AIR_TOUCH_TITLE` |

## Diagnostics

Use `--log` so the result returns through `Log-Repo`, then read it with
`log.py`. Check the repository first. Ask the user only for observations the
log cannot provide, such as what appeared on screen.

Opening a shortcut link makes Shortcuts the current app. A shortcut using
`Get Current App` therefore tests only its Shortcuts branch when launched
this way.

## Display the link

Use one single-column table per shortcut link. Put the link in the header,
using `[label](url)`. Use 📋 for copying actions and 📲 for other tasks.

Put warnings, renaming instructions, and screen observations beside the table.
The examples below are templates; replace `GENERATED_URL` with command output.

### Install

| 📲 [Double-BackTap](GENERATED_URL) |
| --- |
| *Passes* `double-back` *to* `Route-Gesture`*.* |
| GENERATED_ACTION_LISTING |
| ⚡[`/workflows/double-backtap.json`](https://mehrlander.github.io/web-tools/pages/shortcuts.html?name=Double-BackTap) |

- Describe the shortcut in one italic sentence. Keep code identifiers outside
  the italic markers.
- Generate the action listing with
  `python3 tools/sketch.py plists/<Name>.plist --card`.
  Use the published plist that matches the installation.
- Preserve the generated listing, including line numbers and references.
- Keep the file link last. Use the repo-relative path, including its leading
  slash, as the label. Link to the shortcut's library page.

Use `NEW:` or `REPLACE:` only after checking `index.json`, the newest
`manifests/*.txt`, and the log. Those records can miss recent installations.
If the status is uncertain, use the shortcut name alone.

### Sequence

Add `--card` to `run.py` to generate the table.

| 📲 [Run-Steps](GENERATED_URL) |
| --- |
| `▸ Check-🎟️GitHubToken`<br>`↳ Log-Repo` |

Show every step, including `Log-Repo`. Use `▸` for the first and `↳` for the
rest. Do not number or link the step names, add a description, or add a file
row. If the markers visibly misalign, use `→` on every line.

`Run-Pick` is a menu of alternatives. Generate it with
`run.py --pick <Name> <Name>` and use the generated link caption.
The command does not support `--card` for menus.

### Single shortcut

| 📲 [Open-URL: prefs:root=ACCESSIBILITY&path=…](GENERATED_URL) |

Include short input after the shortcut name. Put longer input below the
header, preserving its line breaks. Omit the colon when there is no input.

For the rendering evidence behind these formats, see
[markdown-in-chat.md](https://github.com/mehrlander/web-tools/blob/main/docs/markdown-in-chat.md).
