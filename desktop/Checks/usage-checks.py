import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('usage', Path(__file__).parents[1] / 'worker' / 'usage.py')
usage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(usage)


class UsageChecks(unittest.TestCase):
    def test_codex_zero_and_missing_are_distinct(self):
        limit = dict(primary=dict(usedPercent=0, windowDurationMins=300, resetsAt=1800000000), secondary=None)
        values = usage.codex_windows(dict(rateLimits=limit))
        self.assertEqual(len(values), 1)
        self.assertEqual(values[0]['usedPercent'], 0)
        del limit['primary']['usedPercent']
        self.assertEqual(usage.codex_windows(dict(rateLimits=limit)), [])

    def test_codex_prefers_bucket_map_without_duplicate_legacy(self):
        limit = dict(primary=dict(usedPercent=15, windowDurationMins=10080, resetsAt=1800000000))
        values = usage.codex_windows(dict(rateLimits=limit, rateLimitsByLimitId={'codex':limit, 'review':limit}))
        self.assertEqual([w['id'] for w in values], ['codex:primary', 'review:primary'])
        self.assertEqual(values[0]['durationMinutes'], 10080)

    def test_gemini_remaining_is_inverted_and_other_accounts_excluded(self):
        model = dict(modelId='gemini-test', label='Gemini test', quotaInfo=dict(remainingFraction=.25, resetTime='2027-01-15T08:00:00Z'))
        data = dict(userStatus=dict(cascadeModelConfigData=dict(clientModelConfigs=[model, dict(model, modelId='claude-test')])))
        values = usage.gemini_windows(data)
        self.assertEqual(len(values), 1)
        self.assertEqual(values[0]['usedPercent'], 75)
        self.assertIsNone(values[0]['durationMinutes'])
        model['quotaInfo']['remainingFraction'] = 0
        self.assertEqual(usage.gemini_windows(data)[0]['usedPercent'], 100)

    def test_claude_uses_account_limits_not_context_or_cost(self):
        data = dict(rate_limits=dict(five_hour=dict(used_percentage=23.5, resets_at=1800000000)), context_window=dict(used_percentage=99), cost=dict(total_cost_usd=3))
        values = usage.claude_windows(data)
        self.assertEqual(len(values), 1)
        self.assertEqual(values[0]['usedPercent'], 23.5)
        self.assertEqual(values[0]['durationMinutes'], 300)
        self.assertNotIn('context_window', values[0])

    def test_bad_percentages_never_become_zero(self):
        for value in [None, '20', True, -1, 101, float('nan'), float('inf')]:
            self.assertIsNone(usage.window('test', 'test', value, 1800000000))

    def test_history_is_bounded_and_reset_changes_are_preserved(self):
        first = usage.window('test', 'test', 25, '2027-01-15T08:00:00Z', 300)
        initial = usage.keep_history([first], [], '2027-01-15T05:00:00+00:00')
        second = usage.window('test', 'test', 26, first['resetsAt'], 300)
        quick = usage.keep_history([second], initial, '2027-01-15T05:01:00+00:00')
        self.assertEqual(len(quick[0]['history']), 1)
        changed = usage.window('test', 'test', 1, '2027-01-15T13:00:00Z', 300)
        reset = usage.keep_history([changed], quick, '2027-01-15T08:00:00+00:00')
        self.assertEqual([p['usedPercent'] for p in reset[0]['history']], [25, 1])


if __name__ == '__main__':
    unittest.main()
