# Browser workbook delivery: confirmed

The original PR 791 viewer's **Where this file also lives → Raw** action downloaded the exact workbook previously inspected in native Excel.

- Renderer revision: `5109699ac5eea3ca510947859ff9e5cb3980676e`.
- Browser: Microsoft Edge `153.0.4234.48`, 1440 × 1000 CSS pixels, device scale 1.
- Real request: `GET https://raw.githubusercontent.com/mehrlander/web-tools/5109699ac5eea3ca510947859ff9e5cb3980676e/docs/examples/demonstration-workbooks.xlsx`.
- Response: HTTP 200, `application/octet-stream`, 28,024 bytes.
- Download event: completed, `failure: null`.
- SHA-256 of both the native specimen and downloaded workbook: `998d5483e1dee7db4c14c9f17142842f5eba451825b33afefa5fc11f4c82be14`.

[Downloaded workbook](roundtrip-live-network-downloaded.xlsx) · [Live request and download evidence](roundtrip-live-evidence.json)

The page and application code were unchanged copies of the pinned revision, loaded through the original `data-view.html` entry point. Their dependency requests used a local cache. The successful workbook download request itself went to GitHub; it was not fulfilled from that cache. This establishes byte identity and browser delivery for this source link. It does not establish workbook correctness or rendering fidelity by itself.

## Investigation record

The first observation watched only the original page. The link opens a new target, and its initial navigation also needs browser-context request routing. The revised probe registers download listeners for both existing and newly opened pages, without altering the app.

The first corrected live attempt was denied by the execution sandbox (`net::ERR_NETWORK_ACCESS_DENIED`). A separately labeled local delivery test at the same URL then emitted a real browser download and preserved the original bytes. After network permission was granted, the root task reran the live request successfully. [Earlier blocked and local transport evidence](roundtrip-evidence.json) is retained separately from the successful live evidence.

The successful attachment navigation also generated `net::ERR_ABORTED` as navigation handed off to the browser download. HTTP 200, a completed download event, the byte count, and matching SHA-256 establish that this was not a failed download.

Task-owned browser contexts and the local HTTP server were closed after each run. No workbook or repository source was modified.
