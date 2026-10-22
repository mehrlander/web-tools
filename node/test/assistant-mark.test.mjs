// node/test/assistant-mark.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot, makeWindow } from './bootstrap.mjs';

const CLAUDE_KIT = 'lib/kits/claude-mark.js';
const ASSISTANT_KIT = 'lib/kits/assistant-mark.js';

const load = () => {
  const { window } = makeWindow();
  const claudeSrc = readFileSync(path.join(repoRoot, CLAUDE_KIT), 'utf8');
  const assistantSrc = readFileSync(path.join(repoRoot, ASSISTANT_KIT), 'utf8');
  new window.Function(claudeSrc)();
  new window.Function(assistantSrc)();
  return window;
};

test('classify reads declarations and abstains when there are none', () => {
  const { assistantMark } = load();

  // Claude
  assert.equal(assistantMark.classify({ name: 'claude/budget-drs-foo-123456' }), 'claude');
  assert.equal(assistantMark.classify({ name: 'random-branch', session: 'https://claude.ai/code/session_abc123' }), 'claude');

  // Codex
  assert.equal(assistantMark.classify({ name: 'codex/text-catalog-move' }), 'codex');
  assert.equal(assistantMark.classify({ name: 'chatgpt/some-refactor' }), 'codex');

  // Gemini
  assert.equal(assistantMark.classify({ name: 'gemini/activity-assistant-attribution' }), 'gemini');
  assert.equal(assistantMark.classify({ name: 'antigravity/csv-viewer-workbench-handoff' }), 'gemini');
  // `agent/` declares nothing, so it abstains unless a row names the branch
  assert.equal(assistantMark.classify({ name: 'agent/two-modes-github-flow-and-real-time' }), 'unknown');
  assert.equal(assistantMark.classify({ name: 'agent/shortcut-run-test' }), 'unknown');
  assert.equal(assistantMark.classify({ name: 'feature-branch', trailer: 'Co-Authored-By: Gemini <gemini@google.com>' }), 'gemini');
  // Gemini, Codex, and Grok take precedence even when an ancestor commit carries a Claude session URL
  assert.equal(assistantMark.classify({ name: 'gemini/rebuild-app-prebuild', session: 'https://claude.ai/code/session_ancestor' }), 'gemini');
  assert.equal(assistantMark.classify({ name: 'codex/move-files', session: 'https://claude.ai/code/session_ancestor' }), 'codex');
  assert.equal(assistantMark.classify({ name: 'grok/summary', session: 'https://claude.ai/code/session_ancestor' }), 'grok');

  // Grok
  assert.equal(assistantMark.classify({ name: 'grok/paragraph-rewrites' }), 'grok');
  assert.equal(assistantMark.classify({ name: 'agent/paragraph-rewrites-grok' }), 'grok');
  assert.equal(assistantMark.classify({ name: 'docs-edit', subject: 'docs: paragraph rewrite proposals (Chief of Staff / Grok)' }), 'grok');

  // Copilot
  assert.equal(assistantMark.classify({ name: 'copilot/look-at-trackers' }), 'copilot');

  // No signal is `unknown`, never `human`
  assert.equal(assistantMark.classify({ name: 'main' }), 'unknown');
  assert.equal(assistantMark.classify({ name: 'my-feature' }), 'unknown');
  assert.equal(assistantMark.classify(null), 'unknown');
});

test('a declared row outranks every inference, and a repo-scoped row wins over a bare one', () => {
  const { assistantMark } = load();
  const n = assistantMark.declare([
    { branch: 'fix/top-swipe-and-rev-banner', repo: 'me/tools', assistant: 'gemini', basis: 'PR #735' },
    { branch: 'agent/shared-name', repo: 'me/tools', assistant: 'codex', basis: 'footer' },
    { branch: 'agent/shared-name', repo: 'me/home', assistant: 'claude', basis: 'footer' },
    { branch: 'hand-edit', repo: '', assistant: 'human', basis: 'the owner said so' },
    { branch: '', assistant: 'grok' },
  ]);
  assert.equal(n, 6);
  assert.equal(assistantMark.classify({ name: 'fix/top-swipe-and-rev-banner', repo: 'me/tools' }), 'gemini');
  assert.equal(assistantMark.classify({ name: 'fix/top-swipe-and-rev-banner' }), 'gemini');
  assert.equal(assistantMark.classify({ name: 'agent/shared-name', repo: 'me/tools' }), 'codex');
  assert.equal(assistantMark.classify({ name: 'agent/shared-name', repo: 'me/home' }), 'claude');
  assert.equal(assistantMark.classify({ name: 'agent/shared-name' }), 'codex');
  assert.equal(assistantMark.classify({ name: 'hand-edit' }), 'human');
  // A row outranks a session URL inherited from an ancestor commit
  assert.equal(assistantMark.classify({ name: 'hand-edit', session: 'https://claude.ai/code/session_x' }), 'human');
  assert.equal(assistantMark.declared('hand-edit'), 'human');
  assert.equal(assistantMark.declared('nobody'), '');
  // declare replaces the table rather than accumulating
  assert.equal(assistantMark.declare([]), 0);
  assert.equal(assistantMark.classify({ name: 'hand-edit' }), 'unknown');
});

test('docs/assistant-branches.csv parses, names known assistants, and states a basis on every row', () => {
  const { assistantMark } = load();
  const src = readFileSync(path.join(repoRoot, 'lib/kits/csv.js'), 'utf8');
  const { window } = makeWindow();
  new window.Function(src)();
  const rows = window.Csv.rows(readFileSync(path.join(repoRoot, 'docs/assistant-branches.csv'), 'utf8'));
  assert.ok(rows.length > 0);
  const keys = new Set(Object.keys(assistantMark.LABEL));
  for (const r of rows) {
    assert.ok(r.branch && r.repo && r.assistant && r.basis && r.declared, JSON.stringify(r));
    assert.ok(keys.has(r.assistant) && r.assistant !== 'unknown', r.branch + ': ' + r.assistant);
    assert.match(r.declared, /^\d{4}-\d{2}-\d{2}$/, r.branch + ': declared');
    assert.match(r.repo, /^[^/]+\/[^/]+$/, r.branch + ': repo');
  }
  assert.equal(assistantMark.declare(rows), new Set(rows.map(r => r.branch)).size + rows.length);
  for (const r of rows) assert.equal(assistantMark.classify({ name: r.branch, repo: r.repo }), r.assistant);
});

test('svg renders distinct marks with appropriate stroke colors', () => {
  const { assistantMark, claudeMark } = load();

  // Claude delegates to claudeMark
  const claudeSvg = assistantMark.svg('claude');
  assert.match(claudeSvg, /stroke:#d97757/);
  assert.ok(claudeSvg.includes(claudeMark.PATH));

  // Gemini renders sparkle in Google blue
  const geminiSvg = assistantMark.svg('gemini');
  assert.match(geminiSvg, /stroke:#1a73e8/);
  assert.ok(geminiSvg.includes(assistantMark.PATH.gemini));

  // Codex renders swirl in OpenAI teal
  const codexSvg = assistantMark.svg('codex');
  assert.match(codexSvg, /stroke:#10a37f/);
  assert.ok(codexSvg.includes(assistantMark.PATH.codex));

  // Grok renders slash in dark slate
  const grokSvg = assistantMark.svg('grok');
  assert.match(grokSvg, /stroke:#52525b/);
  assert.ok(grokSvg.includes(assistantMark.PATH.grok));

  // Human and unclassified are empty by default
  assert.equal(assistantMark.svg('human'), '');
  assert.equal(assistantMark.svg('unknown'), '');
  assert.match(assistantMark.svg('unknown', { showHuman: true }), /stroke:#94a3b8/);
  // Unless showHuman is requested
  const humanSvg = assistantMark.svg('human', { showHuman: true });
  assert.match(humanSvg, /stroke:#64748b/);
  assert.ok(humanSvg.includes(assistantMark.PATH.human));
});

test('el parses a real SVG element in DOM', () => {
  const { assistantMark } = load();
  const el = assistantMark.el('gemini');
  assert.equal(el.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(el.tagName.toLowerCase(), 'svg');
  assert.equal(el.querySelectorAll('path').length, 1);
});

test('label and color provide consistent metadata', () => {
  const { assistantMark } = load();
  assert.equal(assistantMark.label('claude'), 'Claude Code');
  assert.equal(assistantMark.label('gemini'), 'Gemini');
  assert.equal(assistantMark.label('codex'), 'ChatGPT');
  assert.equal(assistantMark.label('grok'), 'Grok');
  assert.equal(assistantMark.label('human'), 'Human');
  assert.equal(assistantMark.label('unknown'), 'Unclassified');

  assert.equal(assistantMark.color('gemini'), '#1a73e8');
  assert.equal(assistantMark.color('claude'), '#d97757');
  assert.equal(assistantMark.color('codex'), '#10a37f');
  assert.equal(assistantMark.color('grok'), '#52525b');
  assert.equal(assistantMark.color('human'), '#64748b');
});

test('gh-boot carries assistant-mark.js right after claude-mark.js', () => {
  const boot = readFileSync(path.join(repoRoot, 'lib/gh-boot.js'), 'utf8');
  assert.ok(boot.includes("{ path: 'kits/assistant-mark.js' }"),
    'assistant-mark.js must be loaded in the boot chain before components mount');
});

test('branchShort strips assistant prefixes and grok suffix', () => {
  const estateSrc = readFileSync(path.join(repoRoot, 'lib/alpineComponents/estate.js'), 'utf8');
  const fnMatch = estateSrc.match(/branchShort\(name\)\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(fnMatch, 'branchShort function must be found in estate.js');
  const branchShort = new Function('name', fnMatch[1]);

  assert.equal(branchShort('claude/feature-name'), 'feature-name');
  assert.equal(branchShort('gemini/activity-assistant-attribution'), 'activity-assistant-attribution');
  assert.equal(branchShort('codex/text-catalog-move'), 'text-catalog-move');
  assert.equal(branchShort('chatgpt/some-refactor'), 'some-refactor');
  assert.equal(branchShort('grok/paragraph-rewrites'), 'paragraph-rewrites');
  assert.equal(branchShort('agent/paragraph-rewrites-grok'), 'paragraph-rewrites');
  assert.equal(branchShort('agent/two-modes-github-flow-and-real-time'), 'two-modes-github-flow-and-real-time');
  assert.equal(branchShort('copilot/look-at-trackers'), 'look-at-trackers');
  assert.equal(branchShort('my-custom-branch'), 'my-custom-branch');
  assert.equal(branchShort('user/feature-test'), 'feature-test');
});

test('estate integration: branch author helpers and filtering', () => {
  const window = load();
  const mockEstate = {
    branchAssistant(row) {
      return row?.assistant || window.assistantMark?.classify?.(row) || 'unknown';
    },
    branchAssistantMark(row) {
      const a = this.branchAssistant(row);
      return window.assistantMark?.svg?.(a, { cls: 'w-4 h-4 shrink-0' }) || '';
    },
    branchAssistantColor(row) {
      const a = this.branchAssistant(row);
      return window.assistantMark?.color?.(a) || window.assistantMark?.COLOR?.[a] || '#64748b';
    },
    branchAssistantTitle(row) {
      const a = this.branchAssistant(row);
      const label = window.assistantMark?.label?.(a) || window.assistantMark?.LABEL?.[a] || a;
      const url = this.branchSessionUrl(row);
      const count = row?.sessions?.length || 0;
      if (url) {
        const base = count > 1
          ? 'Worked across ' + count + ' sessions; opens the newest'
          : 'Open the ' + label + ' session that authored this branch';
        return base + (row?.sessionsExact ? '' : ' (approximate: read from the branch tip)');
      }
      return label + ' branch';
    },
    branchSessionUrl(row) {
      return row?.session || '';
    },
    openBranches: [
      { name: 'claude/foo', session: 'https://claude.ai/code/session_123', repo: 'me/tools' },
      { name: 'gemini/bar', repo: 'me/tools' },
      { name: 'gemini/baz', repo: 'me/home' },
      { name: 'feat/manual', repo: 'me/tools' },
    ],
    openAssistantFilter: '',
    openRepoFilter: '',
    get openAssistants() {
      const by = new Map();
      for (const r of this.openBranches) {
        const a = this.branchAssistant(r);
        by.set(a, (by.get(a) || 0) + 1);
      }
      return [...by.entries()]
        .map(([key, count]) => ({
          key,
          count,
          label: window.assistantMark?.label?.(key) || (key.charAt(0).toUpperCase() + key.slice(1))
        }))
        .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));
    },
    get activeAssistantFilter() {
      const f = this.openAssistantFilter;
      return f && this.openAssistants.some(a => a.key === f) ? f : '';
    },
    get activeRepoFilter() {
      const f = this.openRepoFilter;
      return f && ['me/tools', 'me/home'].includes(f) ? f : '';
    },
    get openRows() {
      let rows = this.openBranches;
      const rf = this.activeRepoFilter;
      if (rf) rows = rows.filter(r => r.repo === rf);
      const af = this.activeAssistantFilter;
      if (af) rows = rows.filter(r => this.branchAssistant(r) === af);
      return rows;
    }
  };

  // Branch attribution marks
  const claudeRow = mockEstate.openBranches[0];
  const geminiRow = mockEstate.openBranches[1];
  const humanRow = mockEstate.openBranches[3];

  assert.equal(mockEstate.branchAssistant(claudeRow), 'claude');
  assert.ok(mockEstate.branchAssistantMark(claudeRow).includes('<svg'));
  assert.match(mockEstate.branchAssistantTitle(claudeRow), /Open the Claude Code session/);

  assert.equal(mockEstate.branchAssistant(geminiRow), 'gemini');
  assert.ok(mockEstate.branchAssistantMark(geminiRow).includes('<svg'));
  assert.equal(mockEstate.branchAssistantTitle(geminiRow), 'Gemini branch');

  assert.equal(mockEstate.branchAssistant(humanRow), 'unknown');
  assert.equal(mockEstate.branchAssistantMark(humanRow), '');
  assert.equal(mockEstate.branchAssistantTitle(humanRow), 'Unclassified branch');

  // Assistant filter chips count
  const chips = mockEstate.openAssistants;
  assert.equal(chips.length, 3);
  assert.deepEqual(chips.map(c => [c.key, c.count]), [
    ['gemini', 2],
    ['claude', 1],
    ['unknown', 1],
  ]);

  // Filtering by assistant
  mockEstate.openAssistantFilter = 'gemini';
  assert.equal(mockEstate.openRows.length, 2);
  assert.ok(mockEstate.openRows.every(r => r.name.startsWith('gemini/')));

  // Combined repo and assistant filtering
  mockEstate.openRepoFilter = 'me/home';
  assert.equal(mockEstate.openRows.length, 1);
  assert.equal(mockEstate.openRows[0].name, 'gemini/baz');
});


test('shortBranch drops the assistant prefix the classifier reads, for a label', () => {
  const { assistantMark } = load();
  assert.equal(assistantMark.shortBranch('claude/budget-drs-foo-123456'), 'budget-drs-foo-123456');
  for (const p of ['codex', 'chatgpt', 'gemini', 'antigravity', 'grok', 'copilot', 'agent', 'Claude']) {
    assert.equal(assistantMark.shortBranch(p + '/x-y'), 'x-y', p);
  }
  assert.equal(assistantMark.shortBranch('feature/x'), 'feature/x', 'a prefix that names no assistant stays');
  assert.equal(assistantMark.shortBranch('claude/a/b'), 'a/b', 'one prefix, not every segment');
  assert.equal(assistantMark.shortBranch('pension-fix-grok'), 'pension-fix', "Grok's suffix is its mark too");
  assert.equal(assistantMark.shortBranch(''), '');
  assert.equal(assistantMark.shortBranch(null), '');
});

test('only assistant-mark.js lists the assistant branch prefixes', async () => {
  // Seven copies stripped a prefix for a label and disagreed on the list:
  // four knew claude, codex, gemini and grok, the estate row added chatgpt,
  // agent and copilot, the app's paste reader added agent alone (2026-10-20).
  // Two others stay, each for a reason a shared helper cannot answer.
  const ALLOWED = {
    'lib/kits/assistant-mark.js': 'the list itself',
    // An op is one standalone function a phone evaluates with no page around
    // it, so it cannot reach window.AssistantMark (lib/ops/README.md).
    'lib/ops/session-menu.js': 'a standalone op',
    // whoOf names the AUTHOR of a vote ("Claude", "Gemini"), not a branch.
    'lib/alpineComponents/waiting.js': 'an author name, not a branch',
  };
  const { execFileSync } = await import('node:child_process');
  const files = execFileSync('git', ['ls-files', 'lib', 'pages', 'app'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(js|html)$/.test(f) && !(f in ALLOWED) && !f.startsWith('pages/scratch/'));
  const offenders = [];
  for (const f of files) {
    readFileSync(path.join(repoRoot, f), 'utf8').split('\n').forEach((line, i) => {
      if (/\((?:\?:)?claude\|(?:codex|gemini|chatgpt)/i.test(line)) offenders.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [], 'these list assistant prefixes themselves; use window.AssistantMark.shortBranch or PREFIX_RE');
});

// docs/surfacing-course.md owns the attribution table, and two files repeat it
// for the assistants that read them first: AGENTS.md in full, GEMINI.md as its
// own row's prefix and trailer. Nothing held the copies until 2026-10-22, by
// which time AGENTS.md knew that `antigravity/` reads as Gemini and the owner
// did not. Each row's prefix must also be one this kit classifies as that
// assistant, so the table cannot promise a classification the code does not make.
test('the attribution table matches its copies and the classifier', () => {
  const rows = (file) => readFileSync(path.join(repoRoot, file), 'utf8')
    .split('\n').filter(l => /^\| \*\*\w+\*\* \|/.test(l)).map(l => l.trim());
  const owner = rows('docs/surfacing-course.md');
  assert.ok(owner.length >= 4, 'the attribution table in docs/surfacing-course.md has rows');
  assert.deepEqual(rows('AGENTS.md'), owner, 'AGENTS.md repeats the table docs/surfacing-course.md owns; change it there first');
  const gemini = owner.find(r => r.startsWith('| **Gemini**')).split('|').map(c => c.trim());
  const geminiMd = readFileSync(path.join(repoRoot, 'GEMINI.md'), 'utf8');
  for (const cell of [gemini[2], gemini[3]]) assert.ok(geminiMd.includes(cell.replace(/`/g, '')), `GEMINI.md lost ${cell}`);
  const { assistantMark } = load();
  for (const r of owner) {
    const [, name, prefix] = r.split('|').map(c => c.trim());
    const branch = prefix.replace(/`/g, '').replace('<slug>', 'x');
    assert.equal(assistantMark.classify({ name: branch }), name.replace(/\*/g, '').toLowerCase(), `${branch} does not classify as ${name}`);
  }
});
