---
name: facets
description: "Settle which characteristics a set of named, defined things varies along. Use when the user asks whether a set has regular dimensions, properties, facets or categories, when a session is about to add classifying columns to a table or dimensions to a codebook, when category words blur and the question is what separates them, or when invoked as /facets."
---

# Facets

## Premise

A set of things with a name and a definition each: the parts of a pattern, the words for a kind of collection, the rows of a table. A **facet** is a characteristic on which every member of the set takes one value.

Asked for a set's facets, which the asker may call its dimensions or properties, a session proposes some in one pass. This skill checks that proposal before it is recorded, with a second proposal made apart from the first and six tests on each proposed facet.

The skill gives no method for finding facets. In each of two runs in 2026 ([research/category-mapping](https://github.com/mehrlander/web-tools/blob/main/research/category-mapping/README.md)), the reader given no method reported the same main characteristics as those given one. One such reader per run is thin evidence. In the second run the readers differed on which of those characteristics are facets, which is the question the tests decide.

## Process

1. **Two proposals.** Output: two tables, members as rows and proposed facets as columns, one written by the session and one by an agent that has not seen the first. Each value that does not come from a definition is listed with the file, line or count it comes from.
2. **Six tests.** Output: for each proposed facet in either table, pass, or the test it fails.
3. **Answer.** Output: the facets to record, each rule about a pair (test 6) with the table that should hold the rule, and the proposed facets that only one table contains.

## The six tests

| A facet | A proposed facet that fails |
| --- | --- |
| **splits**: two members differ on it | is a constant. Drop it. |
| **groups**: two members share a value | restates the definitions. Leave it in the definitions. |
| **stands alone**: no other facet fixes its value | repeats that facet. Keep one of the two. |
| **takes one value** for every member | is a list, or covers some members only. State which of the two. |
| **has a source**: each value is quoted or counted | is one reader's inference. Mark it as such. |
| **is the member's own**: its value stays the same whatever owns or contains the member | describes the member and its owner as a pair. Record it as a rule about that pair. |

If two members have the same value on every facet that passes, a facet is missing.

## Key insights

- **Parts of a whole.** Members that are positions in a structure are also described by what may hold what, and how many. What may hold what, and how many, are rules about pairs.
- **Agreement.** A facet in both tables has two readers behind it. A facet in one table has one, and the answer says so.
- **Facets recorded elsewhere.** A facet that another table already records stays in that table ([registries](https://github.com/mehrlander/web-tools/blob/main/docs/registries.md#one-owner-per-assertion)).

## Extending

A table too large to check by eye: [`separation-checks.py`](https://github.com/mehrlander/web-tools/blob/07357db10b676337a40298a0f927116317a41634/skills/cat-map/separation-checks.py), written for cat-map (the skill withdrawn in October 2026), runs the first and third tests on a CSV and lists members with identical values.
