# The surface format

A **surface** is a JSON file: a curated, annotated set of items presented for a reason at a moment. Files stay where they live (a repo, a URL, a local disk); the surface layers selection, arrangement, and commentary over them, and is archivable as a unit when its moment passes. The format originated in the Surfacer desktop app (the home repo, `projects/surfacer/`); this document is the written contract between every implementation.

**A surface is not a saved stage**, and nothing in the app writes one. Pages
read surfaces by profile: [`pages/branch.html`](../../pages/branch.html),
through [`lib/kits/branch-brief.js`](../../lib/kits/branch-brief.js), reads
`branch-review/1`; [`pages/inquiry.html`](../../pages/inquiry.html) reads
`inquiry/1`; [`pages/approve.html`](../../pages/approve.html) reads
`approval/1` ([`approval.md`](approval.md)).

**The JSON Schemas beside this doc** are a written contract two readers can
agree on, not a gate: no code in `lib/`, `pages/` or the skills loads them, so
a producer that drifts gets no signal. This document carries the concepts,
conventions, and worked examples.

- [`schemas/surface-v2.schema.json`](schemas/surface-v2.schema.json): the core schema.
- [`schemas/profiles/branch-review-v1.schema.json`](schemas/profiles/branch-review-v1.schema.json): the first profile.
- [`schemas/profiles/inquiry-v1.schema.json`](schemas/profiles/inquiry-v1.schema.json), [`schemas/profiles/approval-v1.schema.json`](schemas/profiles/approval-v1.schema.json) and [`schemas/profiles/stage-v1.schema.json`](schemas/profiles/stage-v1.schema.json): the others.

This contract defines **v2**. [`lib/kits/surface.js`](../../lib/kits/surface.js) dual-reads v1 and v2, normalizing to v2 in memory, and answers where each item lives. Every `.surface` file that exists is v1, and the Surfacer C# app still reads v1. **v1 files are never rewritten in place:** reading normalizes for display only, so a v1 file stays v1 until someone deliberately saves it as v2.

## Shape

```
surface (.surface, JSON)
├── manifest            identity and placement
│   ├── name*  description  subtitle  author  created_at*  category
│   ├── schema*           { name: "surface", version: 2 }
│   └── profile           { name, version }        (optional)
├── context             open block, defined by the active profile
└── items[]
    ├── id*  title*  type*  format
    ├── role            semantic role in the surface (optional in core)
    ├── target          { source { repository | uri | path, ref, revision, … }, line_ranges[] }
    ├── change          { status, previous_path, patch }
    ├── view            { mode*, reason }          (optional in core)
    ├── snippet  content  summary  commentary  facet  added_at
    ├── metadata
    └── related[]       { item, relation }
```

`*` marks required. Objects are open (additional properties allowed) unless the schema closes them (`schema`/`profile` identity, `line_ranges` entries, `related` entries).

## The annotation fields, disambiguated

Four fields sound alike and carry distinct meanings:

| Field | Answers |
|---|---|
| `summary` | What does the item say, shorter? (condenses the item) |
| `commentary` | What does the curator think about it? (interprets the item) |
| `view.reason` | Why was this representation chosen? (justifies the view mode) |
| `facet` | Where does it sit in the rendered grouping? (renderer-visible section key) |

`facet` stays first-class rather than moving into `metadata` because renderers dispatch on it (it drives sidebar structure in the Surfacer app).

## Source convention

A `source` says where the targeted resource lives. Three forms, by which fields are present:

1. **Repository source:** the structured `{repository, ref, path}` triple, `repository` as `owner/repo`, always explicit. This is preferred over any packed URI grammar: it round-trips losslessly (it is the stage's item shape) and avoids escaping ambiguity around slashes, colons, and `@` in refs and paths. `ref` is symbolic (branch or tag; absent means the default branch); `revision` pins the resolved commit at capture time. `base_revision`/`head_revision` express a per-source compare for mixed-repository cases.
2. **External source:** `uri`, for resources that already have a canonical external URI (a web page, an API endpoint). Do not encode repository references as URIs.
3. **Local source:** `path` with no `repository`. **A path-only source is local to the environment rendering the surface** (the machine running the Surfacer app). It is never resolved against a repository established elsewhere; repository sources always name their repository. This is also the portability boundary: repository and external sources travel with the surface, local sources are machine-bound.

## View semantics

`view` is the item's representation instruction: `mode` one of `full`, `diff`, `excerpt`, `summary`, `metadata`, `omit`, with `reason` saying why. Two rules:

- **Absence is not `full`.** An item with no `view` supplies no instruction; the active profile or the renderer applies its normal treatment. `full` is an affirmative request and would surprise on a bookmark or an external link.
- Excerpts follow `target.line_ranges` (named, labeled ranges), never arbitrary truncation.

## Profiles

The core schema is deliberately light: `role`, `view`, and `context` are optional and open, so a casual surface (bookmarks, a curated reading list) carries no ceremony. A **profile** is a named, versioned constraint layer for a specific use, declared in the manifest beside the schema identity:

```json
"schema":  { "name": "surface", "version": 2 },
"profile": { "name": "branch-review", "version": 1 }
```

A document claiming a profile must validate against **both** the core schema and the profile schema. The core leaves `context` open; the profile defines and requires its fields, and may raise optional core fields (`role`, `view`) to required. Profile schemas live in [`schemas/profiles/`](schemas/profiles/), one file per profile version.

### `branch-review/1`

Serializes a review package: a base/head compare plus a role-annotated selection. The insight it encodes: the unified diff is the authoritative change record, and a surface is the **manifest layer** over it (what was included, at what view, why, and what was omitted), not the content itself. Shipping the package to a token-less reader is a separate **materialization** step: resolve each ref through a token, cut excerpts at the declared ranges, inline the patch, and emit one self-describing text bundle. The surface stays durable and inspectable; the bundle is the disposable transport.

The profile requires `context.repository`, `context.base`, and `context.head` (each endpoint a `{ref, revision}`; pin the revision, refs move), plus `role` and `view` on every item; items with `role: "changed"` must carry `change.status`. Documented roles: `intent`, `changed`, `context`, `omitted`.

What `pages/branch.html` shows from one (delivered as `?src=` or `#gz=`; the projection is `fromSurface` in [`lib/kits/branch-brief.js`](../../lib/kits/branch-brief.js)): the `intent` items' `commentary` (else `summary` or `title`), falling back to `manifest.description`; `context.notes` and `context.open`; the `omitted` items' titles; and each `changed` item's `commentary` beside its `target.source.path`. It does not read `context.intent`, and it matches a `role` given as a string, not as an array. The compare itself comes from GitHub, not from the surface.

Worked example:

```json
{
  "manifest": {
    "name": "Review: stage rework",
    "description": "Review package for the stage-to-estate move.",
    "author": "Claude",
    "created_at": "2026-07-20T18:00:00Z",
    "category": "showcase",
    "schema": { "name": "surface", "version": 2 },
    "profile": { "name": "branch-review", "version": 1 }
  },
  "context": {
    "repository": "mehrlander/web-tools",
    "base": { "ref": "main", "revision": "70ddd99" },
    "head": { "ref": "claude/stage-rework-x1y2z3", "revision": "a81c3f2" },
    "intent": "Move the stage to the estate context without changing the deposit flow.",
    "review_focus": ["correctness", "hidden coupling"]
  },
  "items": [
    {
      "id": "request",
      "title": "Review request",
      "type": "story",
      "role": "intent",
      "view": { "mode": "full" },
      "format": "markdown",
      "content": "Look particularly for accidental semantic changes in the deposit flow."
    },
    {
      "id": "stage-js",
      "title": "lib/alpineComponents/stage.js",
      "type": "file",
      "role": "changed",
      "target": {
        "source": {
          "repository": "mehrlander/web-tools",
          "ref": "claude/stage-rework-x1y2z3",
          "revision": "a81c3f2",
          "path": "lib/alpineComponents/stage.js"
        }
      },
      "change": { "status": "modified" },
      "view": { "mode": "full", "reason": "central abstraction, changed in several distant regions" }
    },
    {
      "id": "shell",
      "title": "app/index.html",
      "type": "file",
      "role": "context",
      "target": {
        "source": {
          "repository": "mehrlander/web-tools",
          "ref": "claude/stage-rework-x1y2z3",
          "revision": "a81c3f2",
          "path": "app/index.html"
        },
        "line_ranges": [ { "start": 40, "end": 115, "label": "stage mount" } ]
      },
      "view": { "mode": "excerpt", "reason": "only the mount region bears on the change" }
    },
    {
      "id": "thumb",
      "title": "pages/thumbs/demos/demo-viewer.png",
      "type": "file",
      "role": "omitted",
      "change": { "status": "modified" },
      "view": { "mode": "metadata", "reason": "regenerated screenshot; not reviewable content" }
    }
  ]
}
```

### `stage/1`

**No producer since 2026-08-27.** The profile stands as a defined shape, and
[`pages/inquiry.html`](../../pages/inquiry.html) defines its `reply_to` by
contrast with this profile's `destination`. It serializes a **staged fileset**:
the set itself is the record. It requires one thing, a `target` on every item;
`context` may carry a `destination` (`owner/repo[:dir]`, where the set is
proposed to go) and `prompts` (`{label, ask}`), and the documented relation is
`compares-to`, naming the other side of a diff pair. A field belongs if it is
still true a year later with no tool running. There is no `intent` field, since
`manifest.description` says why the set exists; a diff pair is `view.mode:
"diff"` on both items plus the `compares-to` relation, not a surface-level
mode; and `manifest.name` may be generated from the contents (first file, plus
a count).

## v1 → v2 migration

v1 is the shape the Surfacer app shipped with (`schema_version: 1` in the manifest; examples in home `projects/surfacer/app/surfaces.example/`). v1's `kind` mixed genre with transport (`github_blob` says both "a file" and "lives on GitHub"); v2 separates them into `type` (genre) and `target.source` (location). `lib/kits/surface.js` carries this table as code.

| v1 | v2 |
|---|---|
| `manifest.schema_version: 1` | `manifest.schema: { name: "surface", version: 2 }` |
| `manifest.created` | `manifest.created_at` |
| `kind: note` / `kind: story` | `type: note` / `type: story` (`body` → `content`, with `format`) |
| `kind: github_blob` / `github_dir` / `repo` | `type: file` / `directory` / `repo` + `target.source {repository, ref, path}` |
| `kind: url` | `type: link` + `target.source.uri` |
| `kind: local_html` / `local_md` / `local_text` / `image` | `type: file` + path-only `target.source` (local), `format` as needed |
| app-generated kinds (`recent`, `downloads`, `chron_thread`, `system_health`, `script`) | app-defined `type` values, unchanged in meaning; open by design |
| flat per-kind source fields on the item | `target.source` |
| `commentary`, `facet`, `added_at`, `snippet`, `related` | retained as-is (`related` entries become `{item, relation}`) |
| (no equivalent) | `role`, `view`, `change`, `context`, `profile` |

### Reader migration targets

- **Surfacer C# app + `surfacer.html`** (home `projects/surfacer/app/`): reads v1. Target: dispatch on `manifest.schema`; keep reading v1 files indefinitely (personal surfaces are not migrated in place), author new surfaces as v2.
