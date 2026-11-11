---
name: facets
description: "Check the facets proposed for a set, also called its dimensions or properties, before they are recorded. Use when asked whether a set has regular dimensions, properties, facets or categories, before adding classifying columns to a table, or when category words overlap."
---

# Facets

## Premise

A set has members, each with a name and a definition. A facet is a characteristic on which every member takes one value.

A session can propose facets from one reading. This skill checks the proposal before it is recorded.

The skill has no method for finding facets. In two tests, a reader with no method reported the same candidate facets as readers given one ([research/category-mapping](https://github.com/mehrlander/web-tools/blob/main/research/category-mapping/README.md)).

## Process

1. **Propose.** Write the facets as a table: members in rows, facets in columns.
2. **Propose again.** Ask an agent that has not seen the table to write its own.
3. **Test.** Run the six tests on every facet in either table.
4. **Answer.** List the facets to record, the rules from test 6, and the facets only one table has.

## The six tests

1. **Splits.** Two members differ on it. If none do, it is the same for every member: drop it.
2. **Groups.** Two members share a value. If none do, it repeats the definitions: drop it.
3. **Stands alone.** No other facet sets its value. If one does, keep only one of the two.
4. **One value.** Every member takes one value. If not, name each member with none or several.
5. **Sourced.** Each value is quoted from a file or counted. If not, mark it as a guess.
6. **Its own.** The value is the same whatever owns the member. If it changes with the owner, record it as a rule about the member and its owner.

If two members match on every facet that passes, a facet is missing.

## Extending

For a table too large to check by eye, [`separation-checks.py`](https://github.com/mehrlander/web-tools/blob/07357db10b676337a40298a0f927116317a41634/skills/cat-map/separation-checks.py), from the withdrawn cat-map skill, runs tests 1 and 3 on a CSV and lists members that match.
