# sites/

Domain-scoped popups: HTML pages designed to open as a window from a specific
host and operate against that host's pages via `window.opener`.

## Convention

- Each subfolder is named for the exact `location.hostname` of the page the
  popup is intended to be launched from. No normalization — `www.example.com`
  and `example.com` are different folders.
- One popup, one site. A popup that doesn't tightly assume a specific host is a
  general tool and belongs under `tools/`, not here.
- The popup is allowed to assume things about that host: URL shapes, DOM
  structure, the host's IDB databases, page-specific selectors. That assumption
  is the whole point — it's why these are different from general tools.

## Subfolders within a host folder

- `*.html` at the top level — popups (open as a window).
- `snippets/` — JavaScript meant to be pasted into DevTools console on that
  host. Different shape from popups, same domain assumption.
- `docs/` — reference notes about that host's data model or page structure.
