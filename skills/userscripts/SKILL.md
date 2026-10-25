---
name: userscripts
description: "Maintain, test, and ship Safari userscripts and bookmarklets in Web Tools. Use when editing userscripts/lib/launcher.js, updating userscript stubs or bookmarklets, diagnosing GM storage or loader cache updates, configuring repository capture intake, or verifying userscript builds."
---

# Userscripts

Part of the **workflow documentation** family.

## The premise

The Userscripts Safari extension runs the launcher and swipe deck on any page, without user credentials or GitHub tokens. The `.user.js` stub is installed once, pinned to `main`, and loads the current body of `userscripts/lib/launcher.js` from GitHub into GM storage; bookmarklets read the same file from GitHub Pages. [`userscripts/README.md`](https://github.com/mehrlander/web-tools/blob/main/userscripts/README.md) owns how the stub, the loader and the two hosts work. Captures return to a repo through the `Log-Repo` shortcut (`shortcuts://run-shortcut?name=Log-Repo`), or through Web Tools Stage when too large for a URL.

## The goal and output

Maintain the launcher deck, view extractors, and channel routers in `userscripts/lib/launcher.js`.

Every edit yields three synchronized artifacts via the build generator:
1. `userscripts/builds.json`: SHA256 build hash and timestamp.
2. `userscripts/launcher.user.js`: Safari Userscripts stub with GM storage permissions and background loader.
3. `bookmarklets/launcher.js`: Standalone bookmarklet loader reading from GitHub Pages.

All changes must pass `node/test/userscript-stubs.test.mjs`.

## The process

1. **Edit source**: Make changes in `userscripts/lib/launcher.js`. Keep slides, extractors, icons, and action handlers self-contained.
2. **Re-stamp build**:
   ```bash
   python python/userscript-stub.py launcher --ref main \
       --name "wt launcher" \
       --description "The Web Tools launcher and swipe deck" \
       --match "*://*/*"
   ```
   This computes the SHA256 build hash, updates `builds.json`, synchronizes the version in `launcher.user.js`, and regenerates `bookmarklets/launcher.js`.
3. **Verify gate tests**:
   ```bash
   node --test node/test/userscript-stubs.test.mjs
   ```
4. **Ship actively to main**: Commit and merge directly to `main`. Do not park changes on feature branches for previewing. Behavior can only be observed on a physical device running over live web pages, and the installed stub reads `main`. Landing on `main` turns the phone into an immediate test environment where tapping `[ ⟳ ]` loads the new build instantly.

## Key insights

- **Active merging over GitHub Flow.** Branch-based previewing is an anti-pattern for Userscripts. Previewing a branch on device requires re-stamping with `--ref <branch>`, pushing, opening Safari, and manually re-installing the extension stub. Once `node/test/userscript-stubs.test.mjs` passes, merge each change directly to `main` for device verification. `main` is the hot-reload source for the phone.
- **Physical gesture requirement.** iOS Safari blocks programmatic navigation to `shortcuts://` schemes (`location.href = ...`) without an active user gesture. All Shortcut actions must bind to physical `<a>` elements rendered in the DOM.
- **Size threshold (`SEND_MAX`).** A Shortcuts URL drops a payload over about 8,000 characters. In `userscripts/lib/launcher.js`, compute `shortcutUrl(payload)`: within `SEND_MAX`, wire `href` to the shortcut; over it, route `href` to Web Tools Stage (`dest=owner/repo:channel`) and copy the full JSON payload to the clipboard in the click handler.
- **Capture envelope contract.** Standardize capture payloads across views: `{ op: "capture", channel, url, title, view, representation, captured_at, content, source, meta }`. Register the channel destination in the target repo's `.web-tools.json` and document the key in `docs/manifest-fields.csv`.
