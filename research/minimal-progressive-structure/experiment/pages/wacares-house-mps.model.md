# WA Cares ballot measure: model

Source: Jerry Cornfield, "Voters to decide if WA Cares tax dollars can be invested in stock market," Washington State Standard, October 31, 2025 (CC BY-NC-ND 4.0). Page: `wacares-house-mps.html`.

## 1. Governing question and root

**Governing question.** "The first item on my ballot is SJR 8201: what changes for WA Cares money if it passes, and who is making the case each way?"

**Root: the measure, Senate Joint Resolution 8201.** The reader is a Washington voter meeting the measure on the ballot, so the question is about one decision, not a set. WA Cares is the thing whose money is at stake, so it is a referenced neighbor, not the root. The measure's full view is two comparisons the reader weighs: what each vote leaves in force (No against Yes), and who argues each side (Against against For). Left is No and right is Yes in both, locked across the page.

## 2. Entity model

### Entity types and fields

| Type | Fields |
|---|---|
| Measure | name, kind, text change, purpose, ballot position, decision day, threshold, legislative vote, outcomes (comparison), sides (comparison), road to the ballot (sequence), program (reference) |
| Outcome (member of the measure's outcomes; 2 members: If No, If Yes) | what the money can be invested in, standing under the stock ban, investment earnings |
| Side (member of the measure's sides; 2 members: Against, For) | voice, case, backers, campaign money |
| Program (WA Cares) | kind, events (sequence): created, collections begin, trust balance, pilot, benefit access; tax rate; benefit amount |
| Ballot step (member of road to the ballot; 3 members) | when, event |
| Program event (member of the program's events; 6 members, one of them the root's label) | when, position on the time axis, event |

### Facts, each on its owner (forms 1 and 2)

**Measure SJR 8201**
- M1 kind: proposed constitutional amendment.
- M2 text change: adds a few lines to the state constitution.
- M3 effect: changes how billions of taxpayer dollars are managed.
- M4 ballot position: first item on every Washington voter's ballot.
- M5 purpose: lets the state make stock market investments with payroll taxes collected for WA Cares; lets assets be managed like the state's pension funds.
- M9 legislative vote: the Legislature voted earlier this year (2025) to put it on the ballot, 86-9 in the House and 42-7 in the Senate.
- M11 threshold and day: becomes law if more than 50% of voters approve it on Tuesday.

**Outcome: If No (the account stays under today's limit)**
- R1 the state constitution generally bars investing public money in the stock of private companies.
- R2 state and local governments are therefore limited to fixed-income securities: government bonds, treasury bills, certificates of deposit; less risky, typically lower returns.
- R4 the WA Cares account is now subject to this limitation.
- R5 the state's pension and retirement funds are on the list of funds exempt from the prohibition (stated through M13).

**Outcome: If Yes (the constitution is amended)**
- M7 the Washington State Investment Board would be legally able to handle the program's assets in a similar manner as pension and retirement funds.
- M14 the board could then decide whether to invest in private equity funds and buy stock of private companies, or not.
- M13 the Long Term Services and Supports Trust Account is added to the exempt list alongside the pension and retirement funds.
- M6 any earnings must be used solely for the program's beneficiaries.
- M15 per Weiner: unlike the 2020 measure, earnings must go into the WA Cares Fund; the intent is to keep lawmakers from tapping them for other budget needs.

**Side: Against**
- N1 voice: State Sen. Bob Hasegawa, D-Tukwila, at a recent University of Washington debate.
- N2 case (quotation): "Our fiduciary responsibility is to the people ... retain those constitutional protections."
- N4 backers: Hasegawa and three Republican state lawmakers wrote the voters' pamphlet statement opposing the measure.
- N3 money: no funded opposition campaign, as in the last ballot fight.

**Side: For**
- Y1 voice: Heather Weiner, Approve 8201 campaign, at the same debate.
- Y2 case: invests the tax dollars in a "safe and risk averse way" while producing greater returns.
- Y3 case: pension funds' annual returns have averaged 8.9% since 1992, several points above government bonds; in the long run, a lot more dollars for the program.
- Y5 case (quotation): "This doesn't mean day trading ... that fund will be there for you."
- Y6 backers: Gov. Bob Ferguson (Democrat); Senate Minority Leader John Braun, R-Centralia; Washington State Nurses Association; Washington State Council of Fire Fighters; AARP; Washington Health Care Association.
- Y7 money: SEIU 775 underwrites the campaign; $2.5 million raised and spent as of Friday, five times its spending in the losing 2020 effort.
- Y8 SEIU 775 represents 55,000 long-term care workers in Washington, Montana and Alaska (qualifier on its label).

**Road to the ballot (sequence on the measure)**
- P1 2020: voters defeated a similar measure. P2 it passed only in King, Jefferson and Whatcom counties.
- M9 2025: Legislature's vote (above).
- M11 Tuesday: the threshold (above).

**Program: WA Cares**
- W1 kind: the state's long-term care program.
- W2 2019: created by a state law.
- W3 and W4 mid-2023: collections begin of a 0.58% tax on the paychecks of most workers in Washington.
- W5 summer 2025: more than $2.5 billion banked in the Long Term Services and Supports Trust Account.
- W8 January: a pilot program starts in a handful of counties.
- W6 and W7 July 2026: those who qualify can begin accessing the benefit, a lifetime amount of $36,500, set to rise in future years to account for inflation.

**Sources**
- S1 statements from both sides and the attorney general's explanation are on the secretary of state website (no address given in the source).
- S2 the article: author, outlet, date, URL, license.

### Collections

| Collection | Members | Columns |
|---|---|---|
| Outcomes | If No, If Yes | invested in; stock ban; earnings |
| Sides | Against, For | voice; case; backers; campaign money |
| For's backers | 6 values | name with role or party |
| Road to the ballot | 2020, 2025, Tuesday | when; event |
| Program events | 2019, mid-2023, summer 2025, Tuesday (root label), January, July 2026 | when; axis position; event |

### Relations and kinds

| From | To | Kind |
|---|---|---|
| Measure | Outcomes (No, Yes) | comparison |
| Measure | Sides (Against, For) | comparison |
| Measure | Road to the ballot | sequence |
| Measure | WA Cares | reference |
| Outcome Yes | Washington State Investment Board | reference (value, no view) |
| Side For | backers | member (values) |
| Side For | SEIU 775 | reference (value, no view) |
| WA Cares | program events | sequence |
| WA Cares | Long Term Services and Supports Trust Account | part (value with its balance) |
| every fact | its article sentences | evidence |

### Earned views (form 3 and the earned-view rule)

- **WA Cares earns a view.** It has facts of its own (creation, tax rate, collections, balance, benefit, pilot, start date) and relations to the measure, the trust account and the payroll tax. Its facts reach the measure only through it, so the root holds a label and the facts live in the program view.
- **The 2020 measure does not.** Two facts of its own (defeated; passed in three counties); it sits as one step in the road to the ballot. The comparisons it supports (earnings mandate, SEIU spending, no funded opposition) belong to the 2025 outcome and sides, which state them.
- **SEIU 775 does not.** One fact beyond its name (55,000 workers in three states), carried as a qualifier on its label in the For side's money.
- **Washington State Investment Board does not.** Only its role (handles pension and retirement funds), which is the If Yes outcome's own fact.
- **The trust account does not.** One fact of its own (its balance), a part of WA Cares.
- **People** (Weiner, Hasegawa, Ferguson, Braun, the three Republican lawmakers) are values on their side.
- **The constitution's stock ban** is not an entity: its facts are the If No outcome's.

## 3. Projection table

| Entity type | Label | Row fields | View sections |
|---|---|---|---|
| Measure (root) | "SJR 8201" (in the WA Cares timeline: "Voters decide SJR 8201", which returns to the root) | single entity | Header: kind, ballot position, decision day, report date, title, what it does, WA Cares label. Then, in order: What a vote decides (If No against If Yes); Who argues each side (Against against For); Road to the ballot; Sources footer |
| Outcome | "If No: WA Cares stays under today's limit", "If Yes: the constitution is amended" | invested in; under the stock ban; investment earnings | shown as the columns of the first comparison; no separate view |
| Side | "Against: vote No", "For: vote Yes" | voice at the UW debate; their case; backers; campaign money | shown as the columns of the second comparison; no separate view |
| Program (WA Cares) | "WA Cares · the state's long-term care program · 0.58% payroll tax · $2.5B+ banked as of summer · benefits from July 2026", with the control "Funding, benefit and timeline" | single entity | Dialog: title and kind; time axis 2019 to 2027 with a dot per event, the vote marked; the event list with dates; article text per event |
| Ballot step | when + event | when; event | a step in the root's road to the ballot |
| Program event | when + event | when; event | an item in the WA Cares view |
| Sources | "Article text" toggle on each row and event | the source sentences | in-place disclosure under the claim; article citation and license in the footer |

Label copies, and why each is sanctioned: the WA Cares label copies the tax rate, the balance and the benefit start, because at the root they answer "whose money, how much, and when it pays out", which bears on the governing question. The For side's money copies SEIU 775's membership as the qualifier that identifies the union. The WA Cares timeline carries the root's label ("Voters decide SJR 8201") so the vote is placed against the program's dates.

## 4. Checks

1. **No duplicates.** Pass. Each fact sits in full in one place: rule facts in the If No column, measure terms in the If Yes column, argument facts in the side columns, program facts in the WA Cares view, legislative and 2020 facts in the road to the ballot. Copies appear only inside labels (WA Cares label, SEIU qualifier, the root label in the program timeline). Weiner's earnings claim (M15) sits only in the If Yes earnings cell, attributed to her there, not repeated in her case.
2. **Nothing lost.** Every source fact is reached except: M3, "change how billions of taxpayer dollars are managed", is not shown as its own line because the WA Cares label's "$2.5B+ banked" states the same magnitude exactly; the headline's wording is not reproduced. The secretary of state website is named without a link because the source gives no address. Dates the source gives relatively ("Tuesday", "January", "as of Friday", "summer") stay relative; the header's report date anchors them, and no calendar date is computed for display.
3. **Scent.** Pass. Controls: "Funding, benefit and timeline" on the WA Cares label (opens the program view); "Article text" on each row and event (shows the source sentences behind that row, switching to "Hide article text"); "Back to SJR 8201" on the vote item in the program view; "Close" on the dialog. No control reads "More" or "Details".
4. **Depth.** Pass. The header (what the measure does) and the first comparison row (what the money can be invested in, No against Yes) are on the first screen at desktop width; at phone width the header and the WA Cares label are, with the comparison starting below. Root facts are at zero interactions, WA Cares facts at one (open the view), article sentences at one or two.
5. **No empty slots.** Pass. The earnings row has no If No counterpart in the source, so its If No cell is omitted (absent on a phone, blank on a wide screen). No view is given to the 2020 measure, SEIU 775, the investment board, the trust account or any person. The page has one interaction level beyond the root, so there is no tab bar, deck or footer navigation.
