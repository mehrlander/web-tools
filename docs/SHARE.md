# Share Portable Docs

Claude Code sessions restrict cross-repo git and MCP access. Bypass it by
fetching public files directly via HTTP GET, since `raw.githubusercontent.com` is
typically reachable in the sandbox ([fuller constraints](environment/capabilities.md)).

## Copy-paste prompt

```
Fetch our portable docs catalog (public repo, no auth or scope change required)
and apply what's relevant here:

  curl -fsSL https://raw.githubusercontent.com/mehrlander/web-tools/main/docs/PORTABLE.md

If curl is blocked, use WebFetch or the GitHub MCP get_file_contents on
mehrlander/web-tools.
```

**Target a specific doc:** replace `PORTABLE.md` in the URL to fetch a single
file directly, e.g. `docs/headless-vendoring.md`.
