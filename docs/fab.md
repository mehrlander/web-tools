# The FAB

The FAB is the draggable floating button every page and app view carries, and the drawer it opens ([`lib/alpineComponents/fab.js`](../lib/alpineComponents/fab.js)). This document is its account. Until 2026-09-28 the same text was the component's `description` string, about 2,100 words shown at 13px in the drawer's own Inspect tab; the string now names this file instead. The text below is that string divided under headings, with two changes: the drawer's four tabs are now named, since the string said four and described three, and a short section on the fourth, Text, is added.

## The launcher

Draggable floating button that doubles as a view-mode indicator: its launcher shows the neutral sidebar mark whenever the view sits at the default branch and a warning-tinted disc only when it is rendered off it (a toss, or a ?use= lib pin, at some other ref; a toss at main is main, so it reads neutral), plus an error-tinted KEY BADGE in its top-right corner whenever this browser holds no GitHub token, which is a second channel rather than a second meaning on the first: the disc's colour already says off-ref and is the only thing saying it. It matters because a home-screen web app on iOS keeps its own storage, separate from Safari's, so a token saved in one browser is not the token the other reads and the difference was invisible until a private read failed; off the default branch the drawer's ref bar goes warning-tinted and grows a button (labeled with the default branch, "main") that returns to the live deployed page, or, where the repo serves no Pages and no such page exists, re-addresses this same view at that branch.

## The drawer

Opens a right-side drawer with four tabs (Render, Inspect, Traffic, and Text), under a one-line READOUT strip carried on all but Notes (what this page load cost, how many calls browsing has added, what is left of the rate limit) which is also the way the Traffic tab is found.

## The layer strip

Above the tabs, not inside one, sits the LAYER strip naming the frame stack this view arrived through (a toss is renderer over page, the app view is app over renderer over page, a nested toss four), one row each, outermost first, the selected one ringed and every row carrying its own off-ref mark so a layer on branch code cannot hide behind a neutral launcher two levels up: the layer is the drawer's subject and every tab is a lens on it, so picking a row re-points the whole drawer and a lone page renders as a one-line label rather than vanishing, which would leave Inspect and Traffic with nothing naming what they describe. It is derived by walking the live frames each time the drawer opens rather than from a remembered announcement (so a frame that goes away needs no clear), and a cross-origin layer is listed as sealed rather than omitted.

## Render: the ref bar

Render (the default) leads with a ref bar naming the ref this view is rendered at, which opens a dropdown of the branches carrying a different version of this page (blob-compare against the default branch); one tap renders there, outside a toss by navigating to toss-render (the one renderer, no bespoke overlay), inside one by re-addressing in place via __tossNavigate.

## Render: the width bar

Under it a WIDTH bar answers the sibling question, what shape the view is rendered at: Actual / Phone 390 / Tablet 820 / Desktop 1280, each resolving to a frame of that width, since a frame is the only thing in a browser that honestly IS a viewport (media queries and a boot-time innerWidth read both see it, and pointer/hover are the part no width can fake, which the bar says rather than leaves to be discovered). Inside a toss it moves the frame in place through the shell's window.__tossWidth; outside one it navigates to toss-render carrying ?w=, the same trip the ref rows make, which is also what makes it trustworthy, since the page boots fresh at the target width. It tints itself warning off actual rather than borrowing the launcher's mark, which is reserved for the off-ref state a viewer cannot otherwise see.

## Render: page toggles

Sharing that row, past a hairline, are the page's own `toggles`, the state counterpart to `actions`: a page declares { key, label, icon, on, title, set } and each becomes one on/off control beside the presets, since which ref, what width, and whatever else a page is presented at are one question. The presets go icon-only under a single Width label so the row holds one line at a phone's drawer width, and nothing on it explains itself in prose. The app contributes HEADER there, which is the way to an unframed view and the way back from one; the sidebar is deliberately not offered, having two owners already (the header's hamburger, and ?shell= in the address).

## Render: the repo and path block

Above it the repo/path block carries two controls: the PATH is a picker (alpineComponents/path-picker, trigger-less, rooted at this repo and ref) so any file in the repo can be chosen and rendered from the drawer, and the github mark is a MENU (this file, its commits, then the repo rows lib/kits/github-links.js gives the sidebar). The ref bar sits under that block rather than above it.

## Render: the branch guide

The body of the tab is the branch's GUIDE, its PR body rendered as markdown, with the links inside re-aimed at what can show them (a blob link to a page becomes a toss of that page, one to markdown or data becomes a data-view read) and lifted into a chip strip deduped by file; arrows step through every PR the branch has had, newest first, since a merge ends a PR but not the branch. With no PR the pane reports the ref's standing instead (the commit it is at, the PR that code came from, how long ago) and the file's own last change on that ref, which is where the version chip went; the guide reads with one REST call on open and never waits on the branch scan, which is the dropdown's and runs when it opens.

## Inspect

Inspect merges the page scripts (loaded via gh.load(), with per-entry status) and Alpine components (tap to outline in place) into one scroll; in a #gh= toss it scans the subject frame too, listing the tossed page first and badging the rows that belong to the shell; each script row carries what it cost, reading "inlined" for a module the pre-build served from its cache rather than a byte figure that would imply a fetch nobody made.

## Traffic

Traffic answers the size question in three bands that do not share a unit: BOOT is what this one page load cost (Resource Timing, weight by role with a bar, then every resource, each marked network / cached / size-not-disclosed), API is what browsing has spent since (the fetch wrapper reading content-length, grouped by endpoint shape since a browser has no honest async caller context, with the rate limit remaining), and a collapsed STORAGE line reports what the origin keeps (Web Storage plus navigator.storage.estimate, which is quota-managed storage only: the HTTP cache is not counted there and shows up as the cached rows under Boot instead), opening itself only where there is mass to look at.

## Text

Text reads what the page says, as against the other three tabs, which report how it was delivered. The string this document replaces did not describe it; [`tools/test/fab-text.test.mjs`](../tools/test/fab-text.test.mjs) states what the tab reports and which of its figures are gated.

## Notes and the annotator

Notes was a fifth tab and is not: the annotator's set is read in its own card now (kits/annotate.js), whose expander opens the list, either serialization and the actions on the set, so the drawer carries no second implementation of that view and no handshake to keep it in step. What survives here is STARTING the annotator, from the take grid, from the launcher menu, and from a SELECTION: select text anywhere on the page and a compact "+ note" offer appears ON the passage (teleported to the body, since the launcher's own transform would trap a fixed child, and carrying no quote because the words are right there), one tap on which loads the annotator, aims it at the document the passage is in, and opens the composer on that passage; the one listener this component arms on the host document (selectionchange, debounced) exists for it, and it stands down while the annotator is on, whose own chip and selection bar offer the same thing.

## The launcher menu

A LONG PRESS or right-click on the launcher opens a short menu with two built-in rows, over a CREDENTIAL SECTION that appears only where the token is missing: "Get token" hands the browsing context to Shortcuts through the device's gesture router (shortcuts://run-shortcut, an anchor rather than a location assignment, carrying the label web-token), and "Paste token" raises a small card, teleported to the body and carrying one field, a clipboard button that fills it and a Save that checks the shape before it writes; the card raises ITSELF on the way back from Shortcuts, so the trip is tap, switch back, paste, with no second long press to remember. A field rather than a silent clipboard read because iOS gates navigator.clipboard.read() behind a system Paste confirmation a page cannot style or explain, and the platform's own long-press Paste has no such gate. A third row, "Test the bridge", sits with Peek and the probe instead and appears in EVERY token state, since gating the only row that runs a shortcut on a missing credential leaves a browser that has one unable to find out whether the mechanism works at all. It fires the same kind of link at Log-Repo, which needs nothing installed and commits what it is handed, so the positive answer lands in the device log; the negative is unobservable from there, because a scheme nothing is registered for fails silently, so every one of these rows also watches for this document being backgrounded and reports the exact URL it tried when the document stays put. "Take a note" turns the annotator on and stages a PAGE draft with the microphone off: an offer rather than a recorder that started itself, and the three aimed targets are still reached by the gesture that defines each one. A PROBE row beside Peek arms kits/probe.js on the view (its corner readout of live conditions plus the trace of every popup guard decision), and the same row takes it off again, its label carrying the state; it is armed in the WATCHED realm rather than this one, through the subject frame's own gh chain, since unlike Peek the probe listens for window events and reads window.__panelTipProbe, and a framed page with no loader of its own is told to use ?probe= instead. Reading the set is the card's own job, one tap on its Notes header. "Home" leaves for the deployed app at the default branch, which is the one way out of a view that does not depend on the view: a fixed address rather than the ref bar's re-render of THIS page elsewhere, so it reaches the app from a toss, from a ?use= pin, and from a page that was never part of it. Under them sit the rows the page contributes through `menu`, the third opt-in contract beside `actions` and `toggles` and the one for a verb wanted BEFORE the drawer rather than inside it (the app contributes the HEADER row, the second owner of the Render tab's header switch and the one a reader finds without knowing which tab to open, which is what an app view needs since it opens with no header on screen); they are read at open time rather than from the drawer's scan, so the first long press of a page load is not an empty menu. Every row is one line carrying a label and an icon, since a menu raised by a held finger is read in the half-second before the finger lifts and has no room for prose. A tap still opens the drawer, and a drag still moves the launcher; a right-click raises the menu and does ONLY that, spending the gesture the way a fired long press does so the pointerup behind it cannot toggle the drawer as well.

## The take menu

A take menu sits under the render tab in every context the drawer appears in, toss included, with six named outputs: a rendering copy (one pasteable HTML string carrying the page plus its own code and read() data inlined, for CodePen or any bare HTML preview), a review brief (sized before it is taken, and refused over a token cap rather than silently copying megabytes), a picked REGION (Peek armed on its Render reading: tap an element, step to the ancestor you mean, and copy it wrapped as a page that renders alone, with the theme and vendor tags carried and the framework attributes stripped, proved in a frame before the copy), a stage link, and the two zips. Inside a toss it aims at the subject rather than the shell.

## Other controls

A header hard-refresh button reloads bypassing the browser cache, for Safari on iOS. Plus a collapsible console and a compact version chip.

## One per viewport

Singleton per viewport: toss-render stamps __fabHosted so a fab booting under it declines to mount (handing the rendered subject up via __tossSubject/__tossFrame for the shell fab to adopt), and a fab booting inside an iframe declines on its own (data-allow-framed opts back in). The host page offers the bust-out instead.
