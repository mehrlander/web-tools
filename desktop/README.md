# Web Tools Desktop

A Windows desktop version of [Web Tools](https://mehrlander.github.io/web-tools/app/).
The Web Tools tab loads the deployed app directly. The Now tab brings current
assistant work, assistant errand queues and recent results together. An activity strip
stays visible above either tab.

## First version

- Codex, Gemini and Claude lanes with shared assistant marks, session names,
  activity states, timestamps and explicit Laptop or Cloud labels.
- Assistant errand queues: waiting errands in request order, claimed work and arriving replies. The Gemini worker card distinguishes empty, unavailable and saved-snapshot states.
- Recent results with local output folders
  and the corresponding Web Tools errand one click away.
- Gemini worker process detection and the last local log write time.
- Current Codex and Gemini sessions, recent Claude desktop metadata, and Claude
  cloud session updates from Web Tools' existing captured-session cache.
- An activity feed with assistant, state and text filters, plus a selected result
  or a short history of observed local session events.
- Recent activity: one latest meaningful change per piece of work, without
  read receipts or a step to acknowledge the activity.
- Published Claude checkpoints with topic titles, recent exchange summaries,
  measured activity and links to the resulting pull requests.
- The Gemini worker's last reported task and report time, alongside its queue.
  Tapping the phone card opens the latest twelve normalized reports and related errands.
- Claude cloud turns from explicit prompt, tool and response hooks, with bounded
  prompt and response text in the selected detail view.
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
node .\desktop\Checks\computer-ui-checks.mjs
node .\desktop\Checks\offline-checks.mjs
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
checkout is its `web-tools-private` child. Window size and the Web Tools address
persist under
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

The assistant headers on phone and desktop have separate launch arrows for
Codex, Antigravity and Claude Code. These work even when the assistant has no
recent activity. Names still filter the activity list; launch arrows use the
provider's HTTPS address in a separate browser context. Codex opens ChatGPT,
which includes Codex on mobile. Claude's Code URL also
supports its installed mobile app through universal links. Browser and app
handoff follows the device's link settings.

The phone opens on one Now feed: current work, waiting errands and all recent items
in the current snapshot, with assistant filters, inline details and short observed
history. The assistant headers keep compact usage bars visible above the feed;
the full Usage view remains available on desktop. Now and Computer are read-only;
Devices offers Stereo Bridge's media controls. The laptop must
be awake and online; waking the laptop through Windows App can restore access.
The last received snapshot remains in that browser's local storage, labeled with
its observation time when contact is lost. After a successful online visit, a
service worker saves only the interface assets for offline reloads. API responses
never enter Cache Storage; a network or server failure uses the saved interface, while an
HTTP access denial is returned directly. The interface can therefore still offer
Windows App when the laptop is unreachable. A responding server with an observation
older than fifteen seconds also loses its Live status. Closing the phone browser
stops polling and does not stop collection.

Tapping a main-list item toggles its compact inline details. Each item's launch
arrow opens compact choices for the provider session and its Web Tools record,
preserving Now's position and open detail. Claude uses its captured original URL;
Gemini uses the conversation ID and the enabled Antigravity instance reported by
the existing local service. The companion checks that routing every thirty seconds
without enabling remote access or launching a provider. Codex's documented thread
link opens its desktop app. On mobile, where no direct thread route is established,
the control offers ChatGPT and the original session title to copy for lookup.
Unavailable direct links are labeled; errands keep their saved request/result
destinations. Provider URLs are validated separately from Web Tools links. Older
phone detail bookmarks and the worker's own report view remain supported. On iOS,
a Home Screen web app may open an external link in a Safari browser sheet, where
the system offers the control to continue in Safari.

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
caching, and offers no CORS access. Stereo Bridge actions and repository fetches accept POST,
with a deliberate-action header and a same-origin browser request. Other Tailscale identities are
denied. The desktop-only route requires the local bearer even through Serve.
Access settings, including the bearer, live in `companion-access.json` beside
desktop settings; those settings never enter API responses or tracked files.

- `GET /api/v1/now`: versioned phone projection, observation time, source freshness,
  assistant work, queue, recent results, checkpoints, changes and the last fifty
  observed events.
- `GET /api/v1/results/<id>`: a selected reply, capped at 20,000 characters, plus
  the phone's link to its full saved result in Web Tools.
- `GET /api/v1/computer`: current Windows session state, machine measurements and
  grouped desktop application windows, with a separate window-observation time.
- `GET /api/v1/devices`: Stereo Bridge's current media and playback capabilities.
- `GET /api/v1/repositories`: local checkout state, dated GitHub comparisons and
  local file inventories.
- `GET /api/v1/files?path=<relative-folder>`: immediate folder contents beneath the configured repositories root, with names, Git status and file sizes. An empty path lists the root.
- `POST /api/v1/repositories/<key>/fetch`: queue a fetch for a discovered repository,
  or `all`, without integrating changes into any working branch.
- `POST /api/v1/devices/stereo/<action>`: previous, play-pause, next, volume-down,
  mute or volume-up. Controls require the same owner access as observations.
- `GET /api/v1/desktop`: full desktop snapshot for the authenticated local app.

### Computer view

The phone's title menu switches between Now, Computer, Devices and Files, retaining each view's
reading position. Computer shows application icons, names and window counts;
tapping an app reveals its window titles and minimized state. The companion
enumerates top-level desktop windows in its own Windows session every five
seconds, excluding shell helpers, tool windows, owned dialogs and cloaked windows.
UWP frame hosts resolve to their child app where possible. The view is a window
inventory, so tray-only apps, services and windows on other virtual desktops may
be absent. An open window does not imply agent work. No executable paths, command
lines, screenshots or process-control actions enter the API.

Windows session APIs report lock and remote-connection state. Locked,
disconnected or unknown sessions retain the previous window list and its original
observation time. CPU, physical-memory use, and battery/power readings continue
independently; unavailable values remain unknown. The companion saves the latest
Computer observation beside its settings for restart continuity. The phone polls
Computer every three seconds while that view is visible, pauses when hidden,
backs off on failure, and stores its last observation locally with a stale label.
The isolated companion-check environment never collects real window titles.

The shared phone header's monitor button directly runs the owner's existing
**Open-Windows** iPhone shortcut through
`shortcuts://run-shortcut?name=Open-Windows`. The shortcut's **Open App** action
selects Microsoft's Windows app (`com.microsoft.rdc.ios`). The legacy `rdp://`
handoff did not work on the owner's iPhone, so the interface no longer offers that
route or a connection-options menu. The shortcut opens Windows App; the owner's
saved laptop connection remains there. The companion does not alter remote
desktop, firewall, login or wake settings.

When changing the offline interface's asset contract, increment the cache version
in `phone/sw.js`. Successful installation replaces only this app's older shell
caches, without reloading an open page or caching private API bodies.

### Devices view

Stereo Bridge must already be running on the laptop. While Devices is visible, the phone polls the companion every two seconds. The companion reads Stereo Bridge's fixed loopback API on port 45831, showing the current track, player, timeline and available playback controls. Volume and mute affect Windows' selected audio output; no numeric volume or output-device reading is available. Tailscale carries the control requests. Phone audio still needs the existing Bluetooth connection.

The adapter disables redirects, bounds responses and omits native errors. Unavailable or stale observations disable controls. Actions run once, without retries, offline replay or a command queue; an unconfirmed response stays labeled. The interface distinguishes a reachable Bridge with no media from an unavailable Bridge. Roku discovery and control are not included in this version.

### Files view

Files groups working folders by repository at the configured root, showing each repository's default-branch folder first when available. An icon/count control reveals secondary work folders; Other files holds remaining root entries. Search includes collapsed folders. Top-level rows on the default branch omit branch labels and zero commit counts; their repository icon opens the folder name, branch, comparison and check time. Other Git working folders retain branch labels. The companion reads branch, working-file and commit differences every ten seconds. Named branches compare with the same-named GitHub branch when present, otherwise their configured GitHub upstream. Touch or keyboard focus on an arrow or warning symbol identifies the comparison branch, any different configured upstream, condition and GitHub check time. Comparisons that cannot establish counts use a warning symbol. The branch icon opens the observed PR state or inclusion in the GitHub default branch; a merged PR with unverified local inclusion remains flagged for review. Detached working folders compare with the GitHub default branch and are identified as snapshots when their commits are verified in that history. PR observations refresh with GitHub checks and retain their own last-successful time.

The companion fetches on startup and every five minutes. The root refresh icon checks all GitHub repositories; working folders with a GitHub origin have a vertical menu offering Check GitHub and Open on GitHub. The GitHub link selects the comparison branch when available. Fetches use explicit remote-tracking destinations, skip tags, pruning, submodules and automatic maintenance, and leave the working branch, index and files unchanged. Failed checks retain their previous successful time and a notice in the comparison tooltip. The phone polls every three seconds while the view is visible and disables check controls when its observation is stale or offline. Fetch reads GitHub changes; pull integrates changes into a working branch. Working folder synchronization offers fetch only. Git credentials, full filesystem paths, file contents and raw Git diagnostics stay outside the phone projection.

The companion inventories ignored and untracked entries on a separate loop from Git comparisons, waiting a minute after each completed scan. Local status icons show compact counts for changed tracked files, untracked files and ignored inventory entries; their panels retain exact counts, conflicts and inventory shortcuts. The explorer has breadcrumbs, search and All, Tracked, Untracked and Ignored filters. All lists immediate children; a Tracked folder contains tracked files. Ignored and Untracked also surface nested entries from the bounded local inventory, retaining measured folder sizes and file counts. Listings skip links and Git administrative entries and label incomplete scans. Folder listings refresh separately while visible, preserving search, focus and reading position. The root and last visited listings remain locally available when offline. File contents and file-changing actions are unavailable.

The Files inventory loop also publishes [`state/laptop-files.tsv`](https://github.com/mehrlander/web-tools-private/blob/background/state/laptop-files.tsv) to the private checkout's `background` branch so cloud sessions can see local material. The collector uses directory/stat metadata and Git index, ignore and reference metadata without opening working-file contents. Tracked filenames stay out of the TSV; folder totals include them. The collector collapses `node_modules`, `.venv`, `venv`, `__pycache__`, `.pytest_cache` and ignored `bin`/`obj` trees to one measured row each. Paths are relative to the configured root (`.` names the root), and unavailable totals stay blank. The writer makes a normal commit only when content changes, at most once per fifteen minutes, and retries concurrent updates without force-pushing. The private checkout's branch, index and working files remain unchanged.

### Account usage

The front-page assistant strip also shows compact allowance bars with percentages
used, labeled by each reported period (for example, 5h or Week). A small tick
marks the even-use budget pace, with amber fill for usage above that pace. The
weekly reset day and local time appear beneath the bars. Hover and Usage provide
the exact reset, pace difference and stale-reading details. Pace compares used
allowance with elapsed time; it is not a forecast and is hidden for stale, expired
or unknown periods. Model quotas without a
reported duration say Quota. Missing periods never gain a guessed bar; multiple
model or bucket readings for one period use the account-wide limit when present,
otherwise the most used reading. The full Usage view retains every limit.

The phone's Usage tab and the desktop's Usage panel show account allowances,
percentage used, reset countdowns and exact reset dates. Known window lengths
also get a time-elapsed tick. Readings are collected independently about once a
minute, without blocking activity. Local history samples every five minutes,
keeps eight days and sends at most sixty points per current window to the phone.
A trend begins with observed readings, without reconstructing past consumption.
Expired or stale readings remain labeled; passing a reset never supplies an
assumed zero.

`worker/session_usage.py` projects recent Claude cloud `usage/1` extracts from one
revision of the existing private checkout. The projection keeps session identity,
last measured input context, call time and session-to-date token/cache counters.
Prompt text, replies and raw transcripts are excluded. The private Usage calendar
joins these measurements to Claude activity in its fixed one-hour cache-window list,
ordered by context size. Each compact row switches to the matching session in Now
and shows the last recorded context token count. Context size is not cumulative
spend; recent activity and prior cache reads do not establish a reusable cache or
its expiry time. Missing sizes remain unknown, and saved measurements retain their
observation time. Extracts cover the main conversation and update after turns finish.
Now session metadata can show the recorded output-token count with a coins icon,
matching the Web Tools session headline. Tapping the count shows fresh input,
cache reads, cache writes, output and last measured context separately. These
counts cover recorded main-conversation calls and do not measure subscription
allowance consumption. Unsupported session sources omit the badge.

Codex uses the signed-in CLI's documented `account/rateLimits/read` app-server
method. The CLI manages its own authentication. Each reported bucket and period
remains separate. Gemini uses the existing Antigravity worker's loopback
`RetrieveUserQuotaSummary` response, which identifies the shared `gemini-5h`
and `gemini-weekly` buckets with explicit window names and reset times. Workers
without the summary method fall back to per-model `GetUserStatus` quotas without
inferring their duration. Temporary summary failures retain the named readings
and their history as stale. That local interface is version-dependent and may
contain cached provider data; the displayed time is when the worker status was
read. The collector never starts the worker or a conversation. Only Gemini model
quotas enter the Gemini lane. Claude models served through Antigravity do not
describe the user's separate Claude subscription. Identical Gemini model
readings and histories are grouped visually. An unreported period stays unknown.

Claude account usage connects through the existing Claude Code sign-in. Run
`claude auth login --claudeai` once if that sign-in has expired. The companion
reads the account usage endpoint shipped with Claude Code about every five
minutes, using Windows certificate trust. Existing OAuth credentials stay in
Claude's configuration directory (`CLAUDE_CONFIG_DIR` or `%USERPROFILE%\.claude`).
Normal token refresh preserves unrelated credential-file data and a newer sign-in
made by Claude. Redirects are disabled on authenticated requests. No model call
or API-key billing is used. The endpoint is version-dependent; failed reads retain
the previous values with an explicit connection notice. Account-wide and reported
model-specific weekly limits stay separate.

Claude's documented Code statusline JSON can also supply `rate_limits.five_hour`
and `rate_limits.seven_day`. A local statusline integration can pipe that JSON to
`python <installed-companion>/worker/usage.py --state <desktop-data> --capture claude`.
The capture command saves only the two percentages, reset times and capture time,
and prints nothing. An existing statusline should retain its normal output.
The normal desktop data directory is `%LOCALAPPDATA%\WebToolsDesktop`. No statusline
settings are changed automatically. Without a reporter, the Claude lane explicitly
says it is not connected. The account reader covers the subscription's usage
without requiring a separate reporter in each cloud session.

Each assistant's usage header has a browser-link icon. Codex opens ChatGPT's
Usage settings and Claude opens Claude's Usage settings. Gemini opens the
Antigravity browser entry point; the vendor places model quotas under Settings
and does not document a standalone browser quota address. The desktop opens only
these three approved destinations in the system browser. The phone opens the
same addresses separately.

Usage files remain beside the companion settings in `usage.json` and
`usage-inputs/claude.json`. No credential, transcript, account identifier or raw
provider error enters the usage projection. Missing fields never imply zero.

The activity projection omits request notes, filesystem fields, downloads and native
actions. Polling uses conditional GET every two seconds in the foreground, pauses
when hidden, refreshes immediately on return, and backs off to fifteen seconds on
failure. The phone distinguishes local observation, Git synchronization and captured
cloud updates. Published Claude records never imply live cloud execution. The portable plugin's
`session-activity.py` hook separately reports `UserPromptSubmit`, throttled
`PreToolUse`, `Stop`, `StopFailure` and `SessionEnd` events for cloud sessions.
The hook discovers the same declared sessions store as the recorder and does
nothing for local or subagent sessions. The hook stages a bounded signal outside
the checkout, then publishes through a detached process using a temporary Git
index. New hooks must be loaded in a cloud session before that session can report.
A tool event can report an ongoing turn when the store is attached after its
first prompt; the hook recovers prompt text from a bounded transcript tail when
available. An old record alone never establishes working status.

Signals live on the private `background` branch at
`sessions/activity/YYYY-MM-DD/<short>.json`, with schema version 1, provider,
location, session URL, state, start/update times, title, last tool name, prompt
(up to 2,000 characters) and response (up to 4,000 characters). Raw tool inputs,
paths and API error bodies are omitted. A later timestamp wins if concurrent
publishers race; failed pushes retry three times without interrupting Claude.
The existing recorder remains the owner of full transcripts. The reader takes
up to 256 signal files from the last two UTC dates and expires signals after a day.
These signals synchronize with errands every five seconds. An unfinished turn
with no report for three minutes becomes quiet; a response or failure ends its
working state. Published topic checkpoints keep their separate provenance and time.
Tool heartbeats update live activity without creating a new change record.

Remove `Web Tools Companion.lnk` from the current user's Startup folder to disable
sign-in startup. Stop `WebTools.Companion` to stop collection. Disable the private
proxy with `tailscale serve --https=443 off`; that command leaves other Serve ports
alone. `WEBTOOLS_COMPANION_DATA` and `WEBTOOLS_COMPANION_PORT` provide isolated
data and loopback ports for integration checks.

The reader fetches the private checkout's `background` branch. It reads requests, claims, results, and output presence
at one immutable Git revision through `ls-tree` and `cat-file --batch`. Fetch
updates `origin/background` and, for cloud records, `origin/main`; the checkout, index, local edits, and checked-out
branch are untouched.
The request's `run.method` assigns its assistant lane: `laptop-daemon` to Gemini, `codex-errand` to Codex, and `claude-errand` to Claude. Unknown methods are skipped. All three methods use the same request, claim and result shape. The method identifies the assistant; `run.venue` distinguishes laptop and cloud execution. A claim does not establish continued execution. The Gemini worker card counts only Gemini errands.
The phone's Errands view filters by assistant and separates Waiting (oldest first), Taken on (claims and arriving replies), and Results. The read-only `/api/v1/errands` projection includes every open errand and the eighty latest results by update time; Now keeps its one-day result horizon. Selected results read Gemini's `data.reply` or the other agents' `data.report`, falling back to the result message. Request notes remain outside the phone API. The Now shortcut and title dropdown open Errands without initiating work.

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

Checkpoint titles and summaries join the session cache to
`state/session-topics.json` and its companions at one immutable revision of the
private `background` branch. The latest three summarized exchanges and up to six
validated PR links accompany each checkpoint. Checkpoint time stays separate from
the session record's update time. Missing companions leave the rollup summary
available; missing summaries leave the recorded session available.

`activity-changes.json` retains the latest meaningful change per item for seven
days, up to 150 items. Starting or finishing a local turn, publishing a cloud
checkpoint, and errand transitions create changes. Local commentary alone does
not. The phone's Now view shows three recent changes outside In progress and
Needs you; the Recent tab shows the retained history. Desktop opens on Recent.
The views do not track whether activity has been seen.

The worker view reads the last 64 KiB of `poller.log`, accepting known timestamped
batch, publication, errand, scheduled-job and error events. The view shows a short
description and its report time, without raw paths or error bodies. A report
does not establish that the reported job is still executing.

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
