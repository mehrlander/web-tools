# PowerShell code workspace

The **Code** tab opens beside a project's Overview when its Web Tools manifest
declares an installation manifest. It brings the project's PowerShell and XAML
files into an editor while keeping three sources distinct: a pinned GitHub
revision, browser drafts, and copies supplied from the work computer.

The project address is `?view=project&project=<path>&tab=code&item=<file>`.
The existing `repo` and `ref` parameters select the repository and source branch.
Overview continues to own installation observations and adoption records.

## Working with code

The explorer groups files using the installation manifest's areas. Find file
filters paths; Search reads source content at the captured revision and includes
open drafts. Search stops at 500 results and reports that limit. New file creates
a browser draft under the project's `app/` folder.

The editor provides PowerShell and XML syntax highlighting, line numbers,
folding, bracket matching, indentation, undo/redo, Find and Replace, and word
completion with Ctrl+Space. Ctrl+S saves the draft in this browser. Each open
file keeps its own history. **Focus** uses the viewport; phone visits start in
focus mode. **Exit focus** returns to the app frame.

**Companion** opens the paired controller or XAML file. **Split companion**
shows the paired source beside the editable file. Connections lists explicit
`FindName` lookups found in that companion. A companion already open as a draft
contributes its draft text; otherwise the comparison uses pinned source.

Outline and References locate symbols and source expressions. Problems reports
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
the browser. **Export drafts** writes a JSON bundle; **Import drafts** validates
its scope, previews restoration, and refuses to replace different open drafts.

Browser storage is specific to its origin and browser profile. A branch preview
rendered under another origin has separate storage. Concurrent editing of the
same draft in multiple browser windows is not a collaborative editing protocol.
Export before moving to another browser or origin.

## Comparing and publishing

Diff compares the draft with its original base, the last checked GitHub source,
or a supplied copy. **Check GitHub** captures a new revision. An unchanged blob
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

Supplied copy accepts pasted text or one chosen/dropped file. The existing
correspondence kit recognizes UTF-16 BOMs and offers explicit alternate
encodings. The check records the supplied text and pinned source in browser
storage. **Use compared copy as draft** is a separate, confirmed action.

Copy, Download, and publication do not record installation. **Installation**
returns to the project's Overview and selected file. That view shows the
declared destination, pending adoption limits, and dated observations. Its
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
`node tools/test/powershell-workspace-browser.mjs` exercises the full app route,
editor, persistence, export, publication and phone layout against a local fixture.
`node tools/test/powershell-editor.mjs` exercises actual CodeMirror behavior and
the textarea fallback. The browser tests intercept GitHub requests and do not
publish their fixture code.

The editor uses the repository's existing CodeMirror 5 dependency and its
[documented APIs](https://codemirror.net/5/doc/manual.html).
PowerShell installation choices still need to honor Microsoft's
[encoding guidance](https://learn.microsoft.com/en-us/powershell/scripting/dev-cross-plat/vscode/understanding-file-encoding).
