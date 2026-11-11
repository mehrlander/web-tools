import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / 'worker'))
import claude_tokens as tokens
from usage_history import read


class ClaudeTokensChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.state = Path(self.temp.name) / 'state'
        self.logs = Path(self.temp.name) / 'projects'
        self.logs.mkdir()
        self.path = self.logs / 'session.jsonl'
        self.at = '2026-11-09T12:00:00+00:00'

    def tearDown(self):
        self.temp.cleanup()

    def row(self, ident='msg_1', output=4, at='2026-11-08T23:59:00Z'):
        return dict(type='assistant', timestamp=at, message=dict(id=ident, content='PRIVATE TEXT', usage=dict(input_tokens=2, output_tokens=output, cache_read_input_tokens=10, cache_creation_input_tokens=3, iterations=[dict(input_tokens=99999)], output_tokens_details=dict(thinking_tokens=99999))))

    def append(self, row, newline=True):
        with self.path.open('a', encoding='utf-8') as stream:
            stream.write(json.dumps(row) + ('\n' if newline else ''))

    def collect(self):
        tokens.collect(self.state, self.logs, self.at)
        return read(self.state)['tokenDays']

    def test_stream_duplicates_copies_restarts_and_subagents_count_once(self):
        self.append(self.row())
        self.append(self.row())
        self.assertEqual(self.collect()[0]['tokens'], 19)
        self.append(self.row(output=7))
        child = self.logs / 'session' / 'subagents'
        child.mkdir(parents=True)
        (child / 'copy.jsonl').write_text(self.path.read_text(), encoding='utf-8')
        (child / 'agent.jsonl').write_text(json.dumps(self.row(ident='msg_2')) + '\n', encoding='utf-8')
        self.assertEqual(self.collect()[0]['tokens'], 41)
        self.assertEqual(self.collect()[0]['tokens'], 41)

    def test_partial_line_later_completed_and_truncation_do_not_lose_or_double_totals(self):
        self.append(self.row(), newline=False)
        self.assertEqual(self.collect(), [])
        with self.path.open('a') as stream:
            stream.write('\n')
        self.assertEqual(self.collect()[0]['tokens'], 19)
        self.path.write_text(json.dumps(self.row('msg_2')) + '\n', encoding='utf-8')
        self.assertEqual(self.collect()[0]['tokens'], 38)

    def test_utc_dates_validation_and_deleted_source_retention(self):
        self.append(self.row(at='2026-11-09T00:30:00+02:00'))
        self.append(self.row('msg_2', at='2026-11-09T01:00:00Z'))
        self.append(self.row('bad', output=True))
        self.assertEqual([(d['day'], d['tokens']) for d in self.collect()], [('2026-11-08', 19), ('2026-11-09', 19)])
        self.path.unlink()
        self.assertEqual(len(self.collect()), 2)

    def test_no_content_paths_or_raw_identifiers_are_stored(self):
        self.append(self.row())
        self.collect()
        db = sqlite3.connect(self.state / 'usage-history.sqlite3')
        try:
            dump = '\n'.join(db.iterdump())
        finally:
            db.close()
        for value in ('PRIVATE TEXT', 'msg_1', str(self.logs), '99999'):
            self.assertNotIn(value, dump)


if __name__ == '__main__':
    unittest.main()
