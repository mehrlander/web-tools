"""Exercise root containment and Git labels against real temporary working folders."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'worker'))
from folder_explorer import browse


class ExplorerChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'repos'
        self.root.mkdir()
        self.repo = self.root / 'project'
        self.repo.mkdir()
        self.run_git('init', '-b', 'main')
        self.run_git('config', 'user.email', 'fixture@example.test')
        self.run_git('config', 'user.name', 'Fixture')
        (self.repo / 'src').mkdir()
        (self.repo / 'src' / 'tracked.txt').write_text('PRIVATE FILE CONTENT')
        (self.repo / '.gitignore').write_text('cache/\n*.secret\n')
        self.run_git('add', '.')
        self.run_git('commit', '-m', 'fixture')
        (self.repo / 'cache').mkdir()
        (self.repo / 'cache' / 'nested').mkdir()
        (self.repo / 'cache' / 'nested' / 'x').write_text('PRIVATE CACHE CONTENT')
        (self.repo / 'new notes.txt').write_text('PRIVATE NOTE CONTENT')
        (self.repo / 'é.txt').write_text('unicode')
        (self.repo / 'password.secret').write_text('PRIVATE SECRET CONTENT')

    def run_git(self, *args):
        return subprocess.run(['git', '-C', str(self.repo), *args], check=True, capture_output=True).stdout

    def test_root_is_actual_structure(self):
        (self.root / 'ordinary folder').mkdir()
        value = browse(self.root, '')
        self.assertEqual([e['name'] for e in value['entries']], ['ordinary folder', 'project'])
        self.assertEqual(value['path'], '')
        self.assertEqual(value['rootName'], 'repos')

    def test_git_states_and_metadata_only(self):
        before = self.run_git('status', '--porcelain')
        value = browse(self.root, 'project')
        rows = {e['name']: e for e in value['entries']}
        self.assertEqual(rows['src']['gitState'], 'tracked')
        self.assertEqual(rows['.gitignore']['gitState'], 'tracked')
        self.assertEqual(rows['cache']['gitState'], 'ignored')
        self.assertEqual(rows['password.secret']['gitState'], 'ignored')
        self.assertEqual(rows['new notes.txt']['gitState'], 'untracked')
        self.assertEqual(rows['é.txt']['gitState'], 'untracked')
        self.assertIsNone(rows['src']['bytes'])
        self.assertNotIn('.git', rows)
        self.assertNotIn('PRIVATE', json.dumps(value))
        self.assertNotIn(str(self.root), json.dumps(value))
        self.assertEqual(before, self.run_git('status', '--porcelain'))

    def test_nested_tracked_and_ignored(self):
        self.assertEqual(browse(self.root, 'project/src')['entries'][0]['gitState'], 'tracked')
        self.assertEqual(browse(self.root, 'project/cache')['entries'][0]['gitState'], 'ignored')
        self.assertEqual(browse(self.root, 'project/cache/nested')['entries'][0]['gitState'], 'ignored')

    def test_path_boundaries(self):
        for path in ('..', '../elsewhere', '/project', 'project//src', 'project/./src',
                     'project/../project', 'project\\src', 'C:/Windows', 'project/.git',
                     'project/.GIT/config', 'project/.git.', 'project/.. /outside', 'project/src ',
                     'project/file:stream', 'project/\x00', 'x' * 1025):
            with self.subTest(path=path):
                self.assertEqual(browse(self.root, path)['state'], 'invalid')
        self.assertEqual(browse(self.root, 'missing')['state'], 'missing')
        self.assertEqual(browse(self.root, 'project/.gitignore')['state'], 'missing')

    def test_linked_folders_are_not_followed(self):
        outside = Path(self.temp.name) / 'outside'
        outside.mkdir()
        (outside / 'private').write_text('private')
        link = self.repo / 'linked'
        if sys.platform == 'win32':
            subprocess.run(['cmd', '/c', 'mklink', '/J', str(link), str(outside)], check=True, capture_output=True)
        else:
            link.symlink_to(outside, target_is_directory=True)
        self.assertEqual(browse(self.root, 'project/linked')['state'], 'blocked')
        self.assertNotIn('linked', [e['name'] for e in browse(self.root, 'project')['entries']])

    def test_linked_worktree(self):
        self.run_git('worktree', 'add', '-b', 'other', str(self.root / 'project-other'))
        self.assertEqual(browse(self.root, 'project-other')['state'], 'ready')
        self.assertEqual(next(e for e in browse(self.root, 'project-other')['entries'] if e['name'] == 'src')['gitState'], 'tracked')

    def test_limits_and_empty(self):
        value = browse(self.root, 'project', limit=2)
        self.assertTrue(value['partial'])
        self.assertEqual(len(value['entries']), 2)
        (self.root / 'empty').mkdir()
        self.assertEqual(browse(self.root, 'empty')['entries'], [])

    def test_literal_folder_names_and_staged_files(self):
        (self.repo / '[draft]').mkdir()
        (self.repo / '[draft]' / 'staged.txt').write_text('staged')
        self.run_git('add', '--', '[draft]/staged.txt')
        self.assertEqual(browse(self.root, 'project/[draft]')['entries'][0]['gitState'], 'tracked')


if __name__ == '__main__':
    unittest.main()
