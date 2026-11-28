"""Antigravity fixtures exercise source evidence and readable projections."""
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / 'worker'))
import gemini_sessions


class GeminiSessionChecks(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.profile = Path(self.temporary.name)
        self.root = self.profile / '.gemini/antigravity'
        self.root.mkdir(parents=True)
        with closing(sqlite3.connect(self.root / 'conversation_summaries.db')) as db, db:
            db.execute('create table conversation_summaries(conversation_id,title,workspace_uris,killed,last_modified_time,parent_conversation_id,nesting_depth,status,source,agent_name)')
            db.execute('create table conversation_parents(conversation_id,parent_id)')
        self.checkout = self.profile / 'gh/project'
        self.checkouts = [{'id': 'fixture-checkout', 'path': self.checkout, 'repo': 'fixture/project'}]

    def catalog(self, identity='gemini-0001', title='Fixture', parent='', killed=0):
        with closing(sqlite3.connect(self.root / 'conversation_summaries.db')) as db, db:
            db.execute('insert into conversation_summaries values(?,?,?,?,?,?,?,?,?,?)',
                       (identity, title, json.dumps([(self.profile / 'gh').as_uri()]), killed,
                        '2026-11-24T10:00:00Z', parent, int(bool(parent)), 'IDLE', 'CLI', 'fixture-agent'))

    def trajectory(self, rows, identity='gemini-0001'):
        path = self.root / 'brain' / identity / '.system_generated/logs/transcript.jsonl'
        path.parent.mkdir(parents=True)
        path.write_text(''.join(json.dumps(row) + '\n' for row in rows), encoding='utf-8')
        return path

    def row(self, step, kind, content=None, source='MODEL', **extra):
        row = {'step_index': step, 'type': kind, 'source': source,
               'created_at': '2026-11-24T09:00:00Z', **extra}
        if content is not None:
            row['content'] = content
        return row

    def capture(self, **kwargs):
        records, coverage = gemini_sessions.capture(self.profile, self.checkouts, **kwargs)
        return [record for _, record in records], coverage

    def test_revisions_preserve_source_but_project_latest_visible_reply(self):
        self.catalog()
        rows = [self.row(0, 'USER_INPUT', 'Owner ask', 'USER_EXPLICIT'),
                self.row(1, 'PLANNER_RESPONSE', 'Draft', thinking='Exposed early reasoning'),
                self.row(1, 'PLANNER_RESPONSE', 'Final', thinking='Exposed final reasoning')]
        self.trajectory(rows + rows[-1:])
        records, coverage = self.capture()
        record = records[0]
        self.assertEqual(coverage['captured'], 1)
        self.assertEqual(record['format'], 'local-conversation/2')
        self.assertEqual([item['text'] for item in record['replies']], ['Final'])
        self.assertEqual(len(record['source_items']), 3)
        self.assertFalse(record['source_items'][1]['latest'])
        self.assertEqual(record['source_items'][2]['supersedes'], record['source_items'][1]['id'])
        self.assertIn('Exposed early reasoning', json.dumps(record['source_items']))
        before = [item['id'] for item in record['source_items']]
        after = [item['id'] for item in self.capture()[0][0]['source_items']]
        self.assertEqual(before, after)

    def test_path_arguments_link_checkout_and_generic_results_are_not_replies(self):
        self.catalog()
        target = str(self.checkout / 'source.py')
        self.trajectory([self.row(0, 'USER_INPUT', 'Read the source', 'USER_EXPLICIT'),
                         self.row(1, 'PLANNER_RESPONSE', tool_calls=[{'name': 'read_file', 'args': {'Path': target}}]),
                         self.row(2, 'GENERIC', 'Tool output contains a source file'),
                         self.row(3, 'PLANNER_RESPONSE', 'Visible answer')])
        record = self.capture()[0][0]
        self.assertEqual([item['text'] for item in record['replies']], ['Visible answer'])
        self.assertEqual(record['repos'][0]['checkout'], 'fixture-checkout')
        self.assertEqual(record['calls'][0]['input']['Path'], target)
        self.assertEqual(record['tool_results'][0]['association'], 'unresolved')
        self.assertEqual(record['files'][target], {'read_file': 1})
        self.assertEqual(record['tools'], {'read_file': 1})

    def test_catalog_and_table_parentage_keep_child_inputs_out_of_owner_prompts(self):
        self.catalog(parent='parent-0001')
        with closing(sqlite3.connect(self.root / 'conversation_summaries.db')) as db, db:
            db.execute('insert into conversation_parents values(?,?)', ('gemini-0001', 'parent-0002'))
        self.trajectory([self.row(0, 'USER_INPUT', 'Delegated task', 'USER_EXPLICIT'),
                         self.row(1, 'PLANNER_RESPONSE', 'Child result')])
        record = self.capture()[0][0]
        self.assertEqual(record['kind'], 'subagent')
        self.assertEqual(record['parent']['session_id'], 'parent-0001')
        self.assertEqual(len(record['relationships']), 2)
        self.assertEqual(record['prompts'], [])
        self.assertEqual(record['injected'][0]['kind'], 'child-input')
        self.assertEqual(record['source_catalog']['nesting_depth'], 1)

    def test_usage_is_native_ledger_without_sum_of_checkpoint_counters(self):
        self.catalog()
        self.trajectory([self.row(0, 'USER_INPUT', 'Ask', 'USER_EXPLICIT'),
                         self.row(1, 'PLANNER_RESPONSE', 'Answer', input_tokens=11, output_tokens=7, cache_read_tokens=19),
                         self.row(2, 'CHECKPOINT', 'Compaction summary', source='SYSTEM', input_tokens=11, output_tokens=7)])
        record = self.capture()[0][0]
        self.assertEqual([item['kind'] for item in record['usage_ledger']], ['PLANNER_RESPONSE', 'CHECKPOINT'])
        self.assertEqual(record['usage_ledger'][0]['data']['cache_read_tokens'], 19)
        self.assertFalse(record['capture']['capabilities']['usage_totals'])
        self.assertNotIn('tokens', record)
        self.assertEqual(record['injected'][0]['kind'], 'checkpoint')

    def test_unknown_source_types_and_image_omissions_remain_inspectable(self):
        self.catalog()
        media = 'data:image/png;base64,QUJDREVGRw=='
        self.trajectory([self.row(0, 'USER_INPUT', 'Inspect attached picture', 'USER_EXPLICIT', media=[{'uri': media}]),
                         self.row(1, 'FUTURE_PROVIDER_EVENT', 'Future source body', source='INTERNAL', extra_fact=17)])
        record = self.capture()[0][0]
        self.assertEqual(record['source_items'][1]['data']['extra_fact'], 17)
        self.assertEqual(record['unknown_types'], {'FUTURE_PROVIDER_EVENT': 1})
        self.assertNotIn(media, json.dumps(record))
        self.assertIn('sha256', json.dumps(record['attachments']))
        self.assertTrue(record['capture']['omissions'])

    def test_image_only_input_is_an_owner_turn_with_attachment_evidence(self):
        self.catalog()
        self.trajectory([self.row(0, 'USER_INPUT', source='USER_EXPLICIT',
                                  media=[{'uri': 'data:image/png;base64,QUJD'}]),
                         self.row(1, 'PLANNER_RESPONSE', 'The picture shows a chart')])
        record = self.capture()[0][0]
        self.assertEqual(record['exchanges'], 1)
        self.assertEqual(record['prompts'][0]['text'], '')
        self.assertTrue(record['prompts'][0]['has_attachments'])
        self.assertEqual(record['prompts'][0]['provenance']['kind'], 'human')
        self.assertNotIn('origin', record['prompts'][0])
        self.assertEqual(record['replies'][0]['turn_id'], record['prompts'][0]['id'])
        self.assertEqual(record['attachments'][0]['source_item'], record['prompts'][0]['id'])

    def test_untitled_killed_catalog_entry_is_partial_metadata_stub(self):
        self.catalog(title='', killed=1)
        records, coverage = self.capture(limit=None)
        self.assertEqual(coverage['catalog'], 1)
        self.assertEqual(coverage['captured'], 1)
        record = records[0]
        self.assertEqual(record['title'], '')
        self.assertEqual(record['lifecycle']['killed'], 1)
        self.assertEqual(record['capture']['source'], 'catalog')
        self.assertEqual(record['capture']['start_basis'], 'catalog-last-modified')
        self.assertIn('trajectory unavailable', record['capture']['gaps'])
        self.assertEqual(record['kind'], 'unknown')

    def test_identity_filter_reads_only_the_requested_conversation(self):
        self.catalog()
        self.catalog(identity='gemini-0002')
        self.trajectory([self.row(0, 'USER_INPUT', 'Requested conversation', 'USER_EXPLICIT')], identity='gemini-0002')
        records, coverage = gemini_sessions.capture(self.profile, self.checkouts, limit=None, identities=['gemini-0002'])
        self.assertEqual([record['session_id'] for _, record in records], ['gemini-0002'])
        self.assertEqual(coverage['catalog'], 2)
        self.assertEqual(coverage['examined'], 1)
        self.assertEqual(gemini_sessions.capture(self.profile, self.checkouts, identities=[])[0], [])

    def test_fractional_timestamp_does_not_sort_before_the_start_of_its_second(self):
        self.catalog()
        first = self.row(0, 'USER_INPUT', 'Ask', 'USER_EXPLICIT')
        later = self.row(1, 'PLANNER_RESPONSE', 'Reply')
        later['created_at'] = '2026-11-24T09:00:00.5Z'
        self.trajectory([first, later])
        record = self.capture()[0][0]
        self.assertEqual(record['started'], gemini_sessions.shared.stamp(first['created_at']))
        self.assertEqual(record['ended'], gemini_sessions.shared.stamp(later['created_at']))

    def test_late_prompt_is_not_lost_to_old_lifetime_line_cap(self):
        self.catalog()
        repeat = self.row(0, 'PLANNER_RESPONSE', 'Earlier reply')
        path = self.trajectory([])
        with path.open('w', encoding='utf-8') as stream:
            stream.write((json.dumps(repeat) + '\n') * 100001)
            stream.write(json.dumps(self.row(1, 'USER_INPUT', 'Prompt after old limit', 'USER_EXPLICIT')) + '\n')
        record = self.capture()[0][0]
        self.assertEqual([item['text'] for item in record['prompts']], ['Prompt after old limit'])
        self.assertEqual(len(record['source_items']), 2)

    def test_malformed_row_does_not_discard_good_evidence(self):
        self.catalog()
        path = self.trajectory([self.row(0, 'USER_INPUT', 'Retain good evidence', 'USER_EXPLICIT')])
        with path.open('ab') as stream:
            stream.write(b'\xff\xfe\n')
            stream.write(json.dumps(self.row(1, 'PLANNER_RESPONSE', 'Also retained')).encode() + b'\n')
        record = self.capture()[0][0]
        self.assertEqual(len(record['source_items']), 2)
        self.assertEqual(record['capture']['state'], 'partial')
        self.assertIn('1 malformed trajectory rows', record['capture']['gaps'])
        self.assertEqual(record['replies'][0]['text'], 'Also retained')


if __name__ == '__main__':
    unittest.main()
