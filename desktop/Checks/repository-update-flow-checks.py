"""Check fresh-fetch authorization and identity-bound automatic-update projection."""
from copy import deepcopy
from contextlib import ExitStack, redirect_stderr, redirect_stdout
import base64
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import Mock, patch


sys.path.insert(0, str(Path(__file__).parents[1] / 'worker'))
spec = importlib.util.spec_from_file_location('repository_update_flow', Path(__file__).parents[1] / 'worker' / 'repositories.py')
repos = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repos)
HEAD, TARGET = 'a' * 40, 'b' * 40


class GitAuthenticationChecks(unittest.TestCase):
    token = 'fixture_private_token_for_child_environment'

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='web-tools-auth-check-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.header = 'Authorization: Basic ' + base64.b64encode(('x-access-token:' + self.token).encode()).decode()
        self.calls = []
        self.environments = []
        self.native_environment = dict(os.environ)
        self.real_runner = repos.run_bounded
        self.real_monotonic = repos.time.monotonic
        self.clock = 100.0
        self.lookup_seconds = 7.0
        self.credential = SimpleNamespace(returncode=0, stdout=self.token + '\n')
        self.output, self.errors = io.StringIO(), io.StringIO()
        self.parent_environment = {
            'PATH': os.environ.get('PATH', ''),
            'GIT_CONFIG_COUNT': '1', 'GIT_CONFIG_KEY_0': 'trace2.envVars',
            'GIT_CONFIG_VALUE_0': 'WEBTOOLS_GITHUB_AUTH',
            'GIT_TRACE': str(self.root / 'trace.log'),
            'git_trace2_event': str(self.root / 'events.json'),
            'GIT_TRACE_CURL': str(self.root / 'curl.log'),
            'GIT_CURL_VERBOSE': '1',
        }
        stack = ExitStack()
        self.addCleanup(stack.close)
        stack.enter_context(patch.dict(os.environ, self.parent_environment, clear=True))
        self.before = dict(os.environ)
        stack.enter_context(patch.object(repos.shutil, 'which', return_value='fixture-gh'))
        stack.enter_context(patch.object(repos.time, 'monotonic', side_effect=lambda: self.clock))
        stack.enter_context(patch.object(repos, 'run_bounded', side_effect=self.process))
        # The fixture names Git calls 'git'; repository-process-checks.py covers which binary is chosen.
        stack.enter_context(patch.object(repos, 'GIT_EXECUTABLE', 'git'))
        stack.enter_context(redirect_stdout(self.output))
        stack.enter_context(redirect_stderr(self.errors))

    def process(self, argv, **kwargs):
        environment = kwargs['env']
        self.calls.append({'argv': list(argv), 'env': dict(environment),
                           'timeout': kwargs['timeout'], 'max_output': kwargs.get('max_output')})
        self.environments.append(environment)
        if argv[0] == 'fixture-gh':
            self.clock += self.lookup_seconds
            if isinstance(self.credential, Exception):
                raise self.credential
            return self.credential
        # Model a file-target trace without retaining any credential fixture on
        # disk when the inherited tracing variables have been removed.
        for name in ('GIT_TRACE', 'git_trace2_event', 'GIT_TRACE_CURL'):
            if environment.get(name):
                Path(environment[name]).write_text(environment.get('WEBTOOLS_GITHUB_AUTH', ''), encoding='utf-8')
        if kwargs['timeout'] <= 0:
            return None
        if 'ls-remote' in argv:
            reply = f'ref: refs/heads/main\tHEAD\n{TARGET}\tHEAD\n{TARGET}\trefs/heads/main\n'
        elif 'rev-parse' in argv:
            reply = TARGET + '\n'
        else:
            reply = ''
        return SimpleNamespace(returncode=0, stdout=reply)

    def network(self):
        return repos.git(self.root, 'ls-remote', '--symref', 'https://github.com/fixture/project.git', 'HEAD', timeout=25)

    def assert_private(self, value):
        text = str(value)
        for secret in (self.token, self.header, self.header.partition('Basic ')[2]):
            self.assertNotIn(secret, text)

    def test_network_authentication_is_scoped_child_only_and_unlogged(self):
        self.assertIsNotNone(self.network())
        self.assertEqual(len(self.calls), 2)
        command = self.calls[-1]
        configuration = [arg for arg in command['argv'] if arg.startswith('--config-env=')]
        self.assertEqual(len(configuration), 1)
        key, variable = configuration[0][len('--config-env='):].split('=', 1)
        self.assertEqual(key, 'http.https://github.com/.extraheader')
        self.assertEqual(command['env'][variable], self.header)
        self.assertNotIn(variable, self.calls[0]['env'])
        self.assertIn('credential.helper=', command['argv'])
        self.assertFalse(any('credential.helper=!' in arg for arg in command['argv']))
        self.assertIn('http.followRedirects=false', command['argv'])
        self.assertFalse(any('trace2.' in argument for argument in command['argv']))
        for call in self.calls:
            self.assert_private(call['argv'])
            allowed = {'GIT_TRACE2': '0', 'GIT_TRACE2_PERF': '0', 'GIT_TRACE2_EVENT': '0'} if call['argv'][0] == 'git' else {}
            traces = {name: value for name, value in call['env'].items() if name.upper().startswith('GIT_TRACE')}
            self.assertEqual(traces, allowed)
            self.assertFalse(any(name.upper().startswith('GIT_CONFIG') or name.upper() == 'GIT_CURL_VERBOSE'
                                 for name in call['env']))
        self.assertEqual(dict(os.environ), self.before)
        self.assertTrue(all(variable not in environment for environment in self.environments))
        self.assertEqual(list(self.root.iterdir()), [])
        self.assertEqual((self.output.getvalue(), self.errors.getvalue()), ('', ''))

    def test_child_environment_suppresses_real_git_global_trace_sinks(self):
        self.assertIsNotNone(self.network())
        candidate = dict(self.calls[-1]['env'])
        # Supply Windows loader locations, without reintroducing credentials or
        # Git configuration from the real test process environment.
        for name in ('SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'):
            if name in self.native_environment:
                candidate.setdefault(name, self.native_environment[name])
        targets = {kind: self.root / (kind + '.log') for kind in ('normal', 'perf', 'event')}
        config = self.root / 'global.config'
        config.write_text('[trace2]\n' + ''.join(
            '\t' + kind + 'Target = ' + json.dumps(str(path).replace('\\', '/')) + '\n'
            for kind, path in targets.items()) + '\tenvVars = WEBTOOLS_GITHUB_AUTH\n', encoding='utf-8')
        candidate['GIT_CONFIG_GLOBAL'] = str(config)

        def version(environment):
            # The auth deadline tests use a deterministic clock. Restore the
            # real clock while the actual process runner enforces its bound.
            with patch.object(repos.time, 'monotonic', self.real_monotonic):
                result = self.real_runner(['git', '--version'], env=environment, timeout=20, max_output=4096)
            self.assertIsNotNone(result)
            self.assertEqual(result.returncode, 0)
            self.assert_private(result.stdout)

        control = {name: value for name, value in candidate.items() if not name.startswith('GIT_TRACE2')}
        version(control)
        self.assertTrue(all(path.exists() for path in targets.values()), 'The global Trace2 fixture must be active.')
        self.assertIn(self.header, targets['event'].read_text(encoding='utf-8'))
        for path in targets.values():
            path.unlink()
        version(candidate)
        self.assertTrue(all(not path.exists() for path in targets.values()), 'The child environment must disable global trace sinks.')
        self.assertEqual(dict(os.environ), self.before)
        self.assertEqual((self.output.getvalue(), self.errors.getvalue()), ('', ''))

    def test_exact_url_redirect_guard_overrides_real_git_url_specific_configuration(self):
        self.assertIsNotNone(self.network())
        command = self.calls[-1]
        flags = []
        for index, argument in enumerate(command['argv'][:-1]):
            if argument == '-c':
                flags.extend(['-c', command['argv'][index + 1]])
        self.assert_private(flags)
        environment = {name: value for name, value in command['env'].items() if name != 'WEBTOOLS_GITHUB_AUTH'}
        for name in ('SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'):
            if name in self.native_environment:
                environment.setdefault(name, self.native_environment[name])
        config = self.root / 'global.config'
        config.write_text('[http "https://github.com/"]\n\tfollowRedirects = true\n'
                          '[http "https://github.com/fixture/project.git"]\n\tfollowRedirects = true\n', encoding='utf-8')
        environment['GIT_CONFIG_GLOBAL'] = str(config)

        def matched(configuration):
            argv = ['git', *configuration, 'config', '--get-urlmatch', 'http.followRedirects',
                    'https://github.com/fixture/project.git']
            with patch.object(repos.time, 'monotonic', self.real_monotonic):
                result = self.real_runner(argv, env=environment, timeout=20, max_output=4096)
            self.assertIsNotNone(result)
            self.assertEqual(result.returncode, 0)
            self.assert_private(result.stdout)
            return result.stdout.strip()

        self.assertEqual(matched(['-c', 'http.followRedirects=false']), 'true',
                         'The fixture must demonstrate that a generic guard loses to URL-specific settings.')
        self.assertEqual(matched(flags), 'false', 'The actual child flags must prohibit redirects for this request URL.')
        self.assertEqual(dict(os.environ), self.before)

    def test_token_lookup_consumes_the_existing_command_deadline(self):
        self.assertIsNotNone(self.network())
        self.assertLessEqual(self.calls[0]['timeout'], 25)
        self.assertGreater(self.calls[-1]['timeout'], 0)
        self.assertLessEqual(self.lookup_seconds + self.calls[-1]['timeout'], 25)

    def test_expired_lookup_cannot_start_a_git_command_with_a_new_budget(self):
        self.lookup_seconds = 25
        self.assertIsNone(self.network())
        self.assertTrue(all(call['timeout'] <= 0 for call in self.calls if call['argv'][0] == 'git'))

    def test_invalid_deadline_never_starts_a_credential_or_git_process(self):
        for timeout in (0, -1, float('inf'), float('nan'), 'not-a-deadline'):
            with self.subTest(timeout=timeout):
                self.calls.clear()
                self.assertIsNone(repos.git(self.root, 'ls-remote', 'https://github.com/fixture/project.git', 'HEAD', timeout=timeout))
                self.assertEqual(self.calls, [])

    def test_invalid_or_failed_token_lookup_has_no_git_or_helper_fallback(self):
        cases = [None, SimpleNamespace(returncode=1, stdout=self.token + '\n'),
                 SimpleNamespace(returncode=0, stdout=''),
                 SimpleNamespace(returncode=0, stdout=self.token + '\nsecond-line\n'),
                 SimpleNamespace(returncode=0, stdout=self.token + '\n\n'),
                 SimpleNamespace(returncode=0, stdout=self.token + '\u2028'),
                 SimpleNamespace(returncode=0, stdout='embedded space'),
                 SimpleNamespace(returncode=0, stdout='nonascii-\u00e9'),
                 SimpleNamespace(returncode=0, stdout='x' * 1025),
                 OSError(self.token)]
        for credential in cases:
            with self.subTest(case=type(credential).__name__):
                self.calls.clear()
                self.credential = credential
                self.assertIsNone(self.network())
                self.assertEqual([call['argv'][0] for call in self.calls], ['fixture-gh'])
                self.assertEqual(dict(os.environ), self.before)
        self.assertEqual((self.output.getvalue(), self.errors.getvalue()), ('', ''))
        self.assertEqual(list(self.root.iterdir()), [])

    def test_local_and_non_github_commands_do_not_look_up_a_token(self):
        for arguments in [('rev-parse', '--verify', 'HEAD'),
                          ('ls-remote', 'https://example.test/fixture/project.git', 'HEAD'),
                          ('fetch', str(self.root / 'local.git'), 'main')]:
            with self.subTest(command=arguments[0]):
                self.calls.clear()
                repos.git(self.root, *arguments)
                self.assertEqual([call['argv'][0] for call in self.calls], ['git'])
                self.assertFalse(any(arg.startswith('--config-env=') for arg in self.calls[0]['argv']))
                self.assertNotIn('WEBTOOLS_GITHUB_AUTH', self.calls[0]['env'])

    def test_git_error_discards_credentials_and_diagnostics(self):
        def failing_git(argv, **kwargs):
            result = self.process(argv, **kwargs)
            if argv[0] == 'git':
                raise OSError(self.header)
            return result
        with patch.object(repos, 'run_bounded', side_effect=failing_git):
            self.assertIsNone(self.network())
        self.assertEqual(dict(os.environ), self.before)
        self.assertTrue(all('WEBTOOLS_GITHUB_AUTH' not in environment for environment in self.environments))
        self.assertEqual((self.output.getvalue(), self.errors.getvalue()), ('', ''))
        self.assertEqual(list(self.root.iterdir()), [])

    def test_fetch_records_snapshot_and_files_never_contain_authentication(self):
        repo_key = repos.key('fixture/project')
        entry = {'path': self.root / 'checkout', 'repo': 'fixture/project',
                 'common': 'fixture-store', 'key': repo_key}
        row = {'name': 'checkout', 'key': 'c' * 24, 'branch': 'main', 'upstream': 'origin/main',
               'head': TARGET, 'changed': 0, 'untracked': 0, 'conflicts': 0}
        state = self.root / 'state'
        with patch.object(repos, 'discover', return_value=[entry]), \
                patch.object(repos, 'discover_cached', return_value=[entry]), \
                patch.object(repos, 'local_status', side_effect=lambda _entry: dict(row)), \
                patch.object(repos, 'pull_requests', return_value=None), \
                patch.object(repos, 'load_legacy', return_value={}), \
                patch.object(repos, 'load_comparisons', return_value={}), \
                patch.object(repos, 'save_comparisons'), \
                patch.object(repos, 'compare', return_value={'state': 'current', 'ahead': 0, 'behind': 0}), \
                patch.object(repos, 'branch_status', return_value={'state': 'unknown'}):
            result = repos.fetch_repository(self.root, state, repo_key)
            self.assertTrue(result)
            self.assert_private(result)
            self.assert_private(repos.read_source(state, repo_key))
            self.assert_private(json.dumps(repos.snapshot(self.root, state)))
        for file in self.root.rglob('*'):
            if file.is_file():
                self.assert_private(file.read_text(encoding='utf-8'))
        self.assertEqual(dict(os.environ), self.before)
        self.assertEqual((self.output.getvalue(), self.errors.getvalue()), ('', ''))


class ParallelObservationChecks(unittest.TestCase):
    def test_fresh_observations_overlap_with_at_most_four_active_calls(self):
        entries = [{'number': number} for number in range(9)]
        lock, release, wave = threading.Lock(), threading.Event(), threading.Event()
        oversubscribed = threading.Event()
        active, peak, generation = 0, 0, [HEAD]
        calls, outcome = [], {}

        def observe(entry):
            nonlocal active, peak
            with lock:
                active += 1
                peak = max(peak, active)
                calls.append(entry['number'])
                if active == 4:
                    wave.set()
                if active > 4:
                    oversubscribed.set()
            try:
                if not release.wait(5):
                    raise AssertionError('Independent observation calls did not overlap.')
                return {'name': 'folder-' + str(entry['number']), 'branch': 'main', 'head': generation[0]}
            finally:
                with lock:
                    active -= 1

        def read():
            try:
                outcome['rows'] = repos.status_rows(entries)
            except BaseException as error:
                outcome['error'] = error

        with patch.object(repos, 'local_status', side_effect=observe):
            worker = threading.Thread(target=read, daemon=True)
            worker.start()
            try:
                self.assertTrue(wave.wait(5), 'Four independent observations should proceed together.')
                self.assertFalse(oversubscribed.wait(.1), 'Observation work must stay within four active calls.')
            finally:
                release.set()
                worker.join(5)
            self.assertFalse(worker.is_alive())
            self.assertNotIn('error', outcome)
            self.assertEqual(peak, 4)
            self.assertEqual([row['name'] for row in outcome['rows']], ['folder-' + str(n) for n in range(9)])
            self.assertEqual(sorted(calls), list(range(9)))
            generation[0] = TARGET
            source = {'defaultBranch': 'main', 'tips': {'main': TARGET}}
            repos.record_main_sync(entries, source, {'folder': 'folder-0', 'state': 'updated'})
            self.assertEqual(source['mainSyncBasis']['head'], TARGET)
            self.assertEqual(len(calls), 18, 'Post-update projection must read every checkout again.')
            self.assertLessEqual(peak, 4)


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

    def test_ref_validation_overlaps_with_a_four_call_bound_and_excludes_rejected_refs(self):
        branches = ['main'] + ['feature/' + str(index) for index in range(7)] + ['invalid..branch']
        self.ref_reply = f'ref: refs/heads/main\tHEAD\n{TARGET}\tHEAD\n' + ''.join(
            f'{TARGET}\trefs/heads/{branch}\n' for branch in branches)
        lock, release, wave, oversubscribed = threading.Lock(), threading.Event(), threading.Event(), threading.Event()
        active, peak = 0, 0
        validated, fetch_arguments, outcome = [], [], {}

        def validate(_path, *args, **kwargs):
            nonlocal active, peak
            if args[0] != 'check-ref-format':
                if args[0] == 'fetch':
                    fetch_arguments.extend(args)
                return self.git(_path, *args, **kwargs)
            with lock:
                active += 1
                peak = max(peak, active)
                validated.append(args[1])
                if active == 4:
                    wave.set()
                if active > 4:
                    oversubscribed.set()
            try:
                if not release.wait(5):
                    raise AssertionError('Independent ref validation calls did not overlap.')
                return None if args[1].endswith('invalid..branch') else ''
            finally:
                with lock:
                    active -= 1

        def fetch():
            try:
                outcome['result'] = self.fetch()
            except BaseException as error:
                outcome['error'] = error

        with patch.object(repos, 'git', side_effect=validate):
            worker = threading.Thread(target=fetch, daemon=True)
            worker.start()
            try:
                self.assertTrue(wave.wait(5), 'Four independent refs should be validated together.')
                self.assertFalse(oversubscribed.wait(.1), 'Ref validation must stay within four active calls.')
            finally:
                release.set()
                worker.join(5)
        self.assertFalse(worker.is_alive())
        self.assertNotIn('error', outcome)
        self.assertTrue(outcome['result'])
        self.assertEqual(peak, 4)
        self.assertEqual(sorted(validated), sorted('refs/heads/' + branch for branch in branches))
        self.assertEqual(set(self.written['tips']), set(branches) - {'invalid..branch'})
        self.assertFalse(any('invalid..branch' in argument for argument in fetch_arguments))

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
