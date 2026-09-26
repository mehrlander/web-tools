---
name: userscripts
description: "Maintain, test, and ship Safari userscripts and bookmarklets in Web Tools. Use when editing userscripts/lib/launcher.js, updating userscript stubs or bookmarklets, diagnosing GM storage or loader cache updates, configuring repository capture intake, or verifying userscript builds."
---

# Userscripts

Part of the **workflow documentation** family.

## The premise

The Userscripts Safari extension executes code across third-party web origins without access to user credentials or GitHub tokens. The launcher and swipe deck run on any page with no manual setup per site once allowed in the extension menu.

Because re-installing an iOS extension on every edit is prohibitive, the `.user.js` stub is installed once. It loads a dynamic body from GitHub into GM storage, checking for new builds in the background and executing them on subsequent page loads. The installed stub is permanently pinned to `main`.

Bookmarklets share the same source file (`userscripts/lib/launcher.js`) but cannot use the raw host: raw GitHub serves `text/plain` with `nosniff`, which browser script tags refuse to execute. Bookmarklets read the same file from GitHub Pages instead, which serves it as JavaScript but only as `main` has it.

Data delivery back to repositories operates under mobile sandbox constraints: direct device Shortcuts (`shortcuts://run-shortcut?name=Log-Repo`) handle payloads within URL length limits (~8 KB), while larger payloads route through Web Tools Stage (`dest=owner/repo:channel`) and write directly to the clipboard.

## The goal and output

Maintain the launcher deck, view extractors, and channel routers in `userscripts/lib/launcher.js`.

Every edit yields three synchronized artifacts via the build generator:
1. `userscripts/builds.json`: SHA256 build hash and timestamp.
2. `userscripts/launcher.user.js`: Safari Userscripts stub with GM storage permissions and background loader.
3. `bookmarklets/launcher.js`: Standalone bookmarklet loader reading from GitHub Pages.

All changes must pass the 7 test assertions in `tools/test/userscript-stubs.test.mjs`.

## The process

1. **Edit source**: Make changes in `userscripts/lib/launcher.js`. Keep slides, extractors, icons, and action handlers self-contained.
2. **Re-stamp build**:
   ```bash
   python scripts/userscript-stub.py launcher --ref main \
       --name "wt launcher" \
       --description "The Web Tools launcher and swipe deck" \
       --match "*://*/*"
   ```
   This computes the SHA256 build hash, updates `builds.json`, synchronizes the version in `launcher.user.js`, and regenerates `bookmarklets/launcher.js`.
3. **Verify gate tests**:
   ```bash
   node --test tools/test/userscript-stubs.test.mjs
   ```
   Ensures the stub body exists, both host routes load the same body, SHA256 stamps match, the manifest agrees with the body, and versioned `@require` lines are intact.
4. **Ship actively to main**: Commit and merge directly to `main`. Do not park changes on feature branches for previewing. Behavior can only be observed on a physical device running over live web pages, and the installed stub reads `main`. Landing on `main` turns the phone into an immediate test environment where tapping `[ ⟳ ]` loads the new build instantly.

## Key insights

- **Active merging over GitHub Flow.** Branch-based previewing is an anti-pattern for Userscripts. Previewing a branch on device requires re-stamping with `--ref <branch>`, pushing, opening Safari, and manually re-installing the extension stub. Once `tools/test/userscript-stubs.test.mjs` passes, merge each change directly to `main` for device verification. `main` is the hot-reload source for the phone.
- **No manual re-installation.** The installed stub declares `@grant GM.getValue`, `@grant GM.setValue`, and `@grant GM.xmlHttpRequest`. On page load, the stub queries `builds.json` using a timestamp query parameter to bypass cache. When a new build hash is detected, it downloads the body into GM storage. The next page load evaluates the cached body. The refresh button `[ ⟳ ]` in the drawer header triggers an immediate update check.
- **Host separation.** Raw GitHub serves `text/plain` with `nosniff`. Safari Userscripts can fetch and evaluate this text, but bookmarklets injecting `<script>` tags cannot. Bookmarklets read from `https://mehrlander.github.io/web-tools/userscripts/lib/launcher.js`, whose ten-minute cache needs no purge.
- **Physical gesture requirement.** iOS Safari blocks programmatic navigation to `shortcuts://` schemes (`location.href = ...`) without an active user gesture. All Shortcut actions must bind to physical `<a>` elements rendered in the DOM.
- **Size threshold (`SEND_MAX`).** Shortcuts URLs drop payloads exceeding ~8,000 characters. In `userscripts/lib/launcher.js`, calculate `shortcutUrl(payload)`. If within `SEND_MAX`, wire `href` to the shortcut. If it exceeds `SEND_MAX`, route `href` to Web Tools Stage (`dest=owner/repo:channel`) and copy the full JSON payload to the clipboard in the click handler.
- **Capture envelope contract.** Standardize capture payloads across views: `{ op: "capture", channel, url, title, view, representation, captured_at, content, source, meta }`. Register the channel destination in the target repo's `.web-tools.json` and document the key in `docs/manifest-fields.csv`.
