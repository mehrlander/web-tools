using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;

namespace WebTools.Desktop;

public partial class MainWindow : Window
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly UserSettings settings = UserSettings.Load();
    private readonly DispatcherTimer timer = new() { Interval = TimeSpan.FromSeconds(2) };
    private readonly DispatcherTimer loadingTimer = new() { Interval = TimeSpan.FromMilliseconds(100) };
    private readonly HttpClient companion = CompanionAccess.Client();
    private LaptopSnapshot? snapshot;
    private bool refreshing, laptopReady, closing, laptopSelected, webNavigating;
    private DateTimeOffset refreshStarted, navigationStarted, restartAttempt;
    private double syncMilliseconds;
    private string? webError;
    private readonly string? diagnosticsPath;

    public MainWindow()
    {
        var args = Environment.GetCommandLineArgs();
        var rootAt = Array.IndexOf(args, "--root");
        if (rootAt >= 0 && rootAt + 1 < args.Length) {
            settings.RepositoriesRoot = Path.GetFullPath(args[rootAt + 1]); settings.Save();
        }
        var diagnosticAt = Array.IndexOf(args, "--diagnostics");
        if (diagnosticAt >= 0 && diagnosticAt + 1 < args.Length) diagnosticsPath = Path.GetFullPath(args[diagnosticAt + 1]);
        InitializeComponent();
        var availableWidth = Math.Max(320, SystemParameters.WorkArea.Width);
        var availableHeight = Math.Max(240, SystemParameters.WorkArea.Height);
        MinWidth = Math.Min(860, availableWidth);
        MinHeight = Math.Min(620, availableHeight);
        Width = Math.Clamp(settings.Width, MinWidth, availableWidth);
        Height = Math.Clamp(settings.Height, MinHeight, availableHeight);
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        if (settings.Maximized) WindowState = WindowState.Maximized;
        PreviewKeyDown += HandleKeys;
        timer.Tick += async (_, _) => await Refresh();
        loadingTimer.Tick += (_, _) => {
            var now = DateTimeOffset.UtcNow;
            var loading = refreshing && snapshot is null && now - refreshStarted > TimeSpan.FromMilliseconds(700)
                || webNavigating && !laptopSelected && now - navigationStarted > TimeSpan.FromMilliseconds(700);
            LoadingProgress.Visibility = loading ? Visibility.Visible : Visibility.Collapsed;
        };
    }

    private async void WindowLoaded(object sender, RoutedEventArgs e)
    {
        try {
            CompanionAccess.Start();
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: Path.Combine(UserSettings.DataDirectory, "browser"));
            await LaptopView.EnsureCoreWebView2Async(environment);
            var local = LaptopView.CoreWebView2;
            local.SetVirtualHostNameToFolderMapping("desktop.web-tools.local", Path.Combine(AppContext.BaseDirectory, "ui"), CoreWebView2HostResourceAccessKind.DenyCors);
            local.NavigationStarting += (_, a) => {
                if (NavigationPolicy.IsLocal(a.Uri)) return;
                a.Cancel = true;
                if (NavigationPolicy.IsExternalPage(a.Uri)) OpenExternal(a.Uri);
            };
            local.NewWindowRequested += (_, a) => {
                a.Handled = true;
                if (NavigationPolicy.IsExternalPage(a.Uri)) OpenExternal(a.Uri);
            };
            local.WebMessageReceived += LaptopMessage;
            local.NavigationCompleted += async (_, a) => {
                laptopReady = a.IsSuccess;
                if (laptopReady) await SendSnapshot();
            };
            LaptopView.Source = new Uri(NavigationPolicy.LocalUrl);
            _ = Refresh();
            timer.Start();
            loadingTimer.Start();
            await WebView.EnsureCoreWebView2Async(environment);
            var web = WebView.CoreWebView2;
            web.Settings.IsWebMessageEnabled = false;
            // Seed the existing Web Tools login from GitHub CLI. No token enters
            // the laptop view, settings, diagnostics, command arguments or logs.
            try {
                var token = await Commands.Text("gh", ["auth", "token", "--hostname", "github.com"], timeoutSeconds: 8);
                if (token.Length > 0) await web.AddScriptToExecuteOnDocumentCreatedAsync(
                    "if(window===window.top && location.origin==='https://mehrlander.github.io' && location.pathname.startsWith('/web-tools/')) {"
                    + "if(!localStorage.getItem('ghToken')) localStorage.setItem('ghToken'," + JsonSerializer.Serialize(token) + "); }");
            } catch { /* The existing Web Tools token screen remains available. */ }
            web.NavigationStarting += (_, a) => {
                if (NavigationPolicy.IsWebTools(a.Uri)) {
                    webNavigating = true; navigationStarted = DateTimeOffset.UtcNow;
                    webError = null; ErrorPanel.Visibility = Visibility.Collapsed;
                }
                else { a.Cancel = true; OpenExternal(a.Uri); }
            };
            web.NewWindowRequested += (_, a) => {
                a.Handled = true;
                if (NavigationPolicy.IsWebTools(a.Uri)) web.Navigate(a.Uri);
                else OpenExternal(a.Uri);
            };
            web.NavigationCompleted += (_, a) => {
                webNavigating = false;
                webError = a.IsSuccess ? null : "The hosted Web Tools page could not be reached (" + a.WebErrorStatus + "). Laptop activity remains available.";
                if (!a.IsSuccess && !laptopSelected) ShowWebError();
                WriteDiagnostics();
            };
            web.SourceChanged += (_, _) => {
                if (NavigationPolicy.IsWebTools(web.Source)) settings.WebUrl = web.Source;
            };
            WebView.Source = new Uri(NavigationPolicy.IsWebTools(settings.WebUrl) ? settings.WebUrl : NavigationPolicy.AppUrl);
            if (Environment.GetCommandLineArgs().Contains("--laptop")) SelectLaptop(true);
        } catch (Exception ex) {
            webError = "The desktop browser could not initialize. Check that Microsoft Edge WebView2 Runtime is installed. " + ex.Message;
            ShowWebError();
            WriteDiagnostics();
        }
    }

    private async Task Refresh(bool force = false)
    {
        if (refreshing || closing) return;
        refreshing = true;
        refreshStarted = DateTimeOffset.UtcNow;
        try {
            var collected = await companion.GetFromJsonAsync<CollectedActivity>("/api/v1/desktop", Json);
            if (closing || collected is null) return;
            snapshot = collected.Snapshot;
            syncMilliseconds = collected.SyncMilliseconds;
            var stale = DateTimeOffset.UtcNow - collected.ObservedAt > TimeSpan.FromSeconds(15);
            var jobs = snapshot.Activity.Errands;
            var claimed = jobs.Count(j => j.State == "claimed");
            var queued = jobs.Count(j => j.State == "queued");
            var arriving = jobs.Count(j => j.State == "reply");
            var newResults = jobs.Count(j => j.IsNew);
            var attention = jobs.Count(j => j.State == "failed" && j.IsNew);
            var parts = new List<string> { "Now" };
            var working = snapshot.Sessions.Items.Count(s => s.State == "working");
            if (working > 0) parts.Add($"{working} working session{(working == 1 ? "" : "s")}");
            if (claimed > 0) parts.Add($"{claimed} claimed");
            if (queued > 0) parts.Add($"{queued} waiting for Gemini");
            if (arriving > 0) parts.Add($"{arriving} replies arriving");
            if (newResults > 0) parts.Add($"{newResults} new result{(newResults == 1 ? "" : "s")}");
            if (attention > 0) parts.Add($"{attention} to review");
            if (parts.Count == 1) parts.Add(snapshot.Daemon.State == "detected" ? "Gemini queue clear" : "No current local work");
            ActivityText.Text = string.Join("   ·   ", parts);
            ActivityText.ToolTip = null;
            ActivityDot.Fill = new SolidColorBrush((Color)ColorConverter.ConvertFromString(
                !snapshot.Activity.Connected || attention > 0 ? "#BD8540" : working > 0 || claimed > 0 || arriving > 0 ? "#4C8069" : "#809489"));
            SyncText.Text = stale ? "Last observation" : snapshot.Activity.Connected ? "Live" : "Records offline";
            SyncText.ToolTip = "Local activity every 2 seconds; errands every 5 seconds.\n"
                + $"Cloud records every 30 seconds. Local scan: {snapshot.ScanMilliseconds:F0} ms · Last record sync: {syncMilliseconds:F0} ms\n"
                + (snapshot.Activity.SyncedAt is { } at ? "Last record sync: " + at.ToLocalTime().ToString("h:mm:ss tt") : "No completed record sync yet.");
            await SendSnapshot();
            WriteDiagnostics();
        } catch (Exception ex) {
            SyncText.Text = "Activity unavailable";
            ActivityText.Text = "Now · Activity could not be checked";
            ActivityText.ToolTip = ex.Message;
            if (DateTimeOffset.UtcNow - restartAttempt > TimeSpan.FromSeconds(10)) {
                restartAttempt = DateTimeOffset.UtcNow;
                try { CompanionAccess.Start(); } catch { }
            }
        } finally {
            refreshing = false;
        }
    }

    private Task SendSnapshot()
    {
        if (laptopReady && snapshot is not null && !closing)
            LaptopView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "snapshot", data = snapshot }, Json));
        return Task.CompletedTask;
    }

    private async void LaptopMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (!NavigationPolicy.IsLocal(e.Source) || closing) return;
        try {
            using var document = JsonDocument.Parse(e.WebMessageAsJson);
            var message = document.RootElement;
            var action = Activity.Text(message, "action");
            var id = Activity.Text(message, "id");
            switch (action) {
                case "ready": await SendSnapshot(); break;
                case "refresh": await Refresh(force: true); break;
                case "seen": settings.SeenThrough = DateTimeOffset.UtcNow; settings.Save(); await Refresh(); break;
                case "work-link":
                    var parts = id.Split(':');
                    if (parts.Length == 2 && int.TryParse(parts[1], out var linkIndex)) {
                        var links = snapshot?.Cloud.Items.Find(s => s.Id == parts[0])?.Checkpoint?.Links;
                        if (links is not null && linkIndex >= 0 && linkIndex < links.Count) OpenExternal(links[linkIndex].Url);
                    }
                    break;
                case "change-link":
                    var change = snapshot?.Changes?.Find(c => c.Key == id);
                    if (change?.Url is { } changeUrl && NavigationPolicy.IsWebTools(changeUrl)) {
                        settings.WebUrl = changeUrl; WebView.CoreWebView2?.Navigate(changeUrl); SelectLaptop(false);
                    }
                    break;
                case "web": SelectLaptop(false); break;
                case "activity":
                    settings.WebUrl = NavigationPolicy.AppUrl + "?view=sessions";
                    WebView.CoreWebView2?.Navigate(settings.WebUrl); SelectLaptop(false); break;
                case "cloud-session":
                    if (snapshot?.Cloud.Items.Any(s => s.Id == id) == true) {
                        settings.WebUrl = NavigationPolicy.AppUrl + "?view=sessions&session=" + Uri.EscapeDataString(id);
                        WebView.CoreWebView2?.Navigate(settings.WebUrl); SelectLaptop(false);
                    }
                    break;
                case "session-folder":
                    var session = snapshot?.Sessions.Items.Find(s => s.Id == id);
                    if (session is not null && session.Workspace.Length > 0) OpenFolder(session.Workspace);
                    break;
                case "errand":
                    var job = snapshot?.Activity.Errands.Find(j => j.Id == id);
                    if (job is not null) {
                        settings.WebUrl = NavigationPolicy.ErrandUrl(id, job.State is "reply" or "complete" or "failed");
                        WebView.CoreWebView2?.Navigate(settings.WebUrl); SelectLaptop(false);
                    }
                    break;
                case "output":
                    if (Activity.ValidId(id) && snapshot?.Activity.Errands.Any(j => j.Id == id) == true)
                        OpenFolder(LaptopSignals.Outbox(id));
                    break;
                case "place":
                    if (LaptopSignals.PlacePaths(settings.RepositoriesRoot).TryGetValue(id, out var path)) OpenFolder(path);
                    break;
            }
        } catch (Exception ex) { MessageBox.Show(this, ex.Message, "Web Tools Desktop", MessageBoxButton.OK, MessageBoxImage.Information); }
    }

    private void SelectLaptop(bool selected)
    {
        laptopSelected = selected;
        WebView.Visibility = selected ? Visibility.Hidden : Visibility.Visible;
        LaptopView.Visibility = selected ? Visibility.Visible : Visibility.Hidden;
        WebTab.Background = selected ? Brushes.Transparent : Brushes.White;
        LaptopTab.Background = selected ? Brushes.White : Brushes.Transparent;
        ErrorPanel.Visibility = !selected && webError is not null ? Visibility.Visible : Visibility.Collapsed;
        WriteDiagnostics();
    }

    private void ShowWeb(object sender, RoutedEventArgs e) => SelectLaptop(false);
    private void ShowLaptop(object sender, RoutedEventArgs e) => SelectLaptop(true);
    private void OpenBrowser(object sender, RoutedEventArgs e) => OpenExternal(WebView.Source?.AbsoluteUri ?? NavigationPolicy.AppUrl);
    private void RetryWeb(object sender, RoutedEventArgs e) {
        ErrorPanel.Visibility = Visibility.Collapsed;
        if (WebView.CoreWebView2 is not null) WebView.Reload();
    }

    private void OpenSettings(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFolderDialog { Title = "Choose the folder containing your repository checkouts", InitialDirectory = settings.RepositoriesRoot };
        if (dialog.ShowDialog(this) != true) return;
        settings.RepositoriesRoot = dialog.FolderName;
        settings.Save();
        _ = Refresh(force: true);
    }

    private void HandleKeys(object sender, KeyEventArgs e)
    {
        if (Keyboard.Modifiers == ModifierKeys.Alt && !laptopSelected) {
            var key = e.Key == Key.System ? e.SystemKey : e.Key;
            if (key == Key.Left && WebView.CanGoBack) { WebView.GoBack(); e.Handled = true; }
            if (key == Key.Right && WebView.CanGoForward) { WebView.GoForward(); e.Handled = true; }
        }
        if (Keyboard.Modifiers != ModifierKeys.Control) return;
        if (e.Key == Key.D1) { SelectLaptop(false); e.Handled = true; }
        if (e.Key == Key.D2) { SelectLaptop(true); e.Handled = true; }
    }

    private void ShowWebError() { ErrorText.Text = webError; ErrorPanel.Visibility = Visibility.Visible; }
    private static void OpenFolder(string path) {
        if (Directory.Exists(path)) Process.Start(new ProcessStartInfo("explorer.exe") { UseShellExecute = false, ArgumentList = { path } });
    }
    private static void OpenExternal(string address) {
        if (NavigationPolicy.ExternalTarget(address) is { } target)
            Process.Start(new ProcessStartInfo(target) { UseShellExecute = true });
    }

    private void WriteDiagnostics()
    {
        if (diagnosticsPath is null) return;
        try {
            Directory.CreateDirectory(Path.GetDirectoryName(diagnosticsPath)!);
            File.WriteAllText(diagnosticsPath, JsonSerializer.Serialize(new {
                tab = laptopSelected ? "laptop" : "web", webUrl = WebView.Source?.AbsoluteUri,
                webError, laptopReady, activity = snapshot, observedAt = DateTimeOffset.UtcNow
            }, Json));
        } catch { }
    }

    private void WindowClosing(object? sender, CancelEventArgs e)
    {
        closing = true;
        timer.Stop();
        loadingTimer.Stop();
        var bounds = RestoreBounds;
        settings.Width = bounds.Width;
        settings.Height = bounds.Height;
        settings.Maximized = WindowState == WindowState.Maximized;
        try { settings.Save(); } catch { }
        WebView.Dispose(); LaptopView.Dispose(); companion.Dispose();
    }
}
