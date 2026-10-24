# The FAB

The FAB is the draggable floating button every page and app view carries, and a tap on it opens the FAB sidebar ([`lib/alpineComponents/fab.js`](../lib/alpineComponents/fab.js)). This document is their account. The off-site FAB, a separate program that draws the same button on pages Web Tools does not serve, has its own in [`userscripts/README.md`](../userscripts/README.md).

## What the FAB says

The FAB doubles as an indicator. Its colour, the glyph at its centre and two corner badges say which version of the view is on screen and whether a newer one exists, whether this browser holds a GitHub token, and whether selected text can become a note. Each signal is a row of [`fab-signals.csv`](fab-signals.csv): when it shows, what it means and what a tap does. The Map view's Showing tab renders the rows under **What the FAB says**, and [`fab-signals.test.mjs`](../node/test/fab-signals.test.mjs) holds the live ones to the FAB's markup, so a glyph added to `fab.js` fails the suite until its row exists.

The newer-commits check runs when the view changes and when the tab comes back into view, never on a timer, and only where a token is saved, since the anonymous rate limit is shared by the whole browser.

## The FAB sidebar

A tap opens the FAB sidebar on the right, with six tabs (About, Render, Inspect, Traffic, Text, and Note), under a one-line READOUT strip carried on all but Text (what this page load cost, how many calls browsing has added, what is left of the rate limit) which is also the way the Traffic tab is found. The sidebar opens on About, which shows what the page in view says about itself through its `about` declaration: what it is and what it reads.

## The layer strip

Above the tabs, not inside one, sits the LAYER strip naming the frame stack this view arrived through (a toss is renderer over page, the app view is app over renderer over page, a nested toss four), one row each, outermost first, the selected one ringed and every row carrying its own off-ref mark, so a layer on branch code cannot hide behind a neutral FAB two levels up. The layer is the FAB sidebar's subject and every tab is a lens on it, so picking a row re-points the whole sidebar, and a lone page renders as a one-line label. It is derived by walking the live frames each time the sidebar opens, and a cross-origin layer is listed as sealed rather than omitted.

## Render: the ref bar

Render leads with a ref bar naming the ref this view is rendered at, which opens a dropdown of the branches carrying a different version of this page (blob-compare against the default branch); one tap renders there, outside a toss by navigating to toss-render, inside one by re-addressing in place via __tossNavigate; over a file deck or the Stage's reader it asks __deckNavigate first, which re-renders where the reader stands. Off the default branch the ref bar turns warning and grows a button labeled with the default branch ("main") that returns to the live deployed page, or, where the repo serves no Pages, re-addresses this same view at that branch.

## Render: the width bar

Under it a WIDTH bar answers the sibling question, what shape the view is rendered at: Actual / Phone 390 / Tablet 820 / Desktop 1280, each resolving to a frame of that width, since a frame is the only thing in a browser that is a viewport to media queries and a boot-time innerWidth read alike (pointer and hover are what no width can fake, and the bar says so). Inside a toss it moves the frame in place through the shell's window.__tossWidth; outside one it navigates to toss-render carrying ?w=, so the page boots fresh at the target width. It tints itself warning off actual; the FAB's mark stays reserved for the off-ref state.

## Render: page toggles

Sharing that row, past a hairline, are the page's own `toggles`, the state counterpart to `actions`: a page declares { key, label, icon, on, title, set } and each becomes one on/off control beside the presets. The presets go icon-only under a single Width label so the row holds one line in the FAB sidebar on a phone. The app contributes HEADER there, the way to an unframed view and back; the app's sidebar is not offered, having two owners already (the header's hamburger, and ?shell= in the address).

## Render: the repo and path block

Above it the repo/path block carries two controls: the PATH is a picker (alpineComponents/path-picker, trigger-less, rooted at this repo and ref) so any file in the repo can be chosen and rendered from the FAB sidebar, and the github mark is a MENU (this file, its commits, then the repo rows lib/kits/github-links.js gives the app's sidebar). The ref bar sits under that block rather than above it.

## Render: the branch guide

The body of the tab is the branch's GUIDE, its PR body rendered as markdown, with the links inside re-aimed at what can show them (a blob link to a page becomes a toss of that page, one to markdown or data becomes a data-view read) and lifted into a chip strip deduped by file; arrows step through every PR the branch has had, newest first, since a merge ends a PR but not the branch. With no PR the pane reports the ref's standing instead (the commit it is at, the PR that code came from, how long ago) and the file's own last change on that ref; the guide reads with one REST call on open and never waits on the branch scan, which is the dropdown's and runs when it opens.

## Inspect

Inspect merges the page scripts (loaded via gh.load(), with per-entry status) and Alpine components (tap to outline in place) into one scroll; in a #gh= toss it scans the subject frame too, listing the tossed page first and badging the rows that belong to the shell; each script row carries what it cost, reading "inlined" for a module the pre-build served from its cache rather than a byte figure that would imply a fetch nobody made.

## Traffic

Traffic answers the size question in three bands that do not share a unit: BOOT is what this one page load cost (Resource Timing, weight by role with a bar, then every resource, each marked network / cached / size-not-disclosed), API is what browsing has spent since (the fetch wrapper reading content-length, grouped by endpoint shape since a browser has no honest async caller context, with the rate limit remaining), and a collapsed STORAGE line reports what the origin keeps (Web Storage plus navigator.storage.estimate, which is quota-managed storage only: the HTTP cache is not counted there and shows up as the cached rows under Boot instead), opening itself only where there is mass to look at.

## Text

Text reads what the page says, as against Render, Inspect and Traffic, which report how it was delivered. [`node/test/fab-text.test.mjs`](../node/test/fab-text.test.mjs) states what the tab reports and which of its figures are gated.

## Notes and the annotator

The annotator (kits/annotate.js) keeps its notes in its own card, which shows them as a list, as Markdown or as JSON, or each beside what it is about on the page. The FAB starts the annotator in two ways. Its long-press menu aims it (Page, Element, Section, Region), and the FAB SIDEBAR then hosts the card in a dock at its bottom, under the tabs, with a strip below it for the FAB itself; Element, Section and Region are chosen by pointing at the page, so those three close the sidebar while the reader points, and the sidebar reopens when the note's draft opens. A selection opens the Note tab instead, below. A page that turns the annotator on by itself, without the FAB, still gets the card floating over the page.

A SELECTION lights the FAB: select text anywhere on the page and a highlighter icon replaces the FAB's mark, a ring surrounds the button, and its hover label quotes the passage. A tap on the lit FAB opens the FAB sidebar on its NOTE tab: the passage quoted at the top, a plain field under it that takes the focus, and Save (or Ctrl or ⌘ Enter on a keyboard). The passage is read from whichever document it is in; in a toss (pages/toss-render.html showing a page inside a frame), that is the frame's document. The tap takes the passage even when the press has already cleared the selection, and the passage stays highlighted on the page while the note is written; once the note is saved, its own highlight takes over. Closing the sidebar before saving selects the passage again in place of the highlight, so the FAB lights for it and the platform's Copy is back; what was written stays in the field, and a tap on the relit FAB returns to it. The field is a textarea rather than the card's dictation pad, so it has the platform's own keyboard, autocorrect and dictation key, and at the top of the sidebar the keyboard rises below it rather than over it. Notes written there go into the annotator's set, which owns them: the tab's list of the page's notes, with Copy all and delete, reads that set. Nothing is drawn beside the selected words. The FAB listens for selectionchange on the page's document (debounced) to light itself, and in a toss on each document the frame loads.

## The FAB menu

A LONG PRESS or right-click on the FAB opens a short menu. Every row is one line carrying a label and an icon, and no prose. A tap still opens the FAB sidebar and a drag still moves the FAB; a right-click raises the menu and does only that, so the pointerup behind it cannot toggle the sidebar as well.

- **Credential rows**, only where the token is missing. "Get token" hands the browsing context to Shortcuts through the device's gesture router (`shortcuts://run-shortcut`, an anchor carrying the label `web-token`), and "Paste token" raises a small card with one field, a clipboard button that fills it, and a Save that checks the shape before it writes. The card raises itself on the way back from Shortcuts. It is a field rather than a silent clipboard read because iOS gates `navigator.clipboard.read()` behind a system Paste confirmation; the Shortcuts-bridge comments in `fab.js` give the rest.
- **"Latest version"** heads the menu while the arrow badge is up and does what a tap on the badge does; the branch rides in its tooltip.
- **"Test the bridge"** appears in every token state and fires the same kind of link at Log-Repo, which commits what it is handed, so a positive answer lands in the device log. A scheme nothing is registered for fails silently, so every Shortcuts row watches for this document being backgrounded and reports the exact URL it tried when the document stays put.
- **"Note"** carries the aims as icon buttons beside one label: the page, an element, a section (only where the page declares a kind that names one), and a region. The page aim stages a PAGE draft with the microphone off. **"Hide notes"**, shown only while the card is up, puts the card away and keeps the notes.
- **Peek**, and a **PROBE** row that arms `kits/probe.js` on the view (its corner readout of live conditions plus the trace of every popup guard decision) and takes it off again, its label carrying the state. The probe is armed in the WATCHED realm through the subject frame's own gh chain; a framed page with no loader of its own is told to use `?probe=` instead.
- **"Paste"** puts the clipboard on the Stage: a page showing the Stage takes it in place, and any other page parks it through `kits/stage-handoff.js` and leaves for the app's Stage, which picks it up at boot.
- **"Home"** leaves for the deployed app at the default branch: a fixed address, so it reaches the app from a toss, from a ?use= pin, and from a page that was never part of it.
- **The page's own rows**, contributed through `menu`, the third opt-in contract beside `actions` and `toggles`, for a verb wanted BEFORE the FAB sidebar rather than inside it. The app contributes the HEADER row here, since an app view opens with no header on screen. They are read at open time, so the first long press of a page load is not an empty menu.

## The take menu

A take menu sits under the render tab in every context the FAB sidebar appears in, toss included, with six named outputs: a rendering copy (one pasteable HTML string carrying the page plus its own code and read() data inlined, for CodePen or any bare HTML preview), a review brief (sized before it is taken, and refused over a token cap rather than silently copying megabytes), a picked REGION (Peek armed on its Render reading: tap an element, step to the ancestor you mean, and copy it wrapped as a page that renders alone, with the theme and vendor tags carried and the framework attributes stripped, proved in a frame before the copy), a stage link, and the two zips. Inside a toss it aims at the subject rather than the shell.

## Other controls

A header hard-refresh button reloads bypassing the browser cache, for Safari on iOS. Plus a collapsible console.

## One per viewport

Singleton per viewport: toss-render stamps __fabHosted so a fab booting under it declines to mount (handing the rendered subject up via __tossSubject/__tossFrame for the shell fab to adopt), and a fab booting inside an iframe declines on its own (data-allow-framed opts back in). The host page offers the bust-out instead.
