"""Metadata-only traversal and real non-forced background publication."""
import builtins
import csv
import io
import json
import shutil
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'worker'))
import laptop_inventory as inventory


class Fixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='web-tools-inventory-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'repos'
        self.root.mkdir()

    def git(self, path, *args, data=None):
        result = subprocess.run(['git', '-c', 'core.fsmonitor=false', '-c', 'commit.gpgsign=false',
                                 '-c', 'core.hooksPath=' + str(self.base / 'no-hooks'), '-C', str(path), *args],
                                input=data, capture_output=True, timeout=45)
        self.assertEqual(result.returncode, 0, result.stderr.decode('utf-8', errors='replace'))
        return result.stdout.decode('utf-8').strip()

    def repo(self, name='project'):
        repo = self.root / name
        repo.mkdir(parents=True)
        self.git(repo, 'init', '--initial-branch=main')
        self.git(repo, 'config', 'user.name', 'Fixture')
        self.git(repo, 'config', 'user.email', 'fixture@example.test')
        (repo / '.gitignore').write_text('ignored/\nempty-ignored/\n*.secret\nbin/\nobj/\n', encoding='utf-8')
        (repo / 'src').mkdir()
        (repo / 'src/tracked.txt').write_bytes(b'tracked')
        self.git(repo, 'add', '.')
        self.git(repo, 'commit', '-m', 'seed')
        return repo

    def entries(self):
        body, summary = inventory.collect(self.root)
        lines = list(csv.reader(io.StringIO(body.decode('utf-8')), delimiter='\t'))
        self.assertEqual(lines[0], ['path', 'kind', 'git', 'files', 'bytes', 'branch', 'commit'])
        self.assertTrue(all(len(row) == 7 for row in lines))
        self.assertEqual([r[0] for r in lines[1:]], sorted(r[0] for r in lines[1:]))
        self.assertEqual(summary['lineCount'], len(lines))
        self.assertEqual(summary['bytes'], len(body))
        return {r[0]: dict(zip(lines[0], r)) for r in lines[1:]}, body


class MetadataChecks(Fixture):
    def test_folders_totals_and_untracked_names(self):
        repo = self.repo()
        (repo / 'src/new.txt').write_bytes(b'new')
        (repo / 'ignored').mkdir()
        (repo / 'ignored/password.secret').write_bytes(b'NEVER_EXPORT_THIS_CONTENT')
        (self.root / 'outside.txt').write_bytes(b'outside')
        rows, body = self.entries()
        self.assertNotIn('project/src/tracked.txt', rows)
        self.assertNotIn('project/.gitignore', rows)
        self.assertFalse(any('/.git/' in name or name.endswith('/.git') for name in rows))
        self.assertEqual(rows['project/src/new.txt']['git'], 'untracked')
        self.assertEqual(rows['project/ignored/password.secret']['git'], 'ignored')
        self.assertEqual(rows['outside.txt']['git'], 'none')
        self.assertEqual(rows['project/src']['git'], 'tracked')
        self.assertEqual((rows['project/src']['files'], rows['project/src']['bytes']), ('2', '10'))
        expected = len((repo / '.gitignore').read_bytes()) + 7 + 3 + len(b'NEVER_EXPORT_THIS_CONTENT')
        self.assertEqual((rows['project']['files'], int(rows['project']['bytes'])), ('4', expected))
        self.assertEqual((rows['.']['files'], int(rows['.']['bytes'])), ('5', expected + 7))
        self.assertNotIn(b'NEVER_EXPORT_THIS_CONTENT', body)
        self.assertNotIn(str(self.root).encode(), body)

    def test_collapse_rules_preserve_totals(self):
        repo = self.repo()
        for name in [*inventory.COLLAPSE, 'bin', 'obj']:
            folder = repo / name / 'deep'
            folder.mkdir(parents=True)
            (folder / 'a.txt').write_bytes(b'1234')
        outside = self.root / 'bin'
        outside.mkdir()
        (outside / 'visible.txt').write_bytes(b'outside')
        rows, _ = self.entries()
        for name in [*inventory.COLLAPSE, 'bin', 'obj']:
            row = rows['project/' + name]
            self.assertEqual((row['kind'], row['files'], row['bytes']), ('collapsed', '1', '4'))
            self.assertFalse(any(p.startswith('project/' + name + '/') for p in rows))
        self.assertEqual(rows['bin']['kind'], 'folder')
        self.assertIn('bin/visible.txt', rows)

    def test_empty_and_ignored_folders_are_retained(self):
        repo = self.repo()
        for name in ['empty-ignored/child', 'empty/child', 'bin', 'obj']:
            (repo / name).mkdir(parents=True, exist_ok=True)
        rows, _ = self.entries()
        self.assertEqual(rows['project/empty-ignored']['git'], 'ignored')
        self.assertEqual(rows['project/empty-ignored/child']['git'], 'ignored')
        self.assertEqual(rows['project/empty/child']['git'], 'untracked')
        self.assertEqual(rows['project/bin']['kind'], 'collapsed')
        self.assertEqual(rows['project/bin']['git'], 'ignored')
        self.assertEqual(rows['project/obj']['git'], 'ignored')
        self.assertEqual(rows['project/obj']['files'], '0')

    def test_collector_does_not_open_files(self):
        self.repo()
        (self.root / 'private.txt').write_bytes(b'PRIVATE_BODY')
        with patch.object(builtins, 'open', side_effect=AssertionError('file opened')), \
                patch.object(Path, 'open', side_effect=AssertionError('file opened')):
            body, _ = inventory.collect(self.root)
        self.assertNotIn(b'PRIVATE_BODY', body)

    def test_inventory_is_not_capped_at_phone_inventory_limits(self):
        folder = self.root / 'many'
        folder.mkdir()
        for number in range(137):
            (folder / ('note-' + str(number) + '.txt')).touch()
        rows, _ = self.entries()
        self.assertEqual(sum(r['kind'] == 'file' for r in rows.values()), 137)
        self.assertEqual(rows['many']['files'], '137')

    def test_nested_checkouts_and_detached_commit(self):
        self.repo()
        nested = self.repo('project/nested')
        head = self.git(nested, 'rev-parse', 'HEAD')
        self.git(nested, 'switch', '--detach')
        rows, _ = self.entries()
        self.assertEqual(rows['project/nested']['kind'], 'checkout')
        self.assertEqual(rows['project/nested']['branch'], '(detached)')
        self.assertEqual(rows['project/nested']['commit'], head)
        self.assertTrue(all(not r['branch'] and not r['commit'] for r in rows.values() if r['kind'] != 'checkout'))

    def test_links_do_not_expose_external_names(self):
        outside = self.base / 'external'
        outside.mkdir()
        (outside / 'MUST_NOT_APPEAR.txt').write_bytes(b'secret')
        try:
            (self.root / 'link').symlink_to(outside, target_is_directory=True)
        except OSError:
            self.skipTest('Directory symlink creation unavailable')
        rows, body = self.entries()
        self.assertIn('link', rows)
        self.assertNotIn(b'MUST_NOT_APPEAR', body)

    def test_unreadable_folder_does_not_claim_zero_totals(self):
        path = self.root / 'unavailable'
        path.mkdir()
        original = inventory.scandir
        def denied(value):
            if Path(value) == path:
                raise PermissionError()
            return original(value)
        with patch.object(inventory, 'scandir', side_effect=denied):
            rows, _ = self.entries()
        self.assertEqual(rows['unavailable']['files'], '')
        self.assertEqual(rows['.']['bytes'], '')

    def test_unreadable_root_does_not_replace_the_inventory(self):
        with patch.object(inventory, 'scandir', side_effect=PermissionError()):
            with self.assertRaises(inventory.InventoryError):
                inventory.collect(self.root)

    def test_long_windows_paths_keep_names_and_totals(self):
        folder = self.root.joinpath(*(['long-folder-name'] * 16))
        Path(inventory.native(folder)).mkdir(parents=True)
        Path(inventory.native(folder / 'long.txt')).write_bytes(b'long')
        def cleanup():
            target = self.base.resolve()
            self.assertEqual(target, Path(self.temp.name).resolve())
            shutil.rmtree(inventory.native(target), ignore_errors=True)
        self.addCleanup(cleanup)
        rows, _ = self.entries()
        self.assertEqual(rows[(folder / 'long.txt').relative_to(self.root).as_posix()]['bytes'], '4')
        self.assertEqual((rows['.']['files'], rows['.']['bytes']), ('1', '4'))

    def test_cli_failure_omits_git_diagnostics_and_absolute_paths(self):
        result = subprocess.run([sys.executable, str(Path(inventory.__file__).with_name('repositories.py')),
                                 '--root', str(self.root), '--state', str(self.base / 'state'),
                                 '--publish-laptop-files'], capture_output=True, timeout=45)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout), {'state': 'unavailable', 'path': inventory.TARGET})
        self.assertFalse(result.stderr)

    def test_cli_publication_and_fetch_modes_are_exclusive(self):
        result = subprocess.run([sys.executable, str(Path(inventory.__file__).with_name('repositories.py')),
                                 '--root', str(self.root), '--state', str(self.base / 'state'),
                                 '--local-files', '--publish-laptop-files'], capture_output=True, timeout=45)
        self.assertEqual(result.returncode, 2)


class PublicationChecks(Fixture):
    def setUp(self):
        super().setUp()
        self.repo_path = self.repo('web-tools-private')
        self.remote = self.base / 'remote.git'
        self.git(self.base, 'init', '--bare', '--initial-branch=main', str(self.remote))
        for path in (self.remote,):
            self.git(path, 'config', 'user.name', 'Fixture')
            self.git(path, 'config', 'user.email', 'fixture@example.test')
        empty = self.git(self.repo_path, 'mktree', data=b'')
        background = self.git(self.repo_path, 'commit-tree', empty, '-m', 'seed background')
        self.git(self.repo_path, 'branch', 'background', background)
        self.git(self.repo_path, 'remote', 'add', 'origin', 'https://github.com/mehrlander/web-tools-private.git')
        self.git(self.repo_path, 'config', 'url.' + self.remote.as_uri() + '.insteadOf', 'https://github.com/mehrlander/web-tools-private.git')
        self.git(self.repo_path, 'push', 'origin', 'main', 'background')

    def head(self):
        return self.git(self.remote, 'rev-parse', 'background')

    def test_first_publication_keeps_working_folder_and_index(self):
        (self.repo_path / 'src/tracked.txt').write_bytes(b'dirty working contents')
        (self.repo_path / 'staged.txt').write_bytes(b'staged')
        self.git(self.repo_path, 'add', 'staged.txt')
        before = [self.git(self.repo_path, 'rev-parse', 'HEAD'), self.git(self.repo_path, 'ls-files', '--stage')]
        body, _ = inventory.collect(self.root)
        result = inventory.publish(self.root)
        self.assertEqual(result['state'], 'published')
        self.assertEqual(self.git(self.remote, 'show', 'background:' + inventory.TARGET), body.decode().strip())
        self.assertEqual(before, [self.git(self.repo_path, 'rev-parse', 'HEAD'), self.git(self.repo_path, 'ls-files', '--stage')])
        self.assertEqual((self.repo_path / 'src/tracked.txt').read_bytes(), b'dirty working contents')
        self.assertEqual(body, inventory.collect(self.root)[0])
        self.assertIn('Co-Authored-By: Codex <codex@openai.com>', self.git(self.remote, 'log', '-1', '--format=%B', 'background'))

    def test_unchanged_inventory_creates_no_commit(self):
        inventory.publish(self.root)
        before = self.head()
        result = inventory.publish(self.root, clock=lambda: time.time() + 901)
        self.assertEqual(result['state'], 'unchanged')
        self.assertEqual(self.head(), before)

    def test_remote_timestamp_throttles_before_scanning(self):
        inventory.publish(self.root)
        before = self.head()
        result = inventory.publish(self.root, build=lambda _: self.fail('early scan'))
        self.assertEqual(result['state'], 'throttled')
        self.assertEqual(self.head(), before)

    def test_wrong_origin_is_not_a_publication_destination(self):
        self.git(self.repo_path, 'remote', 'set-url', 'origin', 'https://github.com/other/private.git')
        with self.assertRaises(inventory.InventoryError):
            inventory.publish(self.root, build=lambda _: self.fail('unapproved destination scanned'))

    def test_racing_writer_is_preserved_without_force_push(self):
        original = inventory.git
        raced = False
        def racing(repository, *args, **kwargs):
            nonlocal raced
            if args[0] == 'push':
                self.assertFalse(any(arg.startswith('--force') or arg.startswith('+') for arg in args))
                if not raced:
                    raced = True
                    parent = self.head()
                    blob = self.git(self.remote, 'hash-object', '-w', '--stdin', data=b'other worker')
                    tree = self.git(self.remote, 'mktree', data=('100644 blob ' + blob + '\tother.txt\n').encode())
                    commit = self.git(self.remote, 'commit-tree', tree, '-p', parent, '-m', 'other worker')
                    self.git(self.remote, 'update-ref', 'refs/heads/background', commit, parent)
            return original(repository, *args, **kwargs)
        with patch.object(inventory, 'git', side_effect=racing):
            result = inventory.publish(self.root)
        self.assertEqual(result['state'], 'published')
        self.assertEqual(self.git(self.remote, 'show', 'background:other.txt'), 'other worker')
        self.assertTrue(self.git(self.remote, 'show', 'background:' + inventory.TARGET).startswith(inventory.HEADER.strip()))


if __name__ == '__main__':
    unittest.main()
