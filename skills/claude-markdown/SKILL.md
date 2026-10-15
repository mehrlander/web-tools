---
name: claude-markdown
description: "How the Claude app displays Markdown in a chat reply. Use before showing proposed wording or any other change in a reply, laying out a table in a reply, or giving the reader text to copy, and when a reply displayed wrong on the reader's screen."
---

# Claude Markdown

## Premise

The Claude app renders chat Markdown its own way, not as GitHub does ([GFM](https://github.com/mehrlander/web-tools/blob/main/docs/github/markdown.md)). Some elements fail without an error, and some workarounds add color and emphasis where Markdown does not reach. Measured by screenshot on the phone app and on desktop, which differ.

## Goal and output

Behavior only; the skill produces no file. It describes how the app displays what a formatted reply uses: tables, diffs, and formatted blocks the user can copy.

## Process

Reference only. Read before writing such a reply.

## Key insights

- **Tool steps** (`Edit`, `Bash`): collapsed to one line, the file with its +/− counts or the command's description. The output is hidden.
- **Prose:** `~~old~~` strikes through and `**new**` bolds, in the body font. HTML tags such as `<del>` show raw. Inline code gets a grey pill on desktop and none on the phone.
- **Lists:** each item carries paragraph margin, and nesting compounds it. Tables and fenced blocks stay tight.
- **Tables:** a cell trims leading space, nbsp and tab; a code span, U+2800 or a visible glyph holds an indent. `<br>` breaks a line in a cell. A fenced block cannot sit in a cell, and a code span there has no copy button. The header row renders bold and keeps its height when empty.
- **Fenced blocks:** each has a copy button, copies raw text, and applies no Markdown. The language name after the opening backticks picks the coloring: `diff` colors `+` and `-` lines and leaves the file header and `@@` lines plain; `markdown` colors heading lines (blue on desktop, red on the phone) and colors bracketed text green when `()` follows, inside a heading too; an unknown name gives plain text.
- **Unicode letters:** bold and italic letters (𝗯𝗼𝗹𝗱, 𝘪𝘵𝘢𝘭𝘪𝘤) render anywhere, blocks included, but search, copy targets and screen readers do not read them as letters. A combining strikethrough lands one character to the right.

## Extending

On a client not yet measured, re-probe an entry before relying on it, and name the client beside the result.
