"""Isolated real-Git and synthetic provider-metadata updater regressions."""
from datetime import datetime, timedelta, timezone
from contextlib import contextmanager
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / 'worker'))
import repository_sync as sync
import workspace_activity as activity


def command(*args):
    result = subprocess.run(['git', '-c', 'commit.gpgsign=false', *map(str, args)], capture_output=True, encoding='utf-8', errors='replace', timeout=30)
    if result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout.strip()


@contextmanager
def database(path):
    conn = sqlite3.connect(path)
    try:
        with conn:
            yield conn
    finally:
        conn.close()


class RepositorySyncChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.suite = tempfile.TemporaryDirectory(prefix='web-tools-main-sync-')
        cls.addClassCleanup(cls.suite.cleanup)
        cls.template = Path(cls.suite.name) / 'template'
        command('init', '--initial-branch=main', cls.template)
        command('-C', cls.template, 'config', 'user.name', 'Fixture')
        command('-C', cls.template, 'config', 'user.email', 'fixture@example.test')
        command('-C', cls.template, 'config', 'remote.origin.url', 'https://github.com/fixture/project.git')
        command('-C', cls.template, 'config', 'core.hooksPath', str(Path(cls.suite.name) / 'no-hooks'))
        (cls.template / '.gitignore').write_text('ignored.txt\ncached/\n', encoding='utf-8')
        (cls.template / 'base.txt').write_text('base', encoding='utf-8')
        command('-C', cls.template, 'add', '.')
        command('-C', cls.template, 'commit', '-m', 'base')
        cls.base_head = command('-C', cls.template, 'rev-parse', 'HEAD')
        (cls.template / 'remote.txt').write_text('remote', encoding='utf-8')
        command('-C', cls.template, 'add', '.')
        command('-C', cls.template, 'commit', '-m', 'remote')
        cls.target = command('-C', cls.template, 'rev-parse', 'HEAD')
        command('-C', cls.template, 'update-ref', 'refs/remotes/origin/main', cls.target)
        command('-C', cls.template, 'reset', '--hard', cls.base_head)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='web-tools-main-sync-case-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.local = self.root / 'laptop'
        shutil.copytree(self.template, self.local)
        self.profile = self.root / 'profile'
        self.profile.mkdir()
        self.state = self.root / 'state'
        self.entries = [self.entry(self.local)]
        self.source = {'defaultBranch': 'main', 'checkedAt': datetime.now(timezone.utc).isoformat(), 'tips': {'main': self.target}}
        self.calls = []

    def entry(self, path):
        return {'path': path, 'repo': 'fixture/project', 'common': command('-C', path, 'rev-parse', '--path-format=absolute', '--git-common-dir')}

    def git(self, path, *args, timeout=30, strip=True):
        self.calls.append(args)
        result = subprocess.run(['git', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', str(path), *args],
                                capture_output=True, encoding='utf-8', errors='replace', timeout=timeout)
        return (result.stdout.strip() if strip else result.stdout) if result.returncode == 0 else None

    def run_sync(self, **kwargs):
        return sync.sync_default(self.entries, self.source, self.state, self.git, profile=self.profile,
                                 activity_probe=kwargs.pop('activity_probe', lambda _path, _profile: {'allow': True, 'reason': None}), **kwargs)

    def head(self):
        return command('-C', self.local, 'rev-parse', 'HEAD')

    def assert_blocked(self, reason, **kwargs):
        row = self.run_sync(**kwargs)
        self.assertEqual((row['state'], row['reason']), ('blocked', reason), row)
        self.assertEqual(self.head(), self.base_head)
        self.assertFalse(any('merge' in call for call in self.calls))
        return row

    def test_fast_forward_has_safe_flags_and_retains_last_update_on_current(self):
        row = self.run_sync()
        self.assertEqual((row['state'], row['reason'], row['folder']), ('updated', None, 'laptop'))
        self.assertEqual(self.head(), self.target)
        merge = next(call for call in self.calls if 'merge' in call)
        self.assertEqual(merge, ('-c', 'merge.autoStash=false', '-c', 'submodule.recurse=false', 'merge', '--ff-only', '--no-autostash', '--no-overwrite-ignore', self.target))
        self.assertFalse(any(set(call) & {'reset', 'stash', 'switch', 'checkout', 'push', 'clean'} for call in self.calls))
        self.source['mainSync'] = row
        self.assertEqual(self.run_sync()['updatedAt'], row['updatedAt'])
        self.assertEqual(self.run_sync()['state'], 'current')

    def test_dirty_tracked_and_untracked_files_stay_untouched(self):
        (self.local / 'base.txt').write_text('owner edit', encoding='utf-8')
        (self.local / 'note.txt').write_text('local only', encoding='utf-8')
        self.assert_blocked('local-changes')
        self.assertEqual((self.local / 'base.txt').read_text(), 'owner edit')
        self.assertEqual((self.local / 'note.txt').read_text(), 'local only')

    def test_feature_folder_is_never_switched(self):
        command('-C', self.local, 'switch', '-c', 'codex/feature')
        self.assert_blocked('no-default-worktree')
        self.assertEqual(command('-C', self.local, 'branch', '--show-current'), 'codex/feature')

    def test_two_default_folders_are_ambiguous(self):
        other = self.root / 'second'
        shutil.copytree(self.template, other)
        self.entries.append(self.entry(other))
        self.assert_blocked('ambiguous-default-worktree')

    def test_fresh_fetch_is_mandatory(self):
        for delta in (-301, 60):
            self.source['checkedAt'] = (datetime.now(timezone.utc) + timedelta(seconds=delta)).isoformat()
            self.assert_blocked('fetch-stale')

    def test_unknown_and_active_activity_never_expire_into_idle(self):
        for reason in ('active-session', 'activity-uncertain', 'activity-unavailable'):
            self.assert_blocked(reason, activity_probe=lambda _p, _profile, reason=reason: {'allow': False, 'reason': reason})
        self.assert_blocked('activity-uncertain', activity_probe=lambda _p, _profile: {'allow': False, 'reason': 'a private path'})

    def test_refs_changed_during_activity_probe(self):
        def changed(_path, _profile):
            command('-C', self.local, 'update-ref', 'refs/remotes/origin/main', self.base_head)
            return {'allow': True}
        self.assert_blocked('refs-changed', activity_probe=changed)

    def test_branch_changed_during_activity_probe(self):
        def changed(_path, _profile):
            command('-C', self.local, 'switch', '-c', 'codex/new-work')
            return {'allow': True}
        self.assert_blocked('identity-changed', activity_probe=changed)

    def test_head_changed_during_activity_probe(self):
        def changed(_path, _profile):
            command('-C', self.local, 'commit', '--allow-empty', '-m', 'new work')
            return {'allow': True}
        row = self.run_sync(activity_probe=changed)
        self.assertEqual((row['state'], row['reason']), ('blocked', 'identity-changed'))
        self.assertFalse(any('merge' in call for call in self.calls))

    def test_branch_switch_during_final_clean_is_caught_before_merge(self):
        real_git, seen = self.git, [0]
        def changed(path, *args, **kwargs):
            value = real_git(path, *args, **kwargs)
            if args and args[0] == 'status':
                seen[0] += 1
                if seen[0] == 2:
                    command('-C', self.local, 'switch', '-c', 'codex/started-during-scan')
            return value
        self.git = changed
        self.assert_blocked('identity-changed')

    def test_git_operation_and_updater_lock_block(self):
        marker = self.local / '.git' / 'MERGE_HEAD'
        marker.write_text(self.target, encoding='ascii')
        self.assert_blocked('git-operation')
        marker.unlink()
        with sync._lock(self.state, self.entries[0]['common']):
            self.assert_blocked('updater-busy')

    def test_hidden_index_changes_are_not_clean_proof(self):
        command('-C', self.local, 'update-index', '--assume-unchanged', 'base.txt')
        (self.local / 'base.txt').write_text('hidden edit', encoding='utf-8')
        self.assert_blocked('index-flags')

    def test_local_commits_are_not_rebased_or_discarded(self):
        command('-C', self.local, 'commit', '--allow-empty', '-m', 'local commit')
        before = self.head()
        row = self.run_sync()
        self.assertEqual((row['state'], row['reason']), ('blocked', 'local-commits'))
        self.assertEqual(self.head(), before)

    def test_ignored_incoming_file_is_preserved(self):
        command('-C', self.local, 'switch', '-c', 'fixture/incoming', self.target)
        (self.local / 'ignored.txt').write_text('upstream version', encoding='utf-8')
        command('-C', self.local, 'add', '-f', 'ignored.txt')
        command('-C', self.local, 'commit', '-m', 'incoming ignored name')
        target = self.head()
        command('-C', self.local, 'switch', 'main')
        command('-C', self.local, 'update-ref', 'refs/remotes/origin/main', target)
        self.source['tips']['main'] = target
        (self.local / 'ignored.txt').write_text('irreplaceable local content', encoding='utf-8')
        row = self.run_sync()
        self.assertEqual((row['state'], row['reason']), ('blocked', 'ignored-collision'))
        self.assertEqual(self.head(), self.base_head)
        self.assertEqual((self.local / 'ignored.txt').read_text(), 'irreplaceable local content')

    def test_ignored_directory_prefix_collision_is_preserved(self):
        command('-C', self.local, 'switch', '-c', 'fixture/incoming', self.target)
        (self.local / 'cached').write_text('upstream file', encoding='utf-8')
        command('-C', self.local, 'add', '-f', 'cached')
        command('-C', self.local, 'commit', '-m', 'incoming directory prefix')
        target = self.head()
        command('-C', self.local, 'switch', 'main')
        command('-C', self.local, 'update-ref', 'refs/remotes/origin/main', target)
        self.source['tips']['main'] = target
        (self.local / 'cached').mkdir()
        (self.local / 'cached' / 'kept.txt').write_text('keep', encoding='utf-8')
        row = self.run_sync()
        self.assertEqual((row['state'], row['reason']), ('blocked', 'ignored-collision'))
        self.assertEqual(self.head(), self.base_head)
        self.assertEqual((self.local / 'cached' / 'kept.txt').read_text(), 'keep')

    def test_normal_post_merge_hook_runs_and_changes_are_reported(self):
        hooks = self.root / 'hooks'
        hooks.mkdir()
        script = hooks / 'post-merge'
        script.write_text('#!/bin/sh\nprintf hook-edit > base.txt\n', encoding='utf-8', newline='\n')
        script.chmod(0o755)
        command('-C', self.local, 'config', 'core.hooksPath', hooks)
        row = self.run_sync()
        self.assertEqual((row['state'], row['reason']), ('blocked', 'post-update-changes'))
        self.assertEqual(self.head(), self.target)
        self.assertIsNotNone(row['updatedAt'])
        self.assertEqual((self.local / 'base.txt').read_text(), 'hook-edit')

    def test_post_merge_identity_failure_is_failed_not_pre_update_blocked(self):
        real_git, merged = self.git, [False]
        def failed_after_merge(path, *args, **kwargs):
            if merged[0] and '--show-toplevel' in args:
                return None
            value = real_git(path, *args, **kwargs)
            if 'merge' in args:
                merged[0] = True
            return value
        self.git = failed_after_merge
        row = self.run_sync()
        self.assertEqual((row['state'], row['reason']), ('failed', 'git-unavailable'))
        self.assertEqual(self.head(), self.target)

    def test_inherited_git_redirection_is_rejected_without_git_calls(self):
        for name in ('GIT_DIR', 'GIT_INDEX_FILE', 'GIT_WORK_TREE', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_GLOBAL'):
            self.calls.clear()
            with patch.dict(os.environ, {name: 'fixture-redirection'}):
                row = self.run_sync()
            self.assertEqual((row['state'], row['reason']), ('blocked', 'update-unavailable'))
            self.assertEqual(self.calls, [])

    def test_folder_alias_is_rejected(self):
        alias = self.root / 'alias'
        try:
            alias.symlink_to(self.local, target_is_directory=True)
        except OSError:
            if os.name != 'nt':
                raise
            result = subprocess.run(['cmd', '/c', 'mklink', '/J', str(alias), str(self.local)], capture_output=True)
            if result.returncode:
                self.skipTest('The fixture cannot create an alias')
        self.entries[0]['path'] = alias
        self.assert_blocked('identity-changed')

    def test_result_is_bounded_typed_metadata(self):
        self.source['mainSync'] = {'updatedAt': '2026-01-01T00:00:00+00:00'}
        row = self.run_sync(activity_probe=lambda _path, _profile: (_ for _ in ()).throw(OSError('private diagnostic')))
        self.assertEqual(set(row), {'state', 'reason', 'folder', 'checkedAt', 'updatedAt'})
        self.assertEqual(row['reason'], 'activity-unavailable')
        self.assertEqual(row['updatedAt'], '2026-01-01T00:00:00+00:00')
        self.assertNotIn(str(self.root), json.dumps(row))
        self.assertNotIn('private diagnostic', json.dumps(row))


class ActivityChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='web-tools-workspace-evidence-')
        self.addCleanup(self.temp.cleanup)
        self.profile = Path(self.temp.name)
        self.target = self.profile / 'gh' / 'project'
        self.target.mkdir(parents=True)
        self.original_cli = activity._cli_processes
        process_probe = patch.object(activity, '_cli_processes', return_value=None)
        process_probe.start()
        self.addCleanup(process_probe.stop)

    def codex(self, cwd=None, events=None, archived=0):
        root = self.profile / '.codex'
        (root / 'sessions').mkdir(parents=True, exist_ok=True)
        rollout = root / 'sessions' / 'fixture.jsonl'
        rollout.write_text(''.join(json.dumps({'type': 'event_msg', 'payload': event}) + '\n' for event in events or []), encoding='utf-8')
        with database(root / 'state_5.sqlite') as conn:
            conn.execute('CREATE TABLE IF NOT EXISTS threads(id TEXT,cwd TEXT,rollout_path TEXT,archived INTEGER,updated_at_ms INTEGER,source TEXT,thread_source TEXT)')
            conn.execute('INSERT INTO threads VALUES(?,?,?,?,?,?,?)', ('fixture', str(cwd or self.target), str(rollout), archived, 1577836800000, 'cli', None))
        return rollout

    def history(self, status='completed', end=None):
        with database(self.profile / '.codex' / 'thread_history_2.sqlite') as conn:
            conn.execute('CREATE TABLE IF NOT EXISTS thread_turns(thread_id TEXT,status TEXT,started_at INTEGER,completed_at INTEGER,rollout_ordinal INTEGER,rollout_end_byte_offset INTEGER,rollout_end_ordinal INTEGER,turn_id TEXT,root_turn_id TEXT)')
            conn.execute('CREATE TABLE IF NOT EXISTS thread_history_projection_state(thread_id TEXT,next_rollout_byte_offset INTEGER,next_rollout_ordinal INTEGER)')
            conn.execute('INSERT INTO thread_turns VALUES(?,?,?,?,?,?,?,?,?)', ('fixture', status, 1577836800, 1577836801 if status != 'inProgress' else None, 1, end or 0, 2, 'turn-fixture', 'turn-fixture'))
            conn.execute('INSERT INTO thread_history_projection_state VALUES(?,?,?)', ('fixture', end or 0, 3))

    def probe(self, **kwargs):
        return activity.probe(self.target, self.profile, **kwargs)

    def confirmation_fixture(self):
        rollout = self.codex()
        self.history()
        rollout.unlink()
        with database(self.profile / '.codex' / 'state_5.sqlite') as conn:
            conn.execute('UPDATE threads SET updated_at_ms=1577836900000')
        proposal = activity.propose_idle_confirmations(['fixture'], self.profile)
        self.assertEqual(len(proposal['entries']), 1)
        self.assertNotIn('confirmedAt', proposal)
        state = self.profile / 'companion-state'
        self.assertFalse(state.exists())
        state.mkdir()
        self.write_confirmation(state, proposal)
        return state, proposal, rollout

    def write_confirmation(self, state, proposal):
        value = dict(proposal, confirmedAt=datetime.now(timezone.utc).isoformat())
        (state / activity.CONFIRMATION_FILE).write_text(json.dumps(value), encoding='utf-8')

    def test_absent_provider_stores_are_not_unreadable_installed_stores(self):
        self.assertEqual(self.probe(), {'allow': True, 'reason': None})
        (self.profile / '.codex').mkdir()
        self.assertEqual(self.probe()['reason'], 'activity-unavailable')

    def test_codex_stale_unfinished_turn_blocks_and_completed_turn_clears(self):
        rollout = self.codex(events=[{'type': 'task_started', 'turn_id': 'a'}])
        old = datetime.now().timestamp() - 30 * 86400
        os.utime(rollout, (old, old))
        self.assertEqual(self.probe()['reason'], 'active-session')
        with rollout.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps({'type': 'event_msg', 'payload': {'type': 'task_complete', 'turn_id': 'a'}}) + '\n')
        self.assertTrue(self.probe()['allow'])

    @unittest.skipUnless(os.name == 'nt', 'Win32 extended path fixture')
    def test_codex_extended_paths_still_block_matching_workspace(self):
        rollout = self.codex(cwd='\\\\?\\' + str(self.target), events=[{'type': 'task_started', 'turn_id': 'a'}])
        with database(self.profile / '.codex' / 'state_5.sqlite') as conn:
            conn.execute('UPDATE threads SET rollout_path=?', ('\\\\?\\' + str(rollout),))
        self.assertEqual(self.probe()['reason'], 'active-session')

    def test_broad_root_session_blocks_descendant_and_unrelated_scope_does_not(self):
        self.codex(cwd=self.target.parent, events=[{'type': 'task_started', 'turn_id': 'a'}])
        self.assertEqual(self.probe()['reason'], 'active-session')
        self.assertTrue(activity.probe(self.profile / 'elsewhere', self.profile)['allow'])

    def test_other_turn_completion_cannot_clear_running_turn(self):
        self.codex(events=[{'type': 'task_started', 'turn_id': 'a'}, {'type': 'task_complete', 'turn_id': 'b'}])
        self.assertEqual(self.probe()['reason'], 'active-session')

    def test_legacy_terminal_without_turn_id_remains_terminal(self):
        self.codex(events=[{'type': 'task_started', 'turn_id': 'a'}, {'type': 'task_complete'}])
        self.assertTrue(self.probe()['allow'])

    def test_unknown_missing_and_partial_lifecycle_fail_closed(self):
        path = self.codex()
        self.assertEqual(self.probe()['reason'], 'activity-uncertain')
        path.write_text('{"type":"event_msg"', encoding='utf-8')
        self.assertEqual(self.probe()['reason'], 'activity-unavailable')

    def test_archived_codex_threads_do_not_block(self):
        self.codex(events=[{'type': 'task_started'}], archived=1)
        self.assertTrue(self.probe()['allow'])

    def test_durable_terminal_history_clears_missing_rollout_only_with_coverage(self):
        path = self.codex()
        path.unlink()
        self.assertEqual(self.probe()['reason'], 'activity-uncertain')
        self.history()
        self.assertTrue(self.probe()['allow'])
        with database(self.profile / '.codex' / 'state_5.sqlite') as conn:
            conn.execute('UPDATE threads SET updated_at_ms=1577836900000')
        self.assertEqual(self.probe()['reason'], 'activity-uncertain')

    def test_only_exact_read_only_guardian_role_is_excluded(self):
        path = self.codex()
        path.unlink()
        with database(self.profile / '.codex' / 'state_5.sqlite') as conn:
            conn.execute('UPDATE threads SET thread_source=?,source=?', ('guardian_review', json.dumps({'subagent': {'other': 'guardian'}})))
        self.assertTrue(self.probe()['allow'])
        with database(self.profile / '.codex' / 'state_5.sqlite') as conn:
            conn.execute('UPDATE threads SET source=?', (json.dumps({'subagent': {'other': 'guardian', 'thread_spawn': {'parent_thread_id': 'parent'}}}),))
        self.assertEqual(self.probe()['reason'], 'activity-uncertain')

    def test_terminal_history_coverage_does_not_hide_new_available_work(self):
        path = self.codex(events=[{'type': 'task_complete', 'turn_id': 'old'}])
        self.history(end=path.stat().st_size)
        with database(self.profile / '.codex' / 'state_5.sqlite') as conn:
            conn.execute('UPDATE threads SET updated_at_ms=1577836900000')
        self.assertTrue(self.probe()['allow'])
        with path.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps({'type': 'event_msg', 'payload': {'type': 'task_started', 'turn_id': 'new'}}) + '\n')
        self.assertEqual(self.probe()['reason'], 'active-session')

    def test_missing_file_needs_past_quiet_terminal_timestamp(self):
        path = self.codex()
        path.unlink()
        self.history()
        with database(self.profile / '.codex' / 'thread_history_2.sqlite') as conn:
            conn.execute('UPDATE thread_turns SET started_at=?,completed_at=?', (int(datetime.now(timezone.utc).timestamp()) - 1, int(datetime.now(timezone.utc).timestamp())))
        self.assertEqual(self.probe()['reason'], 'activity-uncertain')
        with database(self.profile / '.codex' / 'thread_history_2.sqlite') as conn:
            conn.execute('UPDATE thread_turns SET completed_at=?', (int(datetime.now(timezone.utc).timestamp()) + 1000,))
        self.assertEqual(self.probe()['reason'], 'activity-uncertain')

    def test_unprojected_user_suffix_cannot_inherit_finished_history(self):
        path = self.codex(events=[{'type': 'task_complete', 'turn_id': 'old'}])
        self.history(end=path.stat().st_size)
        with path.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps({'type': 'response_item', 'payload': {'type': 'message', 'role': 'user'}}) + '\n')
        self.assertEqual(self.probe()['reason'], 'activity-uncertain')

    def test_uncovered_history_is_not_missing_file_completion_proof(self):
        path = self.codex()
        self.history()
        path.unlink()
        with database(self.profile / '.codex' / 'thread_history_2.sqlite') as conn:
            conn.execute('UPDATE thread_history_projection_state SET next_rollout_ordinal=2')
        self.assertEqual(self.probe()['reason'], 'activity-uncertain')

    def test_durable_in_progress_vetoes_even_terminal_rollout_and_old_age(self):
        self.codex(events=[{'type': 'task_complete'}])
        self.history(status='inProgress')
        self.assertEqual(self.probe()['reason'], 'active-session')

    def test_terminal_index_reads_only_appended_suffix_and_new_work_vetoes(self):
        path = self.codex(events=[{'type': 'task_complete'}])
        path.write_text(json.dumps({'type': 'metadata', 'ignored': 'x' * (activity.MAX_TOTAL_READ + 1)}) + '\n', encoding='utf-8')
        self.history(end=path.stat().st_size)
        self.assertTrue(self.probe()['allow'])
        with path.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps({'type': 'event_msg', 'payload': {'type': 'task_started', 'turn_id': 'new'}}) + '\n')
        self.assertEqual(self.probe()['reason'], 'active-session')

    def test_unknown_durable_status_and_malformed_coverage_fail_closed(self):
        self.codex(events=[{'type': 'task_complete'}])
        self.history(status='unknown')
        self.assertEqual(self.probe()['reason'], 'activity-uncertain')

    def test_gemini_busy_stays_blocked_and_old_idle_is_clear(self):
        root = self.profile / '.gemini' / 'antigravity'
        root.mkdir(parents=True)
        path = root / 'conversation_summaries.db'
        with database(path) as conn:
            conn.execute('CREATE TABLE conversation_summaries(workspace_uris TEXT,status TEXT,not_fully_idle INTEGER,killed INTEGER,last_modified_time TEXT)')
            conn.execute('INSERT INTO conversation_summaries VALUES(?,?,?,?,?)', (json.dumps([self.target.as_uri()]), 'CASCADE_RUN_STATUS_RUNNING', 1, 0, '2020-01-01T00:00:00Z'))
        self.assertEqual(self.probe()['reason'], 'active-session')
        with database(path) as conn:
            conn.execute("UPDATE conversation_summaries SET status='CASCADE_RUN_STATUS_IDLE',not_fully_idle=0")
        self.assertTrue(self.probe()['allow'])

    def test_gemini_unknown_workspace_and_partial_schema_fail_closed(self):
        root = self.profile / '.gemini' / 'antigravity'
        root.mkdir(parents=True)
        path = root / 'conversation_summaries.db'
        with database(path) as conn:
            conn.execute('CREATE TABLE conversation_summaries(workspace_uris TEXT,status TEXT)')
        self.assertEqual(self.probe()['reason'], 'activity-unavailable')

    def test_gemini_old_terminal_record_does_not_need_historical_scope(self):
        root = self.profile / '.gemini' / 'antigravity'
        root.mkdir(parents=True)
        path = root / 'conversation_summaries.db'
        with database(path) as conn:
            conn.execute('CREATE TABLE conversation_summaries(workspace_uris TEXT,status TEXT,not_fully_idle INTEGER,killed INTEGER,last_modified_time TEXT)')
            conn.execute('INSERT INTO conversation_summaries VALUES(?,?,?,?,?)', ('legacy serialized scope', 'CASCADE_RUN_STATUS_IDLE', 0, 0, '2020-01-01T00:00:00Z'))
        self.assertTrue(self.probe()['allow'])
        with database(path) as conn:
            conn.execute("UPDATE conversation_summaries SET status='CASCADE_RUN_STATUS_RUNNING',not_fully_idle=1")
        self.assertEqual(self.probe()['reason'], 'activity-uncertain')

    def test_claude_unarchived_metadata_is_not_idle_proof(self):
        root = self.profile / 'AppData' / 'Roaming' / 'Claude' / 'claude-code-sessions'
        root.mkdir(parents=True)
        path = root / 'local_fixture.json'
        path.write_text(json.dumps({'cwd': str(self.target), 'isArchived': False, 'lastActivityAt': 1}), encoding='utf-8')
        self.assertEqual(self.probe()['reason'], 'activity-uncertain')
        path.write_text(json.dumps({'cwd': str(self.target), 'isArchived': True}), encoding='utf-8')
        self.assertTrue(self.probe()['allow'])

    def test_windows_uri_scope_uses_path_components(self):
        self.assertTrue(activity._scope('c:/users/owner/gh/project', ['file:///C:/Users/owner/gh']))  # machine-path-ok: synthetic Windows URI fixture.
        self.assertFalse(activity._scope('c:/users/owner/gh/project', ['C:\\Users\\owner\\gh\\project-old']))  # machine-path-ok: synthetic Windows boundary fixture.
        self.assertIsNone(activity._scope('c:/users/owner/gh/project', ['relative/path']))  # machine-path-ok: synthetic Windows scope fixture.
        self.assertTrue(activity._scope('c:/users/owner/gh/project', ['\\\\?\\C:\\Users\\owner\\gh']))  # machine-path-ok: synthetic extended Windows path fixture.
        self.assertEqual(activity._path('\\\\?\\UNC\\server\\share\\folder'), '//server/share/folder')

    def test_invalid_numeric_timestamp_is_bounded_and_unknown(self):
        for value in ('inf', 'nan', 1e100, True, None):
            self.assertIsNone(activity._time(value))
        self.assertEqual(activity._time('1795417200000'), 1795417200)

    def test_exact_owner_confirmation_only_waives_missing_catalog_drift(self):
        state, proposal, rollout = self.confirmation_fixture()
        before = (self.profile / '.codex' / 'state_5.sqlite').read_bytes()
        self.assertEqual(self.probe()['reason'], 'activity-uncertain')
        self.assertTrue(self.probe(state=state)['allow'])
        self.assertEqual(before, (self.profile / '.codex' / 'state_5.sqlite').read_bytes())
        self.assertNotIn(str(self.profile), json.dumps(proposal))
        self.assertEqual(set(proposal['entries'][0]), {'threadId', 'catalogUpdatedAt', 'rolloutIdentity', 'terminalFingerprint'})
        rollout.write_text(json.dumps({'type': 'event_msg', 'payload': {'type': 'task_started', 'turn_id': 'new'}}) + '\n', encoding='utf-8')
        self.assertEqual(self.probe(state=state)['reason'], 'active-session')

    def test_confirmation_invalidates_on_catalog_history_projection_or_path_change(self):
        state, _proposal, _rollout = self.confirmation_fixture()
        cases = [
            ('state_5.sqlite', 'UPDATE threads SET updated_at_ms=updated_at_ms+1', 'UPDATE threads SET updated_at_ms=1577836900000'),
            ('thread_history_2.sqlite', 'UPDATE thread_turns SET completed_at=completed_at+1', 'UPDATE thread_turns SET completed_at=1577836801'),
            ('thread_history_2.sqlite', 'UPDATE thread_history_projection_state SET next_rollout_ordinal=next_rollout_ordinal+1', 'UPDATE thread_history_projection_state SET next_rollout_ordinal=3'),
            ('thread_history_2.sqlite', 'UPDATE thread_turns SET turn_id=\'another-turn\'', 'UPDATE thread_turns SET turn_id=\'turn-fixture\'')]
        for name, change, restore in cases:
            with self.subTest(change=change):
                with database(self.profile / '.codex' / name) as conn:
                    conn.execute(change)
                self.assertEqual(self.probe(state=state)['reason'], 'activity-uncertain')
                with database(self.profile / '.codex' / name) as conn:
                    conn.execute(restore)
                self.assertTrue(self.probe(state=state)['allow'])
        with database(self.profile / '.codex' / 'state_5.sqlite') as conn:
            conn.execute('UPDATE threads SET rollout_path=?', (str(self.profile / '.codex' / 'sessions' / 'changed.jsonl'),))
        self.assertEqual(self.probe(state=state)['reason'], 'activity-uncertain')

    def test_active_and_unrecognized_history_veto_confirmations(self):
        state, _proposal, _rollout = self.confirmation_fixture()
        for status, expected in (('inProgress', 'active-session'), ('unknown', 'activity-uncertain')):
            with database(self.profile / '.codex' / 'thread_history_2.sqlite') as conn:
                conn.execute('UPDATE thread_turns SET status=?', (status,))
            self.assertEqual(self.probe(state=state)['reason'], expected)
            self.assertEqual(activity.propose_idle_confirmations(['fixture'], self.profile)['entries'], [])

    def test_confirmation_file_is_bounded_validated_and_cannot_confirm_the_future(self):
        state, proposal, _rollout = self.confirmation_fixture()
        path = state / activity.CONFIRMATION_FILE
        original = json.loads(path.read_text(encoding='utf-8'))
        malformed = [None, {'version': 1, 'entries': []}, dict(original, version=True),
                     dict(original, proposedAt={}), dict(original, unknownFlag=True),
                     dict(original, confirmedAt=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat()),
                     dict(original, confirmedAt='2020-01-01T00:00:02+00:00'),
                     dict(original, entries=original['entries'] * 2)]
        for value in malformed:
            path.write_text(json.dumps(value), encoding='utf-8')
            self.assertEqual(self.probe(state=state)['reason'], 'activity-uncertain')
        path.write_text(' ' * (activity.MAX_CONFIRMATION_BYTES + 1), encoding='utf-8')
        self.assertEqual(self.probe(state=state)['reason'], 'activity-uncertain')
        path.write_text('{', encoding='utf-8')
        self.assertEqual(self.probe(state=state)['reason'], 'activity-uncertain')
        self.write_confirmation(state, proposal)
        with database(self.profile / '.codex' / 'state_5.sqlite') as conn:
            conn.execute('UPDATE threads SET updated_at_ms=?', (round((datetime.now(timezone.utc).timestamp() + 1000) * 1000),))
        self.assertEqual(activity.propose_idle_confirmations(['fixture'], self.profile)['entries'], [])
        self.assertEqual(self.probe(state=state)['reason'], 'activity-uncertain')

    def test_default_probe_gets_state_and_injected_two_argument_probe_stays_compatible(self):
        state = self.profile / 'companion-state'
        with patch.object(activity, 'probe', return_value={'allow': True, 'reason': None}) as default:
            sync._activity(self.target, self.profile, None, state)
            default.assert_called_once_with(self.target, self.profile, state=state)
        seen = []
        sync._activity(self.target, self.profile, lambda path, profile: seen.append((path, profile)) or {'allow': True}, state)
        self.assertEqual(seen, [(self.target, self.profile)])

    @unittest.skipUnless(os.name == 'nt', 'Windows argv and CIM boundary')
    def test_process_guard_parses_modes_and_never_prompt_substrings(self):
        with patch.object(activity, 'run_bounded', return_value=subprocess.CompletedProcess([], 0, 'idle\n', '')) as mocked:
            self.assertIsNone(self.original_cli())
            script = mocked.call_args.args[0][-1]
        def quote(value):
            return "'" + value.replace("'", "''") + "'"
        cases = [
            ('codex.exe', '"C:\\fixture\\codex.exe" -c "setting=value" app-server', 'idle'),
            ('codex.exe', '"C:\\fixture\\codex.exe" -c a=b --config c=d exec-server', 'idle'),
            ('codex.exe', '"C:\\fixture\\codex.exe" app-server', 'idle'),
            ('codex.exe', '"C:\\fixture\\codex.exe" exec "codex.exe app-server"', 'cli'),
            ('codex.exe', '"C:\\fixture\\codex.exe" --unknown app-server', 'unknown'),
            ('node.exe', 'node.exe C:\\fixture\\node_modules\\@google\\gemini-cli\\dist\\index.js --prompt hello', 'cli'),
            ('node.exe', 'node.exe C:\\fixture\\safe.js "C:\\node_modules\\@google\\gemini-cli\\dist\\index.js"', 'idle')]
        lines = ['function Get-CimInstance { param($ClassName,$Filter,$OperationTimeoutSec) $global:CompanionFixture }', '$check = {' + script + '}']
        for name, line, _expected in cases:
            lines.append('$global:CompanionFixture=[pscustomobject]@{Name=' + quote(name) + ';CommandLine=' + quote(line) + ";ExecutablePath='C:\\fixture\\process.exe'}; & $check")
        result = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', '\n'.join(lines)], capture_output=True, encoding='utf-8', errors='replace', timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.split(), [row[2] for row in cases])


if __name__ == '__main__':
    unittest.main(verbosity=2)
