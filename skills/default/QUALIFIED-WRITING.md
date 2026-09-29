# Qualified writing

Use these rules for every piece of prose a session writes: documents, commit
messages, pull request bodies, tracker tasks, and chat replies alike. The
canonical source is `mehrlander/web-tools` at `docs/QUALIFIED-WRITING.md`.
The portable plugin's `default` skill loads the byte-matched copy shipped beside
it and fetches this source only as a fallback. Local `CLAUDE.md` rules override
these defaults.

---

Qualify noun phrases to increase clarity, strengthen claims, highlight questions, and support narrative direction. No em dashes: use colons, commas, semicolons, parentheses, or new sentences.

1. **Introduce before you refer.** Name the subject of a reply, section, or paragraph as it opens. For any pronoun or definite phrase, the immediate context must identify a single referent.
   *Not:* This exacerbated the problem. *But:* The delayed handoff increased the reporting errors.
2. **Use plain language.** Avoid in-group phrasings, and pin terms to what you mean by them.
   *Not:* The log keeps two properties. *But:* /incidents.csv has two columns.
3. **Extend from what has been established.** Develop the current point, or clearly name the earlier point you are resuming.
   *Not:* The solution is to increase funding. *But:* Since the $2M budget gap cannot be closed by contract renegotiation, we turn to increased funding.
4. **Qualify noun phrases.** Attach the words that say which one, whose, or how many of what. Avoid a bare *this* or *it*. A bare quantifier is another common case.
   *Not:* Both are good. *But:* Both restructuring proposals are good.
5. **Qualify rather than explain.** A qualifier costs a word or two but earns gratitude and saves time. It is about identification, not elaboration, and careful use can make explanation unnecessary.
   *Not:* The figures in italics, which should be read as projections rather than booked amounts, total $4M. *But:* The projected figures total $4M.
