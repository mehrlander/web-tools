from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'worker'))
import session_usage as usage

NOW = datetime(2026, 11, 13, 22, tzinfo=timezone.utc)
FIELDS = {'id', 'agentSessionId', 'provider', 'title', 'sessionUrl', 'contextTokens', 'usageAt', 'cacheReadTokens',
          'cacheWriteTokens', 'inputTokens', 'outputTokens', 'measuredSteps', 'reloads'}


def extract(short='1234abcd', day='2026-11-13', at=None, context=450123, agent='session_ExactCloudId'):
    return dict(schema='usage/1', short=short, day=day, session='ignored-local-identifier',
                agent_session='https://claude.ai/code/' + agent if agent else None,
                opening_ask='SYNTHETIC_PROSE_MUST_NOT_ESCAPE', harness_cost=999,
                last_step_at=(at or NOW - timedelta(minutes=20)).isoformat(), context_now=context,
                prompts=[dict(at='ignored', context=1, steps=2, reloads=1,
                              models={'model-a': dict(input=3, output=5, cache_read=7, cache_write_1h=11, cache_write_5m=13)})],
                unowned=dict(steps=1, reloads=2, models={'model-b': dict(input=17, output=19, cache_read=23, cache_write_5m=29)}),
                compactions=[{'body': 'IGNORED'}])


class SessionUsageChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.git('init', '-q', '-b', 'main')
        self.git('config', 'user.name', 'Usage checks')
        self.git('config', 'user.email', 'usage-checks@example.invalid')
        hooks = self.repo / 'empty-hooks'
        hooks.mkdir()
        self.git('config', 'core.hooksPath', str(hooks))

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.repo), *args], stderr=subprocess.DEVNULL).decode().strip()

    def seed(self, extracts, rows=None):
        if rows is None:
            rows = [dict(id=value['short'], day=value['day'], ended=value.get('last_step_at'), agent=value.get('agent_session'),
                         title='Recorded metadata title', tokens={'input': 99999999}) for value in extracts]
        index = self.repo / 'state/sessions.json'
        index.parent.mkdir(exist_ok=True)
        index.write_text(json.dumps({'generatedAt': NOW.isoformat(), 'rows': rows}), encoding='utf-8')
        for value in extracts:
            day, short = value['day'], value['short']
            path = self.repo / f'sessions/usage/{day[:4]}/{day[5:7]}/{day}-{short}.json'
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(value), encoding='utf-8')
        self.git('add', 'state', 'sessions')
        self.git('commit', '-qm', 'Synthetic usage metadata')
        self.git('update-ref', 'refs/remotes/origin/main', 'HEAD')

    def test_projects_exact_context_and_cumulative_allowlisted_counters(self):
        self.seed([extract()])
        result = usage.collect(self.repo, NOW)
        row = result['sessions'][0]
        self.assertTrue(result['available'])
        self.assertFalse(result['partial'])
        self.assertEqual(set(row), FIELDS)
        self.assertEqual((row['id'], row['agentSessionId'], row['provider']), ('1234abcd', 'session_ExactCloudId', 'claude'))
        self.assertEqual((row['title'], row['sessionUrl']), ('Recorded metadata title', 'https://claude.ai/code/session_ExactCloudId'))
        self.assertEqual(row['contextTokens'], 450123)
        self.assertEqual((row['inputTokens'], row['outputTokens'], row['cacheReadTokens'], row['cacheWriteTokens']), (20, 24, 30, 53))
        self.assertEqual((row['measuredSteps'], row['reloads']), (3, 3))
        self.assertNotIn('PROSE', json.dumps(result))
        self.assertNotIn('harness_cost', json.dumps(result))

    def test_recent_activity_includes_session_started_months_earlier(self):
        self.seed([extract(day='2026-01-01')])
        result = usage.collect(self.repo, NOW)
        self.assertEqual(len(result['sessions']), 1)

    def test_extract_ahead_of_index_uses_safe_record_id(self):
        self.seed([extract()], rows=[])
        result = usage.collect(self.repo, NOW)
        self.assertEqual(result['sessions'][0]['id'], '2026-11-13-1234abcd')
        self.assertEqual(result['sessions'][0]['title'], 'Claude session 2026-11-13-1234abcd')

    def test_last_model_step_controls_actual_24_hour_scope(self):
        self.seed([extract(short='11111111', at=NOW - timedelta(hours=24, seconds=1)),
                   extract(short='22222222', at=NOW + timedelta(seconds=1)),
                   extract(short='33333333', at=NOW - timedelta(hours=24))])
        result = usage.collect(self.repo, NOW)
        self.assertEqual([row['id'] for row in result['sessions']], ['33333333'])

    def test_latest_extract_after_compaction_wins_without_summing_duplicates(self):
        older = extract(short='11111111', day='2026-11-12', context=900000, at=NOW - timedelta(hours=2))
        newer = extract(short='22222222', context=100000, at=NOW - timedelta(minutes=10))
        newer['prompts'][0]['models']['model-a']['input'] = 1
        self.seed([older, newer])
        result = usage.collect(self.repo, NOW)
        self.assertEqual(len(result['sessions']), 1)
        self.assertEqual((result['sessions'][0]['id'], result['sessions'][0]['contextTokens'], result['sessions'][0]['inputTokens']), ('22222222', 100000, 18))

    def test_invalid_measurement_is_not_replaced_by_cache_totals_or_activity(self):
        bad = extract()
        bad.pop('last_step_at')
        self.seed([bad])
        result = usage.collect(self.repo, NOW)
        self.assertEqual(result['sessions'], [])
        self.assertTrue(result['partial'])

    def test_bad_counters_and_context_are_skipped_without_leaking_fields(self):
        invalid = extract(short='11111111', context=True)
        negative = extract(short='22222222', agent='session_other')
        negative['prompts'][0]['models']['model-a']['cache_read'] = -1
        valid = extract(short='33333333', agent=None)
        self.seed([invalid, negative, valid])
        result = usage.collect(self.repo, NOW)
        self.assertEqual([row['id'] for row in result['sessions']], ['33333333'])
        self.assertIsNone(result['sessions'][0]['agentSessionId'])
        self.assertTrue(result['partial'])

    def test_reads_pinned_origin_snapshot_and_leaves_dirty_checkout_unchanged(self):
        self.seed([extract(context=123)])
        revision = self.git('rev-parse', 'origin/main')
        tracked = self.repo / 'state/sessions.json'
        tracked.write_text('DIRTY_CHECKOUT_DO_NOT_READ', encoding='utf-8')
        before = self.git('status', '--porcelain')
        result = usage.collect(self.repo, NOW)
        self.assertEqual(result['revision'], revision)
        self.assertEqual(result['sessions'][0]['contextTokens'], 123)
        self.assertEqual(tracked.read_text(), 'DIRTY_CHECKOUT_DO_NOT_READ')
        self.assertEqual(self.git('status', '--porcelain'), before)

    def test_read_budgets_report_partial_data_instead_of_silent_completeness(self):
        self.seed([extract(short='11111111'), extract(short='22222222', agent='session_other')])
        with patch.object(usage, 'MAX_EXTRACTS', 1):
            result = usage.collect(self.repo, NOW)
        self.assertTrue(result['available'])
        self.assertTrue(result['partial'])
        self.assertEqual(len(result['sessions']), 1)
        with patch.object(usage, 'MAX_EXTRACT_BYTES', 1):
            oversized = usage.collect(self.repo, NOW)
        self.assertEqual(oversized['sessions'], [])
        self.assertTrue(oversized['partial'])

    def test_missing_origin_returns_safe_failure_for_snapshot_retention(self):
        result = usage.collect(self.repo)
        self.assertFalse(result['available'])
        self.assertIsNotNone(usage._instant(result['observedAt']))
        self.assertEqual(result['sessions'], [])
        self.assertNotIn(str(self.repo), result['notice'])
        self.assertIn('retain', result['notice'])


if __name__ == '__main__':
    unittest.main()
