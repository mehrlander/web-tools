# Skill archive

Retired skills created or adapted here. These folders are outside the active
library and plugin roster; the original instructions are kept as a record.
Third-party packages are tracked in [upstream skills](../../docs/upstream-skills.csv).

[`archive.csv`](archive.csv) lists each one: the date it was retired, why, and
the file that now carries its guidance. The Map view's Skills tab renders it at
the foot of Yours.

**safe-html-templating.** The original skill is preserved unchanged. Its binding example does
not validate URL schemes, and its window-storage workaround should not be read
as a general document-replacement guarantee. Use the maintained reference.
The [fills exploration](../../pages/drop/fills-concepts/CATALOG.md) records the
broader design discussion; [PR 510](https://github.com/mehrlander/web-tools/pull/510)
established the shared escaping helper.

The claude.ai upload must also be turned off under Customize. The account
declaration records that desired state; the session check reports an upload
that is still enabled. A repository change cannot toggle the account setting.
