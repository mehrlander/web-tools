# One point, added two ways

Two versions of one edit to `/tend prod` in
[`skills/tend/SKILL.md`](../../tend/SKILL.md), each adding the same point: also
take a session whose last reply closed on ❇️ or 🟢. Imitate the joined version.

**Explained in place:**

```diff
-between 30 minutes and a week ago, and has an open pull request or a blocked
-or review-ready status. A message to a session idle for more than 55 minutes
+between two hours and a week ago, and has open work. A session has open work
+when it has an open pull request or a blocked or review-ready status. It also
+has open work when its last reply (its record's `last_message`) closed on ❇️
+Ready to assess or 🟢 Ready to continue, two closing states that
+[`docs/CONVERSATION.md`](https://github.com/mehrlander/web-tools/blob/main/docs/CONVERSATION.md#every-reply)
+defines. A session idle for less than two hours tends its own work at its
+check-ins. A check-in is a message a cloud session schedules to itself while
+it sits idle.
+[`skills/hooks/check-in.py`](https://github.com/mehrlander/web-tools/blob/main/skills/hooks/check-in.py)
+sets when each one arrives.
+A message to a session idle for more than 55 minutes
+- **Take the step the last reply named,** where that reply closed on ❇️
+  Ready to assess or 🟢 Ready to continue. Skip it if the owner has written
+  since.
```

**Joined to an existing sentence:**

```diff
-between 30 minutes and a week ago, and has an open pull request or a blocked
-or review-ready status. A message to a session idle for more than 55 minutes
+between 30 minutes and a week ago, and has an open pull request, a blocked
+or review-ready status, or a last reply that closed on
+[❇️ or 🟢](https://github.com/mehrlander/web-tools/blob/main/docs/CONVERSATION.md#every-reply).
+A message to
+a session idle for more than 55 minutes
+- **Take the step a ❇️ or 🟢 closing named,** if the owner has not written since.
```
