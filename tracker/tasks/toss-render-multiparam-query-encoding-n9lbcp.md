---
id: toss-render-multiparam-query-encoding-n9lbcp
title: toss-render ?query forwarding drops multi-param page queries
status: backlog
track: independent
opened: 2026-07-19
next: decode the gh param from the raw fragment slice (not URLSearchParams) so a bare & in the page query survives, or document the %26 requirement in the head comment and the on-page help
---
# toss-render ?query forwarding drops multi-param page queries

## Symptom

`#gh=owner/repo@ref:path?query` hands the `?query` to the rendered page (the
params shim). It works for a single param (`?view=stage`), but a multi-param
page query with a bare `&` is silently truncated. Example that fails:

```
#gh=mehrlander/web-tools@<ref>:pages/show-repo/show-repo.html?view=app&appRepo=X&appPath=Y
```

The page receives only `view=app`; `appRepo` and `appPath` arrive as `null`, so
a deep link that needs all three routes to the wrong view (the app-view deep
link fell back to the estate front door).

## Cause (confirmed)

toss-render reads the fragment with `new URLSearchParams(location.hash.slice(1))`
(line ~145). URLSearchParams splits the whole fragment on `&` first, so the `&`
inside the `gh` value ends the `gh` param and turns `appRepo=X&appPath=Y` into
sibling fragment params that `showAddress` never sees. The `gh` value is
truncated at the first `&`, i.e. right after `?view=app`.

The workaround is to percent-encode the page query's `&` as `%26`, so it stays
inside the `gh` value and decodes back after URLSearchParams splits. That is a
sharp edge: the head comment and the on-page help show only single-param
examples, so a hand-written multi-param link looks right and quietly misbehaves.

## Fixes (possible)

- Extract `gh` from the raw fragment by string slice (find `gh=`, take the rest)
  rather than via URLSearchParams, so a bare `&` in the value survives. Guard the
  other fragment keys (`gz`, `html`, `url`) that legitimately want URLSearchParams.
- Or: keep the parse, and document the `%26` requirement in the head comment and
  the on-page help, plus have "Copy toss link" emit `%26` for any minted
  multi-param query.

Low urgency: single-param deep links (the common case) work, and callers can
encode `%26`. Worth smoothing so a hand-written link is not a trap.

## Progress log
- 2026-07-19: filed from the app-views session (web-tools PR #242), where the
  News app-view deep link failed until the `&` was encoded as `%26`.
