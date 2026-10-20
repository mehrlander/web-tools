using System.ComponentModel;
using System.Diagnostics;
using System.IO;
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
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private readonly UserSettings settings = UserSettings.Load();
    private readonly DispatcherTimer timer = new() { Interval = TimeSpan.FromSeconds(15) };
    private ErrandReader reader;
    private LaptopSnapshot? snapshot;
    private bool refreshing, laptopReady, closing, laptopSelected;
    private string? webError;
    private readonly string? diagnosticsPath;

    public MainWindow()
    {
        var args = Environment.GetCommandLineArgs();
        var rootAt = Array.IndexOf(args, "--root");
        if (rootAt >= 0 && rootAt + 1 < args.Length) settings.RepositoriesRoot = Path.GetFullPath(args[rootAt + 1]);
        var diagnosticAt = Array.IndexOf(args, "--diagnostics");
        if (diagnosticAt >= 0 && diagnosticAt + 1 < args.Length) diagnosticsPath = Path.GetFullPath(args[diagnosticAt + 1]);
        reader = new(Registry);
        InitializeComponent();
        Width = Math.Clamp(settings.Width, 860, SystemParameters.WorkArea.Width);
        Height = Math.Clamp(settings.Height, 620, SystemParameters.WorkArea.Height);
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        if (settings.Maximized) WindowState = WindowState.Maximized;
        PreviewKeyDown += HandleKeys;
        timer.Tick += async (_, _) => await Refresh();
    }

    private string Registry => Path.Combine(settings.RepositoriesRoot, "web-tools-private");

    private async void WindowLoaded(object sender, RoutedEventArgs e)
    {
        try {
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: Path.Combine(UserSettings.DataDirectory, "browser"));
            await LaptopView.EnsureCoreWebView2Async(environment);
            var local = LaptopView.CoreWebView2;
            local.SetVirtualHostNameToFolderMapping("desktop.web-tools.local", Path.Combine(AppContext.BaseDirectory, "ui"), CoreWebView2HostResourceAccessKind.DenyCors);
            local.NavigationStarting += (_, a) => { if (!NavigationPolicy.IsLocal(a.Uri)) a.Cancel = true; };
            local.NewWindowRequested += (_, a) => a.Handled = true;
            local.WebMessageReceived += LaptopMessage;
            local.NavigationCompleted += async (_, a) => {
                laptopReady = a.IsSuccess;
                if (laptopReady) await SendSnapshot();
            };
            LaptopView.Source = new Uri(NavigationPolicy.LocalUrl);
            _ = Refresh(force: true);
            timer.Start();
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
                if (NavigationPolicy.IsWebTools(a.Uri)) { webError = null; ErrorPanel.Visibility = Visibility.Collapsed; }
                else { a.Cancel = true; OpenExternal(a.Uri); }
            };
            web.NewWindowRequested += (_, a) => {
                a.Handled = true;
                if (NavigationPolicy.IsWebTools(a.Uri)) web.Navigate(a.Uri);
                else OpenExternal(a.Uri);
            };
            web.NavigationCompleted += (_, a) => {
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
        RefreshButton.IsEnabled = false;
        SyncText.Text = "Checking…";
        try {
            var seenThrough = settings.SeenThrough;
            snapshot = await Task.Run(async () => {
                var activity = await reader.Read(seenThrough, force);
                activity = activity with { Errands = activity.Errands.Select(j => j with {
                    HasLocalOutput = Directory.Exists(LaptopSignals.Outbox(j.Id)) }).ToList() };
                return new LaptopSnapshot(activity, LaptopSignals.Daemon(Registry), LaptopSignals.Applications(),
                    LaptopSignals.Places(settings.RepositoriesRoot), LaptopSignals.Downloads(), Environment.MachineName, seenThrough);
            });
            if (closing) return;
            var jobs = snapshot.Activity.Errands;
            var claimed = jobs.Count(j => j.State == "claimed");
            var queued = jobs.Count(j => j.State == "queued");
            var arriving = jobs.Count(j => j.State == "reply");
            var newResults = jobs.Count(j => j.IsNew);
            var attention = jobs.Count(j => j.State == "failed" && j.IsNew);
            var parts = new List<string> { "On this laptop" };
            if (claimed > 0) parts.Add($"{claimed} claimed");
            if (queued > 0) parts.Add($"{queued} queued");
            if (arriving > 0) parts.Add($"{arriving} replies arriving");
            if (newResults > 0) parts.Add($"{newResults} new result{(newResults == 1 ? "" : "s")}");
            if (attention > 0) parts.Add($"{attention} to review");
            if (parts.Count == 1) parts.Add(snapshot.Daemon.State == "detected" ? "Worker detected · no open errands" : "No open errands");
            ActivityText.Text = string.Join("   ·   ", parts);
            ActivityDot.Fill = new SolidColorBrush((Color)ColorConverter.ConvertFromString(
                !snapshot.Activity.Connected || attention > 0 ? "#BD8540" : claimed > 0 || arriving > 0 ? "#4C8069" : "#809489"));
            SyncText.Text = snapshot.Activity.Connected ? "Checked " + DateTime.Now.ToString("h:mm tt") : "Saved activity · offline";
            await SendSnapshot();
            WriteDiagnostics();
        } catch (Exception ex) {
            SyncText.Text = "Activity unavailable";
            ActivityText.Text = "On this laptop · Activity could not be checked";
            ActivityText.ToolTip = ex.Message;
        } finally {
            refreshing = false;
            if (!closing) RefreshButton.IsEnabled = true;
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
                case "web": SelectLaptop(false); break;
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
    private async void RefreshClicked(object sender, RoutedEventArgs e) => await Refresh(force: true);
    private void OpenBrowser(object sender, RoutedEventArgs e) => OpenExternal(WebView.Source?.AbsoluteUri ?? NavigationPolicy.AppUrl);
    private void RetryWeb(object sender, RoutedEventArgs e) {
        ErrorPanel.Visibility = Visibility.Collapsed;
        if (WebView.CoreWebView2 is not null) WebView.Reload();
    }

    private void OpenSettings(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFolderDialog { Title = "Choose the folder containing your repository checkouts", InitialDirectory = settings.RepositoriesRoot };
        if (dialog.ShowDialog(this) != true) return;
        if (refreshing) { MessageBox.Show(this, "A refresh is still running. Choose the folder again after the refresh finishes.", "Web Tools Desktop"); return; }
        settings.RepositoriesRoot = dialog.FolderName;
        settings.Save();
        reader = new(Registry);
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
        if (Uri.TryCreate(address, UriKind.Absolute, out var uri) && uri.Scheme is "https" or "http")
            Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
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
        var bounds = RestoreBounds;
        settings.Width = bounds.Width;
        settings.Height = bounds.Height;
        settings.Maximized = WindowState == WindowState.Maximized;
        try { settings.Save(); } catch { }
        WebView.Dispose(); LaptopView.Dispose();
    }
}
