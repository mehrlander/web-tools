"""Capture from real SQLite fixtures and publish without altering a checkout."""
import json
from contextlib import closing
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / 'worker'))
import local_activity as activity
import local_sessions as sessions


class CaptureChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.profile = Path(self.temp.name)
        self.root = self.profile / 'gh'
        self.root.mkdir()
        self.state = self.profile / 'state'

    def test_codex_history_survives_absent_rollout_and_reports_missing(self):
        root = self.profile / '.codex'
        root.mkdir()
        with closing(sqlite3.connect(root / 'state_5.sqlite')) as db, db:
            db.execute('create table threads(id,title,cwd,rollout_path,created_at,updated_at)')
            for identity in ['thread-0001', 'thread-0002']:
                db.execute('insert into threads values(?,?,?,?,?,?)', (identity, 'Fixture work', str(self.root / 'project'), 'missing.jsonl', 1700000000, 1700000020))
        with closing(sqlite3.connect(root / 'thread_history_1.sqlite')) as db, db:
            db.execute('create table thread_items(thread_id,item_json,item_type,created_at_ms,rollout_ordinal)')
            values = [('userMessage', {'content': [{'type': 'text', 'text': 'Preserve this ask'}]}),
                      ('agentMessage', {'text': 'Preserve this reply'}), ('reasoning', {'text': 'MUST_NOT_CAPTURE'})]
            for i, (kind, value) in enumerate(values):
                db.execute('insert into thread_items values(?,?,?,?,?)', ('thread-0001', json.dumps(value), kind, 1700000000000 + i * 1000, i))
        checkouts = [{'id': 'co', 'path': self.root / 'project', 'repo': 'fixture/project'}]
        records, coverage = sessions.codex(self.profile, checkouts)
        self.assertEqual((coverage['captured'], coverage['unavailable']), (1, 1))
        record = records[0][1]
        self.assertEqual(record['capture']['source'], 'history-database')
        self.assertEqual(record['repos'][0]['checkout'], 'co')
        self.assertEqual(record['replies'][0]['text'], 'Preserve this reply')
        self.assertNotIn('MUST_NOT_CAPTURE', json.dumps(record))
        self.assertNotEqual(record['short'], 'thread-0')

    def test_gemini_new_root_duplicate_steps_and_no_reasoning(self):
        root = self.profile / '.gemini/antigravity'
        root.mkdir(parents=True)
        with closing(sqlite3.connect(root / 'conversation_summaries.db')) as db, db:
            db.execute('create table conversation_summaries(conversation_id,title,workspace_uris,killed,last_modified_time)')
            db.execute('insert into conversation_summaries values(?,?,?,?,?)', ('gemini-0001', 'New root', json.dumps([(self.root / 'project').as_uri()]), 0, '2026-11-11T00:00:00Z'))
        path = root / 'brain/gemini-0001/.system_generated/logs/transcript.jsonl'
        path.parent.mkdir(parents=True)
        rows = [dict(step_index=0, source='USER_EXPLICIT', type='USER_INPUT', content='Ask', created_at='2026-11-11T00:00:00Z'),
                dict(step_index=1, source='MODEL', type='PLANNER_RESPONSE', content='Draft reply', created_at='2026-11-11T00:00:01Z'),
                dict(step_index=1, source='MODEL', type='PLANNER_RESPONSE', content='Final reply', thinking='MUST_NOT_CAPTURE', created_at='2026-11-11T00:00:01Z',
                     tool_calls=[{'name': 'view_file', 'args': {'AbsolutePath': str(self.root / 'project/readme.txt')}}])]
        path.write_text('\n'.join(map(json.dumps, rows)))
        records, coverage = sessions.gemini(self.profile, [{'id': 'co', 'path': self.root / 'project', 'repo': 'fixture/project'}])
        record = records[0][1]
        self.assertEqual(coverage['captured'], 1)
        self.assertEqual([r['text'] for r in record['replies']], ['Final reply'])
        self.assertEqual(record['repos'][0]['checkout'], 'co')
        self.assertNotIn('MUST_NOT_CAPTURE', json.dumps(record))

    def git(self, repo, *args):
        value = subprocess.run(['git', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=' + str(self.profile / 'no-hooks'), '-C', str(repo), *args], capture_output=True, text=True)
        self.assertEqual(value.returncode, 0, value.stderr)
        return value.stdout.strip()

    def repo(self, path):
        path.mkdir(parents=True)
        self.git(path, 'init', '--initial-branch=main')
        self.git(path, 'config', 'user.name', 'Fixture')
        self.git(path, 'config', 'user.email', 'fixture@example.test')
        (path / 'keep.txt').write_text('Keep source')
        self.git(path, 'add', 'keep.txt')
        self.git(path, 'commit', '-m', 'seed')
        return path

    def test_worktrees_share_stash_store_and_failed_comparisons_stay_unknown(self):
        repo = self.repo(self.root / 'project')
        sibling = self.root / 'second'
        self.git(repo, 'worktree', 'add', '-b', 'feature', str(sibling))
        (repo / 'keep.txt').write_text('local work')
        snapshot, _ = activity.build(self.root, self.state, self.profile, legacy=False)
        self.assertEqual(len(snapshot['checkouts']), 2)
        self.assertEqual(len(snapshot['stores']), 1)
        self.assertEqual({r['integration'] for r in snapshot['checkouts']}, {'unknown'})
        changed = next(r for r in snapshot['checkouts'] if r['path'] == 'project')
        self.assertEqual((changed['publication'], changed['changed']), ('unknown', 1))

    def test_named_publication_preserves_index_files_and_remote_siblings(self):
        repo = self.repo(self.root / 'store')
        remote = self.profile / 'remote.git'
        self.git(repo, 'init', '--bare', str(remote))
        self.git(repo, 'remote', 'add', 'origin', str(remote))
        self.git(repo, 'push', 'origin', 'main')
        (repo / 'keep.txt').write_text('STAGED_WORK_MUST_SURVIVE')
        self.git(repo, 'add', 'keep.txt')
        before = (repo / '.git/index').read_bytes()
        head = self.git(repo, 'rev-parse', 'HEAD')
        files = {'sessions/2026/11/2026-11-11-aabbccdd.json': b'{"prompts":[]}\n'}
        with patch.object(activity.inventory, 'approved_origin', return_value=True):
            self.assertEqual(activity.publish(repo, files, 'main', 'Capture fixture'), 'published')
            self.assertEqual(activity.publish(repo, files, 'main', 'Capture fixture'), 'unchanged')
        self.assertEqual((repo / '.git/index').read_bytes(), before)
        self.assertEqual(self.git(repo, 'rev-parse', 'HEAD'), head)
        self.assertEqual((repo / 'keep.txt').read_text(), 'STAGED_WORK_MUST_SURVIVE')
        self.assertEqual(self.git(repo, 'show', 'origin/main:keep.txt'), 'Keep source')
        self.assertFalse((repo / 'sessions').exists())

    def test_standalone_files_are_metadata_only(self):
        folder = self.profile / 'Code/experiment'
        folder.mkdir(parents=True)
        (folder / 'sample.xlsx').write_text('PRIVATE_BODY_NOT_IN_INVENTORY')
        snapshot, _ = activity.build(self.root, self.state, self.profile)
        row = next(r for r in snapshot['standalone'] if r.get('path') == 'experiment')
        self.assertEqual(row['files'], 1)
        self.assertNotIn('PRIVATE_BODY_NOT_IN_INVENTORY', json.dumps(snapshot))


if __name__ == '__main__': unittest.main()
