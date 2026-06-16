# Sharing the portable docs

A copy-paste pointer for sending another Claude Code session to web-tools'
**portable docs** (the to-go set in [PORTABLE.md](PORTABLE.md)).

**Why this exists.** To share the set you point another session at it, but a
session won't always know it *can* read a different repo, and several paths
genuinely can't: git-level access to other repos is blocked by the GitHub proxy,
and the GitHub MCP tools only see repos in the session's scope. What *does* work
is a plain HTTP GET of a public raw file, `raw.githubusercontent.com` is on the
sandbox allowlist. So the message below hands over the fetch command itself,
turning "can I even read that repo?" into "run this." (Fuller constraints: the
"two gates" and allowlist notes in
[docs/environment/capabilities.md](environment/capabilities.md).)

## Paste this

```
We keep a small set of portable docs (working conventions, a headless-rendering
recipe, sandbox notes) in a public repo. Pull the catalog and tell me how it
applies here. raw.githubusercontent is reachable from the sandbox and the repo is
public, so this needs no auth and no repo-scope change:

  curl -fsSL https://raw.githubusercontent.com/mehrlander/web-tools/main/docs/PORTABLE.md

If curl is blocked by a stricter network policy, WebFetch the same URL, or use the
GitHub MCP get_file_contents on mehrlander/web-tools.
```

**To lead with one doc** instead of the catalog, swap the path, e.g. the
headless-rendering recipe:

```
  curl -fsSL https://raw.githubusercontent.com/mehrlander/web-tools/main/docs/headless-vendoring.md
```

Everything under `https://raw.githubusercontent.com/mehrlander/web-tools/main/`
is fair game the same way (the example asset, the conventions, the environment
notes); `PORTABLE.md` lists the paths.
