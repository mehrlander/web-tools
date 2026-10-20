# Diff views: every way to see a change

A change can be shown in eleven places here. Pick the view by the question you are asking of the change. The views share three diff engines, listed below, so a fix to one engine reaches every view built on it.

| Question | View | Starts from |
| --- | --- | --- |
| Should this documentation edit go in? | a doc review in chat ([doc-craft, Review](../skills/doc-craft/SKILL.md#review)) | a branch's edits to documents |
| What did a branch change, file by file? | 🔍 [Review page](../pages/review.html) | a branch, or one file on it, against a base |
| Yes or no to one proposed edit? | [Approve page](../pages/approve.html) | an [`approval/1`](envelopes/approval.md) envelope: the edit and its author's reason |
| Apply an edit a session could not make? | the app's Proposals view | a pending proposal in web-tools-private |
| Which of my own edits to keep? | [Dictate](../pages/dictate.html) | a document as GitHub has it, and the edits made on the page |
| Which cuts of a shortening to keep? | [Shorter](../pages/shorter.html) | a text and a shorter version ([contract](envelopes/shorter.md)) |
| How has a paragraph been worded over time? | [Text Lab](../pages/text-lab.html), Variants; the app's file viewer | a paragraph's earlier versions and variants |
| How do two files on the stage differ? | the app's Stage view, Diff | two files in the working set |
| How do two pasted texts differ? | [Diff tool](../pages/diff-tool.html) | any two texts |
| How did a bill's text change? | [Legislative Diff Tool](../pages/drop/diff-tool.html) | two texts, pasted or loaded by URL |
| How should an edit look in a reply? | the [show-diff](../skills/show-diff/SKILL.md) skill | a proposed change, shown in chat |

## The engines

- [`lib/kits/md-diff.js`](../lib/kits/md-diff.js) reads a prose change as the document: each changed block gets a container, and unchanged prose renders as prose. Approve, Dictate, Text Lab and the app's file viewer use it.
- [`lib/kits/text-diff.js`](../lib/kits/text-diff.js) diffs lines, then words inside a changed line pair. The Diff tool, the Stage's Diff and the Proposals view use it.
- [`lib/kits/cm6-merge.js`](../lib/kits/cm6-merge.js) draws CodeMirror's side-by-side and unified views. The Review page uses it.

Shorter keeps a word diff of its own; md-diff took its rule for merging small changes from it.
