#!/usr/bin/env python3
"""SessionStart and UserPromptSubmit: put this session's topics, as Gemini read
them, into the session's context with a line on how fresh that reading is, and
say when the Lenovo's Gemini daemon has stopped reading sessions or a job it
runs is failing.

THE SOURCE is the session archive, found as session-record.sh finds it
(archive() in session-detail-caption.py, beside this file). The daemon
(sessions/tools/poll_followup.py there) writes each record's companion to the
archive's `background` branch at sessions/topics/YYYY/MM/<day>-<short>.json,
corrections beside it in <name>.corrections.jsonl; sessions/topics/README.md
there holds both formats. Records are on `main`.

THE MIRROR. The hook reads through a bare mirror of its own under the temp
directory, holding two days of both branches' commits and trees and only the
blobs it reads, and never fetches into the archive's checkout. The sessions
skill clones that checkout shallow and single-branch, so fetching `background`
into it would bring the branch's whole history, and a day of records on `main`
was 590 MB of blobs (measured 2026-11-21), more than any fetch finishes in
seconds. The mirror's fetch took 1.6 s the first time and under one second
after. Each fetch has a time limit (FETCH_LIMIT); a failed one is said in one
line and the reading goes on from what the mirror holds.

WHAT IT SAYS. This session's topics in first-appearance order, each with its
status and, for an open one, whom it waits on and for what. A correction the
companion has not taken in yet is applied over it, a later line over an earlier;
only `status` and `rename` lines, since a `move` needs the record. More than
TOPIC_LINES topics fold the done and dropped ones into a count. Then when
Gemini read the session, through what point in its record, and whether the
record has moved since. A session with no companion yet gets "no topics yet"
and when Gemini last wrote any topics. Nothing more when all is fresh.

WHEN IT WARNS. The thresholds were measured on 2026-11-21 over the record
commits on main and the companions on background from 11-13 to 11-21.
- Behind: a session record has waited ESTATE_BEHIND since Gemini last wrote
  any session's topics. Of 372 stretches between topic writes in which a record
  waited, 365 ended within the hour (355 within 45 minutes); the other seven
  ran from 71 minutes to 23 hours. daemonHealth in web-tools lib/kits/errands.js
  asks the same question with ten minutes, which suits a status dot but would
  have flagged 113 of the 372. The line names the daemon's last commit of any
  kind (a subject ending VIA): one later than its last topics means it is
  running other jobs and the topic reader is the part stuck; none means the
  Lenovo is asleep or the daemon stopped, which the hook cannot tell apart.
- Passed over: this session's record moved after Gemini's reading of it and has
  waited SESSION_BEHIND while Gemini wrote other sessions' topics. A live
  session's reading trails its record: of 1,483 record versions read while the
  daemon was writing, p95 waited 87 minutes and p99 221; 26 waited three
  hours, 18 of them in one long session.
- Failing: a row of state/scheduled-daemon.json on background whose `tried` is
  later than its `fired`. schedule_runner.py there retries a failed run hourly
  and clears `tried` and `error` when one succeeds. The line names the job and
  quotes its `error` when the row has one.
Mail to the owner when no session is open is the Lenovo Companion's job
(web-tools#1397); this hook only tells sessions.

WHEN IT RUNS. SessionStart on startup and compact gives the whole reading,
since the context does not hold one. On resume it gives one only when it
changed since the session was last given one, and does not count it as given:
SessionStart output reached none of 71 resumes measured on 2026-10-28
(default-files-hint.py), so the next prompt looks again. UserPromptSubmit
fetches at most every CHECK_EVERY and speaks only when the reading changed: a
topic, a status, what one waits on, or a warning. An unchanged reading is not
repeated, because a compaction, the one event that loses it, gets it again at
SessionStart. So a long session learns of new topics within about fifteen
minutes of Gemini writing them, for one fetch a quarter hour. A failed fetch
at a prompt is said only once it has failed for an hour.

THE STATE is one small JSON file per session under the temp directory, beside
that session's mirror: when it last fetched, the digest of the reading it last
gave, and since when fetches have failed.

Silent and exit 0 on anything else: a subagent, no session id, no archive, or
any failure along the way. It never blocks a prompt past its fetch limit.
"""
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
MIN, HOUR, DAY = 60, 3600, 86400
ESTATE_BEHIND = 60 * MIN
SESSION_BEHIND = 3 * HOUR
CHECK_EVERY = 15 * MIN
FETCH_LIMIT = {"SessionStart": 8, "UserPromptSubmit": 4}  # seconds, for all the hook's fetches
FETCH_FAILED_SAY = HOUR
WINDOW = 2 * DAY
TOPIC_LINES = 10
WAITING_CHARS = 90
VIA = " via Gemini daemon"
TOPICS = "sessions/topics/"
SCHEDULED = "state/scheduled-daemon.json"
NO_TOPICS = "the archive has no background branch"
WAITS = {"owner": "the owner", "session": "this session", "external": "someone outside"}


def caption():
    """session-detail-caption.py, for archive(), clock(), elapsed() and its
    state helpers, loaded by path since its name is hyphenated."""
    spec = importlib.util.spec_from_file_location(
        "session_detail_caption", os.path.join(HERE, "session-detail-caption.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CAP = caption()
# The environment's GIT_CONFIG_*, GIT_ASKPASS and GIT_SSL_CAINFO carry the
# credentials and the proxy's trust, so only the variables that would point
# git at another repository are dropped.
PLACE = ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_COMMON_DIR",
         "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_PREFIX", "GIT_NAMESPACE")
ENV = {k: v for k, v in os.environ.items() if k not in PLACE}
ENV["GIT_TERMINAL_PROMPT"] = "0"


# ── The mirror ──────────────────────────────────────────────────────────────

class Mirror:
    def __init__(self, path, deadline):
        self.path, self.deadline = path, deadline

    def git(self, *args, stdin=None):
        """A local git command's output, or None."""
        try:
            done = subprocess.run(["git", "-C", self.path, *args], input=stdin, capture_output=True,
                                  encoding="utf-8", errors="replace", timeout=10, env=ENV)
        except (OSError, subprocess.SubprocessError):
            return None
        return done.stdout if done.returncode == 0 else None

    def fetch(self, *args, stdin=None, config=()):
        """Run a fetch within what is left of the deadline: "" on success, else
        why not. A fetch out of time is sent SIGTERM, so git removes its locks."""
        left = self.deadline - time.monotonic()
        if left <= 0.2:
            return "no time left"
        cmd = ["git", "-C", self.path, "-c", "gc.auto=0", "-c", "maintenance.auto=false",
               *[part for pair in config for part in ("-c", pair)], "fetch",
               "-q", "--no-tags", "--no-write-fetch-head", "--filter=blob:none", *args]
        try:
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                                    stderr=subprocess.PIPE, encoding="utf-8", errors="replace", env=ENV)
        except OSError as exc:
            return str(exc)
        try:
            _, err = proc.communicate(stdin, timeout=left)
        except subprocess.TimeoutExpired:
            proc.terminate()
            try:
                proc.wait(2)
            except subprocess.TimeoutExpired:
                proc.kill()
            return f"no answer in {round(left)} s"
        if proc.returncode:
            lines = [line for line in (err or "").splitlines() if line.strip()]
            return (lines[-1] if lines else f"git exited {proc.returncode}")[:160]
        return ""

    def refresh(self, url, now):
        """Fetch both branches' new commits and trees: two days' worth into a
        new mirror, what is new since into an old one."""
        if not os.path.isdir(os.path.join(self.path, "objects")):
            os.makedirs(self.path, exist_ok=True)
            if self.git("init", "-q", "--bare") is None:
                return "could not set up the mirror"
        if self.git("config", "remote.origin.url", url) is None:
            return "could not set up the mirror"
        deep = () if self.git("rev-parse", "-q", "--verify", "refs/heads/background") else (
            "--shallow-since=" + datetime.fromtimestamp(now - WINDOW, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),)
        trouble = self.fetch(*deep, "origin", "+refs/heads/main:refs/heads/main",
                             "+refs/heads/background:refs/heads/background")
        return NO_TOPICS if "couldn't find remote ref" in trouble else trouble

    def boundary(self):
        """The shallow boundary's commits, which a path-limited log shows as
        adding every file."""
        try:
            with open(os.path.join(self.path, "shallow"), encoding="utf-8") as fh:
                return set(fh.read().split())
        except OSError:
            return set()

    def oid(self, ref, path):
        out = self.git("rev-parse", "-q", "--verify", f"{ref}:{path}")
        return out.strip() if out else ""

    def blobs(self, oids):
        """{oid: text} for the blobs asked for, in one request; git asks the
        network only for the ones the mirror lacks. After a failed request only
        the ones on disk are read, since reading a missing one would fetch it
        outside the time limit."""
        oids = [o for o in dict.fromkeys(oids) if o]
        if not oids:
            return {}
        # Wanted blobs are not commits to negotiate from, as in git's own lazy fetch.
        if self.fetch("--stdin", "origin", stdin="\n".join(oids) + "\n",
                      config=("fetch.negotiationAlgorithm=noop",)):
            have = set((self.git("cat-file", "--batch-all-objects", "--batch-check=%(objectname)") or "").split())
            oids = [o for o in oids if o in have]
        found = {}
        for o in oids:
            text = self.git("cat-file", "blob", o)
            if text is not None:
                found[o] = text
        return found

    def commits(self, *args):
        """[(sha, time, rest)] newest first, the boundary left out."""
        skip = self.boundary()
        rows = []
        for line in (self.git("log", "--format=%H %ct %s", *args) or "").splitlines():
            sha, _, rest = line.partition(" ")
            stamp, _, subject = rest.partition(" ")
            if sha and sha not in skip and stamp.isdigit():
                rows.append((sha, int(stamp), subject))
        return rows


# ── The reading ─────────────────────────────────────────────────────────────

def iso(text):
    try:
        return datetime.fromisoformat(str(text).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


def minute(text):
    """state/scheduled-daemon.json's YYYY-MM-DDTHH:MMZ, or None."""
    try:
        return datetime.strptime(text, "%Y-%m-%dT%H:%MZ").replace(tzinfo=timezone.utc).timestamp()
    except (TypeError, ValueError):
        return None


def utc(t, form):
    return datetime.fromtimestamp(t, timezone.utc).strftime(form)


def corrected(companion, text):
    """[(topic, status entry or None)] in first-appearance order, with the
    status and rename lines of a corrections file applied in order."""
    by = {}
    for entry in companion.get("topic_status") or []:
        if isinstance(entry, dict) and entry.get("topic"):
            by[entry["topic"]] = dict(entry)
    topics = [t for t in companion.get("topics") or [] if isinstance(t, str)] or list(by)
    for raw in (text or "").splitlines():
        try:
            line = json.loads(raw)
        except ValueError:
            continue
        name = line.get("topic") if isinstance(line, dict) else None
        if name not in topics:
            continue
        if line.get("op") == "rename" and isinstance(line.get("to"), str) and line["to"]:
            entry = by.pop(name, None)
            if line["to"] in topics:  # merges into the topic that has the name
                topics.remove(name)
            else:
                topics[topics.index(name)] = line["to"]
                if entry is not None:
                    by[line["to"]] = {**entry, "topic": line["to"]}
        elif line.get("op") == "status":
            open_ = line.get("status") == "open"
            by[name] = {**by.get(name, {}), "topic": name, "status": line.get("status"),
                        "waits_on": line.get("waits_on") if open_ else None,
                        "waiting": line.get("waiting") if open_ else None}
    return [(t, by.get(t)) for t in topics]


def describe(entry):
    status = (entry or {}).get("status")
    if status == "open":
        whom = WAITS.get(entry.get("waits_on"))
        said = "open" + (f", waiting on {whom}" if whom else "")
        what = " ".join(str(entry.get("waiting") or "").split())
        if what:
            said += ": " + (what if len(what) <= WAITING_CHARS else what[:WAITING_CHARS - 1].rstrip() + "…")
        return said
    return status if status in ("done", "dropped") else "status not decided"


def record_path(m, short, now):
    """This session's record on main, for a session with no companion yet."""
    found = []
    for folder in dict.fromkeys((utc(now, "%Y/%m"), utc(now - 31 * DAY, "%Y/%m"))):
        listed = m.git("ls-tree", "--name-only", "refs/heads/main", "--", f"sessions/{folder}/") or ""
        found += [p for p in listed.split() if p.endswith(f"-{short}.json")]
    return sorted(found)[-1] if found else ""


def unread_since(m, record, source):
    """When the oldest version of the record that Gemini has not read was
    committed, or None when its reading covers the record. A version is read
    once the companion names its blob."""
    if not record or (source and m.oid("refs/heads/main", record) == source):
        return None
    skip, after, sha = m.boundary(), [], None
    for line in (m.git("log", "--format=C %H %ct", "--raw", "--no-abbrev", "refs/heads/main", "--", record) or "").splitlines():
        if line.startswith("C "):  # newest first
            _, sha, at = line.split()
            if sha not in skip:
                after.append([int(at), ""])
        elif line.startswith(":") and after and sha not in skip:
            after[-1][1] = line.split()[3]
            if source and after[-1][1] == source:
                after.pop()
                break
    return min(at for at, _ in after) if after else None


def failing(rows, when):
    """A line and a key for each daemon job whose last try came after its last
    success."""
    found = []
    for job, row in sorted(rows.items() if isinstance(rows, dict) else []):
        if not isinstance(row, dict):
            continue
        tried, fired = minute(row.get("tried")), minute(row.get("fired"))
        if tried is None or (fired is not None and fired >= tried):
            continue
        error = " ".join(str(row.get("error") or "").split())
        ran = f"last ran {when(fired)}" if fired else "never ran"
        found.append((f"Daemon job {job} is failing: {ran}, last tried {when(tried)}, "
                      + (f"error: {error}" if error else "no error recorded") + ".",
                      ["failing", job, row.get("fired"), error]))
    return found


def read(m, short, now):
    """What there is to say, as (lines, keys); the keys are the parts whose
    change is worth saying again."""
    when = lambda t: day_clock(t, now)
    lines, keys, warnings = [], [], []

    # The blobs: this session's companion and corrections, and the jobs' state.
    listed = m.git("ls-tree", "-r", "--name-only", "refs/heads/background", "--", TOPICS) or ""
    mine = sorted(p for p in listed.split() if p.endswith(f"-{short}.json"))
    oid = m.oid("refs/heads/background", mine[-1]) if mine else ""
    fixes = m.oid("refs/heads/background", mine[-1][:-len(".json")] + ".corrections.jsonl") if mine else ""
    scheduled = m.oid("refs/heads/background", SCHEDULED)
    got = m.blobs([oid, fixes, scheduled])
    try:
        companion = json.loads(got[oid]) if oid in got else None
    except ValueError:
        companion = None
    companion = companion if isinstance(companion, dict) else None

    # Gemini's last topic write for any session, the daemon's last commit of
    # any kind, and the oldest record committed since that topic write.
    written = m.commits("-n", "8", "refs/heads/background", "--", ":(glob)sessions/topics/**/*.json")
    last_topics = written[0][1] if written else None
    alive = m.commits("-n", "1", "-F", f"--grep={VIA}", "refs/heads/background")
    years = [f"sessions/{y}" for y in sorted({utc(now, "%Y"), utc(now - WINDOW, "%Y")})]
    since = (f"--since=@{last_topics}",) if last_topics is not None else ()
    later = [t for _, t, _ in m.commits(*since, "refs/heads/main", "--", *years)
             if last_topics is None or t > last_topics]
    waiting_since = min(later) if later else None

    record = (companion or {}).get("source_path") or record_path(m, short, now)
    unread = unread_since(m, record, (companion or {}).get("source_blob"))

    if companion is not None:
        topics = corrected(companion, got.get(fixes, "")
                           if fixes != (companion.get("corrections") or {}).get("blob") else "")
        read_at, reach = iso(companion.get("analyzed_at")), iso(companion.get("source_ended"))
        last = m.commits("-n", "1", "refs/heads/main", "--", record) if record else []
        moved = (f"the record has moved since, last at {when(last[0][1] if last else None)}" if unread
                 else "that reading covers the record as it stands")
        lines.append(f"This session's topics, as Gemini read them at {when(read_at)} from the record "
                     f"through {when(reach)}; {moved}:")
        shown = topics if len(topics) <= TOPIC_LINES else [
            (t, e) for t, e in topics if (e or {}).get("status") not in ("done", "dropped")]
        for name, entry in shown:
            lines.append(f"- {name}: {describe(entry)}")
            keys.append([name] + [(entry or {}).get(k) for k in ("status", "waits_on", "waiting")])
        if len(shown) < len(topics):
            lines.append(f"- and {len(topics) - len(shown)} more, done or dropped")
    else:
        lines.append("No topics yet for this session.")
        keys.append("no topics")

    if waiting_since is not None and now - waiting_since >= ESTATE_BEHIND:
        gap = (f"since {when(last_topics)} ({CAP.elapsed(now - last_topics)})" if last_topics is not None
               else "in two days")
        other = alive[0] if alive and (last_topics is None or alive[0][1] > last_topics) else None
        if other:
            what = other[2][:-len(VIA)] if other[2].endswith(VIA) else other[2]
            tail = (f", though the daemon committed other work at {when(other[1])} ({what}), "
                    "so its topic reader is the part stopped or stuck")
        else:
            seen = f"since {when(alive[0][1])}" if alive else "in two days"
            tail = f", and nothing from the daemon at all {seen}: the Lenovo is asleep or the daemon stopped"
        warnings.append(f"Gemini is behind: no session topics written {gap} while session records "
                        f"have waited since {when(waiting_since)}{tail}.")
        keys.append(["behind", last_topics, bool(other)])
    elif (unread is not None and now - unread >= SESSION_BEHIND
          and last_topics is not None and last_topics > unread):
        warnings.append(f"Gemini has passed over this session: its record has waited since {when(unread)} "
                        f"({CAP.elapsed(now - unread)}) for a reading while Gemini read other sessions, "
                        f"last at {when(last_topics)}.")
        keys.append(["passed over", unread])
    elif companion is None and last_topics is not None:
        lines.append(f"Gemini last wrote session topics at {when(last_topics)}, "
                     f"{CAP.elapsed(now - last_topics)} ago.")

    try:
        rows = json.loads(got.get(scheduled) or "{}")
    except ValueError:
        rows = {}
    for line, key in failing(rows, when):
        warnings.append(line)
        keys.append(key)

    if warnings:
        lines += warnings + ["Mention this to the owner if your work waits on Gemini."]
    return lines, keys


def day_clock(t, now):
    """The owner's clock time, with the date only when it is not today's."""
    if t is None:
        return "an unknown time"
    shown, today = CAP.clock(t), CAP.clock(now)
    date, _, hour = shown.partition(" ")
    return hour if date == today.partition(" ")[0] else shown


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except ValueError:
        return
    if not isinstance(payload, dict) or payload.get("agent_id"):
        return
    session = str(payload.get("session_id") or "")
    if not re.fullmatch(r"[\w.-]+", session):
        return
    event = payload.get("hook_event_name") or "UserPromptSubmit"
    if event not in FETCH_LIMIT:
        return
    resume = event == "SessionStart" and payload.get("source") == "resume"
    now = float(os.environ.get("TOPIC_CONTEXT_NOW") or time.time())  # a fixed clock, for the tests
    base = os.path.join(CAP.temp_dir(), "topic-context")
    state_path = os.path.join(base, session + ".json")
    state = CAP.load(state_path)
    if event == "UserPromptSubmit" and now - float(state.get("checked") or 0) < CHECK_EVERY:
        return
    store = CAP.archive(os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or os.getcwd())
    if not store:
        return
    try:
        url = subprocess.run(["git", "-C", store, "config", "--get", "remote.origin.url"], capture_output=True,
                             encoding="utf-8", errors="replace", timeout=5, env=ENV).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return
    if not url:
        return

    m = Mirror(os.path.join(base, session + ".git"), time.monotonic() + FETCH_LIMIT[event])
    trouble = m.refresh(url, now)
    if trouble == NO_TOPICS:
        return
    if trouble:
        state.setdefault("failing_since", now)
    else:
        state.pop("failing_since", None)
    state["checked"] = 0 if resume else now  # a resume's output may not arrive, so the next prompt looks again
    held = m.git("rev-parse", "-q", "--verify", "refs/heads/background")
    lines, keys = read(m, session[:8], now) if held else ([], [])
    if trouble and (event == "SessionStart" or not lines
                    or now - float(state["failing_since"]) >= FETCH_FAILED_SAY):
        lines.insert(0, f"Could not refresh this session's topics from the session archive ({trouble}); "
                        + ("what follows is from the last fetch." if lines else "they are unknown for now."))
        keys.append("fetch failed")
    digest = hashlib.sha1(json.dumps(keys).encode()).hexdigest()[:12]
    speak = bool(lines) and ((event == "SessionStart" and not resume) or digest != state.get("said"))
    if speak and not resume:
        state["said"] = digest
    CAP.save(state_path, state)
    if speak:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": event,
            "additionalContext": "\n".join(lines),
        }}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
