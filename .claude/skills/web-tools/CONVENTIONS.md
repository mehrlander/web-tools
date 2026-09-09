# Working conventions (portable)

Remote-sandbox conventions for Claude Code web sessions; output is strictly via chat. The canonical source is `mehrlander/web-tools` at `docs/CONVENTIONS.md`, loaded by `@`-import or the `web-tools` skill. Substitute the current repo into all URL templates.

This hub holds behavior that applies whether or not anything is being surfaced. Two companions load as one set with it:

- **[SURFACING.md](SURFACING.md)**: the surfacing system, the primitives that make session work visible in chat (no setup) plus the surfacing course (the guide-PR lifecycle, idle until you open a PR).
- **[PORTABLE.md](https://github.com/mehrlander/web-tools/blob/main/docs/PORTABLE.md)**: installation, the plugin, and the full catalog of what travels from the hub to any repo.

## Qualified writing

Qualify noun phrases to increase clarity, strengthen claims, highlight questions, and support narrative direction. No em dashes: use colons, commas, semicolons, parentheses, or new sentences.

1. **Introduce before you refer.** Use *this*, *it*, or a definite phrase only when the immediate context identifies a single referent.
   *Not:* This exacerbated the problem. *But:* The delayed handoff increased the reporting errors.
2. **Use plain language.** Avoid in-group phrasings, and pin terms to what you mean by them.
   *Not:* The log keeps two properties. *But:* /incidents.csv has two columns.
3. **Extend from what has been established.** Develop the current point, or clearly name the earlier point you are resuming.
   *Not:* The solution is to increase funding. *But:* Since the $2M budget gap cannot be closed by contract renegotiation, we turn to increased funding.
4. **Qualify noun phrases.** Attach the words that say which one, whose, or how many of what. A bare quantifier is the common case.
   *Not:* Both are good. *But:* Both restructuring proposals are good.

## Pointers

The rest of the system lives where a skill or document owns it; each line here is the whole rule as a session needs it.

<<<<<<< HEAD
- **Status.** Preserved or aged material is marked **`Frozen`**, **`Stale`**, or **`Wrong`**. Run `/markers` before marking anything, or before editing in a repo whose frozen areas you have not seen.
- **Venues.** This sandbox is one venue among several. Before concluding that something cannot be done from here, read [venues.md](https://github.com/mehrlander/web-tools/blob/main/docs/venues.md).
- **Avoid explanatory prose.** Before adding to a doc, ask in order: does the app derive it, does the suite enforce it, does another document own it? If yes, delete it and link there.
- **Keep focus.** Be wary of improvements that address a hypothetical problem. `/tasks` owns task filing; a friction observation goes to the repo's snags log.
=======
- The **branch anchor**, **guide PR**, and **wrap-up** in [SURFACING.md](SURFACING.md) are per-workstream: "the branch" and "the PR" always mean this workstream's.

**Two settings are per repository, and these are their defaults.** *Render path:* ⭐ for a page already deployed, the toss otherwise; there is no per-repo preview mechanism. *Per-session refreshes:* normally none; a local `CLAUDE.md` names only a generated artifact too slow or too non-deterministic to ride a commit hook.

## Status: frozen, stale, wrong

Material preserved on purpose, or that has aged, says so where it is read. The
vocabulary is **`Frozen`** (preserved on purpose), **`Stale`** (no longer
accurate) and **`Wrong`** (flatly incorrect, not merely aged), carried two ways:
a **marker** on a claim in prose, and a **declaration** (`.paths.json`) on a
file path, which is the only one that reaches a non-markdown artifact.

**Run `/markers` before marking anything, and before editing in a repo whose
frozen areas you have not seen.** It owns the shapes, the cascade, and the
check; this paragraph exists so you know the system is there.

## Venues: this session is not the only place work can run

Besides this sandbox, work can run in a local Claude Code CLI, in Cowork on the desktop, through **Dispatch** (a phone-to-desktop relay, attended: the machine must be awake with the app open), on GitHub's hosted runners, on a **self-hosted runner** on your own machine (unattended: it queues while the machine sleeps), and in a Claude Code Remote environment.

See [venues.md](https://github.com/mehrlander/web-tools/blob/main/docs/venues.md): what each reaches, and the attended-versus-unattended split that decides where a job belongs.

## Avoid explanatory prose

Before adding to a doc, and whenever one has outgrown its subject, ask three questions in order:

1. **Is this a fact the app derives?** Delete it and link the view.
2. **Is this a rule the suite enforces?** Delete the description, keep a pointer to the gate. The test is the statement.
3. **Does another document already own it?** Delete it and link there.

## Keep focus

When asked to look for improvements, be wary of ideas that address a hypothetical problem. A simple, clear fix is worth making; the trap is speculative work that goes off course. The test applies to work the session conceives, not to a specific user request.

The `tasks` skill owns the filing rules; load `/tasks` before writing a task file. A friction observation goes to the repo's snags log (web-tools: [`SNAGS.md`](https://github.com/mehrlander/web-tools/blob/main/docs/SNAGS.md)), one line with a `→` to the fixing doc; the third recurrence earns a task.

## Adding your own, without clobbering

The install owns only what it ships. Plugin skills are namespaced (`/portable:caption`), so a same-named skill of yours coexists; the fallback fetch hook writes a fixed file list and touches nothing else. Your own skills and any `CLAUDE.md` text below the import are never overwritten.
>>>>>>> origin/main
