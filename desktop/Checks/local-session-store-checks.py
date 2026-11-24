"""Exercise durable evidence across shortened sources and concurrent writers."""
from concurrent.futures import ThreadPoolExecutor
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
import local_session_backfill as backfill
import local_session_store as store
import local_sessions as sessions


def record(items=(), **extras):
    prompts, replies = extras.pop('prompts', []), extras.pop('replies', [])
    return sessions.record('codex', 'thread-00001', 'Fixture', '2026-11-01T00:00:00Z',
                           '2026-11-02T00:00:00Z', prompts, replies, {}, '', [], [], 'fixture',
                           kind='user', source_items=list(items), **extras)


class StoreChecks(unittest.TestCase):
    def test_shorter_source_retains_evidence_and_truthful_counters(self):
        _, prior = record([{'id': 'one', 'data': {'value': 'original'}}, {'id': 'two', 'data': {}}],
                          calls=[{'id': 'call', 'name': 'command', 'body': 'Result'}],
                          injected=[{'id': 'context', 'body': 'Instructions'}])
        _, fresh = record([{'id': 'two', 'data': {}}])
        value = store.merge(prior, fresh)
        self.assertEqual({r['id'] for r in value['source_items']}, {'one', 'two'})
        self.assertEqual(value['calls_total'], 1)
        self.assertEqual(value['injected_total'], 1)
        self.assertEqual(value['capture']['state'], 'partial')
        self.assertEqual(value['capture']['retained_from_prior']['source_items'], 1)

    def test_revision_updates_view_without_erasing_earlier_source(self):
        _, prior = record([{'id': 'draft', 'latest': True, 'data': {'text': 'Draft'}}],
                          replies=[{'id': 'draft', 'source_item': 'draft', 'text': 'Draft'}])
        _, fresh = record([{'id': 'draft', 'latest': False, 'data': {'text': 'Draft'}},
                           {'id': 'final', 'latest': True, 'supersedes': 'draft', 'data': {'text': 'Final'}}],
                          replies=[{'id': 'final', 'source_item': 'final', 'text': 'Final'}])
        value = store.merge(prior, fresh)
        self.assertEqual([r['text'] for r in value['replies']], ['Final'])
        self.assertEqual(len(value['source_items']), 2)
        prior['capture']['captured_at'] = '2026-11-01T00:00:00Z'
        fresh['capture']['captured_at'] = '2026-11-02T00:00:00Z'
        self.assertEqual([r['text'] for r in store.merge(fresh, prior)['replies']], ['Final'])

    def test_timestamps_order_whole_seconds_before_fractional_seconds(self):
        _, prior = record()
        _, fresh = record()
        prior['ended'] = '2026-11-02T00:00:00Z'
        fresh['ended'] = '2026-11-02T00:00:00.500000Z'
        self.assertEqual(store.merge(prior, fresh)['ended'], fresh['ended'])
        self.assertLess(store.order({'at': prior['ended']}), store.order({'at': fresh['ended']}))

    def test_newer_observation_of_shortened_source_keeps_current_gap_report(self):
        _, prior = record([{'id': 'tail', 'data': {}}], source_metadata={'catalog': {'updated_at': 1700000000}})
        _, fresh = record(source_metadata={'catalog': {'updated_at': 1700000000}},
                          capture={'state': 'partial', 'gaps': ['Source became unavailable']})
        prior['capture']['captured_at'] = '2026-11-02T00:00:00Z'
        fresh['capture']['captured_at'] = '2026-11-03T00:00:00Z'
        fresh['ended'] = '2026-11-01T00:00:00Z'
        value = store.merge(prior, fresh)
        self.assertIn('Source became unavailable', value['capture']['gaps'])
        self.assertEqual(value['ended'], prior['ended'])

    def test_updated_native_item_keeps_prior_payload_as_revision(self):
        _, prior = record([{'id': 'one', 'data': {'status': 'running'}}])
        _, fresh = record([{'id': 'one', 'data': {'status': 'completed'}}])
        value = store.merge(prior, fresh)
        self.assertEqual(value['source_items'][0]['data']['status'], 'completed')
        self.assertEqual(value['source_revisions'][0]['data']['status'], 'running')

    def test_attachment_siblings_relationships_and_owner_provenance_survive(self):
        _, prior = record(attachments=[{'source_item': 'same', 'kind': 'media', 'data': ['image']},
                                      {'source_item': 'same', 'kind': 'artifact', 'data': ['file']}],
                          relationships=[{'session_id': 'parent-one'}])
        _, fresh = record()
        value = store.merge(prior, fresh)
        self.assertEqual(len(value['attachments']), 2)
        self.assertEqual(value['relationships'], [{'session_id': 'parent-one'}])
        args = ('codex', 'thread-00001', '', 1700000000, 1700000001,
                [{'text': 'Owner', 'origin': {'kind': 'user'}}], [], {}, '', [], [], 'fixture')
        owner = sessions.record(*args)[1]['prompts'][0]
        self.assertNotIn('origin', owner)
        self.assertEqual(owner['provenance']['kind'], 'user')

    def test_path_is_pinned_and_unverified_legacy_prose_is_not_owner_input(self):
        _, prior = record()
        prior.update(format='local-conversation/1', schema=5,
                     prompts=[{'at': '2026-11-01T00:00:00Z', 'text': 'Inherited context'}])
        _, fresh = record()
        fresh['day'] = '2026-11-02'
        value = store.merge(prior, fresh)
        self.assertEqual(value['day'], '2026-11-01')
        self.assertEqual(value['prompts'], [])
        self.assertEqual(value['legacy_entries'][0]['text'], 'Inherited context')
        bad = dict(fresh, session_id='other-thread')
        with self.assertRaises(ValueError):
            store.merge(prior, bad)
        with self.assertRaises(ValueError):
            store.merge(fresh, prior)

    def test_prior_owner_history_remains_readable_when_source_disappears(self):
        _, prior = record(prompts=[{'at': '2026-11-01T00:00:00Z', 'text': 'Owner ask'}],
                          replies=[{'at': '2026-11-01T00:00:01Z', 'text': 'Saved answer'}])
        prior.update(format='local-conversation/1', schema=5)
        prior['capture']['source'] = 'history-database'
        _, fresh = record()
        value = store.merge(prior, fresh)
        self.assertEqual(value['prompts'][0]['text'], 'Owner ask')
        self.assertEqual(value['replies'][0]['text'], 'Saved answer')
        self.assertEqual(value['exchanges'], 1)
        self.assertEqual(value['prompts'][0]['provenance']['basis'], 'prior-history-projection')
        _, restored = record(prompts=[{'id': 'real', 'at': '2026-11-01T00:00:00Z', 'text': 'Owner ask'}])
        self.assertEqual(len(store.merge(value, restored)['prompts']), 1)

    def test_concurrent_staging_serializes_union_and_unchanged_poll_keeps_time(self):
        with tempfile.TemporaryDirectory() as directory:
            path, first = record([{'id': 'one', 'data': {}}])
            first['capture']['captured_at'] = '2026-11-01T01:00:00Z'
            store.stage([(path, first)], directory)
            _, second = record([{'id': 'two', 'data': {}}])
            _, third = record([{'id': 'three', 'data': {}}])
            with ThreadPoolExecutor(max_workers=2) as pool:
                list(pool.map(lambda r: store.stage([r], directory), [(path, second), (path, third)]))
            with closing(sqlite3.connect(Path(directory) / 'local-sessions/captured.sqlite')) as conn:
                import json
                value = json.loads(conn.execute('select body from captured').fetchone()[0])
            self.assertEqual({r['id'] for r in value['source_items']}, {'one', 'two', 'three'})
            fresh = dict(value, capture={**value['capture'], 'captured_at': '2026-11-03T00:00:00Z'})
            self.assertEqual(store.merge(value, fresh)['capture']['captured_at'], value['capture']['captured_at'])

    def test_narrow_omissions_leave_command_code_and_unknown_fields_whole(self):
        counts = {}
        original = {'code': 'data:image/png;base64,sample', 'data': 'ordinary text', 'binary_catalog': b'opaque metadata',
                    'unknown': {'a': 'b'}, 'media': [{'uri': 'data:image/png;base64,AAAA'}],
                    'encrypted_content': 'opaque'}
        value = sessions.clean_payload(original, counts)
        self.assertEqual(value['code'], original['code'])
        self.assertEqual(value['data'], original['data'])
        self.assertEqual(value['unknown'], original['unknown'])
        self.assertEqual(value['binary_catalog']['encoding'], 'base64')
        self.assertEqual(value['binary_catalog']['bytes'], len(original['binary_catalog']))
        self.assertEqual(value['media'][0]['uri']['omitted'], 'media_bytes')
        self.assertEqual(counts, {'media_bytes': 1, 'encrypted_content': 1})
        self.assertEqual(sessions.clean_payload(value), value)

    def test_pending_survives_no_new_capture_and_ack_does_not_hide_newer_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            path, first = record([{'id': 'one', 'data': {}}])
            store.stage([(path, first)], directory)
            batch = next(store.pending(directory))
            self.assertEqual(len(batch), 1)
            store.stage([], directory)
            self.assertEqual(len(next(store.pending(directory))), 1)
            _, fresh = record([{'id': 'two', 'data': {}}])
            store.stage([(path, fresh)], directory)
            store.acknowledge(directory, batch)
            updated = next(store.pending(directory))
            self.assertEqual(len(updated[0][1]['source_items']), 2)
            store.acknowledge(directory, updated)
            self.assertEqual(list(store.pending(directory)), [])

    def test_second_identical_collection_does_not_queue_a_new_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            path, candidate = record([{'id': 'one', 'data': {}}])
            store.stage([(path, candidate)], directory)
            batch = next(store.pending(directory))
            store.acknowledge(directory, batch)
            _, fresh = record([{'id': 'one', 'data': {}}])
            store.stage([(path, fresh)], directory)
            self.assertEqual(list(store.pending(directory)), [])

    def test_stage_rejects_foreign_path_and_join_key_collision(self):
        with tempfile.TemporaryDirectory() as directory:
            path, first = record()
            store.stage([(path, first)], directory)
            wrong = dict(first, session_id='another-thread')
            with self.assertRaises(ValueError):
                store.stage([(path, wrong)], directory)
            with self.assertRaises(ValueError):
                store.stage([('sessions/2026/11/2026-11-01-0000000000000000.json', first)], directory)

    def test_remote_blob_with_swapped_filename_is_rejected(self):
        path, candidate = record()
        foreign = path.replace(candidate['short'], '0' * 16)
        body = store.encode(candidate)
        oid = 'a' * 40
        def git(repository, command, *args, **kwargs):
            if command == 'ls-tree':
                # The filename selects another wanted join key, while its body
                # claims the first identity. Both claims must agree.
                return ('100644 blob ' + oid + '\t' + foreign).encode() + b'\0'
            return (oid + ' blob ' + str(len(body)) + '\n').encode() + body + b'\n'
        hint = {'assistant': 'codex', 'session_id': 'other-thread', 'short': '0' * 16}
        with self.assertRaises(ValueError):
            store.prior_records(Path('.'), 'revision', [(path, candidate), (foreign, hint)], git)

    def test_run_retries_pending_evidence_even_without_current_source_records(self):
        with tempfile.TemporaryDirectory() as directory:
            path, candidate = record([{'id': 'saved', 'data': {'text': 'Saved before source vanished'}}])
            store.stage([(path, candidate)], directory)
            snapshot = {'checkouts': [], 'sessions': [], 'observedAt': '2026-11-24T00:00:00Z'}
            with patch.object(activity, 'build', return_value=(snapshot, [])), \
                 patch.object(activity, 'publish', return_value='published') as publish:
                result = activity.run(Path(directory), Path(directory), Path(directory), push=True)
            self.assertEqual(result['records'], 1)
            self.assertEqual(publish.call_args_list[0].args[2], 'main')
            self.assertIn(path, publish.call_args_list[0].args[1])
            self.assertEqual(list(store.pending(directory)), [])

    def test_preview_streams_without_retaining_prepared_records(self):
        with tempfile.TemporaryDirectory() as directory:
            path, candidate = record()
            staged = []
            prepared, report = backfill.prepare(iter([(path, candidate)]), None, None, directory,
                                                prior={}, retain=False,
                                                on_record=lambda p, r: staged.append(p))
            self.assertEqual(prepared, [])
            self.assertEqual(staged, [path])
            self.assertEqual(report['records'], 1)

    def git(self, path, *arguments):
        result = subprocess.run(['git', '-C', str(path), '-c', 'core.hooksPath=' + str(Path(path) / 'no-hooks'),
                                 '-c', 'commit.gpgsign=false', *arguments], capture_output=True, check=True)
        return result.stdout.decode().strip()

    def test_publisher_unions_remote_evidence_and_keeps_existing_path_and_index(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            repository, remote = base / 'repo', base / 'remote.git'
            repository.mkdir()
            self.git(repository, 'init', '--initial-branch=main')
            self.git(repository, 'config', 'user.name', 'Fixture')
            self.git(repository, 'config', 'user.email', 'fixture@example.test')
            path, prior = record([{'id': 'old', 'data': {'result': 'Evidence'}}])
            target = repository / path
            target.parent.mkdir(parents=True)
            target.write_bytes(store.encode(prior))
            self.git(repository, 'add', path)
            self.git(repository, 'commit', '-m', 'seed')
            self.git(repository, 'init', '--bare', str(remote))
            self.git(repository, 'remote', 'add', 'origin', str(remote))
            self.git(repository, 'push', 'origin', 'main')
            index = (repository / '.git/index').read_bytes()
            head = self.git(repository, 'rev-parse', 'HEAD')
            _, fresh = record([{'id': 'new', 'data': {}}])
            fresh['day'] = '2026-11-02'
            new_path = sessions.record_path(fresh)
            with patch.object(activity.inventory, 'approved_origin', return_value=True):
                result = activity.publish(repository, {new_path: store.encode(fresh)}, 'main', 'Fixture')
            self.assertEqual(result, 'published')
            import json
            value = json.loads(self.git(repository, 'show', 'origin/main:' + path))
            self.assertEqual({r['id'] for r in value['source_items']}, {'old', 'new'})
            paths = self.git(repository, 'ls-tree', '-r', '--name-only', 'origin/main')
            self.assertNotIn(new_path, paths)
            self.assertEqual((repository / '.git/index').read_bytes(), index)
            self.assertEqual(self.git(repository, 'rev-parse', 'HEAD'), head)

    def test_backfill_defaults_to_preview_and_reports_counts_without_content(self):
        with tempfile.TemporaryDirectory() as directory:
            path, candidate = record([{'id': 'one', 'data': {'text': 'PRIVATE CONTENT'}}])
            rows, report = backfill.prepare([(path, candidate)], None, None, directory)
            self.assertTrue((Path(directory) / path).is_file())
            self.assertEqual(report['new'], 1)
            self.assertNotIn('PRIVATE CONTENT', store.encode(report).decode())
            self.assertEqual(rows[0][1]['format'], 'local-conversation/2')


if __name__ == '__main__':
    unittest.main()
