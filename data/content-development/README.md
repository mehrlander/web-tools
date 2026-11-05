# Content development: worked examples

Worked examples of how pieces of content in web-tools and home moved between
forms, each a dated path of points. The Map's
[Docs → Development](https://mehrlander.github.io/web-tools/app/?view=map&tab=development)
subview draws them. [`docs/content-development.md`](../../docs/content-development.md) states
the frame and when each move is worth making.

## The two files

[`scales.csv`](scales.csv) defines the two scales a point sits on, `held_as`
(how the content is held) and `shown_in` (where a reader meets it), one row per
level, least held or farthest from an app first.

[`paths.csv`](paths.csv) has one row per point:

| Column | Holds |
| --- | --- |
| `example` | The example's display name, the same on each of its points. |
| `seq` | The step number, 1 to n within the example, in date order. |
| `date` | When the point became true, `YYYY-MM-DD`, or `YYYY-MM` where only the month is known: the commit that added the file or wired the view. |
| `held_as`, `shown_in` | The point's level on each scale. |
| `state` | `done`, or `proposed` for a next move no one has made. Proposed points come last. |
| `evidence` | The file that shows the point, as `repo:path`, or `repo:path@sha` for a file since removed. |
| `move` | For step 1, where the content came from; for later steps, what moved it there. |

## How a point is placed

A point is placed by what the files show. A page whose payload is an excerpt
index over Markdown is still held as prose. Records count as checked only when a
committed check, run by a suite, holds the display or its payload to them. A step
that changes neither scale (a corpus adding pages, say) is a point of its own
only when the example's history needs it.

[`node/test/content-development.test.mjs`](../../node/test/content-development.test.mjs)
holds the two files to each other: levels exist, steps run in date order,
evidence parses, and a web-tools evidence path exists. Nothing else is gated.
