"""Check fresh-fetch authorization and identity-bound automatic-update projection."""
from copy import deepcopy
from contextlib import ExitStack
import importlib.util
from pathlib import Path
import sys
from types import ModuleType
import unittest
from unittest.mock import Mock, patch


sys.path.insert(0, str(Path(__file__).parents[1] / 'worker'))
spec = importlib.util.spec_from_file_location('repository_update_flow', Path(__file__).parents[1] / 'worker' / 'repositories.py')
repos = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repos)
HEAD, TARGET = 'a' * 40, 'b' * 40


class FreshFetchChecks(unittest.TestCase):
    def setUp(self):
        self.repo_key = repos.key('fixture/project')
        self.entry = {'path': Path('fixture-main'), 'repo': 'fixture/project', 'common': 'fixture-store', 'key': self.repo_key}
        self.row = {'name': 'fixture-main', 'key': 'c' * 24, 'branch': 'main', 'upstream': 'origin/main', 'head': HEAD}
        self.source = {'defaultBranch': 'main', 'tips': {'main': HEAD}, 'checkedAt': repos.stamp()}
        self.ref_reply = f'ref: refs/heads/main\tHEAD\n{TARGET}\tHEAD\n{TARGET}\trefs/heads/main\n'
        self.fetch_ok = True
        self.written = None
        self.fake_module = ModuleType('repository_sync')
        self.fake_module.sync_default = Mock(side_effect=self.update)
        stack = ExitStack()
        self.addCleanup(stack.close)
        stack.enter_context(patch.dict(sys.modules, {'repository_sync': self.fake_module}))
        stack.enter_context(patch.object(repos, 'discover', return_value=[self.entry]))
        stack.enter_context(patch.object(repos, 'local_status', side_effect=lambda _entry: dict(self.row)))
        stack.enter_context(patch.object(repos, 'read_source', side_effect=lambda *_: deepcopy(self.source)))
        stack.enter_context(patch.object(repos, 'write_source', side_effect=self.save))
        stack.enter_context(patch.object(repos, 'pull_requests', return_value=None))
        stack.enter_context(patch.object(repos, 'git', side_effect=self.git))

    def save(self, _state, _key, value):
        self.written = deepcopy(value)

    def git(self, _path, *args, **_kwargs):
        if args[0] == 'ls-remote': return self.ref_reply
        if args[0] == 'check-ref-format': return ''
        if args[0] == 'fetch': return '' if self.fetch_ok else None
        raise AssertionError('Unexpected Git command: ' + repr(args))

    def update(self, entries, source, state, git):
        self.assertEqual(entries, [self.entry])
        self.assertEqual(source['tips']['main'], TARGET)
        self.assertIsNone(source['notice'])
        self.row['head'] = TARGET
        return {'state': 'updated', 'reason': None, 'folder': self.row['name'],
                'checkedAt': repos.stamp(), 'updatedAt': repos.stamp()}

    def fetch(self, automatic=True):
        return repos.fetch_repository(Path('.'), Path('state'), self.repo_key, update_main=automatic)

    def test_manual_check_remains_fetch_only(self):
        self.assertTrue(self.fetch(automatic=False))
        self.fake_module.sync_default.assert_not_called()
        self.assertEqual(self.row['head'], HEAD)

    def test_successful_scheduled_fetch_authorizes_one_update(self):
        self.assertTrue(self.fetch())
        self.fake_module.sync_default.assert_called_once()
        self.assertEqual(self.written['mainSync']['state'], 'updated')
        self.assertEqual(self.written['mainSyncBasis']['head'], TARGET)
        self.assertEqual(repos.main_sync_observation(self.written, [self.row])['state'], 'updated')

    def test_failed_fetch_never_uses_cached_tip(self):
        self.fetch_ok = False
        self.assertFalse(self.fetch())
        self.fake_module.sync_default.assert_not_called()
        self.assertEqual(self.row['head'], HEAD)
        self.assertEqual(self.written['mainSync']['reason'], 'fetch-failed')

    def test_unreachable_remote_preserves_success_time_without_updating(self):
        prior = repos.stamp()
        self.source['mainSync'] = {'state': 'updated', 'folder': self.row['name'], 'updatedAt': prior}
        self.ref_reply = None
        self.assertFalse(self.fetch())
        self.fake_module.sync_default.assert_not_called()
        self.assertEqual(self.written['mainSync']['updatedAt'], prior)
        self.assertEqual(self.written['mainSync']['state'], 'failed')

    def test_unverified_default_ref_does_not_authorize_update(self):
        self.ref_reply = f'{TARGET}\trefs/heads/main\n'
        self.assertFalse(self.fetch())
        self.fake_module.sync_default.assert_not_called()

    def test_update_exception_records_unavailable_without_exposing_diagnostics(self):
        self.fake_module.sync_default.side_effect = OSError('private credentials and native paths')
        self.assertTrue(self.fetch())
        self.assertEqual(self.written['mainSync']['reason'], 'update-unavailable')
        self.assertNotIn('credentials', str(self.written))

    def test_cli_rejects_update_flag_outside_fetch_mode(self):
        with patch.object(sys, 'argv', ['repositories.py', '--root', '.', '--state', 'state', '--update-main']), \
                patch.object(repos, 'snapshot') as snapshot, patch('sys.stderr'):
            with self.assertRaises(SystemExit) as error:
                repos.main()
            self.assertEqual(error.exception.code, 2)
            snapshot.assert_not_called()


class ProjectionChecks(unittest.TestCase):
    def setUp(self):
        self.row = {'name': 'fixture-main', 'branch': 'main', 'head': TARGET}
        self.source = {'defaultBranch': 'main', 'tips': {'main': TARGET},
                       'mainSync': {'state': 'updated', 'reason': None, 'folder': 'fixture-main',
                                    'checkedAt': repos.stamp(), 'updatedAt': repos.stamp()},
                       'mainSyncBasis': {'defaultBranch': 'main', 'target': TARGET, 'branch': 'main',
                                         'head': TARGET, 'defaultFolders': ['fixture-main']}}

    def projected(self):
        return repos.main_sync_observation(self.source, [self.row])

    def test_legacy_has_no_claim_and_valid_current_identity_has_result(self):
        self.assertIsNone(repos.main_sync_observation({}, []))
        self.assertEqual(self.projected()['state'], 'updated')
        self.assertNotIn('head', self.projected())

    def test_changed_head_branch_or_remote_tip_invalidates_result(self):
        for changed in ('head', 'branch', 'target'):
            with self.subTest(changed=changed):
                source, row = deepcopy(self.source), deepcopy(self.row)
                if changed == 'target': source['tips']['main'] = HEAD
                else: row[changed] = HEAD if changed == 'head' else 'feature/work'
                self.assertIsNone(repos.main_sync_observation(source, [row]))

    def test_result_without_verified_basis_cannot_claim_current(self):
        self.source.pop('mainSyncBasis')
        self.assertIsNone(self.projected())

    def test_updated_claim_cannot_hide_remaining_commit_gap(self):
        self.row['head'] = HEAD
        self.source['mainSyncBasis']['head'] = HEAD
        self.assertIsNone(self.projected())

    def test_bad_paths_dates_and_raw_reason_strings_are_rejected(self):
        for field, value in [('folder', '../outside'), ('folder', 'C:\\private'), ('checkedAt', 'bad'),
                             ('updatedAt', 'bad'), ('reason', '<script>native diagnostic</script>')]:
            with self.subTest(field=field):
                source = deepcopy(self.source)
                source['mainSync'][field] = value
                self.assertIsNone(repos.main_sync_observation(source, [self.row]))

    def test_missing_main_reason_is_invalidated_when_main_folder_appears(self):
        self.source['mainSync'].update(state='blocked', reason='no-main', folder=None)
        self.source['mainSyncBasis']['defaultFolders'] = []
        self.assertIsNone(self.projected())


if __name__ == '__main__':
    unittest.main()
