import unittest
from pathlib import Path
import sys
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'worker'))
from daily_allowance import build_daily, Calendar

def stamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()

def point(at, used, reset='2026-11-07T12:00:00Z', provider='claude', bucket='seven_day', minutes=10080):
    return dict(provider=provider,bucket=bucket,at=at,used=used,reset=reset,minutes=minutes)

def days(rows, now='2026-11-06T23:59:59Z', confirmed_restores=()):
    return {row['day']:row for row in build_daily(rows,now=stamp(now),zone=timezone.utc,confirmed_restores=confirmed_restores)['providers'][2]['days']}

def restore(before, after):
    return dict(provider=before['provider'], bucket=before['bucket'], minutes=before['minutes'],
                before_at=before['at'], at=after['at'], before_reset=before['reset'], reset=after['reset'],
                before=before['used'], after=after['used'])

class DailyChecks(unittest.TestCase):
    def test_changes_not_cumulative_totals(self):
        value=days([point('2026-11-06T10:00:00Z',60),point('2026-11-06T11:00:00Z',65)])['2026-11-06']
        self.assertEqual(value['points'],5)
        self.assertEqual(value['state'],'partial')

    def test_short_midnight_interval_is_split_and_conserved(self):
        value=days([point('2026-11-05T23:55:00Z',10),point('2026-11-06T00:05:00Z',14)])
        self.assertEqual([value[d]['points'] for d in ('2026-11-05','2026-11-06')],[2,2])
        self.assertTrue(value['2026-11-06']['estimated'])

    def test_long_overnight_gap_is_not_distributed(self):
        value=days([point('2026-11-05T22:00:00Z',5),point('2026-11-05T23:00:00Z',6),point('2026-11-06T07:00:00Z',16),point('2026-11-06T08:00:00Z',18)])
        self.assertEqual(value['2026-11-05']['points'],1)
        self.assertEqual(value['2026-11-06']['points'],2)
        self.assertEqual(value['2026-11-06']['unallocated'],10)
        self.assertIn('overnight-gap',value['2026-11-06']['reasons'])

    def test_reset_counts_post_reset_usage_only(self):
        value=days([point('2026-11-07T11:55:00Z',80),point('2026-11-07T12:05:00Z',3,'2026-11-14T12:00:00Z'),point('2026-11-07T12:10:00Z',4,'2026-11-14T12:00:00Z')],now='2026-11-07T13:00:00Z')['2026-11-07']
        self.assertEqual(value['points'],4)
        self.assertEqual(value['resets'],1)
        self.assertIn('reset-tail',value['reasons'])

    def test_downward_correction_does_not_get_counted_twice(self):
        rows=[point(f'2026-11-06T{hour:02}:00:00Z',value) for hour,value in zip(range(10,16),(10,12,9,11,12,13))]
        self.assertEqual(days(rows)['2026-11-06']['points'],3)

    def test_confirmed_partial_restore_rebases_without_assuming_zero(self):
        rows = [point(f'2026-11-06T{hour:02}:00:00Z', value) for hour, value in zip(range(10, 14), (10, 12, 2, 4))]
        conservative = days(rows)['2026-11-06']
        confirmed = days(rows, confirmed_restores=[restore(rows[1], rows[2])])['2026-11-06']
        self.assertEqual(conservative['points'], 2)
        self.assertEqual(confirmed['points'], 4)
        self.assertEqual((confirmed['restores'], confirmed['restoredPoints']), (1, 10))
        self.assertEqual(confirmed['resets'], 0)
        self.assertIn('allowance-restored', confirmed['reasons'])
        self.assertEqual(confirmed['state'], 'partial')

    def test_confirmed_restore_accepts_scheduled_timestamp_jitter(self):
        rows = [point('2026-11-06T10:00:00Z', 89), point('2026-11-06T10:05:00Z', 61, '2026-11-07T11:59:59Z'),
                point('2026-11-06T10:10:00Z', 63)]
        value = days(rows, confirmed_restores=[restore(rows[0], rows[1])])['2026-11-06']
        self.assertEqual((value['points'], value['restores'], value['restoredPoints']), (2, 1, 28))

    def test_malformed_and_mismatched_confirmations_are_ignored(self):
        rows = [point(f'2026-11-06T{hour:02}:00:00Z', value) for hour, value in zip(range(10, 14), (10, 12, 2, 4))]
        event = restore(rows[1], rows[2])
        bad = [None, {}, dict(event, before=True), dict(event, before=13), dict(event, after=3),
               dict(event, before_at='bad'), dict(event, at='2026-11-06T12:01:00Z'),
               dict(event, bucket='seven_day_fable'), dict(event, provider='codex'), dict(event, minutes=300),
               dict(event, reset='2026-11-14T12:00:00Z'), dict(event, before_reset='2026-11-14T12:00:00Z')]
        value = days(rows, confirmed_restores=bad)['2026-11-06']
        self.assertEqual((value['points'], value['restores']), (2, 0))
        self.assertNotIn('allowance-restored', value['reasons'])

    def test_confirmation_applies_only_to_its_exact_adjacent_drop(self):
        rows = [point(f'2026-11-06T{hour:02}:00:00Z', value) for hour, value in zip(range(10, 16), (10, 12, 2, 4, 1, 3))]
        value = days(rows, confirmed_restores=[restore(rows[1], rows[2])])['2026-11-06']
        self.assertEqual((value['points'], value['restores']), (4, 1))
        self.assertIn('reported-decrease', value['reasons'])
        inserted = [*rows[:2], point('2026-11-06T11:30:00Z', 11), *rows[2:4]]
        self.assertEqual(days(inserted, confirmed_restores=[restore(rows[1], rows[2])])['2026-11-06']['restores'], 0)

    def test_confirmation_does_not_apply_to_a_different_window(self):
        rows = [point('2026-11-06T10:00:00Z', 12), point('2026-11-06T11:00:00Z', 2, '2026-11-08T12:00:00Z'),
                point('2026-11-06T12:00:00Z', 4, '2026-11-08T12:00:00Z')]
        value = days(rows, confirmed_restores=[restore(rows[0], rows[1])])['2026-11-06']
        self.assertEqual((value['points'], value['restores']), (2, 0))
        self.assertIn('period-change', value['reasons'])

    def test_restore_crossing_midnight_retains_uncertain_interval(self):
        rows = [point('2026-11-05T23:50:00Z', 10), point('2026-11-05T23:55:00Z', 12),
                point('2026-11-06T00:05:00Z', 2), point('2026-11-06T00:10:00Z', 4)]
        value = days(rows, confirmed_restores=[restore(rows[1], rows[2])])
        self.assertEqual([value[day]['points'] for day in ('2026-11-05', '2026-11-06')], [2, 2])
        self.assertTrue(all('allowance-restored' in value[day]['reasons'] for day in ('2026-11-05', '2026-11-06')))
        self.assertEqual((value['2026-11-05']['restores'], value['2026-11-06']['restores']), (0, 1))

    def test_known_start_can_anchor_zero(self):
        value=days([point('2026-11-01T12:05:00Z',3,'2026-11-08T12:00:00Z')])['2026-11-01']
        self.assertEqual(value['points'],3)

    def test_small_reset_revision_does_not_refill(self):
        value=days([point('2026-11-06T10:00:00Z',10),point('2026-11-06T10:05:00Z',11,'2026-11-07T12:00:01Z')])['2026-11-06']
        self.assertEqual(value['points'],1)
        self.assertEqual(value['resets'],0)

    def test_large_revision_is_uncertain(self):
        value=days([point('2026-11-06T10:00:00Z',10),point('2026-11-06T10:05:00Z',20,'2026-11-07T13:00:00Z')])['2026-11-06']
        self.assertIsNone(value['points'])
        self.assertIn('period-change',value['reasons'])

    def test_changed_period_establishes_new_baseline(self):
        value=days([point('2026-11-06T10:00:00Z',80),point('2026-11-06T10:05:00Z',2,'2026-11-08T10:00:00Z'),point('2026-11-06T10:10:00Z',4,'2026-11-08T10:00:00Z')])['2026-11-06']
        self.assertEqual(value['points'],2)
        self.assertIn('period-change',value['reasons'])

    def test_scoped_and_short_and_unknown_windows_are_excluded(self):
        rows=[point('2026-11-06T10:00:00Z',10,bucket='seven_day_opus'),point('2026-11-06T11:00:00Z',20,bucket='seven_day_opus'),point('2026-11-06T10:00:00Z',10,minutes=None),point('2026-11-06T11:00:00Z',20,minutes=300)]
        self.assertTrue(all(day['points'] is None for day in days(rows).values()))

    def test_true_zero_is_distinct_from_no_observations(self):
        value=days([point('2026-11-06T10:00:00Z',10),point('2026-11-06T11:00:00Z',10)])
        self.assertEqual(value['2026-11-06']['points'],0)
        self.assertIsNone(value['2026-11-05']['points'])

    def test_local_dst_day_is_25_hours(self):
        import time
        if 'Pacific' not in time.tzname[0]:
            self.skipTest('Pacific laptop timezone fixture')
        from datetime import date
        calendar=Calendar()
        self.assertEqual(calendar.midnight(date(2026,11,2))-calendar.midnight(date(2026,11,1)),90000)

if __name__=='__main__':
    unittest.main()
