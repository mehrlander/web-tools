---
name: powershell-ise-theming
description: "How to share WPF theme resources (a Theme.xaml ResourceDictionary with keys like GhostButton, PillButton, MutedLabel) across PowerShell ISE add-on tools and forms without disturbing the ISE's own UI. Use this whenever the user wants their vertical ISE tools, add-ons, or UserControls to pick up their Forms theme, asks \"why did my whole ISE turn a color\" or \"why did the Options dialog buttons change\", says a DynamicResource or theme key won't resolve inside an ISE tool, wants to merge a theme app-wide, or is deciding between an application-level merge and a per-control merge. Trigger even when the user doesn't say \"theme\" or \"skill\". Phrasings like \"style my ISE tools\", \"make my ISE add-on use my theme\", \"my UserControl ignores my brushes\", or \"something I merged leaked into the editor chrome\" all belong here. Covers the DynamicResource lookup chain, the keyed-only rule, the keyless-style leak, StaticResource vs DynamicResource at dock time, and the per-control fallback."
---

# Theming ISE Tools and Forms

A tool docked into the ISE's vertical or horizontal add-on pane is a compiled WPF UserControl (often C# via `Add-Type`), outside the path that themes PowerShell-driven forms. This skill covers making the Theme.xaml resources behind those forms (brushes and named styles such as `GhostButton`, `PillButton`, `MutedLabel`) resolve in the tools too, by merging the theme into the ISE as a whole.

## The mechanism

A `DynamicResource` lookup is deferred and resolved at runtime by walking up the element tree: the control's own `Resources`, then each ancestor's, finally `Application.Current.Resources`. Three rungs, checked in order.

The Forms module uses the middle rung: it merges Theme.xaml into each Window's resources inside `New-Wpf`, so anything in a form resolves and nothing escapes the window. ISE tools live outside that path, and the rung that reaches them is the top one. `[System.Windows.Application]::Current` is a live, non-null Application object in the ISE (confirmed), so merging the theme there once makes every key resolvable process-wide: tools, forms, popups, with no per-tool plumbing.

The catch is that the top rung is shared. The same merge that feeds your tools is visible to the ISE's own chrome. A keyed resource stays inert until something names it; a keyless implicit style does not.

## The safe recipe

1. **Keep the theme keyed.** Every `<Style>` in Theme.xaml carries an `x:Key`. No keyless implicit styles (a `<Style TargetType="Button">` with no key). Tools reference styles by key; nothing applies by type.
2. **Gate before merging.** Scan Theme.xaml for keyless implicit styles. An empty result means app-wide is safe. Any hit must be keyed first, or routed to the per-control fallback below.
3. **Merge once, guarded.** Add the theme to `Application.Current.Resources.MergedDictionaries`, but only if it isn't already there. Module re-import would otherwise stack duplicate dictionaries.
4. **Opt in with DynamicResource.** Tools and forms reference theme keys with `{DynamicResource KeyName}`, never `{StaticResource}` (see below).

The four bundled helpers below cover steps 2, 3, the per-control fallback, and a one-line check that a key resolves at the app level.

## Why keyed-only: the leak

An app-wide keyless implicit style cascades into every surface in the process, including ones you never authored; a keyed style applies only where some element names it by key. So app-wide merges must be keyed-only, and tools opt in explicitly.

In a live test, a keyless `<Style TargetType="Button">` merged into `Application.Current.Resources` styled the tool buttons and also the ISE Options dialog's own buttons (Cancel, Restore Defaults, Manage Themes). After the same merge, a help button tried to run `Get-Help '/>' -ShowWindow`, which a fresh session did not do; that second finding's exact cause is less certain. An app-wide implicit style can therefore change behavior, not only appearance, which is why the gate refuses keyless styles rather than warning.

## DynamicResource, never StaticResource

Use `{DynamicResource KeyName}` for theme keys in tools. Not `{StaticResource}`.

`StaticResource` resolves at parse time. A tool's XAML is parsed inside the UserControl constructor, which runs before the control is docked into the ISE tree. At that moment the control has no ancestors and no connection to `Application.Current`, so an app-level `StaticResource` lookup finds nothing and throws. `DynamicResource` defers the lookup until the control is connected and the walk up to the app rung can succeed.

## The per-control fallback

When a theme contains keyless styles that can't easily be keyed, don't force them app-wide. Merge the dictionary into the individual tool's own `Resources.MergedDictionaries` at dock time. The natural home is the function that adds the tool to `VerticalAddOnTools`, called on the UserControl once it exists.

This way the implicit styles apply to its own subtree and stop there, so they never reach the ISE chrome. The cost is that you repeat the merge per tool instead of once globally. For a theme that's already keyed, prefer the app-wide path; reach for per-control when implicit styles are unavoidable.

## What you cannot reskin

The ISE's own chrome (editor surface, menus, toolbar) will not fully reskin through resource merging. Its native widgets pin their own styles and don't subscribe to your keys. The only thing that reaches them is a keyless implicit style.

The supported door for editor background and font is the `$psISE.Options` API. Reaching deeper into the ISE visual tree to restyle native widgets is fragile and tends to break on ISE updates. Treat `$psISE.Options` as the boundary of what's meant to be themed and your tools as the surfaces you actually control.

## Session and cleanup notes

None of this persists across sessions. A restart clears every merge.

Removing a merged dictionary stops future lookups, but surfaces already rendered may keep their styling until they rebuild. Don't expect a live un-merge to repaint everything on the spot. For a clean slate, restart the ISE.

## Bundled helpers

### Gate: find keyless implicit styles

```powershell
function Get-KeylessImplicitStyles {
    # Returns the TargetType of every <Style> that has no x:Key.
    # Empty result means the theme is keyed-only and safe to merge app-wide.
    param([Parameter(Mandatory)][string]$ThemeXamlPath)

    $xml = [xml](Get-Content -LiteralPath $ThemeXamlPath -Raw)
    $styles = $xml.GetElementsByTagName('Style')
    $hits = foreach ($s in $styles) {
        if ($s.HasAttribute('TargetType') -and -not $s.HasAttribute('x:Key')) {
            $s.GetAttribute('TargetType')
        }
    }
    @($hits)
}
```

### Guard + merge: app-wide, once

```powershell
function Add-ThemeToApplication {
    # Merge a keyed theme into Application.Current so all ISE tools, forms,
    # and popups can resolve its keys via {DynamicResource}. Idempotent.
    param(
        [Parameter(Mandatory)][string]$ThemeXamlPath,
        [string]$SentinelKey = 'GhostButton'
    )

    $app = [System.Windows.Application]::Current

    # Guard: a known theme key already resolves, so we've merged before. Re-import safe.
    if ($null -ne $app.Resources[$SentinelKey]) { return }

    # Gate: refuse keyless implicit styles. App-wide, they cascade into ISE chrome.
    $keyless = Get-KeylessImplicitStyles -ThemeXamlPath $ThemeXamlPath
    if ($keyless.Count -gt 0) {
        throw "Theme has keyless implicit styles ($($keyless -join ', ')). These would cascade into native ISE chrome. Key them, or use Add-ThemeToControl instead."
    }

    $uri = New-Object System.Uri((Resolve-Path -LiteralPath $ThemeXamlPath).Path)
    $dict = New-Object System.Windows.ResourceDictionary
    $dict.Source = $uri
    $app.Resources.MergedDictionaries.Add($dict)
}
```

If `$dict.Source` won't load a loose file in a given host, swap the last three lines for an explicit parse: `$dict = [System.Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader ([xml](Get-Content -Raw -LiteralPath $ThemeXamlPath))))`.

### Fallback: per-control merge at dock time

```powershell
function Add-ThemeToControl {
    # Contain the theme to one control's subtree. Tolerates keyless styles.
    # Call at dock time, e.g. inside the function that adds the tool to VerticalAddOnTools.
    param(
        [Parameter(Mandatory)][System.Windows.FrameworkElement]$Control,
        [Parameter(Mandatory)][string]$ThemeXamlPath
    )

    $uri = New-Object System.Uri((Resolve-Path -LiteralPath $ThemeXamlPath).Path)
    $dict = New-Object System.Windows.ResourceDictionary
    $dict.Source = $uri
    $Control.Resources.MergedDictionaries.Add($dict)
}
```

### Verify: does a key resolve at the app level

```powershell
# ResourceDictionary's indexer searches its own keys then its merged dictionaries,
# so this confirms the theme actually reached Application.Current.
$null -ne [System.Windows.Application]::Current.Resources['GhostButton']
```

## Related, but not covered here

Serializing a live, themed form back to XAML via `[System.Windows.Markup.XamlWriter]::Save` drops the programmatically merged theme dictionary, leaving any `{DynamicResource}` references in the output dangling.