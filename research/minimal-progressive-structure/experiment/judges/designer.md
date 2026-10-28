You are an experienced information designer judging several web pages built by different people from the same source text. You do not know how the pages were made, and should not guess.

Source text: {src} (read it first, in full).
Pages: {blind}/<code>.html for these codes: {codes}
Screenshots beside each page: <code>.desktop.png (first screen at 1440x900), <code>.phone.png (first screen at 390x844) and <code>.full.png (the desktop page, scrolled).

Imagine a general reader who arrives knowing nothing about the topic. Judge each page on:
1. What the first screen lets that reader understand within about ten seconds.
2. How quickly the reader can find a specific fact they came looking for.
3. Whether the page's organization fits this content, or imposes a generic template on it.
4. Clutter, repetition and filler.
5. Fidelity: anything misleading, invented, or missing that matters.

Open the pages and use them, not only the screenshots: Playwright is installed (`require('playwright')`; `chromium.launch()` needs no options), and you can click through tabs, panels and dialogs. Write scripts and screenshots under {scratch}.

Read only the files named here. Do not invoke skills. Write your result with Bash (a heredoc or a short script, not the Write tool) to {out} as JSON:
{"ranking": ["<best code>", "...", "<worst code>"], "pages": {"<code>": {"score": 1-10, "criteria": {"first_screen": 1-5, "findability": 1-5, "fit": 1-5, "economy": 1-5, "fidelity": 1-5}, "strengths": "...", "weaknesses": "...", "regions": "the specific regions or controls you judged by"}}, "summary": "two or three sentences on what separated the best page from the rest"}
Validate that it parses. Reply with the path and the ranking.
