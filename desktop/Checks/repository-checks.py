"""Exercise real Git graphs and fetches against isolated local bare repositories."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('repositories', Path(__file__).parents[1] / 'worker' / 'repositories.py')
repos = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repos)


class RepositoryChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='web-tools-repository-check-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'checkouts'
        self.root.mkdir()
        self.state = self.base / 'state'
        self.remote, self.writer, self.local = self.base / 'remote.git', self.base / 'writer', self.root / 'laptop'
        self.cmd('init', '--bare', '--initial-branch=main', str(self.remote))
        self.cmd('init', '--initial-branch=main', str(self.writer))
        self.configure(self.writer)
        self.commit(self.writer, 'base.txt', 'base')
        self.cmd('-C', str(self.writer), 'push', str(self.remote), 'main')
        self.cmd('clone', str(self.remote), str(self.local))
        self.configure(self.local)
        self.cmd('-C', str(self.local), 'remote', 'set-url', 'origin', 'https://github.com/fixture/project.git')
        real_git = repos.git
        def fixture_git(path, *args, **kwargs):
            args = [str(self.remote) if a == 'https://github.com/fixture/project.git' else a for a in args]
            return real_git(path, *args, **kwargs)
        self.mock = patch.object(repos, 'git', fixture_git)
        self.mock.start()
        self.addCleanup(self.mock.stop)
        self.repo_key = repos.key('fixture/project')

    def cmd(self, *args):
        result = subprocess.run(['git', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=' + str(self.base / 'no-hooks'), *args], capture_output=True, encoding='utf-8', errors='replace')
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip()

    def configure(self, path):
        self.cmd('-C', str(path), 'config', 'user.name', 'Fixture')
        self.cmd('-C', str(path), 'config', 'user.email', 'fixture@example.test')

    def commit(self, path, name, text):
        (path / name).write_text(text, encoding='utf-8')
        self.cmd('-C', str(path), 'add', name)
        self.cmd('-C', str(path), 'commit', '-m', text)

    def remote_commit(self):
        self.commit(self.writer, 'remote.txt', 'remote work')
        self.cmd('-C', str(self.writer), 'push', str(self.remote), 'main')

    def row(self):
        return repos.snapshot(self.root, self.state)['repositories'][0]['checkouts'][0]

    def fetch(self):
        self.assertTrue(repos.fetch_repository(self.root, self.state, self.repo_key))

    def test_no_network_check_is_not_reported_as_current(self):
        self.assertEqual(self.row()['tracked']['state'], 'not-checked')
        self.remote_commit()
        self.assertEqual(self.row()['tracked']['state'], 'not-checked')

    def test_fetch_refreshes_remote_refs_without_changing_checkout(self):
        self.remote_commit()
        (self.local / 'base.txt').write_text('uncommitted', encoding='utf-8')
        (self.local / 'scratch.txt').write_text('untracked', encoding='utf-8')
        before = [self.cmd('-C', str(self.local), 'rev-parse', 'HEAD'), (self.local / '.git' / 'index').read_bytes(), (self.local / 'base.txt').read_bytes()]
        self.fetch()
        after = [self.cmd('-C', str(self.local), 'rev-parse', 'HEAD'), (self.local / '.git' / 'index').read_bytes(), (self.local / 'base.txt').read_bytes()]
        self.assertEqual(before, after)
        row = self.row()
        self.assertEqual((row['tracked']['ahead'], row['tracked']['behind']), (0, 1))
        self.assertEqual((row['changed'], row['untracked']), (1, 1))
        self.assertTrue((self.local / 'scratch.txt').exists())

    def test_divergence_counts_commits_on_each_side(self):
        self.commit(self.local, 'local.txt', 'local work')
        self.remote_commit()
        self.fetch()
        self.assertEqual(self.row()['tracked'], {'branch': 'main', 'state': 'diverged', 'ahead': 1, 'behind': 1})

    def test_feature_tracking_is_separate_from_main_and_worktrees_group(self):
        self.cmd('-C', str(self.local), 'switch', '-c', 'feature/working')
        self.commit(self.local, 'feature.txt', 'feature work')
        self.cmd('-C', str(self.local), 'push', str(self.remote), 'feature/working')
        self.cmd('-C', str(self.local), 'config', 'branch.feature/working.remote', 'origin')
        self.cmd('-C', str(self.local), 'config', 'branch.feature/working.merge', 'refs/heads/feature/working')
        self.cmd('-C', str(self.local), 'worktree', 'add', str(self.root / 'second'), 'main')
        self.remote_commit()
        self.fetch()
        group = repos.snapshot(self.root, self.state)['repositories'][0]
        self.assertEqual(len(group['checkouts']), 2)
        feature = next(c for c in group['checkouts'] if c['branch'] == 'feature/working')
        self.assertEqual(feature['tracked']['state'], 'current')
        self.assertEqual((feature['main']['ahead'], feature['main']['behind']), (1, 1))

    def test_failed_fetch_preserves_prior_observation_and_sanitizes_errors(self):
        self.fetch()
        before = repos.read_source(self.state, self.repo_key)
        normal = repos.git
        with patch.object(repos, 'git', side_effect=lambda path, *args, **kwargs: None if 'ls-remote' in args else normal(path, *args, **kwargs)):
            self.assertFalse(repos.fetch_repository(self.root, self.state, self.repo_key))
        after = repos.read_source(self.state, self.repo_key)
        self.assertEqual(after['checkedAt'], before['checkedAt'])
        self.assertEqual(after['tips'], before['tips'])
        self.assertIn('failed', after['notice'])

    def test_unknown_keys_never_fetch_and_paths_do_not_enter_snapshot(self):
        with patch.object(repos, 'git', wraps=repos.git) as observed:
            self.assertFalse(repos.fetch_repository(self.root, self.state, '../../escape'))
            self.assertFalse(any('fetch' in call.args for call in observed.call_args_list))
        self.fetch()
        value = json.dumps(repos.snapshot(self.root, self.state))
        self.assertNotIn(str(self.base), value)
        self.assertNotIn('remote.git', value)

    def test_missing_remote_branch_is_distinct_from_no_upstream(self):
        self.cmd('-C', str(self.local), 'config', 'branch.main.merge', 'refs/heads/gone')
        self.fetch()
        self.assertEqual(self.row()['tracked']['state'], 'remote-missing')
        self.cmd('-C', str(self.local), 'config', '--unset', 'branch.main.remote')
        self.assertEqual(self.row()['tracked']['state'], 'no-upstream')

    def test_only_github_identities_are_accepted(self):
        self.assertEqual(repos.github_name('git@github.com:owner/repo.git'), 'owner/repo')
        self.assertEqual(repos.github_name('https://token@github.com/owner/repo.git'), 'owner/repo')
        for value in ['https://github.com.evil.test/o/r', 'file:///tmp/repo', 'ext::run-command', 'https://github.com/o/r?token=secret']:
            self.assertIsNone(repos.github_name(value))


if __name__ == '__main__':
    unittest.main()
