import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const htmlPath = path.join(repoRoot, 'pages/drop/json-lens.html');
const rawHtml = readFileSync(htmlPath, 'utf8');

test('pages/drop/json-lens.html loads and boots in jsdom with visual collapsible tree and semantic lens inspector', () => {
  const { window, problems } = makeWindow({ html: rawHtml });

  assert.equal(problems.length, 0, 'booted without errors or warnings');

  const document = window.document;

  // 1. Breadcrumbs & Topology
  const breadcrumbBar = document.getElementById('breadcrumb-bar');
  assert.ok(breadcrumbBar, 'breadcrumb bar exists');
  assert.ok(breadcrumbBar.textContent.includes('root'), 'root breadcrumb present');

  const topologyRibbon = document.getElementById('topology-ribbon');
  assert.ok(topologyRibbon, 'topology ribbon exists');
  assert.ok(topologyRibbon.children.length > 0, 'topology ribbon has child segments');

  // 2. Visual Collapsible Tree
  const treeViewport = document.getElementById('tree-viewport');
  assert.ok(treeViewport, 'tree viewport exists');
  const treeNodes = treeViewport.querySelectorAll('.tree-node');
  assert.ok(treeNodes.length > 0, 'tree nodes rendered');

  const nodeCount = document.getElementById('tree-node-count');
  assert.ok(nodeCount, 'node counter exists');
  assert.match(nodeCount.textContent, /\d+\s+nodes/, 'node count displayed');

  // 3. Tree Branch indentation guide lines
  const branches = treeViewport.querySelectorAll('.tree-branch');
  assert.ok(branches.length > 0, 'tree indentation branches rendered');

  // 4. Semantic Lens Inspector
  const inspectorContent = document.getElementById('desktop-inspector-content');
  assert.ok(inspectorContent, 'desktop inspector content container exists');
  assert.ok(inspectorContent.textContent.includes('root'), 'inspector shows root target');
  assert.ok(inspectorContent.textContent.includes('TypeScript Shape'), 'inspector displays TypeScript shape');

  // 5. Mobile Bottom Sheet
  const mobileSheet = document.getElementById('mobile-sheet');
  assert.ok(mobileSheet, 'mobile sheet element exists');
  const mobileContent = document.getElementById('mobile-sheet-content');
  assert.ok(mobileContent, 'mobile sheet content container exists');

  // 6. Filter Tree Search
  const filterInput = document.getElementById('filter-input');
  assert.ok(filterInput, 'filter input exists');
  filterInput.value = 'Eleanor';
  filterInput.dispatchEvent(new window.Event('input'));
  assert.ok(treeViewport.textContent.includes('Eleanor'), 'filter matches text');

  // Reset filter
  filterInput.value = '';
  filterInput.dispatchEvent(new window.Event('input'));

  // 7. Theme Switcher
  const themeBtn = document.getElementById('theme-toggle');
  assert.ok(themeBtn, 'theme toggle exists');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light', 'initial theme is light');
  themeBtn.click();
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark', 'theme toggles to dark');
  themeBtn.click();
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light', 'theme toggles back to light');
});
