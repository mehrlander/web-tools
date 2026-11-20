import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'worker'))
from allowance_events import detect_decreases


def point(at, used, **changes):
    return dict(provider='claude', bucket='seven_day', label='All models',
                at=at, used=used, reset='2026-11-15T01:00:00Z', minutes=10080, **changes)


class AllowanceEventChecks(unittest.TestCase):
    def test_decrease_preserves_observation_interval_and_values(self):
        events = detect_decreases([point('2026-11-11T20:00:00Z', 89), point('2026-11-11T20:05:00Z', 64)])
        self.assertEqual(len(events), 1)
        event = events[0]
        self.assertEqual((event['before'], event['after'], event['drop']), (89, 64, 25))
        self.assertEqual((event['before_at'], event['at']), ('2026-11-11T20:00:00+00:00', '2026-11-11T20:05:00+00:00'))
        self.assertEqual((event['provider'], event['bucket'], event['label'], event['minutes']), ('claude', 'seven_day', 'All models', 10080))
        self.assertEqual(event['reset'], '2026-11-15T01:00:00+00:00')
        self.assertEqual(event['before_reset'], event['reset'])
        self.assertFalse({'manual', 'cause', 'occurred_at'} & event.keys())

    def test_same_schedule_full_refill_to_zero_is_an_observed_decrease(self):
        events = detect_decreases([point('2026-11-11T20:00:00Z', 42), point('2026-11-11T20:05:00Z', 0)])
        self.assertEqual(events[0]['drop'], 42)

    def test_unchanged_and_increasing_counters_do_not_create_events(self):
        self.assertEqual(detect_decreases([point('2026-11-11T20:00:00Z', 0), point('2026-11-11T20:05:00Z', 0), point('2026-11-11T20:10:00Z', 7)]), [])

    def test_scheduled_rollover_and_changed_duration_are_excluded(self):
        first = point('2026-11-11T20:00:00Z', 89)
        rollover = dict(point('2026-11-11T20:05:00Z', 0), reset='2026-11-22T01:00:00Z')
        changed_duration = dict(point('2026-11-11T20:05:00Z', 20), minutes=300)
        self.assertEqual(detect_decreases([first, rollover]), [])
        self.assertEqual(detect_decreases([first, changed_duration]), [])

    def test_one_second_scheduled_reset_jitter_preserves_decrease(self):
        first = dict(point('2026-11-11T20:00:00Z', 89), reset='2026-11-15T00:59:59Z')
        second = point('2026-11-11T20:05:00Z', 61)
        event = detect_decreases([first, second])[0]
        self.assertEqual((event['before'], event['after'], event['drop']), (89, 61, 28))
        self.assertEqual((event['before_reset'], event['reset']), ('2026-11-15T00:59:59+00:00', '2026-11-15T01:00:00+00:00'))
        reverse = detect_decreases([dict(first, reset=second['reset']), dict(second, reset=first['reset'])])[0]
        self.assertEqual(reverse['drop'], 28)

    def test_large_reset_change_and_jitter_after_previous_deadline_are_excluded(self):
        first = point('2026-11-11T20:00:00Z', 89)
        changed = dict(point('2026-11-11T20:05:00Z', 61), reset='2026-11-15T01:02:01Z')
        self.assertEqual(detect_decreases([first, changed]), [])
        before_deadline = dict(point('2026-11-15T00:59:58Z', 89), reset='2026-11-15T00:59:59Z')
        after_deadline = dict(point('2026-11-15T01:00:00Z', 0), reset='2026-11-15T01:00:01Z')
        self.assertEqual(detect_decreases([before_deadline, after_deadline]), [])

    def test_readings_before_the_reported_window_are_excluded(self):
        before_window = point('2026-11-08T00:57:59Z', 89)
        at_tolerance = point('2026-11-08T00:58:00Z', 70)
        valid = point('2026-11-08T01:05:00Z', 61)
        events = detect_decreases([before_window, at_tolerance, valid])
        self.assertEqual(len(events), 1)
        self.assertEqual((events[0]['before'], events[0]['after']), (70, 61))

    def test_buckets_and_providers_are_never_paired(self):
        first = point('2026-11-11T20:00:00Z', 89)
        other_bucket = dict(point('2026-11-11T20:05:00Z', 20), bucket='seven_day_fable', label='Fable')
        other_provider = dict(point('2026-11-11T20:10:00Z', 30), provider='codex')
        self.assertEqual(detect_decreases([first, other_bucket, other_provider]), [])

    def test_shuffled_duplicate_and_offset_equivalent_readings_are_stable(self):
        first, second = point('2026-11-11T20:00:00Z', 89), point('2026-11-11T20:05:00Z', 64)
        equivalent = dict(second, at='2026-11-11T12:05:00-08:00', reset='2026-11-14T17:00:00-08:00')
        expected = detect_decreases([first, second])
        self.assertEqual(detect_decreases([second, equivalent, first, first]), expected)
        self.assertEqual(first['at'], '2026-11-11T20:00:00Z')

    def test_malformed_and_expired_window_readings_are_ignored(self):
        first, second = point('2026-11-11T20:00:00Z', 89), point('2026-11-11T20:05:00Z', 64)
        bad = [None, {}, dict(first, at='2026-02-30T20:00:00Z'), dict(first, at='2026-11-11T20:00:00'),
               dict(first, used=True), dict(first, used=float('nan')), dict(first, used=101), dict(first, used=10 ** 1000),
               dict(first, minutes=0), dict(first, minutes=True), dict(first, provider=''),
               dict(first, at='2026-11-16T20:00:00Z', used=0)]
        self.assertEqual(detect_decreases([first, *bad, second]), detect_decreases([first, second]))

    def test_conflicting_simultaneous_values_have_no_invented_order(self):
        first, second = point('2026-11-11T20:00:00Z', 89), point('2026-11-11T20:05:00Z', 64)
        self.assertEqual(detect_decreases([first, dict(first, used=70), second]), [])
        self.assertEqual(detect_decreases([first, dict(first, reset='2026-11-16T01:00:00Z'), second]), [])

    def test_repeated_decreases_have_distinct_stable_ids(self):
        events = detect_decreases([point('2026-11-11T20:00:00Z', 89), point('2026-11-11T20:05:00Z', 64),
                                  point('2026-11-11T20:10:00Z', 70), point('2026-11-11T20:15:00Z', 40)])
        self.assertEqual([event['drop'] for event in events], [25, 30])
        self.assertEqual(len({event['id'] for event in events}), 2)


if __name__ == '__main__':
    unittest.main()
