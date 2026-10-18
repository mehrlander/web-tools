// Every tracked path must be one Windows can hold, or a clone on the laptop
// fails its checkout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i;
const illegal = rel => rel.split('/').some(seg =>
  /[<>:"\\|?*\x00-\x1f]/.test(seg) || /[. ]$/.test(seg) || RESERVED.test(seg));

test('every tracked path is legal on Windows', () => {
  const files = execFileSync('git', ['-c', 'core.quotePath=false', '-C', ROOT, 'ls-files', '-z'], { encoding: 'utf8' })
    .split('\0').filter(Boolean);
  assert.deepEqual(files.filter(illegal), []);
});
