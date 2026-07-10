---
name: powershell-ise-theming
description: How to share WPF theme resources (a Theme.xaml ResourceDictionary with keys like GhostButton, PillButton, MutedLabel) across PowerShell ISE add-on tools and forms without disturbing the ISE's own UI. Use this whenever the user wants their vertical ISE tools, add-ons, or UserControls to pick up their Forms theme, asks "why did my whole ISE turn a color" or "why did the Options dialog buttons change", says a DynamicResource or theme key won't resolve inside an ISE tool, wants to merge a theme app-wide, or is deciding between an application-level merge and a per-control merge. Trigger even when the user doesn't say "theme" or "skill". Phrasings like "style my ISE tools", "make my ISE add-on use my theme", "my UserControl ignores my brushes", or "something I merged leaked into the editor chrome" all belong here. Covers the DynamicResource lookup chain, the keyed-only rule, the keyless-style leak, StaticResource vs DynamicResource at dock time, and the per-control fallback.
---

# Theming ISE Tools and Forms

The ISE is customizable. Part of its appeal is that you can extend it with menu items and with more involved tools that embed a custom form into the host, docked into the vertical or horizontal add-on panes.

Creating those tools dynamically raises challenges. It is not as simple as adding a function through `$profile`. A docked tool has to be compiled, which can mean bringing in C# and structuring things the way WPF wants rather than the way PowerShell usually goes. The tools in question are WPF UserControls compiled via `Add-Type`.

A tension follows. You have already built capability for your forms and would like to reuse it in the tools. Theming is the example: can the Theme.xaml resources behind your forms (brushes and named styles such as `GhostButton`, `PillButton`, `MutedLabel`) drive the ISE tools, given the particular way those tools are constructed?

There are ways. The basic one rests on a surprising fact: you can apply a theme to the ISE generally, not only to the controls you wrote. That reach is the opening and the catch at once. Caveat emptor: a theme can disturb part of the host that never expected your XAML, a menu or dialog for instance. With the right discipline it stays clean, and this skill defines that path.

## The mechanism

A `DynamicResource` lookup is deferred and resolved at runtime by walking up the element tree: the control's own `Resources`, then each ancestor's, finally `Application.Current.Resources`. Three rungs, checked in order.

The Forms module uses the middle rung: it merges Theme.xaml into each Window's resources inside `New-Wpf`, so anything in a form resolves and nothing escapes the window. ISE tools live outside that path, and the rung that reaches them is the top one. `[System.Windows.Application]::Current` is a live, non-null Application object in the ISE (confirmed), so merging the theme there once makes every key resolvable process-wide: tools, forms, popups, with no per-tool plumbing.

The catch is that the top rung is shared. The same merge that feeds your tools is visible to the ISE's own chrome. A keyed resource stays inert until something names it; a keyless implicit style does not, and that gap is the whole hazard. The rest of the skill is the discipline that keeps an app-wide merge safe.

## The safe recipe

The safe path in four steps. Each step's reasoning is in the section that follows.

1. **Keep the theme keyed.** Every `<Style>` in Theme.xaml carries an `x:Key`. No keyless implicit styles (a `<Style TargetType="Button">` with no key). Tools reference styles by key; nothing applies by type.
2. **Gate before merging.** Scan Theme.xaml for keyless implicit styles. An empty result means app-wide is safe. Any hit must be keyed first, or routed to the per-control fallback below.
3. **Merge once, guarded.** Add the theme to `Application.Current.Resources.MergedDictionaries`, but only if it isn't already there. Module re-import would otherwise stack duplicate dictionaries.
4. **Opt in with DynamicResource.** Tools and forms reference theme keys with `{DynamicResource KeyName}`, never `{StaticResource}`. The reason is in the StaticResource section.

The four bundled helpers below cover steps 2, 3, the per-control fallback, and a one-line check that a key resolves at the app level.

## Why keyed-only: the leak

This is the load-bearing finding, confirmed by live test. We merged a deliberately keyless implicit style (`<Style TargetType="Button">`, no `x:Key`) into `Application.Current.Resources`. It styled the intended tool buttons. It also leaked into native ISE chrome: the buttons in the ISE Options dialog (Cancel, Restore Defaults, Manage Themes) all turned the test color.

An app-wide keyless implicit style cascades into every surface in the process, including ones you never authored. A keyed style does not. A keyed style applies only where some element names it by key. That single contrast is the whole rule: app-wide merges must be keyed-only, and tools opt in explicitly.

## Why keyed-only, sharper: behavior, not just paint

A second finding. After the keyless merge, clicking a help button raised a runtime error: it tried to run `Get-Help '/>' -ShowWindow`, choking on the XAML fragment `/>` passed as an argument. A fresh ISE session showed no such error. The contaminated-session-versus-fresh-session contrast pinned the cause to the merge.

The exact path wasn't fully proven (leading theory: the implicit style collided with how the help button resolved its content or action), so hold this one a notch below the leak in certainty. But the direction is clear and worth stating plainly: an app-wide implicit style can perturb behavior, not only appearance. That raises the cost of a keyless merge from "wrong colors" to "wrong actions", which is why the gate refuses keyless styles rather than merely warning.

## DynamicResource, never StaticResource

Use `{DynamicResource KeyName}` for theme keys in tools. Not `{StaticResource}`.

`StaticResource` resolves at parse time. A tool's XAML is parsed inside the UserControl constructor, which runs before the control is docked into the ISE tree. At that moment the control has no ancestors and no connection to `Application.Current`, so an app-level `StaticResource` lookup finds nothing and throws. `DynamicResource` defers the lookup until the control is connected and the walk up to the app rung can succeed. This is not a style preference; with an app-level theme it's the difference between resolving and failing.

## The per-control fallback

When a theme contains keyless styles that can't easily be keyed, don't force them app-wide. Merge the dictionary into the individual tool's own `Resources.MergedDictionaries` at dock time. The natural home is the function that adds the tool to `VerticalAddOnTools`, called on the UserControl once it exists.

This contains the blast radius to that one control. Its implicit styles apply to its own subtree and stop there, so they never reach the ISE chrome. The cost is that you repeat the merge per tool instead of once globally. For a theme that's already keyed, prefer the app-wide path; reach for per-control when implicit styles are unavoidable.

## What you cannot reskin

The ISE's own chrome (editor surface, menus, toolbar) will not fully reskin through resource merging. Its native widgets pin their own styles and don't subscribe to your keys. The only thing that reaches them is a keyless implicit style, which is exactly the thing to avoid. So the chrome is both unreachable by the safe path and damaged by the unsafe one.

The supported door for editor background and font is the `$psISE.Options` API. Reaching deeper into the ISE visual tree to restyle native widgets is fragile and tends to break on ISE updates. Treat `$psISE.Options` as the boundary of what's meant to be themed and your tools as the surfaces you actually control.

## Session and cleanup notes

None of this persists across sessions. A restart clears every merge.

Removing a merged dictionary stops future lookups, but surfaces already rendered may keep their styling until they rebuild. Don't expect a live un-merge to repaint everything on the spot. For a clean slate, restart the ISE.

## Bundled helpers

All four honor PowerShell 5.1 (no ternary, no null-coalescing, left-hand null comparisons). The gate and the guard carry the only validation here, because they are the point; nothing else is wrapped defensively.

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

## Related, but a separate skill

Serializing a live, themed form back to XAML via `[System.Windows.Markup.XamlWriter]::Save` drops the programmatically merged theme dictionary, leaving any `{DynamicResource}` references in the output dangling. That serialization round-trip has its own cluster of findings (what survives, what vanishes, what gets baked in) and its own triggers. It isn't covered here. Flag it if you want it captured separately.
