"""Bounded observation-cache checks using synthetic Git and private temp state."""
from concurrent.futures import ThreadPoolExecutor
import inspect
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / 'worker'))
import repositories as repos
import repository_cache as cache


class RepositoryCacheChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='web-tools-repository-cache-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root, self.state = self.base / 'checkouts', self.base / 'state'
        self.root.mkdir()
        self.folder = self.checkout('project')
        self.global_config = self.base / 'global-config'
        self.calls, self.branch, self.head = [], 'main', 'a' * 40
        self.original_git = repos.git
        self.remote = 'https://fixture-secret@github.com/fixture/project.git'
        self.extra_status = ''
        self.mock = patch.object(repos, 'git', side_effect=self.git)
        self.mock.start()
        self.addCleanup(self.mock.stop)
        self.inputs = patch.object(cache, '_global_inputs', return_value={self.global_config})
        self.inputs.start()
        self.addCleanup(self.inputs.stop)

    def checkout(self, name):
        path = self.root / name
        (path / '.git').mkdir(parents=True)
        (path / '.git' / 'config').write_text('[remote "origin"]\nurl = fixture\n', encoding='utf-8')
        return path

    def git(self, path, *args, **kwargs):
        path = Path(path)
        self.calls.append((path.name, args, kwargs))
        if args[:3] == ('config', '--get', 'remote.origin.url'):
            return self.remote
        if args and args[0] == 'rev-parse' and '--git-common-dir' in args:
            gitdir, common = cache._layout(path)
            return str(common) + '\n' + str(gitdir)
        if args and args[0] == 'status':
            return '# branch.oid ' + self.head + '\n# branch.head ' + self.branch + '\n# branch.upstream origin/' + self.branch + '\n' + self.extra_status
        if args == ('rev-parse', '--is-shallow-repository'):
            return 'false'
        if args and args[0] == 'cat-file':
            return ''
        if args and args[0] == 'merge-base':
            return self.head
        if args and args[0] == 'rev-list':
            return '0 1'
        if args and args[0] == 'check-ref-format':
            return ''
        if args and args[0] == 'ls-remote':
            return 'ref: refs/heads/main\tHEAD\n' + self.head + '\tHEAD\n' + self.head + '\trefs/heads/main\n'
        if args and args[0] == 'fetch':
            return ''
        raise AssertionError('Unexpected fixture Git operation: ' + repr(args))

    def snapshot(self):
        return repos.snapshot(self.root, self.state)

    def identity_calls(self):
        return [row for row in self.calls if row[1][0] == 'config' or '--git-common-dir' in row[1]]

    def discovery_record(self):
        return next((self.state / 'repository-discovery').glob('*.json'))

    def source(self, target=None):
        repos.write_source(self.state, repos.key('fixture/project'), {'checkedAt': repos.stamp(), 'defaultBranch': 'main',
                           'tips': {'main': target or self.head}, 'pullRequests': {}, 'pullRequestsCheckedAt': repos.stamp()})

    def test_warm_snapshot_reduces_discovery_to_fresh_status(self):
        self.snapshot()
        self.assertEqual(len(self.identity_calls()), 2)
        self.calls.clear()
        value = self.snapshot()
        self.assertEqual(self.identity_calls(), [])
        self.assertEqual([row[1][0] for row in self.calls], ['status'])
        self.assertEqual(value['repositories'][0]['name'], 'fixture/project')
        record = self.discovery_record().read_text(encoding='utf-8')
        self.assertNotIn('https://', record)
        self.assertNotIn('fixture-secret', record)
        self.assertNotIn(str(self.base), json.dumps(value))

    def test_branch_and_uncommitted_status_are_never_cached(self):
        self.snapshot()
        self.calls.clear()
        self.branch = 'codex/new-work'
        self.extra_status = '? new.txt\n1 M. N... 100644 100644 100644 x x existing.txt'
        row = self.snapshot()['repositories'][0]['checkouts'][0]
        self.assertEqual(self.identity_calls(), [])
        self.assertEqual((row['branch'], row['changed'], row['untracked']), ('codex/new-work', 1, 1))

    def test_unrelated_directory_and_working_file_churn_preserve_identity_cache(self):
        self.snapshot()
        (self.root / 'unrelated-files').mkdir()
        (self.folder / 'new-work.txt').write_text('working text', encoding='utf-8')
        (self.folder / '.git' / 'FETCH_HEAD').write_text('fixture', encoding='utf-8')
        (self.folder / '.git' / 'index.lock').write_text('fixture', encoding='utf-8')
        self.extra_status = '? new-work.txt'
        self.calls.clear()
        row = self.snapshot()['repositories'][0]['checkouts'][0]
        self.assertEqual(self.identity_calls(), [])
        self.assertEqual(row['untracked'], 1)

    def replace_marker_with_pointer(self, target):
        original = self.base / 'previous-git-store'
        self.assertTrue(original.resolve().is_relative_to(self.base.resolve()))
        (self.folder / '.git').rename(original)
        (self.folder / '.git').write_text('gitdir: ' + str(target), encoding='utf-8')

    def test_known_missing_gitdir_uses_zero_git_and_no_stale_identity_or_counts(self):
        self.source()
        self.snapshot()
        before = self.discovery_record().read_bytes()
        self.replace_marker_with_pointer(self.base / 'missing-git-store')
        self.calls.clear()
        snapshot = self.snapshot()
        group = snapshot['repositories'][0]
        row = group['checkouts'][0]
        self.assertEqual(self.calls, [])
        self.assertIsNone(group['url'])
        self.assertEqual(group['key'], repos.key(str(self.folder.resolve()).lower()))
        self.assertEqual((row['branch'], row['changed'], row['untracked']), ('', None, None))
        self.assertEqual((row['tracked']['ahead'], row['tracked']['behind']), (None, None))
        self.assertEqual((row['tracked']['state'], row['main']['state'], row['branchStatus']['state']), ('unavailable', 'unavailable', 'unknown'))
        self.assertIsNone(row['branchStatus']['url'])
        self.assertNotIn('_snapshotUnavailable', json.dumps(snapshot))
        self.assertEqual(self.discovery_record().read_bytes(), before)

    def test_restored_gitdir_automatically_recovers_with_fresh_git(self):
        target = self.base / 'restored-store'
        self.replace_marker_with_pointer(target)
        self.assertIsNone(self.snapshot()['repositories'][0]['url'])
        self.assertEqual(self.calls, [])
        target.mkdir()
        (target / 'config').write_text('restored metadata', encoding='utf-8')
        self.remote = 'https://github.com/restored/project.git'
        self.calls.clear()
        group = self.snapshot()['repositories'][0]
        self.assertEqual(len(self.identity_calls()), 2)
        self.assertEqual(group['name'], 'restored/project')
        self.assertEqual(group['checkouts'][0]['branch'], 'main')
        self.calls.clear()
        self.snapshot()
        self.assertEqual(self.identity_calls(), [])

    def test_missing_or_nondirectory_common_target_is_unknown_without_git(self):
        target = self.base / 'missing-common'
        (self.folder / '.git' / 'commondir').write_text(str(target), encoding='utf-8')
        for exists_as_file in (False, True):
            if exists_as_file:
                target.write_text('not a Git directory', encoding='utf-8')
            self.calls.clear()
            self.assertIsNone(self.snapshot()['repositories'][0]['url'])
            self.assertEqual(self.calls, [])
        target.unlink()
        target.mkdir()
        (target / 'config').write_text('restored common metadata', encoding='utf-8')
        self.calls.clear()
        self.assertIsNotNone(self.snapshot()['repositories'][0]['url'])
        self.assertEqual(len(self.identity_calls()), 2)

    def test_unsupported_and_reparse_administration_uses_fresh_fallback(self):
        self.replace_marker_with_pointer(self.base / 'missing-git-store')
        marker = self.folder / '.git'
        entry = {'path': self.folder, 'repo': 'fixture/project', 'common': str(self.base),
                 'gitdir': str(self.base), 'key': repos.key('fixture/project')}
        marker.write_text('an unsupported administration format', encoding='utf-8')
        with patch.object(repos, 'discover', return_value=[entry]) as fresh:
            found = cache.discover_cached(self.root, self.state, repos.discover)
            fresh.assert_called_once_with(self.root, ['project'])
            self.assertEqual(found, [entry])
        marker.write_text('gitdir: ' + str(self.base / 'missing-git-store'), encoding='utf-8')
        real_stamp = cache._stamp
        with patch.object(cache, '_stamp', side_effect=lambda path: None if Path(path) == marker else real_stamp(path)), patch.object(repos, 'discover', return_value=[entry]) as fresh:
            self.assertEqual(cache.discover_cached(self.root, self.state, repos.discover), [entry])
            fresh.assert_called_once()

    def test_broken_snapshot_shortcut_is_not_used_by_fresh_mutation_discovery(self):
        self.replace_marker_with_pointer(self.base / 'missing-git-store')
        def unavailable(_path, *args, **kwargs):
            self.calls.append(('project', args, kwargs))
            return None
        with patch.object(repos, 'git', side_effect=unavailable):
            self.assertFalse(repos.fetch_repository(self.root, self.state, repos.key('fixture/project'), update_main=True))
        self.assertEqual(len(self.identity_calls()), 2)

    def test_local_global_and_missing_config_creation_invalidate(self):
        self.snapshot()
        for path in (self.folder / '.git' / 'config', self.global_config, self.folder / '.git' / 'config.worktree'):
            with self.subTest(path=path.name):
                self.calls.clear()
                path.write_text('changed config input\n', encoding='utf-8')
                self.snapshot()
                self.assertEqual(len(self.identity_calls()), 2)
                self.calls.clear()
                self.snapshot()
                self.assertEqual(self.identity_calls(), [])

    def test_pointer_and_common_pointer_changes_invalidate(self):
        (self.folder / '.git' / 'config').unlink()
        (self.folder / '.git').rmdir()
        store = self.base / 'store'
        gitdir = store / 'worktrees' / 'project'
        gitdir.mkdir(parents=True)
        (store / 'config').write_text('fixture', encoding='utf-8')
        (gitdir / 'commondir').write_text('../..', encoding='utf-8')
        marker = self.folder / '.git'
        marker.write_text('gitdir: ' + str(gitdir), encoding='utf-8')
        self.snapshot()
        self.calls.clear()
        self.snapshot()
        self.assertEqual(self.identity_calls(), [])
        marker.write_text('gitdir: ' + str(gitdir) + '\n', encoding='utf-8')
        self.calls.clear()
        self.snapshot()
        self.assertEqual(len(self.identity_calls()), 2)
        other = self.base / 'other-store'
        other.mkdir()
        (other / 'config').write_text('different fixture', encoding='utf-8')
        (gitdir / 'commondir').write_text(str(other), encoding='utf-8')
        self.calls.clear()
        self.snapshot()
        self.assertEqual(len(self.identity_calls()), 2)

    def test_root_and_checkout_replacement_invalidate(self):
        self.snapshot()
        old = self.base / 'old-root'
        self.assertTrue(old.resolve().is_relative_to(self.base.resolve()))
        self.root.rename(old)
        self.root.mkdir()
        self.folder = self.checkout('project')
        self.calls.clear()
        self.snapshot()
        self.assertEqual(len(self.identity_calls()), 2)
        archived = self.base / 'old-checkout'
        self.assertTrue(archived.resolve().is_relative_to(self.base.resolve()))
        self.folder.rename(archived)
        self.folder = self.checkout('project')
        self.calls.clear()
        self.snapshot()
        self.assertEqual(len(self.identity_calls()), 2)

    def test_ttl_expiration_and_future_record_force_fresh_discovery(self):
        self.snapshot()
        path = self.discovery_record()
        record = json.loads(path.read_text(encoding='utf-8'))
        for at in (record['createdAt'] + cache.TTL_SECONDS + 1, record['createdAt'] - 1):
            path.write_text(json.dumps(record), encoding='utf-8')
            self.calls.clear()
            with patch.object(cache.time, 'time', return_value=at):
                self.snapshot()
            self.assertEqual(len(self.identity_calls()), 2)

    def test_corruption_and_failed_refresh_do_not_reuse_old_identity(self):
        self.snapshot()
        path = self.discovery_record()
        for content in ('{', ' ' * (cache.MAX_RECORD + 1), '{"version":true}'):
            path.write_text(content, encoding='utf-8')
            self.calls.clear()
            self.snapshot()
            self.assertEqual(len(self.identity_calls()), 2)
        (self.folder / '.git' / 'config').write_text('new metadata', encoding='utf-8')
        self.remote = None
        self.calls.clear()
        self.assertIsNone(self.snapshot()['repositories'][0]['url'])
        self.calls.clear()
        self.snapshot()
        self.assertEqual(len(self.identity_calls()), 2)

    def test_fresh_mutating_discovery_ignores_forged_snapshot_cache(self):
        self.snapshot()
        path = self.discovery_record()
        record = json.loads(path.read_text(encoding='utf-8'))
        record.update(repo='forged/project', key=repos.key('forged/project'))
        path.write_text(json.dumps(record), encoding='utf-8')
        self.calls.clear()
        result = {'state': 'blocked', 'reason': 'active-session', 'folder': 'project', 'checkedAt': repos.stamp(), 'updatedAt': None}
        with patch.object(repos, 'pull_requests', return_value={}), patch('repository_sync.sync_default', return_value=result) as update:
            for automatic in (False, True):
                self.assertTrue(repos.fetch_repository(self.root, self.state, repos.key('fixture/project'), update_main=automatic))
            update.assert_called_once()
            self.assertEqual(update.call_args.args[0][0]['repo'], 'fixture/project')
        self.assertEqual(len(self.identity_calls()), 4)
        fetch = next(row for row in self.calls if row[1][0] == 'fetch')
        self.assertIn('https://github.com/fixture/project.git', fetch[1])
        self.assertNotIn('https://github.com/forged/project.git', fetch[1])

    def test_completed_comparisons_survive_interrupted_later_observation(self):
        second = self.checkout('second')
        self.source('b' * 40)
        ready = threading.Event()
        real_save, real_git = repos.save_comparisons, self.git
        owner = repos.key(str(self.folder.resolve()).lower())
        def save(state, key, values):
            result = real_save(state, key, values)
            if key == owner:
                ready.set()
            return result
        def interrupted(path, *args, **kwargs):
            if Path(path) == second and args[0] == 'status':
                self.assertTrue(ready.wait(5))
                raise RuntimeError('Simulated scan interruption')
            return real_git(path, *args, **kwargs)
        with patch.object(repos, 'save_comparisons', side_effect=save), patch.object(repos, 'git', side_effect=interrupted):
            with self.assertRaisesRegex(RuntimeError, 'Simulated'):
                self.snapshot()
        self.assertTrue(cache.load_comparisons(self.state, owner))
        self.calls.clear()
        self.snapshot()
        graph = [row for row in self.calls if row[1][0] in ('cat-file', 'merge-base', 'rev-list')]
        self.assertFalse(any(row[0] == 'project' for row in graph))
        self.assertTrue(any(row[0] == 'second' for row in graph))

    def test_per_checkout_atomic_records_do_not_lose_other_writers(self):
        first, second = 'a' * 24, 'b' * 24
        def value(owner):
            return {owner + ':' + repos.key('main'): {'head': 'a' * 40, 'tip': 'b' * 40,
                    'result': {'branch': 'main', 'state': 'behind', 'ahead': 0, 'behind': 1}}}
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(list(pool.map(lambda owner: cache.save_comparisons(self.state, owner, value(owner)), (first, second))), [True, True])
        self.assertEqual(cache.load_comparisons(self.state, first), value(first))
        self.assertEqual(cache.load_comparisons(self.state, second), value(second))
        self.assertEqual(list((self.state / 'repository-observations').glob('*.tmp')), [])

    def test_corrupt_comparison_is_not_accepted_as_completed_progress(self):
        owner = 'a' * 24
        path = self.state / 'repository-observations' / (owner + '.json')
        path.parent.mkdir(parents=True)
        for content in ('{', json.dumps({'version': 1, 'key': owner, 'entries': {'another-owner': {'result': 'invalid'}}})):
            path.write_text(content, encoding='utf-8')
            self.assertEqual(cache.load_comparisons(self.state, owner), {})

    def test_malformed_legacy_counts_are_recomputed_instead_of_projected(self):
        self.source('b' * 40)
        owner = repos.key(str(self.folder.resolve()).lower())
        self.state.mkdir(exist_ok=True)
        bad = {owner + ':' + repos.key('main'): {'head': self.head, 'tip': 'b' * 40,
               'result': {'branch': 'main', 'state': 'behind', 'ahead': 'invalid', 'behind': 1}}}
        (self.state / 'repository-comparisons.json').write_text(json.dumps(bad), encoding='utf-8')
        row = self.snapshot()['repositories'][0]['checkouts'][0]
        self.assertEqual((row['tracked']['ahead'], row['tracked']['behind']), (0, 1))
        self.assertTrue(any(call[1][0] == 'rev-list' for call in self.calls))

    def test_oversized_matching_cached_count_is_recomputed_for_int32_contract(self):
        self.source('b' * 40)
        self.snapshot()
        owner = repos.key(str(self.folder.resolve()).lower())
        path = self.state / 'repository-observations' / (owner + '.json')
        value = json.loads(path.read_text(encoding='utf-8'))
        value['entries'][owner + ':' + repos.key('main')]['result']['behind'] = 2**31
        path.write_text(json.dumps(value), encoding='utf-8')
        self.calls.clear()
        row = self.snapshot()['repositories'][0]['checkouts'][0]
        self.assertEqual((row['tracked']['ahead'], row['tracked']['behind']), (0, 1))
        self.assertTrue(any(call[1][0] == 'rev-list' for call in self.calls))

    def test_oversized_fresh_counts_remain_unavailable_instead_of_breaking_dto(self):
        self.source('b' * 40)
        real_git = self.git
        for counts in ('0 2147483648', '0 ' + '9' * 5000):
            with patch.object(repos, 'git', side_effect=lambda path, *args, **kwargs: counts if args[0] == 'rev-list' else real_git(path, *args, **kwargs)):
                row = self.snapshot()['repositories'][0]['checkouts'][0]
            self.assertEqual((row['tracked']['state'], row['tracked']['ahead'], row['tracked']['behind']), ('unavailable', None, None))

    def test_read_budgets_are_larger_without_altering_fetch_cap(self):
        self.assertEqual(inspect.signature(self.original_git).parameters['timeout'].default, 20)
        self.snapshot()
        self.assertEqual(next(row[2]['timeout'] for row in self.calls if row[1][0] == 'status'), 30)
        with patch.object(repos, 'pull_requests', return_value={}):
            self.assertTrue(repos.fetch_repository(self.root, self.state, repos.key('fixture/project')))
        self.assertEqual(next(row[2]['timeout'] for row in self.calls if row[1][0] == 'fetch'), 60)

    def test_scheduled_failed_discovery_records_failure_without_authorizing_update(self):
        key = repos.key('fixture/project')
        self.source()
        source = repos.read_source(self.state, key)
        successful = source['checkedAt']
        prior_update = '2026-01-01T00:00:00+00:00'
        source.update(mainSync={'state': 'updated', 'folder': 'old-folder', 'updatedAt': prior_update},
                      mainSyncBasis={'defaultFolders': ['old-folder']})
        repos.write_source(self.state, key, source)
        self.remote = None
        with patch('repository_sync.sync_default') as updater, patch.object(repos, 'discover_cached', side_effect=AssertionError('A mutation cannot use snapshot discovery')):
            self.assertFalse(repos.fetch_repository(self.root, self.state, key, update_main=True))
            updater.assert_not_called()
        latest = repos.read_source(self.state, key)
        self.assertEqual(latest['checkedAt'], successful)
        self.assertEqual(latest['mainSync']['updatedAt'], prior_update)
        self.assertEqual((latest['mainSync']['state'], latest['mainSync']['reason'], latest['mainSync']['folder']), ('failed', 'git-unavailable', None))
        self.assertEqual(latest['attemptedAt'], latest['mainSync']['checkedAt'])
        self.assertNotIn('mainSyncBasis', latest)
        self.assertIsNotNone(repos.main_sync_observation(latest, []))
        self.assertNotIn(str(self.base), json.dumps(latest))
        self.assertFalse(any(row[1][0] in ('fetch', 'ls-remote', 'merge') for row in self.calls))

    def test_invalid_key_never_writes_a_failed_discovery_path(self):
        with patch.object(repos, 'write_source') as write:
            self.assertFalse(repos.fetch_repository(self.root, self.state, '../../outside', update_main=True))
            write.assert_not_called()
        self.assertEqual(self.calls, [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
