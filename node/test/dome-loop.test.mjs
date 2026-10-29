// The dome's coordinator, end to end with canned agents: next issues each
// action, the test writes what its agents would, and the loop runs from the
// tasks through the bouts and checks to a result. Fixture-driven, so no model
// runs and the assertions do not move when the briefs do.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DOME = join(dirname(fileURLToPath(import.meta.url)), '../../python/swarm/dome.py')
const PARA = 'Refresh the cache weekly, by hand, not from the hook. Run make cache from the repository root. A stale cache shows old totals.'
const TASKS = [
  { id: 't1', question: 'How is the cache refreshed, and how often?', expected: ['by hand', 'weekly'] },
  { id: 't2', question: 'What command refreshes it, and from where?', expected: ['make cache', 'the repository root'] },
  { id: 't3', question: 'Who owns the cache?', expected: ['the data team'] },
]

const dome = (...a) => spawnSync('python3', [DOME, ...a], { encoding: 'utf8' })
const ledger = run => JSON.parse(readFileSync(join(run, 'ledger.json'), 'utf8'))
const jsonl = (path, rows) => writeFileSync(path, rows.map(r => JSON.stringify(r)).join('\n') + '\n')
const next = (run, ...a) => {
  const r = dome('next', run, ...a)
  assert.equal(r.status, 0, r.stdout + r.stderr)
  return ledger(run)
}

// A run over the paragraph on line 3: bouts of two fighters, two unless given.
function fixture (tasks, bouts = 2, para = PARA) {
  const dir = mkdtempSync(join(tmpdir(), 'dome-'))
  writeFileSync(join(dir, 'doc.md'), '# Doc\n\n' + para + '\n')
  jsonl(join(dir, 'tasks.jsonl'), TASKS)
  const run = join(dir, 'run')
  execFileSync('python3', [DOME, 'init', run, join(dir, 'doc.md'), '3', '3', '--bouts', String(bouts), '--fighters', 'cutter,fuser',
    ...(tasks ? ['--tasks', join(dir, 'tasks.jsonl')] : [])])
  return run
}

// A referee answers blind, reveals, then grades: pass, or fail with what is missing.
function referee (run, n, grades) {
  const out = join(run, `c${n}-referee.jsonl`)
  const rows = Object.entries(grades).map(([task, g]) => ({ task, answer: 'answer to ' + task }))
  jsonl(out, rows)
  assert.equal(dome('reveal', run, out).status, 0)
  jsonl(out, rows.map(r => grades[r.task] === true ? { ...r, status: 'pass' } : { ...r, status: 'fail', missing: grades[r.task] }))
}

test('a tasker writes the tasks when the run has none', () => {
  const run = fixture(false)
  let led = next(run)
  assert.equal(led.actions.at(-1).op, 'write_tasks')
  assert.ok(existsSync(join(run, 'tasks.ctx.md')))
  jsonl(join(run, 'tasks.jsonl'), TASKS)
  led = next(run)
  assert.equal(led.brief.tasks.length, 3)
  assert.deepEqual([led.actions.at(-1).op, led.actions.at(-1).target], ['run_check', 0])
})

test('the loop runs from the tasks to a result', () => {
  const run = fixture(true)

  // Calibration: the referee sees the questions, never the expected facts.
  let led = next(run)
  assert.deepEqual([led.actions.at(-1).op, led.actions.at(-1).target], ['run_check', 0])
  const blind = readFileSync(join(run, 'c0-referee.ctx.md'), 'utf8')
  assert.match(blind, /What command refreshes it/)
  assert.doesNotMatch(blind, /the data team/)

  // A grade may not rewrite the answer it grades.
  referee(run, 0, { t1: true, t2: true, t3: 'the data team' })
  const out = join(run, 'c0-referee.jsonl')
  const graded = readFileSync(out, 'utf8')
  writeFileSync(out, graded.replace('answer to t1', 'a better answer'))
  assert.equal(dome('check', run, out).status, 1)
  writeFileSync(out, graded)

  // A task the original fails is dropped; bout 1 is issued to every fighter.
  led = next(run)
  assert.match(led.brief.tasks[2].dropped, /the data team/)
  assert.deepEqual(led.actions.at(-1).agents.map(a => a.name), ['cutter', 'fuser'])
  assert.doesNotMatch(readFileSync(join(run, 'b1-cutter.ctx.md'), 'utf8'), /Who owns the cache/)

  // The bigger claim lands. The fuser's edit over the same words is knocked out,
  // and so is its edit on words the cutter has just written; its cut lands.
  jsonl(join(run, 'b1-cutter.jsonl'), [{ from: 'Refresh the cache weekly, by hand, not from the hook.', text: 'Refresh the cache weekly.' }])
  jsonl(join(run, 'b1-fuser.jsonl'), [{ from: 'by hand, not from the hook', text: 'manually' },
    { from: 'A stale cache shows old totals.', text: '' }, { from: 'the cache weekly', text: 'the weekly cache' }])
  led = next(run)
  assert.deepEqual([led.bouts[0].landed, led.bouts[0].knocked], [2, 2])
  assert.equal(led.bouts[0].text, 'Refresh the cache weekly. Run make cache from the repository root.')
  assert.deepEqual([led.actions.at(-1).op, led.actions.at(-1).target], ['run_check', 1])

  // The referee's finding reaches the next bout's fighters.
  referee(run, 1, { t1: 'by hand', t2: true })
  led = next(run)
  assert.deepEqual([led.actions.at(-1).op, led.actions.at(-1).target], ['bout', 2])
  assert.match(readFileSync(join(run, 'b2-fuser.ctx.md'), 'utf8'), /could not answer:\n\n- \*\*t1\*\* .* Missing: by hand/)

  // next waits for every fighter; --force smashes without the missing one.
  jsonl(join(run, 'b2-cutter.jsonl'), [{ from: 'Refresh the cache weekly.', text: 'Refresh the cache weekly, by hand.', lost: 'how it is refreshed' }])
  assert.equal(dome('next', run).status, 3)
  led = next(run, '--force')
  assert.equal(led.edits.find(e => e.bout === 2).repair, true)
  assert.deepEqual([led.actions.at(-1).op, led.actions.at(-1).target], ['run_check', 2])

  // The allowance is spent: the result is the shortest text every task passes on.
  referee(run, 2, { t1: true, t2: true })
  led = next(run)
  assert.equal(led.state, 'ready_for_review')
  assert.equal(led.best, 2)
  assert.match(led.stop, /allowance of 2 bouts/)
  assert.equal(led.bouts[1].text, 'Refresh the cache weekly, by hand. Run make cache from the repository root.')
})

test('a repair lands first, and a bout that saves nothing ends the run', () => {
  const run = fixture(true, 3)
  next(run)
  referee(run, 0, { t1: true, t2: true, t3: 'the data team' })
  next(run)
  jsonl(join(run, 'b1-cutter.jsonl'), [{ from: ', not from the hook', text: '' }])
  jsonl(join(run, 'b1-fuser.jsonl'), [{ from: 'A stale cache shows old totals.', text: '' }])
  next(run)
  referee(run, 1, { t1: true, t2: true })
  next(run)

  // The repair claims fewer words than the cut over the same span, and still lands first.
  jsonl(join(run, 'b2-fuser.jsonl'), [{ from: 'weekly, by hand.', text: 'by hand, once a week.', lost: 'nothing, in truth' }])
  jsonl(join(run, 'b2-cutter.jsonl'), [{ from: 'Refresh the cache weekly, by hand.', text: 'Refresh by hand.' }])
  let led = next(run)
  assert.deepEqual([led.bouts[1].landed, led.bouts[1].knocked], [1, 1])
  assert.equal(led.bouts[1].text, 'Refresh the cache by hand, once a week. Run make cache from the repository root.')

  // Bout 2 added words: the run stops with a bout to spare, and the shorter bout 1 is the result.
  referee(run, 2, { t1: true, t2: true })
  led = next(run)
  assert.equal(led.state, 'ready_for_review')
  assert.match(led.stop, /bout 2 saved no words/)
  assert.equal(led.best, 1)
})

test('the smash tidies a cut without touching a code span', () => {
  const run = fixture(true, 1, 'Run `make . -o out` from the root, not by hand.')
  next(run)
  referee(run, 0, { t1: true, t2: true, t3: 'the data team' })
  next(run)
  jsonl(join(run, 'b1-cutter.jsonl'), [{ from: ', not by hand', text: '' }])
  jsonl(join(run, 'b1-fuser.jsonl'), [{ from: 'from the root', text: 'from the repository root' }])
  const led = next(run)
  assert.equal(led.bouts[0].text, 'Run `make . -o out` from the repository root.')
})
