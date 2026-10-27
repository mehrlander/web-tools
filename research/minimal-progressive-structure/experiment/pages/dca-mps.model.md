# DCA25MA108 page: the model before the page

Source: NTSB Aviation Investigation Preliminary Report DCA25MA108, the midair collision
near Ronald Reagan Washington National Airport on January 29, 2025
(`experiment/sources/dca.txt`). Page: `dca-mps.html`, which carries this model as its
inline data (`MODEL` in the page script).

## 1. Governing question and root

**Question.** "What happened when an Army helicopter and a passenger jet collided near
Reagan National Airport, and what has the NTSB established so far?"

**Root: the accident** (the collision, DCA25MA108), not either aircraft and not the
investigation.

The judgment about the reader: a general reader arrives knowing the headline. They want
the outcome, who the two aircraft were, and how two flights on two radio frequencies came
to the same point over the river, minute by minute. That makes the accident's event
sequence the body of the answer. Wreckage examination, recorder hardware, crew
experience, the tower's staffing and the explanations of TCAS and ADS-B matter to the
curious reader but not to the question's first answer, so each sits one step away on the
thing it is about.

## 2. Entity model

### Entity types, fields, and whether each earns a view

| Type | Instances | Own fields | Earns a view? |
|---|---|---|---|
| Accident (root) | 1 | accident number; date and time; location; coordinates; light and weather condition (night VMC); damage (both destroyed); outcome per flight (64 aboard 5342 killed, 3 aboard PAT25 killed); report status | root |
| Flight | 2: Flight 5342, PAT25 | callsign; aircraft make and model; registration; category; operating certificate; rules flown under; flight plan; departure; destination; purpose; composition aboard; report data-table injury categories; medical examination; collision-avoidance equipment; autopilot; fire and explosion (unknown) | yes |
| Crew member | 5 (captain, first officer; instructor pilot, pilot, crew chief) | flight; role; certificate or rank; total hours; hours in make and model; medical certificate; seat or duty | no: every fact fits its row |
| Recorder | 2 (one per flight) | make and type; recovered by; audio length and quality; data parameters; design limits; invalid pressure altitude (PAT25) | no: part of its flight, shown as a section of the flight view |
| Wreckage | 2 (one per flight) | position from runway 33; overall condition; per-structure findings; items retained | no: part of its flight, an outline that expands in place |
| Event | 34 before the collision, 4 after | time; lane (Flight 5342, ATC, PAT25); what happened; measured values (altitude, speed, separation); seconds before impact where the source states them; reception caveat; instrument the source names (CVR, FDR, ATC) | no: every fact fits its row |
| Collision moment | 1 | per flight: radio altitude, pitch, roll, vertical speed, lights illuminated, what happened immediately after; evidence (FDR, video) | no: part of the root, shown in place in the sequence |
| Operator | 2: PSA Airlines; Bravo Company, 12th Aviation Battalion (US Army) | ownership or parent; base; certificate; fleet; mission; data-table name | yes (facts of its own) |
| Control tower | 1: DCA tower | cab orientation; operation mode; staffing; open and combined positions; the frequency each flight used; who could hear whom | yes |
| Airport | 1: DCA | location; operator (MWAA); traffic rank; noise rule; runway count; runway 33 PAPI | yes |
| Runway | 2 strips: 1/19, 15/33 | length; width; use rank; arrival and departure shares 2018 to 2024 | no: rows in the airport view |
| Helicopter route system | 1: Routes 1 and 4 | what route charts are (FAA Order 7210.3EE); chart name; no lateral boundaries; where restrictions are documented | yes |
| Waypoint | 9 across the two routes | name; description; reporting point; altitude change | no: steps in the route view |
| TCAS | 1 | definition; mandate; alert types and voice annunciations; low-altitude inhibitions; operation on the CRJ | yes (facts of its own, relations to flight 5342, an event, the encounter history) |
| ADS-B | 1 | definition; which track source the report used | yes (relations to both flights) |
| Encounter history at DCA | 1 | 2011 to 2024 findings; October 2021 to December 2024 counts | yes |
| Recovery operations | 1 | water depth; survey; recovery responsibility; hangar; divers who recovered remains | yes |
| Investigation | 1 | accident number; class; investigator in charge; on-scene presence; data sources; participants; investigative groups | yes |
| Participant | 14 | organization; role; representative | no: rows in the investigation view |
| Safety action | 2 | date; issuer; action; NOTAM terms | no: rows in the root sequence, NOTAM terms expand in place |
| Weather observation | 1 | station and elevation; time; distance; temperature and dew point; sky; ceiling; wind; visibility; altimeter | no: part of the root, a field group |

### Collections

- **Flights** (comparison): Flight 5342, PAT25. Columns: operator, aircraft and registration, from and to, purpose and rules, aboard and outcome.
- **Events** (sequence): 38 rows in four phases (departure and en route; converging along the river; the last two minutes; emergency response), with the collision moment between the third and fourth.
- **Crew** (member, per flight): columns role, certificate or rank, total hours, hours in type, medical, seat or duty.
- **Collision moment** (comparison): fields radio altitude, pitch, roll, vertical speed, lights, immediately after; one column per flight.
- **Runways**, **waypoints** (two sequences), **participants**, **investigative groups**, **recovery divers**, **retained items** (per flight), **safety actions** (sequence).

### Relations and their kinds

| From | To | Kind |
|---|---|---|
| Accident | events | sequence |
| Accident | flights | member, shown as comparison |
| Accident | collision moment | part (a comparison of the flights at one instant) |
| Accident | weather observation | part |
| Accident | safety actions | sequence |
| Accident | tower, routes, TCAS, ADS-B, airport, encounter history | reference (context) |
| Accident | recovery operations, investigation | reference |
| Flight | crew | member |
| Flight | recorder, wreckage | part |
| Flight | operator | reference |
| Flight 5342 | TCAS, ADS-B, airport (destination) | reference |
| PAT25 | ADS-B, routes | reference |
| Flight | tower | reference (the frequency fact lives on the tower) |
| Airport | runways | member |
| Airport | tower | part |
| Route system | Route 1, Route 4 | part, each a sequence of waypoints |
| Investigation | participants | member |
| Investigation | investigative groups | part |
| Event, collision fields | instrument (CVR, FDR, ATC, video) | evidence |

### Placement decisions (forms 2 and 3)

- The frequency each flight used is a fact about the pairing of flight and tower, so it lives in the tower view; a flight view shows the tower as a label carrying the frequency.
- Altitude, pitch, roll, lights and breakup at the moment of collision are facts about the pairing of flight and collision, so they live on the collision moment in the root, compared side by side.
- Runway arrival shares come from the source's near-midair section but are about runways, so they live in the airport view.
- Each wreck's distance from runway 33 is about that wreck, so it lives in the flight view; the recovery view shows it only inside the flight's label.
- Medical examination facts are about each flight's occupants, so they live in the flight views.
- Who was flying PAT25 changed during the flight, so it lives on the events (20:30 and the change of control after 20:32); the crew table carries only seats.
- PAT25's passage times at bridges and Hains Point are events; the route view shows them only as time labels on waypoints.
- Recorder recovery (FBI dive team; DC Metropolitan Police) is about each recorder, so it lives in the flight view, not the recovery view.
- Operator facts (PSA fleet and parent; the Army company's mission), system explanations (TCAS, ADS-B) and tower staffing reach the accident only through another thing, so each lives on that thing and the root holds a label.
- The altimeter setting the tower issued (29.89) is an event; the Kollsman readings (29.88 to 29.89, 29.87) are PAT25 wreckage findings; the 29.9 inHg reading is the weather observation. Each stays on its owner, and the page draws no comparison the source does not.

## 3. Projection table

| Type | Label (qualifier chosen per place) | Row fields | View sections, in order |
|---|---|---|---|
| Accident | (root) | (root) | Answer: headline sentence, when, where, conditions, damage, report status. The two flights as rows. Event sequence as a three-lane timeline (Flight 5342, ATC, PAT25) with the collision moment as a side-by-side comparison. Context labels. After the collision: recovery and investigation labels, safety-action sequence. Weather observation and coordinates. Report source. |
| Flight | callsign + operator and type; on the root "64 aboard, all killed" or "3 crew aboard, all killed"; in the tower view its frequency; in the recovery view its wreck position | operator; aircraft and registration; from and to; purpose and rules; aboard and outcome | The flight (identity, rules, plan, route, radio as a tower label, operator as a label). Crew table. Everyone aboard (composition, data-table categories, examinations). Equipment (TCAS and ADS-B as labels). Flight recorder. Wreckage examination as an outline expanding per structure. Report sections. |
| Crew member | role | role; certificate or rank; total hours; hours in type; medical; seat or duty | none |
| Event | time + lane | time; lane; text; value chips; seconds before impact (source-stated); caveat; instrument chips; gap from the previous timed event | none |
| Collision moment | (in place) | one row per field, one column per flight | none |
| Operator | name + parent or unit | (none: no collection shown) | Facts; flight it operated (label); report sections |
| Control tower | "DCA control tower" + "positions combined; separate frequencies" on the root | | Setup (cab, operation, staffing, combined positions). Frequencies, keyed by flight labels. Who could hear whom. Airport label. Report sections. |
| Airport | name + runway 33 share on the root | | Facts. Runways table. Runway 33 PAPI. Tower label. Report sections. |
| Route system | "Helicopter Routes 1 and 4" + ceiling qualifier | | Route 1 waypoints (sequence, PAT25 time labels). Route 4 waypoints. What route charts are. Boundaries. PAT25 label. Report sections. |
| TCAS | name + low-altitude inhibition qualifier | | What it is. Two kinds of alert. Close to the ground on descent (threshold steps). On the CRJ. Labels: Flight 5342, encounter history. Report sections. |
| ADS-B | name + "equipment on both aircraft" | | What it is. On the two aircraft (labels). In this report (track sources). Report sections. |
| Encounter history | "Close calls at DCA" + 15,214 count | | 2011 to 2024 findings. October 2021 to December 2024 counts. Labels: airport, TCAS. Report sections. |
| Recovery operations | name + depth qualifier | | The site. Where each wreck lay (flight labels). Divers who recovered remains. Report sections. |
| Investigation | name + class and investigator | | Facts. Participants table. Investigative groups. Report sections. |
| Safety action | (row) | date; issuer; action; NOTAM terms (expand in place) | none |
| Weather observation | (field group on the root) | | none |

Mechanisms: sequence as a timeline whose rows sit in the acting party's lane, with the interval to the previous second-precise event shown and the source's own "N seconds before impact" marked; comparison as two columns with each field on the same row; member as tables; part as an outline that expands in place (wreckage, NOTAM terms); reference as a label button that pushes the referenced view onto a side panel with a back control naming the previous view; evidence as instrument chips on the event or field.

## 4. Checks

1. **No duplicates.** Each fact is written in full once. Copies appear only inside labels: the flight labels' "64 aboard" and "3 crew" qualifiers outside the root, the frequency on the tower label inside each flight view, each wreck's distance on the flight labels inside the recovery view, the PAT25 time labels on route waypoints, the "equipped" qualifiers on TCAS and ADS-B labels, and the qualifiers on the root's context labels (route ceiling, runway 33 share, 15,214 occurrences, the TCAS inhibition), each chosen because it bears on the question at that spot. The headline sentence names the flights at label level and says everyone aboard was killed; the counts are written once, on the flight rows. The summary time "about 20:48" and the timeline's "about 20:47:59" are the source's two precisions of the same moment and are kept as stated. Seats appear only in the crew table and who was flying only in the timeline.
2. **Nothing lost.** Dropped on purpose: the seven figures and their captions (the images are not in the source text; Figure 1's convention, blue for flight 5342 and orange for PAT25, is kept as the lane colors); form fields the source leaves blank (Amateur Built, Operator Designator Code, Ground Injuries); the sentences that only point at a figure. Kept as stated rather than reconciled: the data table's make "Bombardier Inc." beside the narrative's "MHI RJ Aviation (formerly Bombardier)"; the data table's PAT25 injury split (2 crew, 1 passenger) beside the narrative's "all 3 crew members"; "MVFR" in the data table beside the narrative's visual flight rules plan. Spelling corrected: "Staff Sargeant" shown as Staff Sergeant. Every other source fact has a path.
3. **Scent.** Controls and what they name: the flight row buttons ("Crew, recorders and wreckage of flight 5342", "Crew, recorder and wreckage of PAT25"); lane headers (open that flight, or the DCA tower); each context label names its subject and carries a qualifier; each phase toggle names the phase and its time span; each wreckage part names the structure ("Left wing: slash marks and black paint transfer"); the NOTAM toggle reads "Show NOTAM terms: altitudes, exceptions, expiry"; the two event links name their target and what it adds ("Helicopter Routes 1 and 4: the route and its altitude limits", "TCAS: how its alerts work near the ground"); the panel's back control reads "Back to <previous view>" and the other control "Close". No control says "More" or "Details".
4. **Depth.** The headline answer, when, where and outcome sit on the first screen at phone and desktop widths, and the two flights follow it. Every fact is at most two interactions from the root: one to open a neighbor's view; a second to expand a wreckage structure, the NOTAM terms, or a reference inside a view (operator from flight; airport from tower). The timeline is open by default; its phases can be collapsed.
5. **No empty slots.** Crew members, events, runways, waypoints, participants and safety actions get no views; recorders and wreckage get no separate views; no view carries a sources level beyond its list of report sections, because the source gives no quotations beyond the facts themselves. In the collision comparison a field the source gives for only one aircraft shows a dash for the other, which keeps each field on one row as the comparison mechanism requires; the dash carries screen-reader text, "Not given in the report".
