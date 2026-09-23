# PowerShell code workspace

The **Code** tab opens beside a project's Overview when its Web Tools manifest
declares an installation manifest. It brings the project's PowerShell and XAML
files into an editor while keeping three sources distinct: a pinned GitHub
revision, browser drafts, and copies supplied from the work computer.

The project address is `?view=project&project=<path>&tab=code&item=<file>`.
The existing `repo` and `ref` parameters select the repository and source branch.
Overview continues to own installation observations and adoption records.

## Working with code

The workspace has three views for the selected file: **Code** edits its browser
draft, **Compare** compares that draft with its base, GitHub source or a supplied
copy, and **History** lists the file's GitHub commits with links to inspect them.
History is separate from the editor's undo history.

The top bar shows the current filename and its project/ref, with **Files**,
**Review changes** and **File actions** beside it. **Code**, **Compare** and
**History** share a second row with Undo/Redo. Phones switch documents through
**Files**; desktop open-file tabs appear when multiple files are open. Both tab
sets support Left/Right Arrow, Home and End keys. Icon actions keep 48-pixel
touch targets. **File actions** contains Find, Find and replace, Code insights,
Close file, and the nested **Workspace actions** menu.

The explorer groups files using the installation manifest's areas. Find file
filters paths; Search reads source content at the captured revision and includes
open drafts. Search stops at 500 results and reports that limit. New file creates
a browser draft under the project's `app/` folder.

The editor provides PowerShell and XML syntax highlighting, line numbers,
folding, bracket matching, indentation, undo/redo, Find and Replace, and word
completion with Ctrl+Space. Ctrl+S saves the draft in this browser. Each open
file keeps its own undo history. **Focus** uses the viewport; phone visits start in
focus mode. **Exit focus** returns to the app frame.

**Companion** opens the paired controller or XAML file. **Split companion**
shows the paired source beside the editable file. Connections lists explicit
`FindName` lookups found in that companion. A companion already open as a draft
contributes its draft text; otherwise the comparison uses pinned source.

**File actions → Code insights** opens Outline, Problems and References; it
starts closed on phones. Outline and References locate symbols and source
expressions. Problems reports
selected lexical and PowerShell 5.1 compatibility observations. These browser
checks use a lexer and conservative patterns. They do not run the PowerShell
parser, PSScriptAnalyzer, WPF, COM, or the code itself. An empty Problems list
does not establish that the script works.

## Exact source and recoverable drafts

Source reads verify each Git blob's bytes and decode UTF-8 without removing its
BOM. The editor displays normalized lines while retaining exact source text,
including CRLF, CR and mixed separators. New lines follow the source's first
separator. Editor undo restores the exact version associated with its history
generation. The plain textarea fallback keeps a bounded history of exact text;
an unavailable undo is refused instead of guessing lost separators.

Draft identity includes repository, project, source ref, and path. IndexedDB
holds the base revision, base blob, original text, edited text, and update date.
Changing tabs or visiting another app view retains drafts. A failed or pending
save also retains recovery text in the current app window, and a browser unload
with unsaved text requests confirmation. Memory recovery cannot survive closing
the browser. **Workspace actions**, reached through **File actions** when a file
is open, provides **Back up drafts** and **Restore drafts**.
Backup writes the browser drafts to a JSON bundle. Restore validates that bundle's
repository, project and ref, previews restoration, and refuses to replace
different open drafts.

Browser storage is specific to its origin and browser profile. A branch preview
rendered under another origin has separate storage. Concurrent editing of the
same draft in multiple browser windows is not a collaborative editing protocol.
Make a backup before moving to another browser or origin.

## Comparing and publishing

**Compare** shows the draft against its original base, the last checked GitHub
source, or a supplied copy. An exact match shows **No changes** without repeating
the code; a new empty draft shows **New empty file**. **Line endings differ** is a
separate result that preserves both texts. Missing source versions show
**Comparison unavailable**. Changed lines label the source and browser draft
and retain explicit added/removed marks.
Desktop gutters label **From** and **Draft** line numbers. A phone uses one gutter:
the source line for a removal, otherwise the draft line.

The filename and project/ref control opens **GitHub source**, where
**Check GitHub** captures a new revision. An unchanged blob
can advance the draft's base revision without changing its text. When GitHub
changed that file, the workspace retains the original base and draft. **Use
current as base** displays the current-source diff, then asks for confirmation
before accepting that source as the new base. It keeps the draft text.

**Review changes** fetches current GitHub source and opens the draft diffs.
Publication requires a new branch name and commit message. Every draft's base
revision, blob, and original text is checked before a Git tree and commit are
created. Creating the new branch is the final write. Existing branches are never
updated or force-pushed, and conflicting or removed source files block the
workspace's publication flow. A source branch that advances after review does
not change the immutable parent of the new branch; the resulting pull request
can expose subsequent differences.

Publication retains browser drafts and links to GitHub's pull-request form.
An uncertain network result can mean GitHub created the branch without returning
its response. Check that branch before attempting a different name. The draft
remains available in either case.

## The separate work installation

PowerShell text can identify its repository file with the existing signature:

```powershell
# @file projects/wps/app/Modules/Forms/Forms.psm1
```

The path is relative to the repository root; the active repository and ref
provide the rest of the address. App-level paste, outside the editor or through
the app's paste control, recognizes that signature and opens the supplied copy
in **Compare**. Native paste with the caret in the code editor edits the current
draft normally. Recognition accepts BOM-prefixed text and LF, CRLF or CR line
endings without rewriting the supplied source. Different `# @file` paths in
one submission are rejected; repeated declarations of the same path are allowed.

Compare also accepts pasted text or one chosen/dropped file for a selected
source. The existing correspondence kit recognizes UTF-16 BOMs and offers
explicit alternate encodings. A check records the supplied text and pinned
source in browser storage. **Use as draft** is a separate,
confirmed action; recognizing a signature does not replace the browser draft.

Copy, Download, and publication do not record installation. **Installation**
returns to the project's Overview and selected file. That view shows the
declared destination, pending adoption limits, dated observations, and the
file's source, read-only. Its
confirmation records the exact row. When the file has a pending-adoption entry,
the first observation and removal of that entry land in one Git commit. A moved
branch fails without replaying stale ledger content over the new tip.

## Further development

The next language feature needs a PowerShell host: a deliberately invoked
Windows PowerShell 5.1 inspection script could export parser diagnostics,
symbols, hashes, and analyzer versions for import here. Bind those results to
the inspected source hash so later edits visibly invalidate them. Such a file
handoff can preserve the existing workflow without a background connection.

A debugger, runtime completion, WPF preview and live COM inspection need an
explicit host connection and execution model. A browser-only imitation would
hide those dependencies. Multi-file rename and reference navigation should
follow trustworthy symbol data. Multiple editor windows need atomic draft
conflict handling before they can promise collaboration.

## Implementation and verification

The component is [powershell-workspace.js](../lib/alpineComponents/powershell-workspace.js).
Its kits separate [repository and draft operations](../lib/kits/powershell-workspace.js),
[editor fidelity](../lib/kits/powershell-editor.js), and
[language observations](../lib/kits/powershell-language.js).
Installation derivation and writing remain in [installation.js](../lib/kits/installation.js).

`npm run preflight` runs the repository's derived-artifact checks and unit suite.
`npm run test:powershell-workspace` exercises the full app route,
editor, persistence, export, publication and phone layout against a local fixture.
`npm run test:powershell-editor` exercises actual CodeMirror behavior and
the textarea fallback. The browser tests intercept GitHub requests and do not
publish their fixture code.

The editor is CodeMirror 6, the same esm.sh module graph the app's other
editor kit (`lib/kits/cm6.js`) loads, so the app carries one CodeMirror. The
PowerShell mode is CodeMirror 6's legacy stream port of the CodeMirror 5
tokenizer (`@codemirror/legacy-modes/mode/powershell`); XAML uses
`@codemirror/lang-xml`. The browser checks serve those packages from
`node_modules` through `tools/render/cdn.mjs`, which stands in for esm.sh
offline. The port from CodeMirror 5 landed on 2026-09-23 at the owner's
direction.
PowerShell installation choices still need to honor Microsoft's
[encoding guidance](https://learn.microsoft.com/en-us/powershell/scripting/dev-cross-plat/vscode/understanding-file-encoding).
