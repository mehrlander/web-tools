---
name: office-scripts-shape-ui
description: "Build interactive UI inside Excel using Office Scripts bound to shapes. Use when the user wants a click-to-render card, a collapsible inspector, a master-detail view, or any pattern where clicking a shape reads a cell and displays structured info. Also use when fighting Office Scripts API quirks: cell-vs-shape fill methods, enum aliasing errors, Map generic parse failures, or the absence of selection-change events."
---

# Office Scripts Shape UI

Excel's drawing layer plus Office Scripts is a surprisingly capable UI shell. A shape acts as a button, a display surface, or both. State lives in the workbook itself: a hidden sheet, alt text on the shape, or the shape's own geometry. The framing line is **workbook is application state, shapes are event handlers, sheets are views**.

This skill covers three patterns and the constraints they all run into.

---

## The patterns

### 1. Button-and-display (one shape, click to render)

A single shape doubles as trigger and display. User selects a cell with an ID, clicks the shape, the script reads the cell, looks up the row in a table, and renders a formatted card into the same shape.

Simplest pattern. Good when the card is small, the lookup is fast, and the user doesn't need to navigate deeper.

Mechanics:
- One shape named something like `LookupCard`.
- Script reads `workbook.getActiveCell().getValue()`.
- Filters the table, renders text via `shape.getTextFrame().getTextRange().setText()`.
- Fill color signals state: gray for normal, amber for not found.

### 2. Collapsible toggle (one shape, two states)

The shape collapses to A1 as a small glyph and expands to a card on click. A second click in expanded state either collapses (same selection) or updates in place (different selection). All state lives in the shape itself.

Better than pattern 1 when the card is large enough to obscure the data, and the user wants to put it away between uses.

Mechanics:
- Shape width crossing a threshold (e.g. 150px) is the toggle signal. No state variable needed for the open/closed bit.
- Persistent state goes in `shape.getAltTextDescription()` as a delimited string. Recommended format: `MARKER|key1|key2|...`. The marker prefix lets you detect a fresh shape vs one with prior state.
- Expand position anchors to `cell.getTop()` plus an offset, which keeps the card near the active cell even after scrolling past a frozen header.
- Cell highlight via `cell.getFormat().getFill().setColor(...)`. Address stored in alt text. Cleared on next click using the stored address.

Logic at top of `main`:
1. Read shape width. Above threshold = currently expanded.
2. Read alt text. Parse stored key.
3. Read active cell. Decide: collapse, update, or first expand.
4. Branch into one of `collapse()`, `renderMessage()`, or `renderCard()`.

### 3. Master-detail (list shape + detail sheet)

For workflows with real hyperlinks, rich layout, or content too complex for a shape's attributed-string model. A shape on the list sheet acts as preview and trigger; a hidden detail sheet, populated by the same click, is the full record view. A Back button on the detail sheet hides it and reactivates the list.

The detail sheet is the escape hatch from every shape limitation. It has real hyperlinks, real layout, real cells. Use this when shapes can't carry the content.

Mechanics:
- List sheet with a table and one or two shapes (Preview, optional GO).
- Hidden `_State` sheet with `A1` = cached cell address, `A2` = current record key. Acts as a key-value store across clicks.
- Hidden `Detail` sheet, populated by the Preview script after rendering the preview text.
- GO script (or click on Preview, depending on intent) shows and activates the detail sheet.
- Back button on detail sheet: `setVisibility(ExcelScript.SheetVisibility.hidden)` on Detail, `activate()` on List. Excel restores sheet position naturally on reactivation.

### Which pattern fits

Use the collapsible toggle as default. It handles most "I want a card about this row" needs with a single shape, in-shape state, and no extra sheets.

Drop down to button-and-display if the card is small enough to leave always-visible.

Step up to master-detail when the content needs real hyperlinks, multi-column layout, formulas, conditional formatting, or any Excel feature that shapes don't support.

---

## State storage options

| Storage | Capacity | Visibility | Best for |
|---|---|---|---|
| Shape alt text | Short string | Hidden, per-shape | Toggle state, last-clicked key, cell address |
| Shape width/position | Boolean signal | Visible side effect | The collapsed-vs-expanded bit itself |
| Hidden `_State` sheet | Unlimited cells | Sheet, easily inspectable | Multi-shape coordination, debugging |
| Cell fill on data | Visual state | Visible on data sheet | Active-row highlight |

Alt text is the lightest. Use it whenever a single shape needs to remember something across clicks. Reach for `_State` when multiple shapes coordinate or when you want to inspect state by unhiding the sheet.

---

## Layout in shapes

Shapes are attributed strings, not box models. No flex, no nesting, no hyperlinks, no borders between substrings. The toolkit:

- **Cascadia Mono** for any grid-shaped content. Fixed character width is the only reliable way to align columns.
- **Segoe UI** when prose dominates and alignment doesn't matter.
- **Padded columns** via `padEnd(n)` / `padStart(n)` for left/right alignment. Truncate with an ellipsis at `n-1`:
```typescript
  const trunc = (s: string, n: number) => s.length > n - 1 ? s.slice(0, n - 1) + "…" : s;
  const padR = (s: string, n: number) => trunc(s, n).padEnd(n);
  const padL = (s: string, n: number) => trunc(s, n).padStart(n);
```
- **Width object** as the tuning surface: `const W = { col1: 16, col2: 24, ... }`. Total width drives shape width.
- **Unicode box drawing** for frames: `━` heavy, `─` light, `│ ┃ ╭ ╮ ╰ ╯` corners.
- **Unicode glyphs** as inline icons: `▸ ● ⚠ ⚖ → ←`.
- **Newlines** as the only layout separator. Design vertically.

For mixed-format content (bold title, gray metadata, accent status), use `textRange.getSubstring(start, length).getFont()` to style runs. Compute substring offsets with a cursor variable that advances as you concatenate.

Border radius is set at shape creation and cannot be changed by script. Pick `Rectangle` for square corners, `RoundedRectangle` for rounded. To get less rounding, create the shape as a `Rectangle`.

---

## Office Scripts constraints catalog

### API gotchas

**Cell fill vs shape fill use different method names.**
- Cell (range): `cell.getFormat().getFill().setColor("#FFF")`.
- Shape: `shape.getFill().setSolidColor("#FFF")`.

Crossing them throws "is not a function" at runtime, not parse time.

**Enum aliasing is forbidden.** This fails:
```typescript
const VA = ExcelScript.ShapeTextVerticalAlignment; // ERROR: Aliasing or assignment of Office Scripts APIs is not allowed
```
Inline the full path at the call site every time.

**Map generic parsing is fragile.** This often fails:
```typescript
const m = new Map<string, (string | number | boolean)[][]>(); // '=>' expected
```
Workaround: define a type alias first, or use a plain object:
```typescript
type RawRow = (string | number | boolean)[];
const m: { [key: string]: RawRow[] } = {};
```

**No viewport API.** Can't read scroll position, can't read screen size. Anchor to a cell instead: `cell.getTop()` and `cell.getLeft()` return worksheet coordinates that approximate where the user is looking.

**No selection-change trigger.** Click on a shape is the only event. Design around it: select cell, then click.

**No parameters from button-triggered scripts.** A script with parameters can only be invoked from Power Automate. Workaround: read a cell.

**Border radius is immutable.** Set at shape creation. Choose the shape type up front.

### Architecture gotchas

**CORS applies to `fetch`.** Office Scripts runs in a browser sandbox. Calls to APIs without permissive CORS headers fail. Workaround: Power Query fetches, Office Script reads from the resulting table.

**`fetch` is undefined in Power Automate.** External calls only work from button-triggered scripts in Excel directly. Power Automate flows need a different connector.

**`refreshAllDataConnections()` works from a button, not from Power Automate.** Known limitation.

**Excel for the Web no longer supports assigning scripts to arbitrary shapes.** Use the official Add-in-workbook button, or assign to shapes via the desktop client.

### Patterns that avoid the gotchas

- Read a cell instead of accepting a parameter.
- Anchor to a cell instead of trying to read the viewport.
- Group rows in a plain object instead of a `Map` with a union-typed value.
- Inline enum paths instead of aliasing.
- Pick shape geometry deliberately at creation.
- Let Power Query own all external fetches.

---

## Skeleton for the collapsible toggle pattern

```typescript
function main(workbook: ExcelScript.Workbook) {
  const CFG = {
    collapsedThreshold: 150,
    expanded: { left: 220, width: 820, height: 290, topOffset: 30 },
    collapsedFill: "#1F2937",
    collapsedGlyph: "▸",
    highlightFill: "#FFF59D",
  };

  const sheet = workbook.getActiveWorksheet();
  const box = sheet.getShape("MyCard");
  if (!box) { console.log("Shape 'MyCard' not found."); return; }

  // State from alt text
  const stateTxt = box.getAltTextDescription() || "";
  const state = stateTxt.startsWith("MARKER|") ? stateTxt.split("|") : null;
  const storedKey = state ? state[1] : "";
  const storedAddr = state ? state[2] : "";

  // Active cell intent
  const cell = workbook.getActiveCell();
  const newKey = String(cell.getValue() ?? "");
  const newAddr = newKey ? cell.getAddress() : "";

  const isExpanded = box.getWidth() > CFG.collapsedThreshold;

  // Collapse if same key clicked, or no key
  if (isExpanded && (!newKey || newKey === storedKey)) {
    clearHighlight(storedAddr);
    box.setAltTextDescription("");
    collapse();
    return;
  }

  // Update or first expand
  if (isExpanded) clearHighlight(storedAddr);
  if (!newKey) { renderMessage("Select a cell, then click."); return; }
  cell.getFormat().getFill().setColor(CFG.highlightFill);
  box.setAltTextDescription(`MARKER|${newKey}|${newAddr}`);
  renderCard(newKey);

  // Helpers: collapse, positionExpanded, renderMessage, renderCard,
  // paint, clearHighlight, stamp: see templates.
}
```

---

## When in doubt

The constraints look annoying in the abstract and shrink in practice. Most cards Marcus has built fit comfortably in the collapsible toggle pattern with a single shape, alt text state, and Cascadia Mono columns. Reach for the master-detail pattern only when the content genuinely needs real Excel features.
