import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Cloud turn hooks publish ordered signals without changing the record checkout', () => {
  const result = spawnSync('python3', [fileURLToPath(new URL('./session-activity-checks.py', import.meta.url))], {
    encoding:'utf8', timeout:90000, env:{...process.env,PYTHONUTF8:'1'}
  });
  assert.equal(result.status,0,result.stdout + result.stderr);
});
