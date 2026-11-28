"""Bounded collector checks use metadata catalogs and one-thread readers."""
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / 'worker'))
import local_session_collect as collector


class CollectorChecks(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.profile = Path(self.temporary.name)
        self.state = self.profile / 'state'
        self.ids = ['thread-' + str(number).zfill(4) for number in range(20)]

    def catalog(self, profile, provider):
        values = self.ids[:] if provider == 'codex' else []
        return values, {'provider': provider, 'catalog': len(values), 'state': 'ready'}

    def reader(self, provider):
        def read(profile, checkouts, limit=None, identities=None):
            self.assertIsNone(limit)
            self.assertEqual(len(identities), 1, 'A source parse must be bounded to one thread')
            identity = identities[0]
            return [('fixture/' + identity, {'session_id': identity})], {'state': 'ready'}
        return read

    def test_native_catalog_selects_all_kinds_without_reading_payloads(self):
        codex = self.profile / '.codex'
        codex.mkdir()
        with closing(sqlite3.connect(codex / 'state_5.sqlite')) as db, db:
            db.execute('create table threads(id,title,updated_at,source)')
            db.execute('insert into threads values(?,?,?,?)', ('untitled-child', '', 1, 'subagent'))
            db.execute('insert into threads values(?,?,?,?)', ('approval-review', '', 2, 'guardian'))
        gemini = self.profile / '.gemini/antigravity'
        gemini.mkdir(parents=True)
        with closing(sqlite3.connect(gemini / 'conversation_summaries.db')) as db, db:
            db.execute('create table conversation_summaries(conversation_id,title,killed,last_modified_time)')
            db.execute('insert into conversation_summaries values(?,?,?,?)', ('killed-untitled', '', 1, '2026-11-24'))
        identities, coverage = collector.catalog(self.profile, 'codex')
        self.assertEqual(identities, ['approval-review', 'untitled-child'])
        self.assertEqual(coverage['catalog'], 2)
        self.assertEqual(collector.catalog(self.profile, 'gemini')[0], ['killed-untitled'])

    def test_iterator_is_lazy_and_uses_frozen_provider_ids_one_at_a_time(self):
        calls = []
        def reader(provider):
            def capture(profile, checkouts, **kwargs):
                calls.append((provider, kwargs['identities']))
                return [('fixture', {'id': kwargs['identities'][0]})], {}
            return capture
        with patch.object(collector, '_reader', side_effect=reader), \
             patch.object(collector, 'catalog', side_effect=AssertionError('Frozen inventory must not be reread')):
            rows = collector.iter_records(self.profile, [], identities={'codex': ['one', 'two'], 'gemini': ['three']})
            self.assertEqual(calls, [])
            self.assertEqual(next(rows)[1]['id'], 'one')
            self.assertEqual(calls, [('codex', ['one'])])
            self.assertEqual([record['id'] for _, record in rows], ['two', 'three'])

    def test_rotation_is_durable_and_refreshes_recent_with_older_threads(self):
        captured = []
        with patch.object(collector, 'catalog', side_effect=self.catalog), \
             patch.object(collector, '_reader', side_effect=self.reader), \
             patch.object(collector.store, 'stage', side_effect=lambda rows, state: captured.extend(rows)), \
             patch.object(collector.store, 'summaries', return_value=[{'id': 'metadata-only'}]):
            summaries, first = collector.collect(self.profile, [], self.state, limit=4)
            self.assertEqual(summaries, [{'id': 'metadata-only'}])
            self.assertEqual(first['examined'], 4)
            self.assertEqual([row[1]['session_id'] for row in captured], self.ids[:1] + self.ids[8:9] + self.ids[1:2] + self.ids[9:10])
            captured.clear()
            collector.collect(self.profile, [], self.state, limit=4)
            self.assertEqual([row[1]['session_id'] for row in captured], self.ids[2:3] + self.ids[10:11] + self.ids[3:4] + self.ids[11:12])

    def test_budget_stops_between_records_and_resumes_without_skipping(self):
        captured = []
        clock = iter([0, 0, 61, 61])
        with patch.object(collector, 'catalog', side_effect=self.catalog), \
             patch.object(collector, '_reader', side_effect=self.reader), \
             patch.object(collector.store, 'stage', side_effect=lambda rows, state: captured.extend(rows)), \
             patch.object(collector.store, 'summaries', return_value=[]), \
             patch.object(collector.time, 'monotonic', side_effect=lambda: next(clock)):
            _, report = collector.collect(self.profile, [], self.state, limit=4, budget_seconds=60)
        self.assertEqual(report['examined'], 1)
        self.assertTrue(report['budget_exhausted'])
        self.assertEqual(captured[0][1]['session_id'], self.ids[0])
        captured.clear()
        with patch.object(collector, 'catalog', side_effect=self.catalog), \
             patch.object(collector, '_reader', side_effect=self.reader), \
             patch.object(collector.store, 'stage', side_effect=lambda rows, state: captured.extend(rows)), \
             patch.object(collector.store, 'summaries', return_value=[]):
            collector.collect(self.profile, [], self.state, limit=1)
        self.assertEqual(captured[0][1]['session_id'], self.ids[8])

    def test_new_arrival_enters_recent_lane_without_resetting_older_cursor(self):
        captured = []
        with patch.object(collector, 'catalog', side_effect=self.catalog), \
             patch.object(collector, '_reader', side_effect=self.reader), \
             patch.object(collector.store, 'stage', side_effect=lambda rows, state: captured.extend(rows)), \
             patch.object(collector.store, 'summaries', return_value=[]):
            collector.collect(self.profile, [], self.state, limit=2)
            self.ids.insert(0, 'new-arrival')
            captured.clear()
            collector.collect(self.profile, [], self.state, limit=16)
        identities = [record['session_id'] for _, record in captured]
        self.assertIn('new-arrival', identities)
        self.assertIn('thread-0009', identities)

    def test_failed_reader_does_not_starve_following_sources(self):
        attempted, staged = [], []
        def reader(provider):
            def capture(profile, checkouts, **kwargs):
                identity = kwargs['identities'][0]
                attempted.append(identity)
                if identity == self.ids[0]:
                    raise OSError('fixture source unavailable')
                return [('fixture', {'session_id': identity})], {}
            return capture
        with patch.object(collector, 'catalog', side_effect=self.catalog), \
             patch.object(collector, '_reader', side_effect=reader), \
             patch.object(collector.store, 'stage', side_effect=lambda rows, state: staged.extend(rows)), \
             patch.object(collector.store, 'summaries', return_value=[]):
            _, report = collector.collect(self.profile, [], self.state, limit=2)
        self.assertEqual(attempted, [self.ids[0], self.ids[8]])
        self.assertEqual(report['examined'], 2)
        self.assertEqual(report['errors'][0]['phase'], 'capture')
        self.assertEqual(len(staged), 1)

    def test_failed_stage_leaves_cursor_for_retry(self):
        with patch.object(collector, 'catalog', side_effect=self.catalog), \
             patch.object(collector, '_reader', side_effect=self.reader), \
             patch.object(collector.store, 'stage', side_effect=OSError('fixture disk failure')), \
             patch.object(collector.store, 'summaries', return_value=[]):
            _, report = collector.collect(self.profile, [], self.state, limit=2)
        self.assertEqual(report['examined'], 0)
        captured = []
        with patch.object(collector, 'catalog', side_effect=self.catalog), \
             patch.object(collector, '_reader', side_effect=self.reader), \
             patch.object(collector.store, 'stage', side_effect=lambda rows, state: captured.extend(rows)), \
             patch.object(collector.store, 'summaries', return_value=[]):
            collector.collect(self.profile, [], self.state, limit=1)
        self.assertEqual(captured[0][1]['session_id'], self.ids[0])


if __name__ == '__main__':
    unittest.main()
