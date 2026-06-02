# github

Everything about working *with GitHub itself* — both what its renderer can do
and how this repo treats git history and branches. Two strands that used to live
apart (`git-markdown.md` and `git-conventions/`), gathered here so there's one
place to point.

## What GitHub renders

- **[markdown.md](markdown.md)** — a gallery of what GitHub-flavored markdown
  turns into pictures, charts, and callouts when you view a `.md` on GitHub: no
  JavaScript, no build step. Mermaid diagrams, math, sparklines, alerts, the
  works.

## How this repo treats git

Durable notes behind the workflow rules in [CLAUDE.md](../../CLAUDE.md), kept
here so the rules have a place to point.

- **[post-merge-branch-mutation.md](post-merge-branch-mutation.md)** — why a
  merged branch should stop being a live workspace. Necromerging, zombie
  branches, and the rule of thumb: *merged means closed.*
