# Step 2b: tag each unit from the job list

You will read two files:

1. **The job list**, one JSON object per line: a `tag`, its `gloss`, the `test`
   a unit must meet to take it, and `not`, the nearest other tag and how to tell
   them apart.
2. **The units**, one per line: `<unit id> <TAB> <jobs> <TAB> <summary>`, where
   jobs and summary are what another reader wrote about the unit's code.

For every unit, write one JSON object on its own line:

    {"id": "<the unit's id, copied exactly>", "tags": ["<tag>", ...]}

- Give a unit **every tag whose test it meets**, and no tag whose test it does
  not. There is no primary tag and no expected number.
- Use only tags from the list. If no tag fits, write `"tags": ["new:<proposed-slug>"]`
  and nothing else for that unit.

Write every unit, in the order given, and nothing else.
