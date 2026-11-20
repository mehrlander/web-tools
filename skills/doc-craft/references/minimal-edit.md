# One point, added two ways

One documentation edit in two versions, for a session about to add a point to a
document it did not write. Both versions add the same point to `/tend prod` in
[`skills/tend/SKILL.md`](../../tend/SKILL.md). The command should also take a
session whose last reply closed on ❇️ Ready to assess or 🟢 Ready to continue.
That session should take the step its reply named. The second version is the
one to imitate.

## Explained in place

```diff
@@ -164,8 +164,17 @@ reading and triggers nothing.
 
 `/tend prod` asks each session with open work to tend its own work. List the
 account's sessions and take each one that is idle, last showed activity
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
 makes it write its whole context to the prompt cache again
 ([`docs/environment/container.md`](https://github.com/mehrlander/web-tools/blob/main/docs/environment/container.md#the-prompt-cache)).
 Leave out a session idle that long whose usage record (`sessions/usage/` in
@@ -208,6 +217,9 @@ report what each session left waiting on the owner.
 A session that receives it works through whichever of these apply, under the
 principles above:
 
+- **Take the step the last reply named,** where that reply closed on ❇️
+  Ready to assess or 🟢 Ready to continue. Skip it if the owner has written
+  since.
 - **Land what is already approved,** up to a pull request ready to merge:
   merge main into the branch, fix conflicts and failing checks, sync the
   body.
```

## Attached to what the document holds

```diff
@@ -164,8 +164,11 @@ reading and triggers nothing.
 
 `/tend prod` asks each session with open work to tend its own work. List the
 account's sessions and take each one that is idle, last showed activity
-between 30 minutes and a week ago, and has an open pull request or a blocked
-or review-ready status. A message to a session idle for more than 55 minutes
+between 30 minutes and a week ago, and has an open pull request, a blocked
+or review-ready status, or a last reply that closed on
+[❇️ or 🟢](https://github.com/mehrlander/web-tools/blob/main/docs/CONVERSATION.md#every-reply).
+A message to
+a session idle for more than 55 minutes
 makes it write its whole context to the prompt cache again
 ([`docs/environment/container.md`](https://github.com/mehrlander/web-tools/blob/main/docs/environment/container.md#the-prompt-cache)).
 Leave out a session idle that long whose usage record (`sessions/usage/` in
@@ -208,6 +211,7 @@ report what each session left waiting on the owner.
 A session that receives it works through whichever of these apply, under the
 principles above:
 
+- **Take the step a ❇️ or 🟢 closing named,** if the owner has not written since.
 - **Land what is already approved,** up to a pull request ready to merge:
   merge main into the branch, fix conflicts and failing checks, sync the
   body.
```

## What changed between them

- The point became a third alternative in the sentence that picks sessions, in
  place of a new definition of "open work".
- The two closing states link to their definitions in
  [`docs/CONVERSATION.md`](https://github.com/mehrlander/web-tools/blob/main/docs/CONVERSATION.md#every-reply),
  in place of being spelled out in the skill.
- The check-in definition and the two-hour window were cut. The window changed
  which sessions `/tend prod` takes, which the point did not require. The
  definition existed only to support the window.
- The new list item is one line.
