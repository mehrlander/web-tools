"""Exercise archive reconciliation, privacy bounds and failure retention."""
from datetime import datetime, timezone
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / 'worker'))
import usage_archive as archive


class ArchiveChecks(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.folder = Path(self.temporary.name)
        self.now = datetime(2026, 4, 8, 12, tzinfo=timezone.utc).timestamp()
        self.a, self.b, self.c = ('2026-04-08T09:00:00+00:00', '2026-04-08T09:10:00+00:00', '2026-04-08T09:20:00+00:00')
        self.target = self.folder / 'runtime' / 'phone-usage-history.json'

    def tearDown(self):
        self.temporary.cleanup()

    def database(self, name, points, tokens=()):
        path = self.folder / name
        with closing(sqlite3.connect(path)) as db:
            db.executescript('''
                CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT);
                CREATE TABLE observations (provider TEXT,bucket TEXT,at TEXT,reset TEXT,used REAL,minutes REAL,label TEXT);
                CREATE TABLE reset_readings (provider TEXT,bucket TEXT,reset TEXT,minutes REAL,label TEXT,
                    first_at TEXT,last_at TEXT,peak REAL,last_used REAL,samples INTEGER,private_diagnostic TEXT);
                CREATE TABLE token_days (provider TEXT,day TEXT,tokens INTEGER,observed_at TEXT);
            ''')
            latest = points[-1][0]
            db.executemany('INSERT INTO metadata VALUES (?,?)', [('updatedAt', latest), ('codexTokenStatus', 'available'), ('codexTokenAttempt', latest), ('privatePath', str(self.folder))])
            reset = '2026-04-13T00:00:00+00:00'
            db.executemany('INSERT INTO observations VALUES (?,?,?,?,?,?,?)',
                           [('claude', 'seven_day', at, reset, used, minutes, 'All models') for at, used, minutes in points])
            db.execute('INSERT INTO reset_readings VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                       ('claude', 'seven_day', reset, points[-1][2], 'All models', points[0][0], latest,
                        max(row[1] for row in points), points[-1][1], len(points), 'PRIVATE TRACE ' + str(self.folder)))
            db.executemany('INSERT INTO token_days VALUES (?,?,?,?)', [('codex', day, value, observed) for day, value, observed in tokens])
            db.commit()
        return path

    def run_export(self, sources, **options):
        return archive.export(sources, target=self.target, state=self.folder, now=self.now, zone=timezone.utc,
                              session_repo=self.folder / 'missing-repository', **options)

    def test_cross_store_merge_deduplicates_offsets_and_preserves_revised_day_totals(self):
        old = self.database('old.db', [(self.a, 10, 10080), (self.b, 20, 10080)], [('2026-04-07', 100, self.b)])
        new = self.database('new.db', [(self.b.replace('+00:00', 'Z'), 20, None), (self.c, 30, 10080)],
                            [('2026-04-07', 90, self.c), ('2026-04-08', 40, self.c)])
        hashes = [hashlib.sha256(path.read_bytes()).hexdigest() for path in (old, new)]
        value = archive.build_archive([old, new, old], now=self.now, zone=timezone.utc)
        row = value['periods'][0]
        self.assertEqual((value['sourceCount'], len(value['periods']), row['samples']), (2, 1, 3))
        self.assertEqual((row['first_at'], row['last_at'], row['peak'], row['minutes']), (self.a, self.c, 30, 10080))
        self.assertEqual({row['day']: row['tokens'] for row in value['tokenDays']}, {'2026-04-07': 90, '2026-04-08': 40})
        today = next(item for item in value['dailyAllowance']['providers'] if item['provider'] == 'claude')['days'][-1]
        self.assertEqual(today['points'], 20)
        missing = next(item for item in value['dailyAllowance']['providers'] if item['provider'] == 'gemini')
        self.assertTrue(all(row['points'] is None for row in missing['days']))
        self.assertEqual(hashes, [hashlib.sha256(path.read_bytes()).hexdigest() for path in (old, new)])

    def test_projection_drops_database_diagnostics_and_bad_values(self):
        source = self.database('history.db', [(self.a, 10, 10080), (self.b, 20, 10080)])
        with closing(sqlite3.connect(source)) as db:
            db.execute('UPDATE reset_readings SET label=?', ('C:/Users/private/source',))  # machine-path-ok: rejected synthetic metadata, never opened
            db.execute("INSERT INTO token_days VALUES ('codex','2026-04-08',-1,?)", (self.b,))
            db.execute("INSERT INTO observations VALUES ('unknown','secret','bad','bad',200,10080,'PRIVATE')")
            db.commit()
        self.run_export([source])
        serialized = self.target.read_text(encoding='utf-8')
        value = json.loads(serialized)
        self.assertEqual(value['periods'][0]['label'], 'seven_day')
        self.assertEqual(value['tokenDays'], [])
        for secret in ('PRIVATE', 'private_diagnostic', 'privatePath', str(self.folder), 'C:/Users/private'):
            self.assertNotIn(secret, serialized)

    def test_unreadable_existing_side_and_read_budget_preserve_complete_archive(self):
        source = self.database('history.db', [(self.a, 10, 10080), (self.b, 20, 10080)])
        self.run_export([source])
        saved = self.target.read_bytes()
        corrupt = self.folder / 'broken.db'
        corrupt.write_bytes(b'not sqlite')
        with self.assertRaises(sqlite3.Error):
            self.run_export([source, corrupt])
        with patch.object(archive, 'MAX_OBSERVATIONS', 1), self.assertRaises(ValueError):
            self.run_export([source])
        with patch.object(archive, 'MAX_ARCHIVE_BYTES', 16), self.assertRaises(ValueError):
            self.run_export([source])
        with closing(sqlite3.connect(source)) as db:
            db.execute("UPDATE metadata SET value=? WHERE key='updatedAt'", ('x' * 9000,))
            db.commit()
        with self.assertRaises(sqlite3.Error):
            self.run_export([source])
        self.assertEqual(self.target.read_bytes(), saved)
        self.assertEqual(list(self.target.parent.glob('*.tmp')), [])

    def test_default_current_store_and_explicit_missing_history_are_distinct(self):
        source = self.database('usage-history.sqlite3', [(self.a, 10, 10080)])
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(archive.build_archive(state=self.folder, now=self.now)['sourceCount'], 1)
            with self.assertRaises(FileNotFoundError):
                archive.build_archive(state=self.folder, history_state=self.folder / 'missing-history', now=self.now)
        missing = self.folder / 'optional.db'
        self.assertEqual(archive.build_archive([source, missing], now=self.now)['sourceCount'], 1)
        self.assertFalse(missing.exists())
        report = self.run_export([source], write=False)
        self.assertGreater(report['bytes'], 0)
        self.assertFalse(self.target.exists())

    def test_default_retained_legacy_store_preserves_union_and_failure_retention(self):
        legacy = self.database('usage-history-legacy.sqlite3', [(self.a, 10, 10080), (self.b, 20, 10080)],
                               [('2026-04-07', 100, self.b)])
        self.database('usage-history.sqlite3', [(self.b, 20, None), (self.c, 30, 10080)],
                      [('2026-04-07', 90, self.c), ('2026-04-08', 40, self.c)])
        before = hashlib.sha256(legacy.read_bytes()).hexdigest()
        with patch.dict(os.environ, {}, clear=True):
            self.run_export(None)
            saved = self.target.read_bytes()
            value = json.loads(saved)
            self.assertEqual((value['sourceCount'], value['periods'][0]['samples']), (2, 3))
            self.assertEqual((value['periods'][0]['first_at'], value['periods'][0]['last_at']), (self.a, self.c))
            self.assertEqual({row['day']: row['tokens'] for row in value['tokenDays']}, {'2026-04-07': 90, '2026-04-08': 40})
            self.assertEqual(hashlib.sha256(legacy.read_bytes()).hexdigest(), before)
            legacy.write_bytes(b'damaged synthetic legacy store')
            with self.assertRaises(sqlite3.Error):
                self.run_export(None)
            self.assertEqual(self.target.read_bytes(), saved)

    def test_session_sync_failure_retains_previous_measurements_without_extra_fields(self):
        source = self.database('history.db', [(self.a, 10, 10080)])
        session = dict(id='1234abcd', agentSessionId='session_Test', provider='claude', title='Recorded session',
                       sessionUrl='https://claude.ai/code/session_Test', contextTokens=1234, usageAt=self.a,
                       cacheReadTokens=5000, cacheWriteTokens=600, inputTokens=7, outputTokens=88, measuredSteps=2, reloads=0)
        metadata = dict(schemaVersion=1, observedAt=self.b, revision='a' * 40, available=True, partial=False,
                        source='Recorded Claude Code usage extracts', lookbackHours=24, fallbackDays=62,
                        indexGeneratedAt=self.a, sessions=[session], notice=None)
        with patch.object(archive, 'collect_session_usage', return_value=metadata):
            self.run_export([source])
        saved = json.loads(self.target.read_text())
        saved['sessionUsage']['sessions'][0]['transcript'] = 'PRIVATE TRANSCRIPT'
        self.target.write_text(json.dumps(saved), encoding='utf-8')
        with patch.object(archive, 'collect_session_usage', return_value=dict(schemaVersion=1, available=False, sessions=[])):
            self.run_export([source])
        result = json.loads(self.target.read_text())['sessionUsage']
        self.assertFalse(result['available'])
        self.assertEqual(result['sessions'], [session])
        self.assertNotIn('PRIVATE', self.target.read_text())
        self.assertIn('saved measurements', result['notice'])

    def test_confirmations_require_the_exact_owner_reported_transition(self):
        source = self.database('history.db', [(self.a, 70, 10080), (self.b, 20, 10080), (self.c, 25, 10080)])
        initial = archive.build_archive([source], now=self.now)
        event = initial['adjustments'][0]
        confirmation = dict(event, basis='owner-report', kind='Manual')
        path = self.folder / 'confirmations.json'
        path.write_text(json.dumps([dict(confirmation, before=69)]), encoding='utf-8')
        unconfirmed = archive.build_archive([source], now=self.now, confirmation_file=path)
        self.assertNotIn('confirmed_restore', unconfirmed['adjustments'][0])
        path.write_text(json.dumps([confirmation]), encoding='utf-8')
        confirmed = archive.build_archive([source], now=self.now, confirmation_file=path)
        self.assertTrue(confirmed['adjustments'][0]['confirmed_restore'])
        row = next(item for item in confirmed['dailyAllowance']['providers'] if item['provider'] == 'claude')['days'][-1]
        self.assertEqual((row['points'], row['restores']), (5, 1))
        (self.folder / 'usage-reset-confirmations.json').write_text(json.dumps([confirmation]), encoding='utf-8')
        self.run_export([source])
        self.assertTrue(json.loads(self.target.read_text())['adjustments'][0]['confirmed_restore'])


if __name__ == '__main__':
    unittest.main()
