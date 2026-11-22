# Wire it in: an example

From [doc-craft's General Principles](../SKILL.md#general-principles): one point added to existing text two ways.

**The point to add.** `/tend prod` should also pick up a session whose last reply closed on ❇️ or 🟢.

**What the skill said.** In [`skills/tend/SKILL.md`](../../tend/SKILL.md), Prod takes each session that is idle, last showed activity between 30 minutes and a week ago, "and has an open pull request or a blocked or review-ready status."

**We could add all this:**

```diff
-and has an open pull request or a blocked or review-ready status.
+and has open work. A session has open work when it has an open pull request
+or a blocked or review-ready status. It also has open work when its last reply
+(its record's `last_message`) closed on ❇️ Ready to assess or 🟢 Ready to
+continue, two closing states that `docs/CONVERSATION.md` defines. A session
+idle for less than two hours tends its own work at its check-ins. A check-in
+is a message a cloud session schedules to itself while it sits idle.
+`skills/hooks/check-in.py` sets when each one arrives.
```

**Or just this:**

```diff
-and has an open pull request or a blocked or review-ready status.
+and has an open pull request, a blocked or review-ready status, or a last
+reply that closed on [❇️ or 🟢](https://github.com/mehrlander/web-tools/blob/main/docs/CONVERSATION.md#every-reply).
```

The sentence already lists what qualifies a session; the point is one more item on it. The longer version adds "open work" and a check-in explanation that this sentence's reader does not need.
