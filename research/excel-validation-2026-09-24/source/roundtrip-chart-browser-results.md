# PR 791 chart rendering: charts absent

The original PR 791 viewer opened the three-sheet chart fixture and displayed every source value, including zero, negative four, and the blank February line-chart value. It displayed none of the three charts.

The fixture package contains three native chart XML parts and three drawing XML parts. The pinned `xlsxKit` parsed no drawing objects and exposed no chart model. On each sheet, the rendered stage contained zero canvas, SVG, or image elements. The captures show the source grid alone:

- [Column case](roundtrip-chart-browser-column.png): 8, 0, −4, 12.
- [Line case](roundtrip-chart-browser-line.png): 2, blank, 7, 3, 9.
- [Scatter case](roundtrip-chart-browser-scatter.png): (0,0), (1,4), (4,1), (10,8).

[Machine-readable evidence](roundtrip-chart-browser-evidence.json) records the source text, object counts, successful module loads, renderer revision, and artifact identity. The renderer revision was `5109699ac5eea3ca510947859ff9e5cb3980676e`; the 13,637-byte fixture SHA-256 was `96e0742507ef118fe00639331ba4c6acb98fe42198acb45f7c60d42dbb951326`.

The unmodified `data-view.html` received the exact workbook bytes through its existing `#gz` local data-envelope input. No fake repository address or replacement rendering page was used. Original app source and dependencies were served from the task's local cache. Edge was `153.0.4234.48`, at 1440 × 1000 CSS pixels and device scale 1. The browser reported no page errors.

## Local-file delivery boundary

This local-envelope view has no GitHub/Raw/CDN file links and no XLSX download or rebuilding action. Its available modes are Raw, Sheet, Grid, and Structure. Source inspection confirms that Structure → Extract → Save writes an `.extract.json` data envelope; it does not write a rebuilt XLSX. No workbook re-export was invented or counted as a round trip. The separate native-preview delivery test covers download of the original chart workbook.

No workbook or renderer source was modified. The task-owned browser and server were closed after capture.
