# Races to watch: model

Source: `experiment/sources/races.txt` (Washington State Standard, May 8, 2026,
CC BY-NC-ND 4.0). Paragraph numbers below (¶0 to ¶52) count the body's
non-empty paragraphs after the `---` line, district headings included.

## 1. Governing question and root

**Question:** *Which Washington legislative races in this first look are worth
watching, and what kind of contest is each one: an open seat, a district that
might flip, or a Democratic incumbent challenged by another Democrat?*

The article's own lede sets the three kinds (¶0: "districts that might flip and
where progressives are challenging other Democrats from the left"; the open
seats come from the "slew of retirements", ¶4). A general reader brings a set
question, not a single-race one, so **the root is the collection of 13 seat
contests (races)**. Its full view is the comparison of its members: a list of
every race, grouped by district, each row carrying the fields that tell races
apart and its contest kinds, with one kind marked in the accent at a time.

The unit is the **seat contest**, not the district: three districts hold three
contests each, and the source's facts (who is leaving, who is running, who
backs whom) attach to a seat, not to a district.

## 2. Entity model

### Entity types and fields

| Type | Fields | Count |
|---|---|---|
| Cycle | filing close; seats on the ballot; current majorities; primary date and rule; Election Day; statewide field; turnover; party aims; installment; source | 1 |
| District | number; area; lean; seats held | 7 |
| Race (seat contest) | district (ref); chamber; seat holder; status; departing holder's facts; race facts; contest kinds (derived); candidates (members); related race (ref); passages (evidence) | 13 |
| Candidate | name; party; role; background facts; backing | 45 candidacies |

Endorsers and other named people (Natasha Hill, Andy Billig, Govs. Ferguson and
Inslee, Victoria Hunt, Bill Ramos, Emily Randall, Ryan Mello, Anders Ibsen,
Jamila Taylor, Bob Hasegawa, Jamie Pedersen, Kitsap County Democrats) have no
facts of their own beyond a title, so they stay **values** inside candidate
rows. Departing holders (Ormsby, Valdez, Conway, Mena, Ryu, Shewmake) are
values on their race's seat field; Mena and Ryu also run in another race, so
their departure is shown as a label that opens that race.

### Cycle (¶1 to ¶7)

- Filing: closed Friday at 5 p.m. (¶2)
- On the ballot: all 98 House seats; 24 of 49 Senate seats (¶3)
- Majorities: Democrats 59-39 House, 30-19 Senate (¶5)
- Primary Aug. 4, top two advance; Election Day Nov. 3 (¶7)
- Statewide: over 1,000 candidates for 600-plus federal, state and local offices (¶6)
- Turnover: many new faces in Olympia next January, slew of retirements (¶4)
- Aims: progressives vs. more moderate Democrats; Democrats to widen majorities; Republicans to claw back seats (¶3)
- Installment: first of two (¶1); scope sentence (¶0)

### Districts

| District | Area | Lean | Seats held |
|---|---|---|---|
| 3rd | Spokane | Reliably Democratic | |
| 5th | Parts of Issaquah, Black Diamond, Covington and part of Snoqualmie | Republicans have eyed it for gains in recent years | Democrats hold all three |
| 11th | Tukwila, Renton and parts of Kent | (not stated) | |
| 26th | Parts of Pierce and Kitsap counties | One of the few battlegrounds left | |
| 29th | (not stated) | Votes reliably Democratic | |
| 32nd | North King County and south Snohomish County | Deep blue | |
| 42nd | Whatcom County | (not stated at district level) | |

### Races (collection; columns: district, chamber, seat holder and status, party mix, kinds)

| id | Race | Status | Kinds | Candidates (party) | ¶ |
|---|---|---|---|---|---|
| r3h | 3rd House | Open: Timm Ormsby retiring (chief budget writer; won 2024 unopposed) | open | Luc Jasmin III (D), Pam Kohlmeier (D), Donovan Arnold DeLeon (D), Natalie Poulson (R) | 9-13 |
| r5h | 5th House | Incumbent Zach Hall (D) | flip, dvd | Zach Hall (D, incumbent), Michelle Bennett (R), Aimee Warmerdam (D, progressive), Topher Leritz (no party) | 15-19 |
| r11h | 11th House | Incumbent David Hackney (D) | dvd | David Hackney (D, incumbent), Ashley Fedan (D), Christian Rombough (R) | 21-24 |
| r26s | 26th Senate | Incumbent Deb Krishnadasan (D); 2025: beat Rep. Michelle Valdez in a hotly contested race | flip | Deb Krishnadasan (D, incumbent), Gary Parker (party not stated) | 26-27 |
| r26hv | 26th House | Open: Michelle Valdez (R) not seeking reelection (formerly Caldier; six terms) | open, flip | Renee Hernandez Greenfield (D), Tedd Wetherbee (D), Katy Cornell (R), Randy Phillips (no party) | 26, 28-32 |
| r26hr | 26th House | Incumbent Adison Richards (D) | flip, dvd | Adison Richards (D, incumbent), Natalie Bornfleth (D), David Olson (R) | 26, 34-35 |
| r29s | 29th Senate | Open: longtime Sen. Steve Conway retiring | open | Sharlett Mena (D) | 37 |
| r29hm | 29th House | Open: Sharlett Mena (D) running for Senate (ref r29s); Mena ran for it unopposed last time | open | Patrick Stickney, Joe Bushnell, Erin Chapman-Smith, Natasha Laitila (D); Darek Blum, Sheri Hayes (R) | 37-40 |
| r29hg | 29th House | Incumbent Melanie Morgan (D) | dvd | Melanie Morgan (D, incumbent), Krista Perez (D), Brett Johnson (R) | 41-43 |
| r32s | 32nd Senate | Incumbent Jesse Salomon (D) | dvd | Jesse Salomon (D, incumbent), Cindy Ryu (D), Ira McBee (R) | 45, 48 |
| r32hr | 32nd House | Open: Cindy Ryu (D) running for Senate (ref r32s); a crowded race of Democrats | open | Jenna Nand, Will Chen, Keith Scully, Danica Noble, Chris Bloomquist (D); Lisa Rezac (R) | 45-46 |
| r32hd | 32nd House | Incumbent Lauren Davis (D); only two candidates | dvd | Lauren Davis (D, incumbent), Imraan Siddiqi (D) | 45, 47 |
| r42s | 42nd Senate | Open: Sharon Shewmake (D) vacated; one of the few open Senate seats; Republicans held it as recently as 2021 | open, flip | Michael Shepard (D), Erika Creydt (R), Eamonn Collins (D), Ryan Bowman (no party) | 50-52 |

**Contest kinds (derived attribute of a race):**
- `open`: the holder is not on the ballot for this seat (retiring, running for
  another seat, not seeking reelection, vacated).
- `flip`: the district is one Republicans have eyed or a battleground (5th,
  26th), or the source calls the seat a Republican opportunity (42nd Senate).
- `dvd`: a Democratic incumbent faces a Democratic challenger.

Candidate background and backing facts are in the page data, one fact per
array item, each traceable to the race's passages.

### Relations and kinds

| From | Relation | To | Kind |
|---|---|---|---|
| Root | races | Race | member |
| District | races | Race | part |
| Race | district | District | reference |
| Race | chamber, status, holder, kinds | values | attribute |
| Race | candidates | Candidate | member (and comparison within the race) |
| Race (r29hm, r32hr) | holder now runs in | Race (r29s, r32s) | reference |
| Candidate | party, role, background, backing | values | attribute |
| Race | passages | source paragraphs | evidence |
| Cycle | facts | values | attribute |
| Cycle | passages | ¶0 to ¶7 | evidence |

No sequence relation earns a timeline: the dates (filing, Aug. 4, Nov. 3,
January) are three points, held as cycle attributes.

## 3. Projection table

| Type | Label | Row fields | View sections |
|---|---|---|---|
| Cycle | header line: "House 59-39 D · Senate 30-19 D · Primary Aug 4 · Election Nov 3" | none | dialog "2026 cycle & source": ballot, majorities, dates, statewide field, turnover, aims, installment; source and license; opening passages (disclosure) |
| District | "26th District" + area + lean (in a race view) | number, area, lean, seats held, as the group header over its races | the group header is its full view; it earns no separate view (four short facts) |
| Race | "{district} · {chamber}" + holder | chamber; holder with status; party mix; kind tags (marked kind in the accent) | strip card: (answer) kind tags; (identify) title, district label, seat status with the departing holder's facts or the related-race label; race facts; (compare) candidates, one row each on shared columns; (sources) "Article text for this race" disclosure |
| Candidate | name + party | name, party, role; background; backing | the row is the full view: every candidate's facts fit in it, so no separate view |

**Order within the race view:** contest kinds first (the answer), then what
identifies the seat (district, holder and status), then the candidates (the
comparison), then the passages.

**Mechanism:** the root's member relation is a list over a strip (house style
rule 12): the list, grouped by district, sits above (beside on a wide pane), a
pick moves the strip to that race's card, a swipe moves the list. The strip
header opens the race as a full-viewport deck (rule 4) with dots for 13 items.
The accent marks one contest kind at a time, chosen by a "Mark" pill row (rule
10), so the comparison never loses rows to a filter. Party is shown as text, not
colour, to keep one accent.

## 4. Checks

1. **No duplicates.** Each fact sits in full in one view. Label copies, all
   sanctioned: the district's area and lean in the race card's district label
   (they identify it and bear on "might flip"); the cycle's majorities and dates
   in the header line (they bear on the question at the top); Mena's and Ryu's
   departure shown in the open House race as a label that opens the Senate race
   where their candidate row lives; Valdez named in the 26th Senate race's 2025
   fact, with her own facts on the seat she is leaving; Emily Randall named in
   two rows as a value. The source gives the Senate majority twice and
   differently (30-19 in ¶5, "29-20" in ¶51). Both are kept where the source
   puts them (cycle view; Erika Creydt's row) and not reconciled, since nothing
   in the source explains the difference.
2. **Nothing lost.** Dropped as carrying no fact: ¶33 ("But wait, there's
   more.") and "it's seeing some action this year" (¶26). The headline becomes
   the page title. Two readings are inferences, stated: Michael Shepard is shown
   as a Democrat because ¶52 says Eamonn Collins "is also running as a
   Democrat"; the five candidates for Ryu's seat are Democrats because ¶46
   counts "five Democrats and one Republican". Gary Parker's party is shown as
   not stated. Ormsby's and Conway's parties are not stated and are not shown.
3. **Scent.** Controls: the "Mark" pills name the kind and count; each list row
   names its seat; the strip header's "Full screen" names the takeover; deck
   footer buttons name the neighbouring race; "Article text for this race (n
   paragraphs)" names its disclosure; the related-race link names the race it
   opens; the header button reads "2026 cycle & source" ("cycle & source" at phone
   width). No "More" or "Details".
4. **Depth.** First screen: every race with its kinds and the marked kind (the
   answer). Race and candidate facts: one tap (pick a row). District facts:
   zero (group header). Cycle facts: one tap (dialog). Passages: two taps,
   excepted.
5. **No empty slots.** Candidates and districts get no separate view. A race
   card leaves out its "Seat facts" list when the race has none, and the
   backing column when no candidate in that race has backing. Districts show
   only stated area and lean (11th: no lean; 29th: no area; 42nd: no lean).
   No filter row beyond "Mark" (13 rows fit). The strip header carries no
   figure.
