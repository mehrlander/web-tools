"""Fixtures for the local work pipeline. No live logs, model, or Git writes."""
import importlib.util
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import time
import unittest

spec = importlib.util.spec_from_file_location('work',Path(__file__).parents[1]/'worker/work_summaries.py')
work = importlib.util.module_from_spec(spec)
spec.loader.exec_module(work)


class WorkChecks(unittest.TestCase):
    def test_gemini_pairs_out_of_order_results_without_thinking(self):
        rows=[{'step_index':2,'type':'GENERIC','status':'DONE','content':'Exit code: 0'},
              {'step_index':1,'type':'PLANNER_RESPONSE','thinking':'PRIVATE REASONING','created_at':'2026-10-27T10:00:00Z',
               'tool_calls':[{'name':'run_command','args':{'CommandLine':'npm test'}}]}]
        events,_,_=work.gemini_events(rows,'session')
        self.assertEqual((events[0]['action'],events[0]['result']),('run checks','succeeded'))
        self.assertNotIn('PRIVATE',json.dumps(events))

    def test_background_command_is_not_a_success(self):
        self.assertEqual(work.outcome('Background command ID: abc'),'returned')
        self.assertEqual(work.outcome('Exit code: 1'),'failed')
        self.assertEqual(work.outcome({'exit_code':0}),'succeeded')
        self.assertEqual(work.outcome('The code example says exit_code: 0'),'returned')

    def test_gemini_edit_requires_a_result(self):
        row={'step_index':1,'type':'PLANNER_RESPONSE','tool_calls':[{'name':'write_to_file','args':{'TargetFile':'C:/fixtures/gh/app/file.txt'}}]}
        events,_,_=work.gemini_events([row],'session')
        self.assertEqual(events[0]['result'],'attempted')
        self.assertEqual(events[0]['target'],'app/file.txt')

    def test_codex_calls_are_paired_and_only_latest_turn_is_read(self):
        def msg(kind,payload):return {'type':kind,'timestamp':'2026-10-27T10:00:00Z','payload':payload}
        rows=[msg('event_msg',{'type':'task_started','turn_id':'old'}),msg('response_item',{'type':'function_call','call_id':'old','name':'exec_command','arguments':'{"cmd":"git push"}'}),
              msg('event_msg',{'type':'task_started','turn_id':'current'}),msg('response_item',{'type':'function_call','call_id':'current','name':'exec_command','arguments':'{"cmd":"npm test"}'}),
              msg('response_item',{'type':'function_call_output','call_id':'current','output':'{"exit_code":0}'}),
              msg('response_item',{'type':'reasoning','text':'PRIVATE'})]
        events,_,turn=work.codex_events(rows,'session')
        self.assertEqual(turn,'current')
        self.assertEqual(len(events),1)
        self.assertEqual(events[0]['result'],'succeeded')
        self.assertNotIn('PRIVATE',json.dumps(events))

    def test_model_cannot_invent_evidence_or_change_state(self):
        batch=[work.event('e1','2026-10-27T10:00:00Z','run checks')]
        with self.assertRaises(ValueError):
            work.parse_answer('{"headline":"Checks","summary":"Inspected checks","continues":true,"evidenceIds":["missing"]}',batch)
        answer=work.parse_answer('{"headline":"Checks","summary":"Inspected checks","continues":true,"evidenceIds":["e1"],"state":"done"}',batch)
        self.assertNotIn('state',answer)

    def test_model_paths_and_secrets_are_rejected(self):
        batch=[work.event('e1','','read file')]
        for summary in ['Read C:\\private\\file.txt','Read /home/owner/file','Read https://private.test','token=secretvalue']:  # machine-path-ok: synthetic rejection fixtures
            with self.assertRaises(ValueError):
                work.parse_answer(json.dumps({'headline':'Files','summary':summary,'continues':True,'evidenceIds':['e1']}),batch)

    def test_same_goal_keeps_identity_and_stable_evidence_is_not_resummarized(self):
        task={'key':'Codex:session','provider':'Codex','id':'session','through':work.stamp(),'turn':'one','agents':0,'events':[work.event('e1',work.stamp(),'run checks','succeeded')]}
        answer={'headline':'Phone layout','summary':'Phone checks passed.','continues':False,'evidenceIds':['e1']}
        first=work.update(task,{},task['events'],answer)
        self.assertEqual(work.evidence(task,first),[])
        task['turn']='two';task['events'].append(work.event('e2',work.stamp(),'install app','attempted'))
        second=work.update(task,first,[task['events'][-1]],{**answer,'continues':True,'evidenceIds':['e2']})
        self.assertEqual(first['segments'][0]['id'],second['segments'][0]['id'])
        self.assertFalse(any('installations' in s for s in second['segments'][0]['evidence']))
        third=work.update({**task,'turn':'three'},second,[task['events'][-1]],{**answer,'continues':False,'evidenceIds':['e2']})
        self.assertEqual(len(third['segments']),2)

    def test_pending_call_result_updates_the_same_evidence_identity(self):
        pending=work.event('e1',work.stamp(),'run checks')
        task={'events':[pending]}
        previous={'seen':[work.digest(pending)]}
        task['events']=[{**pending,'result':'succeeded'}]
        self.assertEqual(work.evidence(task,previous)[0]['id'],'e1')

    def test_late_worker_reply_is_harvested_without_another_model_call(self):
        task={'key':'Codex:local','provider':'Codex','id':'local','through':work.stamp(),'turn':'one','agents':0,'events':[work.event('e1',work.stamp(),'run checks','succeeded')]}
        pending={'pending':{'conversation':'existing-job','started':time.time(),'task':task,'batch':task['events']}}
        class Engine:
            def worker_replies(self,identity):
                self.identity=identity
                return ['{"headline":"Phone checks","summary":"Phone checks passed.","continues":false,"evidenceIds":["e1"]}']
        engine=Engine()
        value=work.harvest(pending,engine)
        self.assertEqual(engine.identity,'existing-job')
        self.assertNotIn('pending',value)
        self.assertEqual(value['segments'][0]['summary'],'Phone checks passed.')

    def test_pending_worker_job_waits_then_expires(self):
        class Engine:
            def worker_replies(self,_):return []
        pending={'pending':{'conversation':'existing','started':time.time()}}
        self.assertIs(work.harvest(pending,Engine()),pending)
        pending['pending']['started']=time.time()-601
        self.assertIsNone(work.harvest(pending,Engine())['pending'])

    def test_gemini_children_are_collected_under_parent_and_worker_profile_is_excluded(self):
        with tempfile.TemporaryDirectory() as td:
            profile=Path(td);root=profile/'.gemini/antigravity';root.mkdir(parents=True)
            with closing(sqlite3.connect(root/'conversation_summaries.db')) as db:
                db.execute('create table conversation_summaries(conversation_id,title,parent_conversation_id,status,not_fully_idle,last_modified_time,killed)')
                for identity,parent,title in [('parent','','Main work'),('child','parent','')]:
                    db.execute('insert into conversation_summaries values(?,?,?,?,?,?,?)',(identity,title,parent,'CASCADE_RUN_STATUS_RUNNING',1,work.stamp(),0))
                    folder=root/'brain'/identity/'.system_generated/logs';folder.mkdir(parents=True)
                    (folder/'transcript_full.jsonl').write_text(json.dumps({'step_index':0,'type':'PLANNER_RESPONSE','created_at':work.stamp(),'tool_calls':[{'name':'view_file','args':{'AbsolutePath':'file.txt'}}]})+'\n')
                db.commit()
            tasks,_=work.collect(profile,work.LogReader())
            self.assertEqual(len(tasks),1)
            self.assertEqual(tasks[0]['agents'],1)
            self.assertEqual(len(tasks[0]['events']),2)

    def test_readonly_database_does_not_create_missing_sources(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'missing.sqlite'
            with self.assertRaises(sqlite3.Error):work.database(path)
            self.assertFalse(path.exists())

    def test_trailing_partial_record_is_ignored(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'source.jsonl'
            path.write_text('{"type":"ok"}\n{"partial":')
            self.assertEqual(work.LogReader().rows(path),[{'type':'ok'}])


if __name__=='__main__':unittest.main()
