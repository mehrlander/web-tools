# Web Tools Desktop

A Windows desktop version of [Web Tools](https://mehrlander.github.io/web-tools/app/).
The Web Tools tab loads the deployed app directly. The Now tab brings current
assistant work, the Gemini queue and recent results together. An activity strip
stays visible above either tab.

## First version

- Codex, Gemini and Claude lanes with shared assistant marks, session names,
  activity states, timestamps and explicit Laptop or Cloud labels.
- Gemini worker queue: waiting errands in request order, claimed work, arriving
  replies, and distinct empty, unavailable and saved-snapshot states.
- New results since the owner last marked results seen, with local output folders
  and the corresponding Web Tools errand one click away.
- Gemini worker process detection and the last local log write time.
- Current Codex and Gemini sessions, recent Claude desktop metadata, and Claude
  cloud session updates from Web Tools' existing captured-session cache.
- An activity feed with assistant, state and text filters, plus a selected result
  or a short history of observed local session events.
- Local places, service processes and the three newest Downloads files.

An open application establishes no task state. A claim establishes ownership,
not continued execution. The worker's last log write is not a heartbeat.
The desktop app observes the existing worker. Closing the window exits the
desktop app; the background companion keeps collecting activity for the phone.
The companion leaves the existing worker alone.

## Build and run

Requires Windows, Node.js 22 or later and .NET 8 SDK to build, .NET 8 Desktop Runtime
and ASP.NET Core 8 Runtime to run, Git,
and Microsoft Edge WebView2 Runtime. GitHub CLI supplies the existing Web Tools
login when available. An existing private activity checkout is needed for errands.

```powershell
npm run setup
.\desktop\build.ps1
.\desktop\run.ps1
.\desktop\run.ps1 -Laptop
dotnet run --project .\desktop\Checks\DesktopChecks.csproj
node .\desktop\Checks\ui-checks.mjs
node .\desktop\Checks\phone-ui-checks.mjs
node .\desktop\Checks\companion-checks.mjs
```

`install.ps1` publishes into `%LOCALAPPDATA%\Programs\WebToolsDesktop` and creates
Desktop and Start menu shortcuts. Add `-CompanionStartup` to register the hidden
companion at Windows sign-in. The desktop also starts the companion when needed.
Close both processes before updating an installation. The companion runs as the
signed-in user, so existing session metadata and Git credentials remain available.

The window, header, executable and shortcuts use the shared hex-nut mark from
[`lib/favicon.svg`](../lib/favicon.svg). The header bundles its existing
[`apple-touch-icon.png`](../apple-touch-icon.png) rendition. After changing that SVG, regenerate
the Windows icon with `.\desktop\update-icon.ps1` (requires Inkscape).
The generated ICO includes sizes from 16 to 256 pixels and is bundled in the app.

The default repositories folder is `%USERPROFILE%\gh`. Settings chooses a
different folder, or launch with `--root C:\path\to\repositories`. The private
checkout is its `web-tools-private` child. Window size, the Web Tools address,
and the time through which results were reviewed persist under
`%LOCALAPPDATA%\WebToolsDesktop\settings.json`. Browser storage lives beside
that file. Ctrl+1 selects Web Tools; Ctrl+2 selects Now. The existing `--laptop`
launch option still selects the Now tab.
Alt+Left and Alt+Right navigate Web Tools history. A second launch focuses the
existing window.

## Reading activity

Local activity updates every two seconds. Remote activity fetches run separately
every five seconds, so a slow network request does not stall local sessions.
Cloud session records synchronize every thirty seconds.
App process detection runs every ten seconds. Updates preserve selected errands
and scroll position. The status stays steady during background polling; a thin
loading indicator appears only for a slow initial load or Web Tools navigation.
Hover over Live to see scan and synchronization timings.

## Private phone view

The phone has its own Now, Queue and Recent views, assistant filters, result
details and short observed history. The phone view is read-only. The laptop must
be awake and online; waking the laptop through Windows App can restore access.
The last received snapshot remains in that browser's local storage, labeled with
its observation time when contact is lost. A responding server with an observation
older than fifteen seconds also loses its Live status. Closing the phone browser
stops polling and does not stop collection.

After installation, run `desktop/enable-phone.ps1` using the owner's Windows
account. The script reads the existing Tailscale identity, restricts the companion
to that identity, and configures private HTTPS through Tailscale Serve. Unmet HTTPS
requirements produce Tailscale's setup link. The script refuses to replace another
service at the root HTTPS address. The script never enables public Funnel access.

The phone URL is `https://<laptop>.<tailnet>.ts.net/`. Connect Tailscale on the iPhone
and open that address in Safari. Add to Home Screen is optional. Web Tools links
open the existing hosted app, with that browser's own Web Tools authentication.

`WebTools.Companion` listens only at `127.0.0.1:47831`. Tailscale Serve proxies that
listener and supplies the owner's identity header. The companion accepts the owner
identity or a per-user local bearer, validates the Host and Origin, disables HTTP
caching, and offers no CORS access or write routes. Other Tailscale identities are
denied. The desktop-only route requires the local bearer even through Serve.
Access settings, including the bearer, live in `companion-access.json` beside
desktop settings; those settings never enter API responses or tracked files.

- `GET /api/v1/now`: versioned phone projection, observation time, source freshness,
  assistant work, queue, recent results and the last fifty observed events.
- `GET /api/v1/results/<id>`: a selected reply, capped at 20,000 characters, plus
  the phone's link to its full saved result in Web Tools.
- `GET /api/v1/desktop`: full desktop snapshot for the authenticated local app.

The phone projection omits request notes, filesystem fields, downloads and native
actions. Polling uses conditional GET every two seconds in the foreground, pauses
when hidden, refreshes immediately on return, and backs off to fifteen seconds on
failure. The phone distinguishes local observation, Git synchronization and captured
cloud updates. Published Claude records never imply live cloud execution.

Remove `Web Tools Companion.lnk` from the current user's Startup folder to disable
sign-in startup. Stop `WebTools.Companion` to stop collection. Disable the private
proxy with `tailscale serve --https=443 off`; that command leaves other Serve ports
alone. `WEBTOOLS_COMPANION_DATA` and `WEBTOOLS_COMPANION_PORT` provide isolated
data and loopback ports for integration checks.

The reader fetches the private checkout's `background` branch. It reads requests, claims, results, and output presence
at one immutable Git revision through `ls-tree` and `cat-file --batch`. Fetch
updates `origin/background` and, for cloud records, `origin/main`; the checkout, index, local edits, and checked-out
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
Short Codex commentary updates supply the latest observed action. Full local
prompts and replies are not collected. A working session with no event for three
minutes becomes quiet. Recent sessions and observed events remain for one day.
The last 150 observed events persist locally in `activity-history.json` beside
settings. Polling without a state or commentary change adds no history entry.
An agent's local storage format can change. Unavailable metadata produces a
source notice while other activity continues updating.

Claude cloud records come from `state/sessions.json` at one immutable revision
of the private repository's main branch. Recorded closing states identify
published updates, including choices or requests for the owner; they never
assert that a cloud session is running. Selecting a record opens its exact
session in Web Tools. Signal details use the shared accessible title-tip kit.

## Desktop boundary

The hosted Web Tools page has no native message bridge. Only the bundled laptop
document receives native actions, and those actions accept known place keys or
errand or session identifiers from the current snapshot. They open folders or Web Tools
records; the Now view has no command execution action. Replies and filenames
render as text. External web destinations open in the default browser.
Open errands link to the Stage. Errands with a reply link to their exact saved
result in Web Tools' Files view, since the Stage lists only open errands.

The GitHub CLI token is seeded only into the top-level Web Tools origin's existing
`ghToken` storage when that storage is empty. The token is never sent to the laptop
view or written into settings or diagnostics. The browser profile persists the
same authentication storage that the web app normally uses.

`Core/` holds activity interpretation and Git reading; `Machine/` owns shared
Windows collection and local access; `Companion/` hosts collection and the API;
`App/` holds WPF integration; `ui/` holds the desktop view; `phone/` holds the phone
view. The build copies the existing
Tailwind browser runtime from node_modules into the local app, so laptop styling
loads without a network request. The app uses the
[WebView2 SDK](https://www.nuget.org/packages/Microsoft.Web.WebView2) and follows
Microsoft's [WebView2 security guidance](https://learn.microsoft.com/microsoft-edge/webview2/concepts/security).
`--diagnostics <path>` optionally writes the latest activity snapshot and loading
state for local verification. That file includes private activity and belongs
outside tracked source.
