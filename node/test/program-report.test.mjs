// skills/programs/program.py report: the changes section counts the commits to
// the governed files since a date, a commit once for each governed entry it
// touched, a folder entry covering the files under it, and leaves out the
// commits that touch nothing governed. A governed registry whose every column
// is computed is left out and named, and a shallow checkout whose history
// starts after the window says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const SCRIPT = join(repoRoot, 'skills/programs/program.py');
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };

test('the report counts governed commits per entry and lists the latest', () => {
  const base = mkdtempSync(join(tmpdir(), 'program-report-'));
  const origin = join(base, 'origin.git'), work = join(base, 'work');
  const git = (...args) => spawnSync('git', args, { cwd: work, env, encoding: 'utf8' });
  try {
    spawnSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
    spawnSync('git', ['clone', '-q', origin, work]);
    const commit = (files, msg) => {
      for (const [p, text] of Object.entries(files)) {
        mkdirSync(join(work, dirname(p)), { recursive: true });
        writeFileSync(join(work, p), text);
      }
      git('add', '-A');
      git('commit', '-q', '--no-verify', '-m', msg);
    };
    commit({ '.web-tools.json': JSON.stringify({ programs: [{ name: 'demo', label: 'Demo', path: 'programs/demo',
      governs: ['docs/a.md', 'docs/forms/', 'docs/gen.csv', 'docs/mixed.csv'] }] }), 'programs/demo/README.md': '# Demo',
      'docs/registries.csv': 'id,path\ngen,docs/gen.csv\nmixed,docs/mixed.csv\n',
      'docs/properties.csv': 'registry,property,mode\ngen,n,computed\nmixed,n,computed\nmixed,why,recorded\n' }, 'declare');
    commit({ 'docs/a.md': '1' }, 'touch a');
    commit({ 'docs/forms/x.md': '1', 'docs/a.md': '2' }, 'touch a and a form');
    commit({ 'docs/other.md': '1', 'docs/forms-old.md': '1' }, 'touch nothing governed');
    commit({ 'docs/gen.csv': '1' }, 'regenerate a registry');
    commit({ 'docs/mixed.csv': '1' }, 'edit a registry with a recorded column');
    git('push', '-q', 'origin', 'HEAD:main');

    const r = spawnSync('python3', [SCRIPT, 'report', 'demo', '--since', '2000-01-01'], { cwd: work, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^3 commits\./m);
    assert.match(r.stdout, /\| `docs\/mixed\.csv` \| 1 \|/);
    assert.doesNotMatch(r.stdout, /regenerate a registry/);
    assert.match(r.stdout, /^Not counted, as a generator writes each whole: `docs\/gen\.csv`\.$/m);
    assert.doesNotMatch(r.stdout, /history is shallow/);
    assert.match(r.stdout, /\| `docs\/a\.md` \| 2 \|/);
    assert.match(r.stdout, /\| `docs\/forms\/` \| 1 \|/);
    assert.match(r.stdout, /- \w+ \d{4}-\d{2}-\d{2} touch a and a form/);
    assert.doesNotMatch(r.stdout, /touch nothing governed/);

    // A clone cut at its newest commit holds none of the window before it.
    const shallow = join(base, 'shallow');
    spawnSync('git', ['clone', '-q', '--depth', '1', 'file://' + origin, shallow]);
    const s = spawnSync('python3', [SCRIPT, 'report', 'demo', '--since', '2000-01-01'], { cwd: shallow, env, encoding: 'utf8' });
    assert.equal(s.status, 0, s.stderr);
    assert.match(s.stdout, /history is shallow and complete only from \d{4}-\d{2}-\d{2}/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('the report renders tabular and flat-object measures and joins open tasks by project, tag, and governed path', () => {
  const base = mkdtempSync(join(tmpdir(), 'program-report-tasks-'));
  const origin = join(base, 'origin.git'), work = join(base, 'work');
  const git = (...args) => spawnSync('git', args, { cwd: work, env, encoding: 'utf8' });
  try {
    spawnSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
    spawnSync('git', ['clone', '-q', origin, work]);
    const write = (files) => {
      for (const [p, text] of Object.entries(files)) {
        mkdirSync(join(work, dirname(p)), { recursive: true });
        writeFileSync(join(work, p), text);
      }
      git('add', '-A');
      git('commit', '-q', '--no-verify', '-m', 'seed');
    };
    write({
      '.web-tools.json': JSON.stringify({
        tracker: 'tracker/board.md',
        programs: [{
          name: 'demo', label: 'Demo', path: 'programs/demo',
          formerly: ['programs/legacy'],
          governs: ['docs/a.md', 'docs/forms/'],
          measures: ['state/tab.json', 'state/flat.json']
        }]
      }),
      'programs/demo/README.md': '# Demo\n',
      'docs/registries.csv': 'id,path\n',
      'docs/properties.csv': 'registry,property,mode\n',
      'docs/a.md': 'a\n',
      'docs/forms/x.md': 'x\n',
      'state/tab.json': JSON.stringify({
        generated: '2026-04-10',
        summary: { columns: ['week', 'sessions'], rows: [['2026-W15', 2]] },
        caveats: ['sample window']
      }),
      'state/flat.json': JSON.stringify({
        checked_at: '2026-04-12T18:35Z',
        summary: { files: 17, copies_edited: 4, sources_ahead: 0 }
      }),
      'tracker/board.md': '# Board\n',
      'tracker/board.csv': [
        'id,status,project,awaiting,title,href',
        't-proj,open,demo,,Direct project match,tasks/t-proj.md',
        't-old,in-progress,legacy,owner,Former program name match,tasks/t-old.md',
        't-tag,open,other,,Tagged program match,tasks/t-tag.md',
        't-body,open,,,Body link match,tasks/t-body.md',
        't-done,done,demo,,Completed task,tasks/t-done.md',
        't-dormant,dormant,demo,,Dormant task,tasks/t-dormant.md',
        't-sibling,open,,,Touches docs/forms-old.md only,tasks/t-sibling.md',
        't-foreign,open,,,Touches other/repo:docs/a.md only,tasks/t-foreign.md'
      ].join('\n') + '\n',
      'tracker/board-tags.csv': 'task,tag,value\nt-tag,program,demo\n',
      'tracker/tasks/t-proj.md': ' Plain body.\n',
      'tracker/tasks/t-old.md': ' Plain body.\n',
      'tracker/tasks/t-tag.md': ' Plain body.\n',
      'tracker/tasks/t-body.md': 'See [form](../../docs/forms/x.md) for context.\n',
      'tracker/tasks/t-done.md': 'Touch docs/a.md.\n',
      'tracker/tasks/t-dormant.md': 'Touch docs/a.md.\n',
      'tracker/tasks/t-sibling.md': 'Only docs/forms-old.md.\n',
      'tracker/tasks/t-foreign.md': 'Only https://example.com/docs/a.md and other/repo:docs/a.md.\n'
    });
    git('push', '-q', 'origin', 'HEAD:main');

    const r = spawnSync('python3', [SCRIPT, 'report', 'demo', '--since', '2000-01-01'], { cwd: work, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /### `state\/tab\.json` \(generated 2026-04-10\)/);
    assert.match(r.stdout, /\| week \| sessions \|\r?\n\| --- \| --- \|\r?\n\| 2026-W15 \| 2 \|/);
    assert.match(r.stdout, /- sample window/);
    assert.match(r.stdout, /### `state\/flat\.json` \(checked 2026-04-12T18:35Z\)/);
    assert.match(r.stdout, /\| files \| copies_edited \| sources_ahead \|\r?\n\| --- \| --- \| --- \|\r?\n\| 17 \| 4 \| 0 \|/);
    assert.match(r.stdout, /\| t-proj \| open \|  \| Direct project match \|/);
    assert.match(r.stdout, /\| t-old \| in-progress \| owner \| Former program name match \|/);
    assert.match(r.stdout, /\| t-tag \| open \|  \| Tagged program match \|/);
    assert.match(r.stdout, /\| t-body \| open \|  \| Body link match \|/);
    assert.doesNotMatch(r.stdout, /t-done|t-dormant|t-sibling|t-foreign/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

