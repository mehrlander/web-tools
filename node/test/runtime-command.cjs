// Normalize the two runtime command spellings that differ on Windows hosts
// before ESM tests import node:child_process.
//
// - Python 3 may be exposed as `python` only. checkout-setup creates shell/cmd
//   shims for npm scripts and git hooks, but Node's execFile/spawn APIs cannot
//   execute a .cmd shim.
// - `bash` may resolve to Windows' WSL launcher while Git carries the Bash the
//   repository hooks and session dispatcher need. Ask Git for that toolchain.

const child = require('node:child_process');
const { existsSync } = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const path = require('node:path');

// Python on Windows otherwise inherits the active console code page. Several
// checks stream emoji-bearing JSON, so make UTF-8 part of the test runtime
// rather than a property of whichever Python distribution happens to win PATH.
process.env.PYTHONUTF8 ||= '1';

// Disposable repositories created by the suite write their own LF fixtures.
// Do not let a machine-level core.autocrlf setting rewrite those bytes on the
// next checkout and turn platform conversion into a product assertion failure.
const gitConfigCount = Number.parseInt(process.env.GIT_CONFIG_COUNT || '0', 10) || 0;
process.env[`GIT_CONFIG_KEY_${gitConfigCount}`] = 'core.autocrlf';
process.env[`GIT_CONFIG_VALUE_${gitConfigCount}`] = 'false';
process.env.GIT_CONFIG_COUNT = String(gitConfigCount + 1);

const originals = Object.fromEntries(
  ['execFile', 'execFileSync', 'spawn', 'spawnSync'].map(name => [name, child[name]])
);

const succeeds = (command, args) => originals.spawnSync(command, args, {
  encoding: 'utf8', windowsHide: true,
}).status === 0;
const lf = value => typeof value === 'string' ? value.replace(/\r\n/g, '\n') : value;

const replacements = new Map();
let gitUnixBin = null;
const pythonProbe = [
  '-c',
  'import sys; raise SystemExit(sys.version_info < (3, 10))',
];
const py = originals.spawnSync('python', pythonProbe, { encoding: 'utf8', windowsHide: true });
const python3 = originals.spawnSync('python3', pythonProbe, { encoding: 'utf8', windowsHide: true });
if (python3.status !== 0 && py.status === 0) {
  replacements.set('python3', 'python');
}

if (process.platform === 'win32' || !succeeds('bash', ['--version'])) {
  const shell = originals.spawnSync('git', ['var', 'GIT_SHELL_PATH'], { encoding: 'utf8', windowsHide: true });
  if (shell.status === 0) {
    const candidate = path.join(path.dirname(shell.stdout.trim()), process.platform === 'win32' ? 'bash.exe' : 'bash');
    if (existsSync(candidate) && succeeds(candidate, ['--version'])) {
      replacements.set('bash', candidate);
      gitUnixBin = path.dirname(candidate);
    }
  }
}

if (replacements.size) {
  for (const [name, original] of Object.entries(originals)) {
    child[name] = function (command, ...args) {
      const replacement = replacements.get(command);
      const isPython = command === 'python' || command === 'python3';
      if (command === 'bash' && replacement && gitUnixBin) {
        const nextArgs = [...args];
        let optionsIndex = nextArgs.findIndex(value =>
          value && typeof value === 'object' && !Array.isArray(value));

        if (optionsIndex === -1) {
          optionsIndex = Array.isArray(nextArgs[0]) ? 1 : 0;
          nextArgs.splice(optionsIndex, 0, {});
        }

        const options = nextArgs[optionsIndex];
        const env = { ...(options.env || process.env) };
        const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
        env[pathKey] = [gitUnixBin, env[pathKey]].filter(Boolean).join(path.delimiter);
        nextArgs[optionsIndex] = { ...options, env };
        args = nextArgs;
      }

      if (isPython && name === 'execFile') {
        const callbackIndex = args.findLastIndex(value => typeof value === 'function');
        if (callbackIndex !== -1) {
          const callback = args[callbackIndex];
          args[callbackIndex] = (error, stdout, stderr) => callback(error, lf(stdout), lf(stderr));
        }
      }

      const result = original.call(this, replacement || command, ...args);
      if (!isPython) return result;
      if (typeof result === 'string') return lf(result);
      if (result && typeof result === 'object' && !Buffer.isBuffer(result)) {
        result.stdout = lf(result.stdout);
        result.stderr = lf(result.stderr);
      }
      return result;
    };
  }
  syncBuiltinESMExports();
}
