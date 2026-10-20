# Web Tools Desktop

A Windows desktop version of [Web Tools](https://mehrlander.github.io/web-tools/app/).
The Web Tools tab loads the deployed app directly. The On this laptop tab adds
local activity, with an activity strip visible above either tab.

## First version

- Gemini errands: queued, claimed, first reply arriving, complete, or needing review.
- New results since the owner last marked results seen, with local output folders
  and the corresponding Web Tools errand one click away.
- Gemini worker process detection and the last local log write time.
- Current Codex and Gemini sessions, with working, quiet, idle and interrupted states.
- Open application signals for Codex, Antigravity, Stereo Bridge, and Ollama.
- Local places and the six most recently modified Downloads files.

An open application establishes no task state. A claim establishes ownership,
not continued execution. The worker's last log write is not a heartbeat.
The desktop app observes the existing worker; closing the window exits the
desktop app and leaves the worker alone.

## Build and run

Requires Windows, Node.js 22 or later and .NET 8 SDK to build, .NET 8 Desktop Runtime to run, Git,
and Microsoft Edge WebView2 Runtime. GitHub CLI supplies the existing Web Tools
login when available. An existing private activity checkout is needed for errands.

```powershell
npm run setup
.\desktop\build.ps1
.\desktop\run.ps1
.\desktop\run.ps1 -Laptop
dotnet run --project .\desktop\Checks\DesktopChecks.csproj
node .\desktop\Checks\ui-checks.mjs
```

`install.ps1` publishes into `%LOCALAPPDATA%\Programs\WebToolsDesktop` and creates
Desktop and Start menu shortcuts. It does not register Windows sign-in startup.
Close the app before updating an installation.

The default repositories folder is `%USERPROFILE%\gh`. Settings chooses a
different folder, or launch with `--root C:\path\to\repositories`. The private
checkout is its `web-tools-private` child. Window size, the Web Tools address,
and the time through which results were reviewed persist under
`%LOCALAPPDATA%\WebToolsDesktop\settings.json`. Browser storage lives beside
that file. Ctrl+1 selects Web Tools; Ctrl+2 selects On this laptop.
Alt+Left and Alt+Right navigate Web Tools history. A second launch focuses the
existing window.

## Reading activity

Local activity updates every two seconds. Remote activity fetches run separately
every five seconds, so a slow network request does not stall local sessions.
App process detection runs every ten seconds. Updates preserve selected errands
and scroll position. The status stays steady during background polling; a thin
loading indicator appears only for a slow initial load or Web Tools navigation.
Hover over Live to see scan and synchronization timings.

The reader fetches the private checkout's `background` branch. It reads requests, claims, results, and output presence
at one immutable Git revision through `ls-tree` and `cat-file --batch`. Fetch
updates only `origin/background`; the checkout, index, local edits, and checked-out
branch are untouched.
The latest eighty request filenames and every unresolved request are available;
the list shows forty matching entries at once. A first launch treats results
from the preceding day as new. Mark results seen advances the review time.

The worker's record contract lives in the private repo's
[`errands/README.md`](https://github.com/mehrlander/web-tools-private/blob/main/errands/README.md).
When GitHub cannot be reached, the last available records remain visible with
an offline notice. Missing configuration is shown explicitly.

Sessions use read-only queries against local Codex and Antigravity metadata.
Codex turn lifecycle events are read incrementally from local session files.
Prompts and replies are not collected. A working session with no event for three
minutes becomes quiet; recent idle sessions remain visible for thirty minutes.
An agent's local storage format can change. Unavailable metadata produces a
source notice while other activity continues updating.

## Desktop boundary

The hosted Web Tools page has no native message bridge. Only the bundled laptop
document receives native actions, and those actions accept known place keys or
errand identifiers from the current snapshot. They open folders or Web Tools
records; the laptop view has no command execution action. Replies and filenames
render as text. External web destinations open in the default browser.
Open errands link to the Stage. Errands with a reply link to their exact saved
result in Web Tools' Files view, since the Stage lists only open errands.

The GitHub CLI token is seeded only into the top-level Web Tools origin's existing
`ghToken` storage when that storage is empty. The token is never sent to the laptop
view or written into settings or diagnostics. The browser profile persists the
same authentication storage that the web app normally uses.

`Core/` holds activity interpretation and Git reading; `App/` holds the WPF and
Windows integration; `ui/` holds the laptop view. The build copies the existing
Tailwind browser runtime from node_modules into the local app, so laptop styling
loads without a network request. The app uses the
[WebView2 SDK](https://www.nuget.org/packages/Microsoft.Web.WebView2) and follows
Microsoft's [WebView2 security guidance](https://learn.microsoft.com/microsoft-edge/webview2/concepts/security).
`--diagnostics <path>` optionally writes the latest activity snapshot and loading
state for local verification. That file includes private activity and belongs
outside tracked source.
