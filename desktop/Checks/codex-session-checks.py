"""Exercise source fidelity, parent attribution and incomplete local histories."""
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / 'worker'))
import codex_sessions as codex
import local_sessions as shared
import local_session_store as store


class CodexSourceChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.profile = Path(self.temp.name)
        self.root = self.profile / '.codex'
        self.root.mkdir()
        self.catalog = self.root / 'state_5.sqlite'
        self.history = self.root / 'thread_history_1.sqlite'
        with closing(sqlite3.connect(self.catalog)) as db, db:
            db.execute('create table threads(id,title,name,cwd,rollout_path,created_at,updated_at,source,thread_source,model,tokens_used)')
            db.execute('create table thread_spawn_edges(parent_thread_id,child_thread_id,status)')
        with closing(sqlite3.connect(self.history)) as db, db:
            db.execute('create table thread_items(thread_id,turn_id,item_id,rollout_ordinal,created_at_ms,item_type,item_json)')
            db.execute('create table thread_turns(thread_id,turn_id,rollout_ordinal,status,duration_ms,error_json)')
            db.execute('create table thread_history_projection_state(thread_id,next_rollout_byte_offset,next_rollout_ordinal)')

    def thread(self, identity='thread-0001', kind='user', source='vscode', model='source-model'):
        path = self.root / 'sessions' / (identity + '.jsonl')
        with closing(sqlite3.connect(self.catalog)) as db, db:
            db.execute('insert into threads values(?,?,?,?,?,?,?,?,?,?,?)',
                       (identity, 'Original title', 'Chosen title', str(self.profile / 'gh/project'),
                        str(path), 1700000000, 1700000020, json.dumps(source) if isinstance(source, dict) else source,
                        kind, model, 999999))
        return path

    def item(self, data, ordinal=0, thread='thread-0001', turn='turn-0001'):
        with closing(sqlite3.connect(self.history)) as db, db:
            db.execute('insert into thread_items values(?,?,?,?,?,?,?)',
                       (thread, turn, data['id'], ordinal, 1700000000000 + ordinal,
                        data['type'], json.dumps(data)))

    def rollout(self, path, events):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('\n'.join(json.dumps({'timestamp': '2023-11-14T22:13:20Z', **event}) for event in events) + '\n', encoding='utf-8')

    def capture(self, **kwargs):
        records, coverage = codex.capture(self.profile, [], **kwargs)
        return {record['session_id']: record for _, record in records}, coverage

    def test_catalog_classification_preserves_parentage_and_empty_stubs(self):
        self.thread()
        self.thread('child-0001', 'subagent', {'subagent': {'thread_spawn': {
            'parent_thread_id': 'thread-0001', 'depth': 1, 'agent_path': '/root/check'}}})
        self.thread('review-0001', 'guardian_review', {'subagent': {'other': 'guardian'}})
        with closing(sqlite3.connect(self.catalog)) as db, db:
            db.execute('insert into thread_spawn_edges values(?,?,?)', ('thread-0001', 'review-0001', 'open'))
        records, coverage = self.capture()
        self.assertEqual(set(records), {'thread-0001', 'child-0001', 'review-0001'})
        self.assertEqual(records['child-0001']['parent']['short'], shared.short_id('codex', 'thread-0001'))
        self.assertEqual(records['review-0001']['kind'], 'guardian_review')
        self.assertEqual(records['review-0001']['parent']['session_id'], 'thread-0001')
        self.assertEqual(coverage['metadata_only'], 3)
        self.assertEqual(records['child-0001']['capture']['state'], 'partial')

    def test_phases_owner_provenance_attachments_and_exposed_evidence(self):
        path = self.thread()
        self.item({'type': 'userMessage', 'id': 'ask', 'clientId': 'client', 'content': [
            {'type': 'text', 'text': 'Keep the question'}, {'type': 'image', 'image_url': 'data:image/png;base64,YQ=='}]}, 0)
        self.item({'type': 'userMessage', 'id': 'context', 'content': [{'type': 'text', 'text': 'Injected context'}]}, 1)
        self.item({'type': 'agentMessage', 'id': 'progress', 'text': 'Working', 'phase': 'commentary'}, 2)
        self.item({'type': 'agentMessage', 'id': 'answer', 'text': 'Result', 'phase': 'final_answer'}, 3)
        self.item({'type': 'reasoning', 'id': 'summary', 'summary': ['Exposed summary'], 'content': []}, 4)
        self.item({'type': 'commandExecution', 'id': 'command', 'command': 'fixture command',
                   'aggregatedOutput': 'Important output', 'exitCode': 3, 'durationMs': 120, 'status': 'failed'}, 5)
        self.rollout(path, [
            {'type': 'session_meta', 'payload': {'id': 'thread-0001'}},
            {'type': 'response_item', 'payload': {'type': 'message', 'id': 'ask', 'role': 'user',
             'content': [{'type': 'input_text', 'text': 'Keep the question'}],
             'internal_chat_message_metadata_passthrough': {'content_item_kinds': ['user.text'],
                 'content_item_metadata': [{'provenance': {'type': 'user'}}]}}},
            {'type': 'response_item', 'payload': {'type': 'message', 'id': 'context', 'role': 'user',
             'content': [{'type': 'input_text', 'text': 'Injected context'}],
             'internal_chat_message_metadata_passthrough': {'content_item_kinds': ['agents_md.instructions'],
                 'content_item_metadata': [{'provenance': {'type': 'agents_md'}}]}}},
            {'type': 'response_item', 'payload': {'type': 'reasoning', 'id': 'summary',
             'summary': ['Exposed summary'], 'encrypted_content': 'ENCRYPTED_PAYLOAD'}},
        ])
        records, _ = self.capture()
        record = records['thread-0001']
        self.assertEqual([p['text'] for p in record['prompts']], ['Keep the question'])
        self.assertEqual(record['injected'][0]['origin']['kind'], 'harness')
        self.assertEqual([r['phase'] for r in record['replies']], ['commentary', 'final_answer'])
        self.assertEqual(record['thinking'][0]['text'], 'Exposed summary')
        self.assertEqual(record['calls'][0]['exit_code'], 3)
        self.assertEqual(record['calls'][0]['arg'], 'fixture command')
        self.assertEqual(record['calls'][0]['body'], 'Important output')
        self.assertFalse(record['calls'][0]['ok'])
        self.assertEqual(record['calls'][0]['duration_ms'], 120)
        self.assertEqual(record['attachments'][0]['data']['image_url']['omitted'], 'media_bytes')
        self.assertNotIn('YQ==', json.dumps(record))
        self.assertNotIn('ENCRYPTED_PAYLOAD', json.dumps(record))
        self.assertIn('Important output', json.dumps(record['source_items']))
        self.assertEqual(record['capture']['omissions']['media_bytes'], 1)
        self.assertEqual(record['capture']['omissions']['encrypted_content'], 1)

    def test_child_copied_rollout_never_becomes_a_second_owner_conversation(self):
        path = self.thread('child-0001', 'subagent', {'subagent': {'thread_spawn': {'parent_thread_id': 'parent-0001'}}})
        self.rollout(path, [
            {'type': 'session_meta', 'payload': {'id': 'parent-0001', 'source': 'vscode'}},
            {'type': 'response_item', 'payload': {'type': 'message', 'id': 'old-ask', 'role': 'user',
             'content': [{'type': 'input_text', 'text': 'Parent question'}]}},
            {'type': 'response_item', 'payload': {'type': 'message', 'id': 'old-answer', 'role': 'assistant',
             'content': [{'type': 'output_text', 'text': 'Parent answer'}]}},
            {'type': 'event_msg', 'payload': {'type': 'item_completed', 'thread_id': 'child-0001',
             'turn_id': 'child-turn', 'item': {'type': 'agentMessage', 'id': 'own-answer', 'text': 'Child result', 'phase': 'final_answer'}}},
        ])
        records, _ = self.capture()
        record = records['child-0001']
        self.assertEqual(record['prompts'], [])
        self.assertEqual([r['text'] for r in record['replies']], ['Child result'])
        self.assertIn('Parent question', json.dumps(record['source_items']))
        self.assertEqual(sum(item.get('ownership') == 'inherited' for item in record['source_items']), 3)
        self.assertEqual(record['capture']['sources']['rollout']['inherited_events'], 3)
        self.assertTrue(record['replies'][0]['source_id'].startswith('rollout:3:'))
        self.assertIn(record['replies'][0]['source_id'], {item['id'] for item in record['source_items']})

    def test_rollout_fallback_uses_native_origin_and_keeps_image_only_turns(self):
        path = self.thread()
        self.rollout(path, [
            {'type': 'session_meta', 'payload': {'id': 'thread-0001'}},
            {'type': 'response_item', 'payload': {'type': 'message', 'id': 'injected', 'role': 'user',
             'content': [{'type': 'input_text', 'text': 'Instructions'}],
             'internal_chat_message_metadata_passthrough': {'content_item_metadata': [{'provenance': {'type': 'harness'}}]}}},
            {'type': 'response_item', 'payload': {'type': 'message', 'id': 'photo', 'role': 'user',
             'content': [{'type': 'localImage', 'path': 'fixture.png'}],
             'internal_chat_message_metadata_passthrough': {'turn_id': 'turn-image', 'content_item_kinds': ['user.image']}}},
        ])
        records, _ = self.capture()
        record = records['thread-0001']
        self.assertEqual(len(record['prompts']), 1)
        self.assertEqual(record['prompts'][0]['text'], '')
        self.assertEqual(record['prompts'][0]['turn_id'], 'turn-image')
        self.assertEqual(record['attachments'][0]['data']['path'], 'fixture.png')
        self.assertEqual(record['injected'][0]['text'], 'Instructions')

    def test_inherited_usage_is_retained_without_becoming_child_usage(self):
        path = self.thread('child-0001', 'subagent', {'subagent': {'thread_spawn': {'parent_thread_id': 'parent-0001'}}})
        self.rollout(path, [
            {'type': 'session_meta', 'payload': {'id': 'parent-0001'}},
            {'type': 'token_usage_record', 'payload': {'thread_id': 'parent-0001', 'response_id': 'parent-response',
             'usage': {'total_tokens': 42}}},
        ])
        records, _ = self.capture()
        record = records['child-0001']
        self.assertEqual(record['usage_ledger'], [])
        self.assertEqual(record['usage']['state'], 'unavailable')
        self.assertEqual(record['capture']['own_evidence_state'], 'unavailable')
        self.assertEqual(record['prompts'], [])
        self.assertEqual(record['replies'], [])
        self.assertEqual(len(record['source_items']), 2)
        self.assertTrue(all(item['ownership'] == 'inherited' for item in record['source_items']))

    def test_no_lifetime_item_limit_and_explicit_full_catalog_pass(self):
        self.thread()
        self.thread('thread-0002')
        with closing(sqlite3.connect(self.history)) as db, db:
            db.executemany('insert into thread_items values(?,?,?,?,?,?,?)',
                           (('thread-0001', 'turn', 'reply-' + str(i), i, 1700000000000 + i, 'agentMessage',
                             json.dumps({'type': 'agentMessage', 'id': 'reply-' + str(i), 'text': str(i), 'phase': 'commentary'}))
                            for i in range(10025)))
        records, coverage = self.capture(limit=None)
        self.assertEqual(len(records['thread-0001']['replies']), 10025)
        self.assertEqual(records['thread-0001']['replies'][-1]['text'], '10024')
        self.assertIsNone(records['thread-0001']['capture']['lifetime_limit'])
        self.assertFalse(coverage['limited'])
        _, limited = self.capture(limit=1)
        self.assertTrue(limited['limited'])

    def test_usage_native_ledger_deduplicates_responses_without_inventing_cost(self):
        path = self.thread()
        payload = {'thread_id': 'thread-0001', 'turn_id': 'turn', 'response_id': 'response-1',
                   'usage': {'input_tokens': 20, 'cached_input_tokens': 15, 'output_tokens': 5,
                             'reasoning_output_tokens': 3, 'total_tokens': 25},
                   'thread_token_usage': {'total_tokens': 250}}
        self.rollout(path, [
            {'type': 'session_meta', 'payload': {'id': 'thread-0001'}},
            {'type': 'turn_context', 'payload': {'model': 'second-model', 'effort': 'high'}},
            {'type': 'token_usage_record', 'payload': payload},
            {'type': 'token_usage_record', 'payload': payload},
            {'type': 'compacted', 'payload': {'message': 'Exposed compaction summary', 'replacement_history': []}},
        ])
        records, _ = self.capture()
        record = records['thread-0001']
        self.assertEqual(record['usage_ledger'], [payload])
        self.assertEqual(record['usage']['duplicates'], 1)
        self.assertEqual(record['models'], ['source-model', 'second-model'])
        self.assertNotIn('tokens', record)
        self.assertNotIn('cost', record)
        self.assertEqual(record['usage']['scope'], 'request-traffic')
        self.assertIn('Exposed compaction summary', json.dumps(record['source_items']))

    def test_native_versions_are_not_discarded_by_latest_database_projection(self):
        path = self.thread()
        latest = {'type': 'agentMessage', 'id': 'answer', 'text': 'Latest answer', 'phase': 'final_answer'}
        earlier = {**latest, 'text': 'Earlier source revision'}
        self.item(latest)
        self.rollout(path, [
            {'type': 'session_meta', 'payload': {'id': 'thread-0001'}},
            {'type': 'event_msg', 'payload': {'type': 'item_completed', 'thread_id': 'thread-0001', 'item': earlier}},
            {'type': 'event_msg', 'payload': {'type': 'item_completed', 'thread_id': 'thread-0001', 'item': latest}},
        ])
        records, _ = self.capture()
        record = records['thread-0001']
        self.assertEqual([r['text'] for r in record['replies']], ['Latest answer'])
        self.assertIn('Earlier source revision', json.dumps(record['source_items']))
        latest_event = record['source_items'][-1]['data']['payload']['item']
        self.assertEqual(latest_event, {'source_item_ref': 'history:answer', 'source_item_digest': store.digest(latest)})

    def test_store_roundtrip_keeps_canonical_bodies_refs_and_raw_usage_duplicates(self):
        path = self.thread()
        answer = {'type': 'agentMessage', 'id': 'answer', 'text': 'Canonical body', 'phase': 'final_answer'}
        self.item(answer)
        usage = {'thread_id': 'thread-0001', 'response_id': 'same-response', 'usage': {'total_tokens': 12}}
        self.rollout(path, [
            {'type': 'session_meta', 'payload': {'id': 'thread-0001'}},
            {'type': 'response_item', 'payload': {'type': 'message', 'id': 'answer', 'role': 'assistant',
             'content': [{'type': 'output_text', 'text': 'Canonical body'}], 'phase': 'final_answer'}},
            {'type': 'event_msg', 'payload': {'type': 'item_completed', 'thread_id': 'thread-0001', 'item': answer}},
            {'type': 'token_usage_record', 'payload': usage},
            {'type': 'token_usage_record', 'payload': usage},
        ])
        records, _ = self.capture()
        record = records['thread-0001']
        merged = store.merge(record, record)
        self.assertEqual(len(merged['source_items']), len(record['source_items']))
        by_id = {item['id']: item for item in merged['source_items']}
        self.assertEqual(len(by_id), len(merged['source_items']))
        self.assertEqual(by_id['history:answer']['data']['text'], 'Canonical body')
        self.assertEqual(merged['replies'][0]['source_id'], 'history:answer')
        refs = []
        def visit(value):
            if isinstance(value, dict):
                if 'source_item_ref' in value:
                    refs.append(value['source_item_ref'])
                for child in value.values():
                    visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)
        visit(merged['source_items'])
        self.assertTrue(refs)
        self.assertTrue(all(ref in by_id for ref in refs))
        native_usage = [item for item in merged['source_items'] if item['type'] == 'token_usage_record']
        self.assertEqual(len(native_usage), 2)
        self.assertNotEqual(native_usage[0]['id'], native_usage[1]['id'])
        self.assertEqual(len(merged['usage_ledger']), 1)

    def test_rewritten_rollout_positions_keep_distinct_source_events(self):
        path = self.thread()
        first = {'type': 'session_meta', 'payload': {'id': 'thread-0001', 'marker': 'before'}}
        self.rollout(path, [first])
        old, _ = self.capture()
        self.rollout(path, [{**first, 'payload': {**first['payload'], 'marker': 'after'}}])
        new, _ = self.capture()
        self.assertNotEqual(old['thread-0001']['source_items'][0]['id'], new['thread-0001']['source_items'][0]['id'])
        merged = store.merge(old['thread-0001'], new['thread-0001'])
        self.assertEqual(len(merged['source_items']), 2)

    def test_native_body_reference_digest_resolves_after_history_item_changes(self):
        path = self.thread()
        earlier = {'type': 'agentMessage', 'id': 'answer', 'text': 'Earlier immutable body', 'phase': 'final_answer'}
        self.item(earlier)
        self.rollout(path, [
            {'type': 'session_meta', 'payload': {'id': 'thread-0001'}},
            {'type': 'event_msg', 'payload': {'type': 'item_completed', 'thread_id': 'thread-0001', 'item': earlier}},
        ])
        old, _ = self.capture()
        reference = old['thread-0001']['source_items'][-1]['data']['payload']['item']
        self.assertEqual(reference['source_item_digest'], store.digest(earlier))
        later = {**earlier, 'text': 'Latest mutable projection'}
        with closing(sqlite3.connect(self.history)) as db, db:
            db.execute('update thread_items set item_json=? where item_id=?', (json.dumps(later), 'answer'))
        new, _ = self.capture()
        merged = store.merge(old['thread-0001'], new['thread-0001'])
        current = next(item for item in merged['source_items'] if item['id'] == reference['source_item_ref'])
        self.assertNotEqual(store.digest(current['data']), reference['source_item_digest'])
        historical = [item for item in merged['source_revisions']
                      if item.get('item_id') == reference['source_item_ref'] and store.digest(item['data']) == reference['source_item_digest']]
        self.assertEqual(len(historical), 1)
        self.assertEqual(historical[0]['data'], earlier)

    def test_identity_batches_select_only_requested_threads(self):
        self.thread()
        self.thread('thread-0002')
        records, coverage = self.capture(limit=None, identities=['thread-0002'])
        self.assertEqual(set(records), {'thread-0002'})
        self.assertEqual(coverage['catalog'], 2)
        self.assertEqual(coverage['selected'], 1)
        self.assertFalse(coverage['limited'])
        records, coverage = self.capture(identities=[])
        self.assertEqual(records, {})
        self.assertEqual(coverage['selected'], 0)
        self.assertFalse(coverage['limited'])
        with self.assertRaises(ValueError):
            self.capture(identities=['thread-' + str(i) for i in range(33)])

    def test_command_and_mcp_calls_project_known_results_without_guessing_unknown_success(self):
        self.thread()
        self.item({'type': 'commandExecution', 'id': 'command', 'command': 'fixture --check',
                   'cwd': 'fixture/path', 'aggregatedOutput': 'Résumé output', 'exitCode': 0,
                   'status': 'completed', 'durationMs': 125}, 0)
        self.item({'type': 'mcpToolCall', 'id': 'mcp-failure', 'server': 'fixture', 'tool': 'lookup',
                   'arguments': {'key': 'value'}, 'result': None, 'error': {'code': 'fixture-error'},
                   'status': 'failed', 'durationMs': 250}, 1)
        self.item({'type': 'mcpToolCall', 'id': 'mcp-tool-error', 'server': 'fixture', 'tool': 'lookup',
                   'arguments': {'key': 'another'}, 'result': {'isError': True, 'content': [{'type': 'text', 'text': 'Tool failed'}]},
                   'error': None, 'status': 'completed', 'durationMs': 300}, 2)
        self.item({'type': 'mcpToolCall', 'id': 'mcp-unknown', 'server': 'fixture', 'tool': 'lookup',
                   'arguments': {}, 'status': 'inProgress'}, 3)
        records, _ = self.capture()
        calls = {call['id']: call for call in records['thread-0001']['calls']}
        command = calls['command']
        self.assertTrue(command['ok'])
        self.assertEqual(command['arg'], 'fixture --check')
        self.assertEqual(command['input']['cwd'], 'fixture/path')
        self.assertEqual(command['body'], 'Résumé output')
        self.assertEqual(command['bytes'], len('Résumé output'.encode('utf-8')))
        self.assertEqual(command['duration_ms'], 125)
        failure = calls['mcp-failure']
        self.assertFalse(failure['ok'])
        self.assertEqual(failure['input'], {'key': 'value'})
        self.assertEqual(json.loads(failure['arg']), failure['input'])
        self.assertEqual(json.loads(failure['body'])['error'], {'code': 'fixture-error'})
        self.assertEqual(failure['duration_ms'], 250)
        self.assertFalse(calls['mcp-tool-error']['ok'])
        self.assertEqual(json.loads(calls['mcp-tool-error']['body'])['content'][0]['text'], 'Tool failed')
        self.assertNotIn('ok', calls['mcp-unknown'])
        self.assertTrue(calls['mcp-unknown']['output_unprojected'])
        self.assertNotIn('bytes', calls['mcp-unknown'])

    def test_malformed_source_and_projection_lag_are_reported(self):
        path = self.thread()
        self.item({'type': 'agentMessage', 'id': 'answer', 'text': 'Kept'}, 0)
        self.rollout(path, [{'type': 'session_meta', 'payload': {'id': 'thread-0001'}}])
        with path.open('a', encoding='utf-8') as stream:
            stream.write('{incomplete\n')
        with closing(sqlite3.connect(self.history)) as db, db:
            db.execute('insert into thread_history_projection_state values(?,?,?)', ('thread-0001', 1, 1))
        records, _ = self.capture()
        record = records['thread-0001']
        self.assertEqual(record['replies'][0]['text'], 'Kept')
        self.assertEqual(record['capture']['state'], 'partial')
        self.assertEqual(record['capture']['sources']['rollout']['malformed_events'], 1)
        self.assertGreater(record['capture']['sources']['history']['projection_bytes_behind'], 0)
        self.assertEqual(record['usage']['state'], 'unavailable')

    def test_outside_rollout_is_not_followed_and_catalog_identity_survives(self):
        self.thread()
        outside = self.profile / 'elsewhere.jsonl'
        outside.write_text(json.dumps({'type': 'response_item', 'payload': {'type': 'message', 'role': 'assistant',
                                 'content': [{'type': 'output_text', 'text': 'OUTSIDE_SOURCE'}]}}), encoding='utf-8')
        with closing(sqlite3.connect(self.catalog)) as db, db:
            db.execute('update threads set rollout_path=?', (str(outside),))
        records, coverage = self.capture()
        self.assertEqual(coverage['metadata_only'], 1)
        self.assertNotIn('OUTSIDE_SOURCE', json.dumps(records))


if __name__ == '__main__':
    unittest.main()
