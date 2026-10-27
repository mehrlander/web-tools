# WA Cares ballot measure: model (minimal progressive structure)

Source: `experiment/sources/wacares.txt` (Jerry Cornfield, Washington State Standard, October 31, 2025). Line numbers below (L8 and so on) are lines of that file.

## 1. Governing question and root

**Governing question:** "What would a yes vote on SJR 8201 change, and who is for and against it?"

**Root:** the measure, Senate Joint Resolution 8201. The reader is a Washington voter who meets it as the first item on the ballot; the article is organized around that vote, and every other thing in it (WA Cares, the constitutional limit, the 2020 attempt, the campaigns) matters only for what it tells the reader about this measure. The root's full view therefore opens with what changes (a Today / If approved comparison), then the two sides compared, then the road to the ballot, with WA Cares and the constitutional limit as labels.

## 2. Entity model

### Form 1: atomic facts

| id | owner | property / relation | value | src |
|---|---|---|---|---|
| F01 | SJR 8201 | effect (deck) | would let assets be managed like the state's pension funds | L8 (merged into F08) |
| F02 | 2020 measure | outcome (deck) | a similar attempt failed | L8 (merged into F29) |
| F03 | SJR 8201 | ballot position | first item on every Washington voter's ballot | L10 |
| F04 | SJR 8201 | kind | proposal to add a few lines to the state constitution | L10 |
| F05 | SJR 8201 | scale | would change how billions of taxpayer dollars are managed | L10 |
| F06 | SJR 8201 | effect | lets the state make stock market investments with payroll taxes collected for WA Cares, the long-term care program | L12 |
| F07 | SJR 8201 | earnings rule | any earnings used solely for the program's beneficiaries | L12 |
| F08 | SJR 8201 to Investment Board | effect if approved | Washington State Investment Board legally able to handle the program's assets as it does pension and retirement funds | L14 |
| F09 | Yes side | claim (Weiner) | tax dollars invested in a "safe and risk averse way" while producing greater returns | L16 |
| F10 | Yes side | claim (Weiner) | since 1992 state pension funds averaged 8.9% a year, several points above government bonds; far more dollars long run | L18 |
| F11 | Yes side | evidence | Weiner quote: not day trading; smart long-term investing; fund there in 50 years | L20 |
| F12 | No side | voice | State Sen. Bob Hasegawa, D-Tukwila, opposes | L22 |
| F13 | No side | claim + evidence | Hasegawa quote: fiduciary duty to the people; no one knows when a crash comes; keep prudent fiscal management and constitutional protections | L24 |
| F14 | SJR 8201 | sequence | Legislature voted earlier this year to put it on the ballot | L26 |
| F15 | SJR 8201 | attribute of F14 | House 86-9, Senate 42-7 | L26 |
| F16 | SJR 8201 | threshold | becomes law if more than 50% of voters approve on Tuesday | L26 |
| F17 | WA Cares | created | by a 2019 law | L28 |
| F18 | WA Cares | funding | 0.58% tax on the paychecks of most workers in Washington | L28 |
| F19 | WA Cares | sequence | from July 2026 those who qualify can begin accessing the benefit | L28 |
| F20 | WA Cares | benefit | lifetime amount of $36,500, set to rise in future years for inflation | L28 |
| F21 | WA Cares | sequence | pilot program starts in January in a handful of counties | L28 |
| F22 | WA Cares | sequence | payroll tax collections began mid-2023 | L30 |
| F23 | Trust account (part of WA Cares) | balance | more than $2.5 billion banked in the Long Term Services and Supports Trust Account as of summer | L30 |
| F24 | Constitutional limit | rule | generally bars investing public money in the stock of private companies | L32 |
| F25 | Constitutional limit | consequence | state and local governments limited to fixed-income securities (government bonds, treasury bills, certificates of deposit): less risky, typically lower returns | L32 |
| F26 | Trust account, today | status | now subject to the limit | L32 |
| F27 | Trust account, if approved | status | added to the list of funds exempt from the limit, alongside pension and retirement funds | L34 |
| F28 | Trust account, if approved | investments | Investment Board could decide to invest in private equity funds and buy private company stock, or not | L34 |
| F29 | 2020 measure | outcome | defeated by voters; passed only in King, Jefferson and Whatcom counties | L36 |
| F30 | SJR 8201 | earnings rule (per Weiner) | unlike 2020, mandates investment money go into the WA Cares Fund; intent: keep lawmakers from tapping it for other budget needs | L38 |
| F31 | Yes side | backers | Gov. Bob Ferguson (D); Senate Minority Leader John Braun (R-Centralia); Washington State Nurses Association; Washington State Council of Fire Fighters; AARP; Washington Health Care Association | L40 |
| F32 | Yes side | funder | SEIU 775 underwriting the campaign | L42 |
| F33 | SEIU 775 | attribute | represents 55,000 long-term care workers in Washington, Montana and Alaska | L42 |
| F34 | Yes side | money | $2.5 million raised and spent as of Friday, five times SEIU 775's spending in the losing 2020 effort | L42 |
| F35 | No side | money (per Hasegawa) | no funded opposition campaign, as in the last ballot fight | L44 |
| F36 | No side | backers | Hasegawa and three Republican state lawmakers wrote the voters' pamphlet statement opposing | L44 |
| F37 | SJR 8201 | further reading | both sides' statements and the attorney general's explanation are on the secretary of state website (no address given) | L46 |
| F38 | Article | provenance | author, outlet, date, URL, CC BY-NC-ND 4.0 | L1-L4 |

### Collections

- **Account under each outcome** (comparison, 2 members: Today, If approved). Columns: *what the money can go into*; *standing under the constitution*. Facts F25 (as label), F26, F27, F28.
- **The two sides** (comparison, 2 members: For, Against). Columns: *who makes the case*; *the argument* (with evidence); *who backs it*; *money behind it*. Facts F09 to F13, F31 to F36.
- **Road to the ballot** (sequence, 3 members): 2020 attempt (F29), Legislature's vote (F14, F15), Tuesday's vote (F16).
- **WA Cares timeline** (sequence, 5 members): F17, F22, F23, F21, F19, with the Tuesday vote as a label.
- **Yes-side backers** (member list of values): F31.

### Form 2 and 3: owners and references

- Arguments, backers and money belong to the side (the side-measure pairing), not to the people quoted: Weiner and Hasegawa are the sides' voices.
- The 2025 campaign money (F34) belongs to the Yes side; SEIU 775's own fact (F33) belongs to SEIU 775 and reaches the page only inside its label.
- The constitution's rule and what it leaves governments (F24, F25) live on the limit; the account's standing under it today and if approved (F26, F27, F28) lives on the account-outcome pairing, which the root shows as its comparison. The root holds a reference to the limit.
- WA Cares's own facts (F17 to F23) live on WA Cares; the root holds a reference.
- F01 and F02 (the deck) restate F08 and F29 and are merged into them.

### Earned views

| thing | view? | why |
|---|---|---|
| SJR 8201 | root view | the subject |
| WA Cares | yes (dialog) | seven facts of its own, related to the measure and the account |
| Constitutional limit | yes (dialog) | rule, consequence, exemptions; related to the measure, the account, pension funds |
| Trust account | no, a part of WA Cares | after its comparison moves to the root, only its name and balance remain; it is named inside a WA Cares timeline entry |
| Yes side, No side | no separate view | every side fact fits in the comparison's cells; a view would repeat the row |
| 2020 measure | no, shown in full in the sequence | one fact of its own (the three counties); a tap would return one line |
| SEIU 775 | no, a value with a qualifier | passes the threshold formally (55,000 workers, two campaigns), but its own facts fit in its label; a view would return only what the label shows |
| Weiner, Hasegawa, Ferguson, Braun, the four groups, Investment Board, pension funds, Legislature, attorney general, secretary of state | no, values | named with title or party only |

### Relations and kinds

| from | to | kind |
|---|---|---|
| SJR 8201 | account under each outcome | comparison |
| SJR 8201 | the two sides | comparison |
| SJR 8201 | road to the ballot | sequence |
| SJR 8201 | WA Cares | reference |
| SJR 8201 | constitutional limit | reference |
| SJR 8201 | Investment Board | reference (value) |
| side | claims | attribute, with evidence |
| side | quotations | evidence |
| Yes side | backers | member (values) |
| Yes side | SEIU 775 | reference (value with qualifier) |
| WA Cares | trust account | part |
| WA Cares | timeline | sequence |
| constitutional limit | pension and retirement funds | reference (value) |
| constitutional limit | WA Cares | reference |
| every view | article paragraphs | evidence (sources level) |

## 3. Projection table

| entity type | label | row fields | view sections, in order |
|---|---|---|---|
| Measure (SJR 8201, root) | "SJR 8201" + "first item on every ballot, decided Tuesday" (header kicker) | n/a (root) | 1. What a yes vote does (F06, F04, F05); 2. Today / If approved comparison (F26, F27, F28, F08, F25 as label); 3. Where earnings go (F07, F30); 4. The two sides (comparison); 5. Road to the ballot (sequence: F29, F14-F15, F16, F03); 6. The things it touches: WA Cares and constitutional limit labels; 7. Where to read more (F37); 8. Sources |
| Side | "For: Approve 8201 campaign", "Against: Sen. Bob Hasegawa" | who makes the case; the argument; who backs it; money behind it | none (comparison shows all); evidence as a disclosure on the argument |
| 2020 measure | "2020: a similar measure failed" | year, result, where it passed | none (in full in the sequence) |
| Program (WA Cares) | "WA Cares" + "the state's long-term care program; more than $2.5 billion banked from a 0.58% payroll tax" | n/a | 1. Funding and benefit (F18, F20); 2. Timeline (F17, F22, F23, vote label, F21, F19); 3. Sources (L28, L30) |
| Rule (constitutional limit) | "The constitution's bar on investing public money in private stock" + "pension and retirement funds exempt"; in the comparison, qualifier "fixed-income securities, such as government bonds" | n/a | 1. What it bars (F24); 2. What that leaves (F25); 3. Who it covers today (state and local governments; WA Cares account, as a label); 4. Exempt today (pension and retirement funds); 5. Sources (L32, L34) |
| Article | outlet, author, date | n/a | footer: link, license |

Mechanisms: comparison as two columns with each field in the same row; sequences as ordered timelines; references as label cards that open a dialog; evidence as a disclosure on the claim; sources as a disclosure at the end of each view.

## 4. Checks

1. **No duplicates.** Each fact has one home (table above). Copies appear only inside labels: the Today cell's "fixed-income securities, such as government bonds" (label of the limit), the WA Cares label's "$2.5 billion" and "0.58%", the header kicker's "decided Tuesday", and the "Tuesday" marker in the WA Cares timeline. The quotes repeat their paraphrased claims only at the evidence level.
2. **Nothing lost.** Every fact F03 to F38 is reached. F01 and F02 are merged, not dropped. Not stated anywhere on the page, by decision: dates the source does not give ("Tuesday", "summer", "January" and "as of Friday" stay as the article words them, read against its October 31, 2025 dateline); the secretary of state's web address, which the source does not give; the 2020 spending figure in dollars, which the source gives only as a ratio.
3. **Scent.** Controls: the label cards "WA Cares ... See its funding, benefit and timeline" and "The constitutional limit ... See what it bars and who is exempt"; inline labels that name their target ("WA Cares", "the constitution's bar on investing public money in private companies' stock"); "Weiner's words at the debate"; "Hasegawa's words at the debate"; "Article passages behind this section (n)" / "behind this view (n)" / "on the sides, backers and money (n)"; "Back to The constitutional limit"; "Close". None says "More" or "Details".
4. **Depth.** First screen: the one-paragraph answer and the Today / If approved comparison. Every fact is at most one interaction away (a dialog or a quote disclosure); the limit's link to WA Cares inside its dialog is a second route, not the only one. Sources are one more disclosure.
5. **No empty slots.** No side views, no 2020 view, no SEIU view, no trust-account section; the comparison has only rows where both outcomes have a stated value (the source says nothing about who manages the money today, so there is no "manager" row; the Investment Board appears in the If approved cell).
