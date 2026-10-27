# races-mps: model

Source: `experiment/sources/races.txt` (Washington State Standard, May 8, 2026,
"Legislative races to watch as Washington's election season revs up").

## 1. Governing question and root

**Governing question:** *Which Washington legislative seats are worth watching in
2026, what kind of contest is each one, and who is running?*

**Root:** the collection of **seat contests** (races) the article covers. The
reader's question is about a set, so the root's full view is the comparison of
its members: one row per race, with the same fields at the same place on every
row, grouped by district.

Judgment behind the choice: the article is organized by district, but the reader
votes in, and follows, a seat. Three districts hold three contests each (26th,
29th, 32nd), and the facts that answer "why watch it" (open seat, a Democrat
challenging a Democratic incumbent, a seat that might flip) belong to the seat,
not the district. Districts become group headers carrying their own few facts.

## 2. Entity model

### Entity types and fields

| Type | Fields |
|---|---|
| Election (singleton) | seats up per chamber; current majorities; filing deadline; primary date and rule; Election Day; arrival of new members; statewide candidate and office counts; the three partisan efforts; source and installment note |
| District (7) | number; area; partisan lean (source wording) |
| Race (13) | district (part-of); chamber; seat (named for its current holder); status (open / incumbent running); seat situation (holder and seat-history facts); contest tags; field (members); source sentences (evidence) |
| Candidate (45; Mena and Ryu counted once, in their Senate races) | name; title and hometown when a sitting legislator (e.g. "Rep. ... D-Tacoma"); party (D, R, no party, not stated); incumbent flag; role (identifying descriptor); backers (values); further facts grouped under named headings; cross-race reference |
| Backer | value only (name plus identifying qualifier), never an entity |

### Collections

- **Races** (13), columns: chamber, seat, status, tags, field by party.
- **Field** of each race, columns: party, name, role, backers.
- **Timeline** (election sequence): filing deadline, primary, Election Day, new members arrive.
- **Platform** (Warmerdam: 4 items), **committees** (Hackney), **party roles** (Fedan): small lists inside a candidate view.

### Entities

Districts: 3rd (Spokane; reliably Democratic), 5th (parts of Issaquah, Black
Diamond, Covington, part of Snoqualmie; Republicans have eyed it; Democrats hold
all three seats), 11th (Tukwila, Renton, parts of Kent), 26th (parts of Pierce
and Kitsap counties; one of the few battlegrounds), 29th (votes reliably
Democratic), 32nd (north King and south Snohomish counties; deep blue), 42nd
(Whatcom County).

Races (id: holder, status, tags):

| id | Chamber | Seat | Status | Tags | Field |
|---|---|---|---|---|---|
| d3-house | House | Ormsby's | open (retiring) | open | Jasmin D, Kohlmeier D, DeLeon D, Poulson R |
| d5-house | House | Hall's | incumbent (appointed) | vs-dem, flip | Hall D*, Bennett R, Warmerdam D, Leritz none |
| d11-house | House | Hackney's | incumbent | vs-dem | Hackney D*, Fedan D, Rombough R |
| d26-senate | Senate | Krishnadasan's | incumbent | flip | Krishnadasan D*, Parker (party not stated) |
| d26-house-valdez | House | Valdez's | open (not seeking reelection) | open, flip | Greenfield D, Wetherbee D, Cornell R, Phillips none |
| d26-house-richards | House | Richards' | incumbent | vs-dem, flip | Richards D*, Bornfleth D, Olson R |
| d29-senate | Senate | Conway's | open (retiring) | open | Mena D (only candidate named) |
| d29-house-mena | House | Mena's | open (Mena running for Senate) | open | Stickney D, Bushnell D, Chapman-Smith D, Laitila D, Blum R, Hayes R |
| d29-house-morgan | House | Morgan's | incumbent | vs-dem | Morgan D*, Perez D, Johnson R |
| d32-house-ryu | House | Ryu's | open (Ryu running for Senate) | open | Nand D, Chen D, Scully D, Noble D, Bloomquist D, Rezac R |
| d32-senate | Senate | Salomon's | incumbent | vs-dem | Salomon D*, Ryu D, McBee R |
| d32-house-davis | House | Davis's | incumbent | vs-dem | Davis D*, Siddiqi D |
| d42-senate | Senate | Shewmake's | open (vacated) | open, flip | Shepard D, Creydt R, Collins D, Bowman none |

(* incumbent)

Tag rules: **open** = the current holder is not running for this seat.
**vs-dem** = the incumbent faces a fellow Democrat. **flip** = the source
describes the seat or district as contestable between parties: the 5th
("Republicans have eyed" it), the 26th ("still considered a battleground"), the
42nd Senate seat ("a rare opportunity for Republicans"). Mapping those phrases to
the article's own framing ("districts that might flip") is a judgment, stated
here.

### Relations and kinds

| From | Relation | To | Kind |
|---|---|---|---|
| Race collection | members | Race | member |
| Races | compared on chamber, status, tags, field | Race | comparison |
| Race | in district | District | part (grouping) |
| Race | field | Candidate | member |
| Race | seat situation | holder and history facts | attribute |
| Race | source sentences | quotations | evidence |
| Candidate | backers | value | attribute |
| Candidate | further facts | value | attribute |
| Mena (29th Senate candidate) | leaves | 29th House seat | reference |
| Ryu (32nd Senate candidate) | leaves | 32nd House seat | reference |
| 26th Senate history (2025 race) | opponent | Valdez (26th House holder) | reference |
| Election | dates | timeline | sequence |

### Form 2 and Form 3 decisions

- Seat-tenure facts (Krishnadasan's appointment and partial term, Hall's
  appointment and the Hunt and Ramos chain, Ormsby's retirement and 2024 result,
  Hackney first elected 2020, Mena unopposed last time) are about why the seat is
  on this ballot, so they live on the **race** as its seat situation.
- Personal facts (career, committees, platform, votes, endorsements, prior runs)
  live on the **candidate**.
- A departing holder referenced by one race only (Ormsby, Conway, Shewmake) has
  no view; their facts sit in that race's seat situation, their only appearance.
- **Mena** and **Ryu** each appear in two races. Their candidacy lives on the
  Senate race; the House race they leave holds a label that opens the Senate race.
- **Valdez** holds the 26th House seat (her facts live there) and appears in the
  26th Senate history as a label that opens that House race.
- **Emily Randall** (vacated the 26th Senate seat; endorses Greenfield) stays a
  value: her only own fact is being elected to Congress, which is a seat-history
  fact. Same for every other backer and for Hunt, Ramos, Hill, Billig, Ferguson,
  Inslee, Taylor, Hasegawa, Mello, Ibsen, Pedersen.

### Earned views

A candidate earns a view only when facts remain after the row (party, name,
role, backers). 13 do: Jasmin, Hall, Bennett, Warmerdam, Hackney, Fedan,
Greenfield, Richards, Olson, Laitila, Morgan, Perez, Creydt. The other 32
candidates are rows only, with no control.
Districts do not get a separate view: their facts fit the group header, and the
group (header plus race rows) is their view.

## 3. Projection table

| Type | Label | Row | View sections (in order) | Sources |
|---|---|---|---|---|
| Election | "2026 Washington legislative elections" | n/a | lede line on first screen (majorities, seats up); background section: timeline, the three partisan efforts, statewide scale, retirements | disclosure in background section |
| District | "26th District" | group header: number, area, lean | = its group: header plus race rows | carried in each race's sources |
| Race | "29th District Senate · Conway's seat" | chamber, seat, status line, tags, field by party (counts) | 1 seat situation (the answer: why this seat is in play); 2 field (candidate rows); 3 source sentences | "Source sentences (n)" disclosure at the end of the view |
| Candidate | name, party letter, hometown for legislators, "incumbent" | party, name, role, backers | the remaining facts under named headings (Platform, Committees, Income tax vote, ...) | the race's source sentences |

Depth: race rows and district facts at depth 0; race view at 1 (expand in place);
candidate view at 2 (expand in place inside the race view). Reference labels
(Mena, Ryu, Valdez) jump to and open the other race.

Order on the root: answer first (title, framing line, chamber status, filter by
contest kind, the race list), then background (timeline, partisan efforts,
scale), then attribution.

Mechanisms: member, comparison = grid rows with shared columns, grouped by
district; part = expand in place; reference = a label that opens the referenced
race; sequence = a four-step timeline; evidence = disclosure at the end of the
race view.

## 4. Checks

1. **No duplicates.** Each fact is stated in full once. Copies are labels only:
   the status line names the holder ("Open: Rep. Sharlett Mena is running for
   the Senate"), and cross-race labels name the other seat. Ryu's challenge is
   stated on the 32nd Senate race; the 32nd House race links to it. The 2025
   Krishnadasan and Valdez race is stated on the 26th Senate race; the Valdez
   House race links to it. Field counts in the row are derived from the field,
   not separate facts. **Pass.**
2. **Nothing lost.** Every assertion in the source is reachable. Deliberately
   dropped: "But wait, there's more." (no fact). The source's doubled "in in"
   is corrected in Laitila's row and kept verbatim in the source sentences. The source gives two Senate splits, 30-19 in its opening and 29-20 in
   the 42nd District section; both are kept where they appear, and the second
   carries a visible note pointing at the first. No invented counts or dates:
   the filing deadline is shown as "Friday, 5 p.m." as the source says, and
   "next January" stays unconverted. **Pass.**
3. **Scent.** Race rows show seat, status, tags and the field by party, and the
   expand control reads "N candidates". Candidate controls name their headings
   ("Platform", "Committees", "Income tax vote"). Filters name the contest kind
   and count. The evidence control reads "Source sentences (n)". No "More" or
   "Details". **Pass.**
4. **Depth.** The race list (the answer) begins on the first screen. Race facts
   are one interaction away, candidate facts two; sources sit inside the race
   view. **Pass.**
5. **No empty slots.** Seat-situation, backers and candidate-view controls render
   only when they have content; the 29th Senate race says the article names no
   other candidates rather than showing an empty field; districts with no stated
   lean show no lean slot (11th). **Pass.**
