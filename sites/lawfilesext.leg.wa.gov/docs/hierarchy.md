# Washington State Legislative Bill Hierarchy Parsing

Parsing the hierarchical paragraph numbering in Washington State legislative documents (RCW, bills, session laws).

## The Hierarchy

| Level | Style | Examples | Ambiguous? |
|-------|-------|----------|------------|
| 1 | Section | `Sec. 1.` | No |
| 2 | Arabic | `(1)`, `(2)` | No |
| 3 | Lowercase letter | `(a)`, `(b)` | No |
| 4 | Lowercase Roman | `(i)`, `(ii)` | **Yes** |
| 5 | Uppercase letter | `(A)`, `(B)` | No |
| 6 | Uppercase Roman | `(I)`, `(II)` | **Yes** |

Nested structure:
```
Sec. 1.
  (1)
    (a)
      (i)
        (A)
          (I)
```

Citations often collapse: `(2)(a)(i)` or `(4)(c)(ii)(B)(II)`.

---

## The Ambiguity

### `(h)` → `(i)`

After `(h)`, is `(i)` the next letter or the first Roman numeral?

**Resolution:** Treat `(i)` as Roman unless it directly follows `(h)`. Use indentation or DOM structure to disambiguate.

### Overlapping Characters

| Char | Letter | Roman |
|------|--------|-------|
| `i/I` | 9th | 1 |
| `v/V` | 22nd | 5 |
| `x/X` | 24th | 10 |

Multi-character patterns are unambiguous: `(ii)`, `(iv)`, `(vi)` — clearly Roman.

Single letters `(c)`, `(d)`, `(l)`, `(m)` are almost always letters in practice — documents rarely nest deep enough for those Roman values.

---

## Stateful Parsing

Track `previous_marker` while walking the document:

```
function determineLevel(marker):
    if marker == "(digits)":   return 2
    if marker == "(a-h)":      return 3
    if marker == "(i)" and previous_marker == "(h)":
        return 3  // letter, not Roman
    if marker == "(i|ii|iii|iv|v|...)":  return 4
    if marker == "(A-H)":      return 5
    if marker == "(I)" and previous_marker == "(H)":
        return 5  // letter, not Roman
    if marker == "(I|II|III|IV|V|...)":  return 6
```

For compound markers like `(a)(i)`, parse all patterns and use the highest level.

---

## Roman Numeral Regex

Lowercase, up to 39:
```javascript
function isRomanNumeral(str) {
  str = str.replace(/[()]/g, '').toLowerCase();
  return /^(x{0,3})(ix|iv|v?i{0,3})$/.test(str) && str.length > 0;
}
```

Both cases, up to 3999:
```javascript
/^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i
```

---

## Implementations

### JavaScript Bookmarklet

```javascript
javascript:(function() {
  function isRoman(s) {
    return /^(x{0,3})(ix|iv|v?i{0,3})$/.test(s.replace(/[()]/g, '').toLowerCase());
  }

  function level(text) {
    const m = text.trim().split(' ')[0];
    if (/^\(\d+\)/.test(m)) return 0;
    if (/^\([a-z]\)/.test(m)) return isRoman(m) ? 2 : 1;
    if (/^\([A-Z]\)/.test(m)) return 3;
    return 0;
  }

  document.querySelectorAll('div').forEach(div => {
    div.style.marginLeft = (level(div.textContent) * 0.25) + 'in';
  });
})();
```

### PowerShell

```powershell
function Get-ParagraphLevel {
    param([string]$Text)
    $m = ($Text.Trim() -split ' ')[0]
    switch -Regex ($m) {
        '^\(\d+\)'    { 0 }
        '^\([a-h]\)'  { 1 }
        '^\([ivx]+\)' { 2 }
        '^\([j-z]\)'  { 1 }
        '^\([A-H]\)'  { 3 }
        '^\([IVX]+\)' { 4 }
        '^\([J-Z]\)'  { 3 }
        default       { 0 }
    }
}
```

---

## XML Structure

```xml
<Bill type="bill" xmlns="http://leg.wa.gov/2012/document">
  <BillHeading>
    <ShortBillId>SB 5322</ShortBillId>
    <Sponsors>Senators Wellman, Hasegawa...</Sponsors>
    <BriefDescription>...</BriefDescription>
  </BillHeading>
  <BillBody>
    <BillTitle>AN ACT Relating to...</BillTitle>
    <BillSection type="new|amendatory">
      <SectionCite>
        <TitleNumber>43</TitleNumber>.<ChapterNumber>88</ChapterNumber>.<SectionNumber>0301</SectionNumber>
      </SectionCite>
      <P>Paragraph content with (1)(a)(i) markers...</P>
    </BillSection>
  </BillBody>
</Bill>
```

The XML gives document structure, but paragraph-level hierarchy markers are embedded in text content — parsing requires text analysis.

---

## Color Coding

```javascript
const colors = {
  0: '#4A5568',  // (1), (2) — dark grey
  1: '#4299E1',  // (a), (b) — light blue
  2: '#2B6CB0',  // (i), (ii) — medium blue
  3: '#1A365D',  // (A), (B) — dark blue
  4: '#14274E'   // (I), (II) — darker blue
};
```

---

## Chat References

These are private links (author's working notes):

| Topic | Link |
|-------|------|
| Hierarchy table, `(h)→(i)` edge case, stateful algorithm | [Hierarchical HTML Color Coding](https://claude.ai/chat/afe1210d-fd29-4402-be86-878155cdb30a) |
| First bookmarklet, `isRomanNumeral()` | [Bookmarklet to Indent Legal Text Hierarchy](https://claude.ai/chat/302da947-cfac-4991-8933-c81fd269031e) |
| Compound patterns `(a)(i)`, sibling vs child tracking | [Adjusting Color Scheme](https://claude.ai/chat/27aab17d-7d63-404b-9282-2e5a58d9e55e) |
| Original hierarchy discussion | [Paragraph Structure in WA Legislation](https://claude.ai/chat/10f5a1b6-295c-4248-99a8-a12b9c7692b7) |
| XML schema mapping, `Get-BillMeta` | [Extracting bill metadata](https://claude.ai/chat/c142ef12-74de-4cfb-99f6-1faa91d8cb45) |
| JavaScript dual XML/HTM parsing | [Parsing bill data with JavaScript](https://claude.ai/chat/58d2c6aa-8762-4953-ae9c-58cedb54c19c) |

---

## Data Sources

| Source | URL |
|--------|-----|
| Static files | `lawfilesext.leg.wa.gov/biennium/{YYYY-YY}/Xml/Bills/` |
| Web services | `wslwebservices.leg.wa.gov/LegislationService.asmx` |
| HTM versions | Contain hyperlinked RCW refs not in XML |

---

## Future Work

- Full stateful parser tracking complete hierarchy path
- Validation mode flagging out-of-sequence markers
- Amendment diff visualization
- RCW graph integration