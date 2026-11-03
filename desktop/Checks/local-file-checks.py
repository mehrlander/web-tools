"""Verify metadata classification and bounded traversal against real Git indexes."""
import importlib.util
import json
from pathlib import Path
import stat
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch


def module(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parents[1] / 'worker' / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


repos, files = module('repositories'), module('local_files')


class LocalFilesChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='web-tools-local-files-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.checkout = self.base / 'checkout'
        self.checkout.mkdir()
        self.cmd('init', '--initial-branch=main', str(self.checkout))
        self.cmd('-C', str(self.checkout), 'config', 'user.name', 'Fixture')
        self.cmd('-C', str(self.checkout), 'config', 'user.email', 'fixture@example.test')
        (self.checkout / '.gitignore').write_text('exports/\nnode_modules/\n*.secret\nmixed/*\n', encoding='utf-8')
        (self.checkout / 'tracked.txt').write_text('tracked', encoding='utf-8')
        self.cmd('-C', str(self.checkout), 'add', '.')
        self.cmd('-C', str(self.checkout), 'commit', '-m', 'base')

    def cmd(self, *args):
        result = subprocess.run(['git', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=' + str(self.base / 'no-hooks'), *args], capture_output=True, encoding='utf-8', errors='replace')
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip()

    def write(self, relative, content):
        path = self.checkout / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')

    def collect(self, **kwargs):
        return files.collect(self.checkout, repos.key(str(self.checkout)), repos.git, **kwargs)

    def test_ignored_and_untracked_metadata_preserve_files_and_index(self):
        self.write('exports/a.bin', 'abcd')
        self.write('exports/b.bin', '123456')
        self.write('drafts/a.md', 'draft')
        self.write('note.md', 'PRIVATE FILE CONTENT MUST NOT ENTER THE PHONE')
        head, index = self.cmd('-C', str(self.checkout), 'rev-parse', 'HEAD'), (self.checkout / '.git/index').read_bytes()
        value = self.collect()
        entries = {e['path']: e for e in value['entries']}
        self.assertEqual((entries['exports/']['gitState'], entries['exports/']['bytes'], entries['exports/']['files']), ('ignored', 10, 2))
        self.assertEqual(entries['drafts/']['gitState'], 'untracked')
        self.assertEqual(entries['note.md']['kind'], 'file')
        serialized = json.dumps(value)
        self.assertNotIn('PRIVATE FILE CONTENT', serialized)
        self.assertNotIn(str(self.base), serialized)
        self.assertNotIn('tracked.txt', entries)
        self.assertEqual(self.cmd('-C', str(self.checkout), 'rev-parse', 'HEAD'), head)
        self.assertEqual((self.checkout / '.git/index').read_bytes(), index)
        self.assertEqual((self.checkout / 'note.md').read_text(encoding='utf-8'), 'PRIVATE FILE CONTENT MUST NOT ENTER THE PHONE')

    def test_tracked_files_matching_ignore_patterns_are_not_counted(self):
        self.write('mixed/kept.txt', 'tracked data')
        self.cmd('-C', str(self.checkout), 'add', '-f', 'mixed/kept.txt')
        self.cmd('-C', str(self.checkout), 'commit', '-m', 'tracked inside ignored pattern')
        self.write('mixed/new.secret', 'xyz')
        entries = self.collect()['entries']
        self.assertEqual([(e['path'], e['bytes']) for e in entries], [('mixed/new.secret', 3)])

    def test_unicode_and_leading_spaces_are_preserved(self):
        self.write(' leading space.txt', 'abc')
        self.write('résumé.txt', 'abcd')
        self.assertEqual({e['path'] for e in self.collect()['entries']}, {' leading space.txt', 'résumé.txt'})

    def test_partial_measurements_are_lower_bounds_and_unknown_is_not_zero(self):
        self.write('exports/first.bin', 'abcd')
        self.write('exports/second.bin', '123456')
        value = self.collect(max_nodes=1)
        row = value['entries'][0]
        self.assertTrue(row['partial'])
        self.assertEqual(row['files'], 1)
        self.assertIn(row['bytes'], [4, 6])
        self.assertTrue(value['partial'])
        unknown = self.collect(max_nodes=0)['entries'][0]
        self.assertIsNone(unknown['bytes'])
        self.assertIsNone(unknown['files'])

    def test_entry_cap_is_explicit_and_does_not_become_an_empty_success(self):
        self.write('a.md', 'one')
        self.write('b.md', 'two')
        value = self.collect(max_entries=1)
        self.assertEqual(len(value['entries']), 1)
        self.assertTrue(value['partial'])
        self.assertIn('incomplete', value['notice'])

    def test_git_failure_returns_unavailable_without_raw_errors(self):
        value = files.collect(self.checkout, 'fixture', lambda *a, **kw: None)
        self.assertEqual(value['state'], 'unavailable')
        self.assertEqual(value['entries'], [])
        self.assertNotIn(str(self.checkout), json.dumps(value))

    def test_links_and_windows_reparse_points_are_not_followed(self):
        outside = self.base / 'outside'
        outside.mkdir()
        (outside / 'private.bin').write_text('outside data', encoding='utf-8')
        with patch.object(Path, 'lstat', return_value=SimpleNamespace(st_mode=stat.S_IFDIR, st_file_attributes=0x400)):
            self.assertIsNone(files.target(self.checkout, 'linked/private.bin'))
        try:
            (self.checkout / 'exports').symlink_to(outside, target_is_directory=True)
        except (OSError, NotImplementedError):
            return  # Windows without symlink privilege is covered by the reparse-point fixture.
        self.assertIsNone(files.target(self.checkout, 'exports/private.bin'))
        value = self.collect()
        self.assertFalse(value['entries'])
        self.assertTrue(value['partial'])

    def test_path_boundaries_git_internals_and_role_labels(self):
        for name in ['../outside/private.bin', '/absolute', 'C:/outside', '.git/index', 'exports/../../escape', 'a\\b']:
            self.assertIsNone(files.target(self.checkout, name))
        self.write('exports/.git/objects/example', 'internal object')
        self.write('exports/normal.bin', 'abc')
        row = self.collect()['entries'][0]
        self.assertEqual(row['bytes'], 3)
        self.assertTrue(row['partial'])
        self.assertEqual(files.role('node_modules/'), 'Dependencies')
        self.assertEqual(files.role('desktop/__pycache__/'), 'Cache')
        self.assertIsNone(files.role('reports/'))

    def test_worktree_inventories_are_separate(self):
        other = self.base / 'other'
        self.cmd('-C', str(self.checkout), 'worktree', 'add', '-b', 'other', str(other))
        self.write('exports/a.bin', 'first')
        (other / 'note.md').write_text('second', encoding='utf-8')
        value = files.inventories([{'path': self.checkout}, {'path': other}], repos.git, repos.key)
        self.assertEqual(len(value['checkouts']), 2)
        self.assertNotEqual(value['checkouts'][0]['key'], value['checkouts'][1]['key'])
        self.assertEqual(value['checkouts'][0]['entries'][0]['path'], 'exports/')
        self.assertEqual(value['checkouts'][1]['entries'][0]['path'], 'note.md')


if __name__ == '__main__':
    unittest.main()
