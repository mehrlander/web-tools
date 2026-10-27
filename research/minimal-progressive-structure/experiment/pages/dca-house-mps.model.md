# DCA25MA108 page: model

Source: `experiment/sources/dca.txt` (NTSB preliminary report, midair collision near
DCA, January 29, 2025). Page: `dca-house-mps.html`. The page's inline `MODEL` object
is this model as data.

## 1. Governing question and root

**Question:** How did an airliner landing at Reagan National and an Army helicopter
flying a river route come to collide, and what has the preliminary investigation
established so far?

**Root:** the accident, DCA25MA108 (the collision event). The reader arrives with an
event, not a set to choose from, so the root is the single accident and not the
pair of aircraft. The answer is the converging sequence of the two flights; the
pair of aircraft is the root's first neighbor (a comparison collection), and the
setting (routes, tower, airport, TCAS) is reached by reference.

## 2. Entity model

### Entity types and fields

| Type | Fields |
|---|---|
| Accident (root) | report number, date, time of collision, location, fatalities (by aircraft), damage, conditions (weather group), investigation class, status |
| Aircraft (collection of 2: flight 5342, PAT25) | callsign, make/model, registration, category, operator (ref), operating rules, certificate, purpose, origin, destination, flight plan, tower frequency (ref to tower), aboard, fatal, equipment, lights lit before collision, recorders (part), wreckage (part), retained items |
| Crewmember (collection of 5) | aircraft, role, rank, certificate, total hours, hours in make/model, medical or currency, seat or control role |
| Timeline event (sequence of 32 + collision) | clock time, approximate flag, lane (5342 / tower / PAT25), text, seconds-before-impact where the report gives it, separation where given, references |
| Recorder set (part of aircraft) | unit, recovered by, voice, flight data, limits |
| Wreckage (part of aircraft) | where found, components (outline), retained for examination |
| Operator (reference) | PSA Airlines: parent, base, certificate, fleet. 12th Aviation Battalion, Bravo Company: base, mission |
| DCA tower (reference) | cab orientation, operation, staffing, combined positions, frequencies, who hears whom |
| Helicopter route chart (reference) | chart purpose (FAA Order 7210.3EE), lateral boundaries, waypoint sequence of Routes 1 and 4 with altitude limits |
| Airport, DCA (reference) | location, operator, rank, noise routing, runways (collection: end, length x width, arrival and departure share), runway 33 PAPI |
| TCAS (reference) | definition, mandate, TA and RA, descent thresholds, CRJ manual description, voice annunciations |
| ADS-B (reference) | FAA description |
| Encounter record (part of accident) | 2011-2024 report findings; Oct 2021-Dec 2024 operations and proximity counts |
| Emergency response (part) | sequence (20:48-20:59), site and wreckage recovery, diving agencies (collection), medical examination (collection) |
| Investigation (part) | IIC, class, on-scene facts, participants (collection: organization, role, person), groups (collection), safety actions (sequence), status |

### Relations and kinds

| From | To | Kind |
|---|---|---|
| Accident | weather facts, date, location, fatalities | attribute |
| Accident | timeline events | sequence |
| Accident | aircraft pair | member (comparison) |
| Aircraft | the other aircraft | comparison |
| Aircraft | crewmembers | member |
| Aircraft | recorders, wreckage components | part |
| Aircraft | operator | reference |
| Aircraft | tower frequency | reference (tower) |
| Aircraft | ADS-B, TCAS | reference |
| Timeline event | route chart, tower, DCA (runway 33), TCAS | reference |
| Route chart | Route 1, Route 4 waypoints | part, in sequence |
| Airport | runways | member |
| Accident | encounter record, response, investigation | part |
| Investigation | participants, groups | member |
| Investigation | safety actions | sequence |
| Timeline, routes, encounter record, recorders | basis passages from the report | evidence |

### Earned views (decisions)

- **Earn a view:** the accident (root), the aircraft pair (as a comparison), and seven
  references: PSA Airlines, the Army unit, DCA tower, the helicopter route chart,
  DCA airport, TCAS, ADS-B. Each has facts beyond its name.
- **Routes 1 and 4** are parts of one chart view rather than two views: the reader
  follows them as one continuous path (PAT25 requested "Route 1 to Route 4"), and
  each route's facts are a run of waypoints in that path.
- **Crewmembers** stay rows in one table: a crewmember's row already holds every
  fact the report gives about them, so a separate view would repeat the row.
- **Values only:** flight attendants and passengers (counts), Potomac Approach,
  night vision goggles, the diving agencies, investigative groups, wreckage
  components (outline items inside the aircraft's wreckage part).

## 3. Projection table

| Type | Label | Row fields | View sections |
|---|---|---|---|
| Accident | DCA25MA108 · date · 67 fatal | n/a (root) | header line; lede; timeline ending in the collision; weather (background, after the timeline); then tabs Aircraft, Encounters at DCA, Response, Investigation |
| Aircraft | callsign · type · operator · origin to destination (lane heads, column heads) | the comparison fields below | Aircraft tab: aircraft and operator; flight; aboard; crew table; equipment and lights; recorders; wreckage outlines; retained items |
| Crewmember | n/a | aircraft, role, rank, certificate, total hours, in make/model, medical or currency, seat or role | (row only) |
| Timeline event | n/a | time (+ seconds before impact), lane, text, separation | (row only; references inside it open views) |
| Operator | name | n/a | dialog: parent/base/certificate/fleet, or base/mission |
| DCA tower | "DCA tower", qualifier "2 frequencies"; frequency labels in Aircraft tab | n/a | dialog: cab, operation, staffing, combined positions, frequencies, hearing |
| Route chart | "Route 1", "Route 4", with an altitude-limit qualifier at Memorial Bridge | waypoint, note, max altitude | dialog: waypoint path, chart purpose, boundaries, basis |
| Airport | "runway 33" | runway table: end, runway, length x width, arrivals, departures | dialog: location, operator, rank, noise routing, runways, PAPI |
| TCAS | "TCAS" | n/a | dialog: what it is, mandate, advisories, descent thresholds, CRJ manual, basis |
| ADS-B | "ADS-B out" | n/a | dialog: FAA description, basis |
| Encounter record | tab "Encounters at DCA" | proximity table: lateral, vertical, count | tab: reported encounters 2011-2024; proximity counts 2021-2024 |
| Response | tab "Response"; timeline end link "Emergency response from 20:48" | sequence rows; agency list; exam table | tab: sequence; site and wreckage recovery; diving agencies; medical examination |
| Investigation | tab "Investigation" | participants table; groups list | tab: status; safety actions; participants; groups |

**Sources level.** Each view carries a "Basis" line naming the report's stated data
source (recorders and ATC data for the timeline; voluntary reporting and FAA data
for the encounter record; FAA publications for TCAS, ADS-B and routes), plus the
report link in the header. Per-fact quotations are left out (check 5): the rows
use the report's wording closely, so a quotation would repeat the row.

**Mechanisms.** Sequence: a three-lane timeline (5342, tower, PAT25), time in a
gutter, vertical gap proportional to seconds for gaps up to a minute and a labeled
break beyond. Comparison: two aligned columns, each field on one row. Member:
tables. Part: tabs for the root's sections; `<details>` outlines for wreckage
components. Reference: underlined labels opening one shared dialog. Evidence: the
"Basis" line, and the accent marks the words the helicopter's recorder shows PAT25
may not have received ("circling", "pass behind the").

**Accent.** One colour, one meaning: words of a tower transmission that may not
have reached PAT25. The two aircraft are told apart by position (lane, column) and
by badge style (5342 filled, PAT25 outlined, tower ghost), held the same in every
view.

## 4. Checks

1. **No duplicates.** Each fact has one home. Departure times, control changes and
   seat-independent events live only in the timeline; seats and pilot-flying for
   the whole flight live in the crew table. Frequencies live in the tower view;
   the Aircraft tab shows them only inside labels. At-collision attitudes live in
   the timeline's collision row, not the comparison. Copies inside labels: aircraft
   type and origin-destination in lane heads (identifying); "200 ft msl maximum
   from here" in the Memorial Bridge label (bears on the question at that spot);
   "2 frequencies" in the tower lane head. The two source lists of participants
   (parties; participating persons) merge into one table.
2. **Nothing lost.** Dropped, by decision: the seven figures and their captions
   (the source omits the images; the captions carry no fact beyond their text,
   except Figure 6 calling the slashed slat "left outboard" where the body says
   "left center", and the page follows the body); blank form fields (amateur
   built, operator designator code, ground injuries). Kept with a note where the
   report's data tables disagree with its prose: PAT25's flight plan (prose VFR,
   table MVFR) and its fatality split (prose: all 3 crew; table: 2 crew, 1
   passenger). Everything else is reachable.
3. **Scent.** Tabs name their content ("Timeline", "Aircraft", "Encounters at
   DCA", "Response", "Investigation"); reference labels name the thing they open;
   wreckage summaries name the component; the timeline's last control names
   "Emergency response from 20:48". No "More" or "Details".
4. **Depth.** First screen: header line (date, time, 67 fatal), the lede (what
   collided where), and the start of the timeline; weather follows the collision
   row as background, so it does not push the timeline off a phone screen. Reference views are one
   tap from the timeline and two from other tabs (tab, label); wreckage
   components are two (tab, expand). Nothing deeper.
5. **No empty slots.** No per-crewmember or per-event view; no per-fact quotation
   level; no stat tiles; a comparison field missing on one side reads "none
   reported" only for recorder limits, where the absence is itself a contrast;
   footer omitted (single page, no paging).
