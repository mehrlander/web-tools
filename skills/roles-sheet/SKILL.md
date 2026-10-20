---
name: roles-sheet
description: Write or revise a roles sheet, a one-page document that divides one process's work among the roles that do it, as a card per role with a row per kind of work. Use when asked for a roles and responsibilities sheet or a who-does-what page, or to add, split or reassign a role on one.
---

# Roles sheet

A roles sheet divides one process's work among the roles that do it, on one
page. The owner's fiscal-note roles sheet set the form, and the Budget Process
Roles sheet in `mehrlander/home` follows it, at `projects/budget-drs/org/`.
There, `roles.json` holds the content, `build-sheet.py` fills a copy of the
fiscal-note sheet's Word file with it, and the budget-drs app's Org view renders
the same file in the browser.

## The form

- **A title** naming the process.
- **One card per role**, headed by the role's title. A role not yet filled
  carries "(planned)".
- **One row per kind of work**, labelled by an uppercase verb: CONNECT, PLAN,
  ROUTE, MONITOR, ASSESS, REVIEW, SUBMIT, DELIVER, in that order. A card shows
  only the rows it has.
- **Bullets** that each begin with a verb and name one task.
- **A footer** stating the ownership rule below, what the sheet covers and leaves
  out, and what "(planned)" means.

## Dividing the work

1. **Each task has one owner.** The role that approves or submits owns the task.
   A role that helps lists the same task beginning "Assist with", and the footer
   says so in one sentence: a bullet beginning "Assist" is work the role
   supports, and the rest it owns, subject to the approver's approval.
2. **A backup duty states its exceptions in its own bullet**, such as "Back up
   Budget Director except on approvals".
3. **A planned role's bullets follow its position description**, in the
   description's verbs, so the two documents assign the same work. When the
   description changes, the sheet changes with it.
4. **Systems, documents and agencies go by the names the office uses** (TALS,
   AFRS, agency 740). A qualifier the office did not use can name a different
   thing: "IT pool gate releases" named the statewide IT Pool, which those gate
   releases were not part of.
5. **A fact only the office knows is asked, not assigned**, such as who submits
   in a system or who answers an outside body's questions. The draft goes over
   with those questions listed.

## The content file

```json
{
  "title": "BUDGET PROCESS ROLES",
  "footer": "A bullet beginning \"Assist\" is work the role supports; ...",
  "columns": [
    [ { "role": "Budget Director",
        "verbs": [ ["CONNECT", ["Liaison with OFM and legislative fiscal staff"]] ] } ],
    [ { "role": "Budget and Management Analyst", "note": "planned",
        "verbs": [ ["MONITOR", ["Track gate releases and pool letters"]] ] } ]
  ]
}
```

`columns` holds the sheet's columns, each a list of cards from top to bottom.

## Building and checking

- **Word.** Copy an existing sheet as the formatting carrier and replace its
  text, keeping its tables, widths and styles. `build-sheet.py` is the example
  for a carrier shaped like the fiscal-note sheet. Commit the carrier, the
  content file, the builder and the built sheet: `build-sheet.py --check`
  rebuilds the sheet from the carrier and compares, and a viewer opens only a
  committed file. Write the zip entries with a fixed date, so the same content
  builds the same file.
- **In the browser.** A view or page reads the same content file, as the Org view
  does, rather than a copy of it. The built sheet opens in the Web Tools data
  viewer at `toss-render.html#data=owner/repo@ref:path.docx`.
- **One page.** After every edit, render to PDF
  (`soffice --headless --convert-to pdf`) and count the pages (`pdfinfo`). When
  a bullet wraps the sheet onto a second page, shorten the bullet; the type size
  stays.
- **Word itself.** A LibreOffice render is not Word. Until the sheet has been
  opened in Word, say so when handing it over.
