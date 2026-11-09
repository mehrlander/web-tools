# Genre ladders and the profile

A rung says what kind of point a claim makes, on a ladder chosen by the
document's genre. It is a second tag on a claim ([`claims.md`](claims.md)),
beside its type. Rungs compare across documents of one genre; depth
([`tree.md`](tree.md)) does not, and the two barely correlate, so a report on a
document's level of detail needs both.

## Placing a claim

Use the first rung, from the top, whose test the claim passes. Judge a claim by
its predicate, what it says about its subject, not by what it names. When two
rungs fit equally, choose one and write the other in `also`. Use `other` when no
rung fits, and say why in `note`.

**Check the genre first.** Place the claims with `other` available: a document
of the ladder's genre leaves at most about a fifth of its claims on `other`, and
one of another genre leaves a fifth to a half. The genre is a property of each
document, not of its folder.

## Page: documents about a page, tool or app

| Rung | The claim says |
| --- | --- |
| `purpose` | what need the tool meets, naming no outcome a user produces |
| `capability` | what a user can accomplish, naming no control (the tool's own name is not a control) |
| `feature` | that a named part exists or what it is for; major if removing it costs the user an ability, minor if it refines another feature |
| `interaction` | the user does X and the page does Y |
| `presentation` | position, size, colour, wording, icon or layout |
| `limit` | what a user cannot do, must do first, or runs up against |
| `not-page` | internals, formats, parameter grammar, tests, history, rationale, and anything addressed to the page's builder |

## Practice: documents that tell a reader or a session how to act

| Rung | The claim says | Test |
| --- | --- | --- |
| `purpose` | what the practice is for | Names the aim, not an act. |
| `rule` | what to do or not do | An instruction or standard a reader could follow or break. |
| `condition` | when or where a rule applies | A trigger, scope or exception, stated apart from the act. |
| `procedure` | the steps or the command that carries a rule out | Ordered steps, a command, a file to run. |
| `test` | how to tell whether it was done right | A check, a failure symptom, a criterion. |
| `example` | an instance or a non-example | A worked case, a "Not / But" pair, a quoted sample. |
| `rationale` | why a rule exists | A reason, a cost avoided, a history that motivates it. |
| `pointer` | where more lives | A link or reference with nothing else asserted. |

## Inquiry: documents that record what was asked, done or found

| Rung | The claim says | Test |
| --- | --- | --- |
| `question` | what was asked or is at issue | A question or aim of inquiry. |
| `method` | how it was examined | A procedure, tool, sample or setup used to find out. |
| `observation` | a particular measured or seen fact | One result, often dated or counted, true of one case. |
| `finding` | a generalization drawn from observations | A claim about a class of cases. |
| `caveat` | a limit on what is known | An uncertainty, exception or condition on a finding. |
| `implication` | what follows for action | What to do, avoid or build because of a finding. |
| `open` | what remains unknown or undone | A gap, a next step not yet taken. |
| `pointer` | where more lives | A link or reference with nothing else asserted. |

A reference ladder, for definitions and how a tool or format behaves, is not
drafted; taggers asked for `definition` and `behavior` as its core rungs.

## Reading a profile

A document's rung counts are its profile:

- A page document whose claims are mostly `not-page` is a builder's reference.
- A practice document whose rules rarely reach `test` or `example` states rules
  with no way to tell whether they were followed.
- An inquiry document with more `finding` than `observation` generalizes from
  few cases.

## Output

`ladder.csv`: `n,rung,also,note`, one row per claim, every field quoted.
