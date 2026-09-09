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

- **Status.** Preserved or aged material is marked **`Frozen`**, **`Stale`**, or **`Wrong`**. Run `/markers` before marking anything, or before editing in a repo whose frozen areas you have not seen.
- **Venues.** This sandbox is one venue among several. Before concluding that something cannot be done from here, read [venues.md](https://github.com/mehrlander/web-tools/blob/main/docs/venues.md).
- **Avoid explanatory prose.** Before adding to a doc, ask in order: does the app derive it, does the suite enforce it, does another document own it? If yes, delete it and link there.
- **Keep focus.** Be wary of improvements that address a hypothetical problem. `/tasks` owns task filing; a friction observation goes to the repo's snags log.
