# wacares-mps3: model

Source: `experiment/sources/wacares.txt` (Jerry Cornfield, Washington State
Standard, October 31, 2025). Paragraph numbers below count the article body
from the dek: ¶0 is the dek ("A proposed constitutional amendment..."), ¶1 is
"The first item on every Washington voter's ballot...", through ¶19
("Statements from both sides...").

## 1. Governing question and root

**Governing question:** *What am I deciding when I vote on SJR 8201?*

**Root:** the measure, Senate Joint Resolution 8201.

The reader is a Washington voter holding a ballot with this as item one. What
they need first is what a yes vote changes (where WA Cares money may be
invested, today versus after approval), then what the measure is and what it
takes to pass, then how the two sides argue it. The program whose money is at
stake (WA Cares) is a neighbor, not the root: the reader needs its size and its
name to follow the answer, and its benefit details one tap away.

## 2. Entity model

### Form 1: atomic facts

| id | owner | property | value | ¶ |
|---|---|---|---|---|
| M1 | SJR 8201 | kind | proposed amendment adding a few lines to the state constitution | 0, 1 |
| M2 | SJR 8201 | ballot position | first item on every Washington voter's ballot | 1 |
| M3 | SJR 8201 | stakes | would change how billions of taxpayer dollars are managed | 1 |
| M4 | SJR 8201 | purpose | let the state make stock market investments with payroll taxes collected for WA Cares | 2 |
| M5 | SJR 8201 | earnings rule | any earnings used solely for the program's beneficiaries | 2 |
| M6 | Regime: if approved | manager | Washington State Investment Board legally able to handle the program's assets as it does pension and retirement funds | 0, 3 |
| M7 | SJR 8201 | election day | Tuesday (article dated Friday, October 31, 2025) | 3, 9 |
| M8 | SJR 8201 | how it reached the ballot | Legislature voted earlier this year | 9 |
| M9 | Legislative vote (House) | margin | 86-9 | 9 |
| M10 | Legislative vote (Senate) | margin | 42-7 | 9 |
| M11 | SJR 8201 | threshold | becomes law if more than 50% of voters approve | 9 |
| M12 | Regime: if approved | constitutional status | account added to the list of funds exempt from the prohibition, alongside pension and retirement funds | 13 |
| M13 | Regime: if approved | holdings | board could decide whether to invest in private equity funds and buy stock of private companies, or not | 13 |
| M14 | SJR 8201 | official materials | statements from both sides and an attorney general's explanation are on the secretary of state website | 19 |
| R1 | Regime: today | constitutional status | constitution generally bars investing public money in the stock of private companies | 12 |
| R2 | Regime: today | holdings | fixed-income securities such as government bonds, treasury bills, certificates of deposit | 12 |
| R3 | Regime: today | character | less risky, typically lower returns | 12 |
| R4 | Regime: today | applies to WA Cares | the WA Cares account is now subject to the limitation | 12 |
| W1 | WA Cares | what it is | the state's long-term care program | 2 |
| W2 | WA Cares | created | by a 2019 law | 10 |
| W3 | WA Cares | funding | 0.58% tax on the paychecks of most workers in Washington | 10 |
| W4 | WA Cares | access | those who qualify can begin accessing the benefit beginning July 2026 | 10 |
| W5 | WA Cares | benefit | lifetime amount of $36,500 | 10 |
| W6 | WA Cares | benefit growth | set to rise in future years to account for inflation | 10 |
| W7 | WA Cares | pilot | starts in January in a handful of counties | 10 |
| W8 | WA Cares | collections began | mid-2023 | 11 |
| W9 | WA Cares (part: LTSS Trust Account) | balance | more than $2.5 billion banked as of summer | 11 |
| S1 | Side: for | voice | Heather Weiner, Approve 8201 campaign, at a recent University of Washington debate | 4 |
| S2 | Side: for | claim | tax dollars invested in a "safe and risk averse way" while producing greater returns | 4 |
| S3 | Side: for | claim | since 1992, Washington's pension funds have averaged 8.9% annual returns | 5 |
| S4 | Side: for | claim | several percentage points higher than government bonds | 5 |
| S5 | Side: for | claim | in the long run, a lot more dollars for the program | 5 |
| S6 | Side: for | evidence | quote: "This doesn't mean day trading..." | 6 |
| S7 | Side: for | claim | unlike 2020, this year's proposal mandates investment earnings go into the WA Cares Fund | 15 |
| S8 | Side: for | claim | intent: prevent lawmakers from tapping those dollars for other budget needs | 15 |
| S9 | Side: for | backers | Democratic Gov. Bob Ferguson; Senate Minority Leader John Braun, R-Centralia | 16 |
| S10 | Side: for | backers | Washington State Nurses Association; Washington State Council of Fire Fighters; AARP; Washington Health Care Association | 16 |
| S11 | Side: for | funder | SEIU 775 is underwriting the campaign | 17 |
| S12 | SEIU 775 | identity | represents 55,000 long-term care workers in Washington, Montana and Alaska | 17 |
| S13 | Side: for | money | raised and spent $2.5 million as of Friday | 17 |
| S14 | Side: for | money vs 2020 | five times what SEIU 775 spent in its losing 2020 effort | 17 |
| O1 | Side: against | voice | State Sen. Bob Hasegawa, D-Tukwila, opposes the measure | 7 |
| O2 | Side: against | claim + evidence | quote: "Our fiduciary responsibility is to the people... retain those constitutional protections." (told the debate audience) | 8 |
| O3 | Side: against | money | no funded opposition campaign, just like the last ballot fight (per Hasegawa) | 18 |
| O4 | Side: against | backers | Hasegawa and three Republican state lawmakers wrote the voters' pamphlet statement opposing | 18 |
| P1 | 2020 measure | outcome | voters defeated a similar measure | 0, 14 |
| P2 | 2020 measure | where it passed | only King, Jefferson and Whatcom counties | 14 |
| A1 | Article | citation | headline, author, outlet, date, URL, license (CC BY-NC-ND 4.0, republished unedited with attribution) | header |

### Forms 2 and 3: owners and references

- The investment rules are facts about the account's *state*, not about the
  measure, so they sit on two **regime** entities (today, if approved). The
  measure's relation to them is the change itself.
- S14 is a fact about the pairing of SEIU 775 with two campaigns; it sits on
  the *for* side's money field, and the 2020 measure is referenced by label.
- S7/S8 are Weiner's argument, so they sit on the *for* side; the 2020 measure
  is referenced, not copied.
- O3 ("just like the last ballot fight") sits on the *against* side.
- The article names the money four ways: "WA Cares account", "long-term
  service account", "Long Term Services and Supports Trust Account" and "WA
  Cares Fund". It does not say they are one thing, so the page reports each
  name where the source uses it and asserts no identity.

### Entity types and fields

| type | fields |
|---|---|
| Measure | kind, ballot position, stakes, purpose, earnings rule, election day, threshold, legislative votes, official materials |
| Regime | constitutional status, holdings (with character) |
| Program | what it is, funding, benefit, timeline |
| Side | voice, in short, campaign money, argument (claims with evidence), also on this side |
| Prior measure | year, outcome, counties |

### Entities

- **SJR 8201** (Measure, root)
- **Today**, **If approved** (Regime)
- **WA Cares** (Program), with part **Long Term Services and Supports Trust Account**
- **For (Approve 8201)**, **Against** (Side)
- **2020 measure** (Prior measure)

Values, not entities (no facts of their own beyond the qualifier that names
them, or only one relation): Washington State Investment Board (qualifier:
handles the state's pension and retirement funds), SEIU 775 (qualifier:
55,000 long-term care workers in WA, MT, AK), each endorser, the Legislature,
the University of Washington debate, the secretary of state website, the three
2020 counties, the fixed-income examples.

The trust account has one fact beyond its name (W9) and is the program's
money, so it stays a part shown inside the WA Cares view, not a view of its
own. The 2020 measure has two facts (P1, P2) that fit in a row, so it gets a
row and no view.

### Collections

| collection | columns | members |
|---|---|---|
| Regimes | constitutional status, holdings | Today, If approved |
| Sides | voice, in short, campaign money, argument, also on this side | For, Against |
| Legislative votes | chamber, yes, no | House 86-9, Senate 42-7 |
| Endorsers | name, role | Ferguson, Braun, WSNA, WSCFF, AARP, WHCA |
| WA Cares timeline | when, event | 2019, mid-2023, summer, January, July 2026 |

### Relations

| from | to | kind |
|---|---|---|
| SJR 8201 | Today / If approved | comparison |
| SJR 8201 | kind, ballot position, election day, threshold, stakes | attribute |
| SJR 8201 | Legislative votes | member |
| SJR 8201 | WA Cares | reference |
| SJR 8201 | For / Against | comparison |
| SJR 8201 | 2020 measure | sequence (earlier attempt), shown as a row |
| SJR 8201 | article passages | evidence |
| If approved | Washington State Investment Board | reference (value) |
| WA Cares | Trust Account | part |
| WA Cares | timeline events | sequence |
| For | endorsers | member |
| For | SEIU 775 | reference (value) |
| For, Against | 2020 measure | reference |
| each claim | quotation or passage | evidence |

## 3. Projection table

| type | label | row fields | view sections (in order) |
|---|---|---|---|
| Measure (root) | "SJR 8201" + "proposed constitutional amendment" | (root, no row) | 1 What a yes vote does (answer, earnings rule, WA Cares label); 2 Today vs if approved; 3 On your ballot (identify); 4 The two sides (compare); 5 Background: the 2020 attempt and official materials; sources per section |
| Regime | "Today" / "If approved" | constitutional status; holdings | the comparison is the collection's full view, shown in the root because it is the answer |
| Program (WA Cares) | "WA Cares, the state's long-term care program" + "more than $2.5 billion banked as of summer" (copied: bears on "billions of taxpayer dollars") | (single) | dialog: funding; benefit; timeline (with the trust account inside it, and the article date as a muted marker so "summer" and "January" have a reference point); sources |
| Side | "For: Approve 8201" / "Against" | voice at the debate; in short; campaign money | expand in place, both sides at once so fields stay aligned: argument (claims, each with its quotation as evidence); also on this side; sources |
| Prior measure | "2020: a similar measure" | outcome; counties | none (not earned) |

Order inside the root: the answer first (what changes), then what identifies
the measure (ballot facts), then what compares (the sides), then background.

## 4. Checks

1. **No duplicates.** Each fact is in full in one place. Sanctioned label
   copies: the $2.5 billion balance in the WA Cares label (bears on the
   question at that spot); each side's "in short" line, a label-length gist of
   its argument; "unlike 2020" in the *for* argument, which references the
   2020 row rather than restating it. The today/if-approved table holds R1-R4
   and M6, M12, M13 once each; the lead sentence holds M4 and M3, which the
   table does not repeat.
2. **Nothing lost.** Every fact M1-M14, R1-R4, W1-W9, S1-S14, O1-O4, P1-P2 and
   A1 is reached. No fact is dropped. "Tuesday" is given as the source gives
   it, next to the article date, with no calendar date inferred; "January" and
   "summer" likewise carry no inferred year.
3. **Scent.** Controls: "WA Cares: the 0.58% tax, the $36,500 benefit and key
   dates"; "Both sides in full: arguments, backers and quotes"; "Her words" /
   "His words" on each directly quoted claim and "As the article reports it"
   on each reported one; "Article passages behind this section" (or "this
   view" in the WA Cares dialog); "Back to SJR 8201". None reads "More" or
   "Details".
4. **Depth.** The first screen at phone width holds the answer sentence and
   the start of the today/if-approved table. WA Cares details and both sides'
   arguments are one interaction away; quotations are a second interaction
   (sources, excepted).
5. **No empty slots.** No "risk and return" row in the regime table (the
   if-approved side has no neutral fact for it, only the two sides' claims),
   no "who manages it today" row (the source does not say), no view for the
   2020 measure, the trust account, SEIU 775, the board or any endorser.
