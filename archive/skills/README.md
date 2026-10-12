# Skill archive

Retired skills created or adapted here. These folders are outside the active
library and plugin roster; the original instructions are kept as a record.
Third-party packages are tracked in [upstream skills](../../docs/upstream-skills.csv).

| Skill | Retired | Reason and current home |
| --- | --- | --- |
| [safe-html-templating](safe-html-templating/SKILL.md) | 2026-10-08 | HTML construction guidance now lives in [HTML mechanics](../../skills/html-style/references/mechanics.md#html-strings-and-embedded-data), with the shared [vanilla bundle](../../lib/vanilla-bundle.js) and its [demo](../../pages/demos/vanilla-bundle-demo.html). No separate kit corresponded to this skill. |

The original templating skill is preserved unchanged. Its binding example does
not validate URL schemes, and its window-storage workaround should not be read
as a general document-replacement guarantee. Use the maintained reference.
The [fills exploration](../../pages/drop/fills-concepts/CATALOG.md) records the
broader design discussion; [PR 510](https://github.com/mehrlander/web-tools/pull/510)
established the shared escaping helper.

The claude.ai upload must also be turned off under Customize. The account
declaration records that desired state; the session check reports an upload
that is still enabled. A repository change cannot toggle the account setting.
