import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock

spec = importlib.util.spec_from_file_location('usage_history', Path(__file__).parents[1] / 'worker' / 'usage_history.py')
history = importlib.util.module_from_spec(spec)
spec.loader.exec_module(history)


class HistoryChecks(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.state = Path(self.folder.name)
        self.at = '2026-11-07T12:00:00+00:00'
        self.reset = '2026-11-08T12:00:00+00:00'

    def tearDown(self):
        self.folder.cleanup()

    def provider(self, used=20, **extra):
        w = dict(id='primary', label='Codex', usedPercent=used, resetsAt=self.reset, durationMinutes=10080)
        return dict(provider='codex', status='available', observedAt=self.at, windows=[w], **extra)

    def test_durable_samples_and_peaks_survive_restart(self):
        p = self.provider()
        history.store(self.state, [p], at=self.at)
        p['windows'][0]['usedPercent'] = 24
        p['observedAt'] = '2026-11-07T12:01:00+00:00'
        history.store(self.state, [p], at=p['observedAt'])
        value = history.read(self.state)['periods'][0]
        self.assertEqual(value['peak'], 24)
        self.assertEqual(value['samples'], 1)
        self.assertEqual(value['last_at'], p['observedAt'])
        history.store(self.state, [], at='2027-01-01T00:00:00+00:00')
        self.assertEqual(history.read(self.state)['periods'][0]['peak'], 24)

    def test_repeated_and_stale_reports_do_not_fabricate_observations(self):
        p = self.provider()
        history.store(self.state, [p], at=self.at)
        history.store(self.state, [p], at=self.at)
        p.update(status='stale', observedAt='2026-11-07T13:00:00+00:00')
        p['windows'][0]['usedPercent'] = 90
        history.store(self.state, [p], at=p['observedAt'])
        self.assertEqual(history.read(self.state)['periods'][0]['peak'], 20)
        self.assertEqual(history.read(self.state)['periods'][0]['samples'], 1)

    def test_legacy_durations_are_not_guessed_for_primary(self):
        p = self.provider()
        p['windows'][0]['history'] = [dict(at=self.at, usedPercent=10, resetsAt='2026-11-08T11:00:00+00:00')]
        history.store(self.state, [], previous=[p], at=self.at)
        self.assertIsNone(history.read(self.state)['periods'][0]['minutes'])

    def test_reset_revisions_and_zero_are_preserved(self):
        p = self.provider(0)
        history.store(self.state, [p], at=self.at)
        p['observedAt'] = '2026-11-07T12:01:00+00:00'
        p['windows'][0]['resetsAt'] = '2026-11-08T12:01:00+00:00'
        history.store(self.state, [p], at=p['observedAt'])
        self.assertEqual(len(history.read(self.state)['periods']), 2)
        self.assertEqual(history.read(self.state)['periods'][0]['peak'], 0)

    def test_daily_buckets_keep_gaps_and_are_throttled(self):
        read = Mock(return_value={'dailyUsageBuckets': [dict(startDate='2026-11-01', tokens=3), dict(startDate='2026-11-03', tokens=0), dict(startDate='bad', tokens=30)]})
        history.store(self.state, [], token_reader=read, at=self.at)
        history.store(self.state, [], token_reader=read, at='2026-11-07T12:01:00+00:00')
        self.assertEqual(read.call_count, 1)
        self.assertEqual([r['day'] for r in history.read(self.state)['tokenDays']], ['2026-11-01', '2026-11-03'])
        read.side_effect = RuntimeError('must not persist diagnostic text')
        history.store(self.state, [], token_reader=read, at='2026-11-08T12:00:00+00:00')
        self.assertEqual(len(history.read(self.state)['tokenDays']), 2)
        self.assertEqual(history.read(self.state)['codexTokenStatus'], 'unavailable')


if __name__ == '__main__':
    unittest.main()
