# Branch guide: claude/docs-share-pointer-k3n9w

Add `docs/SHARE.md`: a copy-paste pointer for sending another Claude Code session
to web-tools' portable docs, closing the chicken-and-egg where a session doesn't
know it can pull from another repo (it can't via git/MCP scope, but a raw HTTP GET
of a public file works and is allowlisted).

⭐ [docs/SHARE.md](https://github.com/mehrlander/web-tools/blob/claude/docs-share-pointer-k3n9w/docs/SHARE.md)

**Changed:**
- docs/SHARE.md ([new](https://github.com/mehrlander/web-tools/blob/claude/docs-share-pointer-k3n9w/docs/SHARE.md))
- docs/PORTABLE.md, docs/README.md — one-line cross-links to it

**Next steps / open threads:**
- Access facts confirmed this session by probe: raw.githubusercontent of our files
  → 200 (public + allowlisted); blocked host → 403 x-deny-reason. SHARE.md links
  capabilities.md for the fuller "two gates" picture.
- SHARE.md is the *pointer to* the portable set, not itself a to-go doc (it names
  web-tools URLs).
- Follow-up to PR #177 (the portable set + manifest).
