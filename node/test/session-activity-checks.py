"""Real Git fixtures for the portable cloud-turn hook; no external service calls."""
import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[2] / "skills/hooks/session-activity.py"
spec = importlib.util.spec_from_file_location("session_activity", SOURCE)
activity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(activity)


class CloudActivityChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="cloud-turn-check-")
        self.root = Path(self.temp.name)
        self.remote = self.root / "remote.git"
        self.repo = self.root / "records"
        subprocess.run(["git", "init", "--bare", "--initial-branch=background", str(self.remote)], check=True, capture_output=True)
        subprocess.run(["git", "init", "--initial-branch=main", str(self.repo)], check=True, capture_output=True)
        self.git("config", "user.name", "Turn fixture")
        self.git("config", "user.email", "fixture@example.test")
        self.git("config", "core.hooksPath", ".git/hooks")
        self.git("config", "commit.gpgsign", "false")
        self.git("remote", "add", "origin", str(self.remote))
        (self.repo / "sessions/tools").mkdir(parents=True)
        (self.repo / "sessions/tools/on-stop.sh").write_text("exit 0\n", encoding="utf-8")
        (self.repo / ".web-tools.json").write_text('{"sessions":"sessions"}', encoding="utf-8")
        (self.repo / "worker.txt").write_text("original", encoding="utf-8")
        self.git("add", ".")
        self.git("commit", "-m", "Seed fixture")
        self.git("push", "origin", "main:background")
        (self.repo / "worker.txt").write_text("uncommitted edit", encoding="utf-8")
        self.env = dict(os.environ, CLAUDE_PROJECT_DIR=str(self.repo), SESSIONS_ACTIVITY_STAGE=str(self.root / "stage"),
                        CLAUDE_CODE_REMOTE_SESSION_ID="cse_0123456789abcdefghijklmn")
        self.env.pop("SESSIONS_STORE", None)
        self.now = dt.datetime.now(dt.timezone.utc)
        self.payload = {"hook_event_name":"UserPromptSubmit", "session_id":"aabbccdd-1111-2222-3333-444444444444",
                        "prompt":"Inspect the queue", "cwd":str(self.repo)}

    def tearDown(self):
        self.temp.cleanup()

    def git(self, *args):
        return activity.git(self.repo, *args).decode().strip()

    def read(self, staged):
        return json.loads(staged[1].read_text(encoding="utf-8"))

    def test_prompt_tool_stop_lifecycle_and_throttle(self):
        start = activity.capture(self.payload, self.env, self.now)
        self.assertEqual(self.read(start)["state"], "working")
        self.assertEqual(self.read(start)["agent"], "https://claude.ai/code/session_0123456789abcdefghijklmn")
        tool = dict(self.payload, hook_event_name="PreToolUse", tool_name="Read", tool_input={"path":"private/secret"})
        self.assertIsNone(activity.capture(tool, self.env, self.now + dt.timedelta(seconds=2)))
        signal = activity.capture(tool, self.env, self.now + dt.timedelta(seconds=31))
        self.assertEqual(self.read(signal)["lastTool"], "Read")
        self.assertNotIn("private/secret", json.dumps(self.read(signal)))
        stop = activity.capture(dict(self.payload, hook_event_name="Stop", last_assistant_message="Ready"), self.env, self.now + dt.timedelta(seconds=32))
        self.assertEqual(self.read(stop)["state"], "idle")
        self.assertEqual(self.read(stop)["response"], "Ready")
        self.assertEqual(self.read(stop)["prompt"], "Inspect the queue")
        self.assertEqual(self.read(stop)["startedAt"], self.read(start)["startedAt"])

    def test_inert_local_missing_store_and_subagent(self):
        self.assertIsNone(activity.capture(self.payload, dict(self.env, CLAUDE_CODE_REMOTE_SESSION_ID="")))
        self.assertIsNone(activity.capture(self.payload, dict(self.env, SESSIONS_STORE=str(self.root / "missing"))))
        self.assertIsNone(activity.capture(dict(self.payload, agent_id="subagent"), self.env))
        self.assertIsNone(activity.capture(dict(self.payload, session_id="../../escape"), self.env))

    def test_bounded_payload_and_failure_body(self):
        staged = activity.capture(dict(self.payload, prompt="x" * 5000), self.env, self.now)
        self.assertEqual(len(self.read(staged)["prompt"]), 2000)
        staged = activity.capture(dict(self.payload, hook_event_name="Stop", last_assistant_message="y" * 6000), self.env, self.now)
        self.assertEqual(len(self.read(staged)["response"]), 4000)
        staged = activity.capture(dict(self.payload, hook_event_name="StopFailure", error_details="secret error body"), self.env, self.now)
        self.assertEqual(self.read(staged)["state"], "interrupted")
        self.assertNotIn("secret error", json.dumps(self.read(staged)))

    def test_store_attached_midturn_recovers_prompt_without_tool_results(self):
        transcript = self.root / (self.payload["session_id"] + ".jsonl")
        transcript.write_text("\n".join(json.dumps(row) for row in [
            {"type":"user", "message":{"role":"user", "content":"First prompt"}},
            {"type":"user", "message":{"role":"user", "content":[{"type":"text", "text":"Current prompt"}]}},
            {"type":"user", "message":{"role":"user", "content":[{"type":"tool_result", "content":"Private result"}]}},
        ]), encoding="utf-8")
        staged = activity.capture(dict(self.payload, hook_event_name="PreToolUse", tool_name="Read", transcript_path=str(transcript)), self.env, self.now)
        self.assertEqual(self.read(staged)["prompt"], "Current prompt")
        self.assertEqual(self.read(staged)["lastTool"], "Read")
        self.assertEqual(self.read(staged)["state"], "working")
        self.assertNotIn("Private result", json.dumps(self.read(staged)))

    def test_git_publish_preserves_checkout_and_rejects_late_start(self):
        before = (self.git("rev-parse", "HEAD"), self.git("status", "--porcelain"), self.git("write-tree"))
        staged = activity.capture(self.payload, self.env, self.now)
        original = self.read(staged)
        activity.publish(*staged)
        target = "sessions/activity/" + self.now.strftime("%Y-%m-%d") + "/aabbccdd.json"
        self.assertEqual(json.loads(self.git("show", "origin/background:" + target))["state"], "working")
        staged = activity.capture(dict(self.payload, hook_event_name="Stop", last_assistant_message="Finished"), self.env, self.now + dt.timedelta(seconds=1))
        activity.publish(*staged)
        activity.atomic(staged[1], original)
        activity.publish(*staged)
        self.assertEqual(json.loads(self.git("show", "origin/background:" + target))["state"], "idle")
        after = (self.git("rev-parse", "HEAD"), self.git("status", "--porcelain"), self.git("write-tree"))
        self.assertEqual(before, after)
        self.assertEqual((self.repo / "worker.txt").read_text(encoding="utf-8"), "uncommitted edit")
        self.assertFalse((self.repo / "sessions/activity").exists())

    def test_concurrent_background_writer_is_preserved_on_retry(self):
        staged = activity.capture(self.payload, self.env, self.now)
        original_git = activity.git
        raced = []

        def interleaved(repo, *args, **kwargs):
            if args[0] == "push" and not raced:
                base = original_git(repo, "ls-remote", "origin", "refs/heads/background").decode().split()[0]
                tree = original_git(repo, "rev-parse", base + "^{tree}").decode().strip()
                commit = original_git(repo, "commit-tree", tree, "-p", base, "-m", "Concurrent worker update").decode().strip()
                original_git(repo, "push", "origin", commit + ":refs/heads/background")
                raced.append(commit)
            return original_git(repo, *args, **kwargs)

        activity.git = interleaved
        try:
            activity.publish(*staged)
        finally:
            activity.git = original_git
        self.assertEqual(self.git("rev-parse", "origin/background^"), raced[0])


if __name__ == "__main__":
    unittest.main()
