// docs/portable.csv — the one index of the portable set (its prose parent,
// docs/PORTABLE.md, was retired 2026-09-09; MARKETPLACE.md owns the channel).
// This test types every row, holds each path to disk, and holds the skill
// rows to the plugin's actual source boundary on disk.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const manifest = { items: parseCsv(readFileSync(path.join(repoRoot, 'docs', 'portable.csv'), 'utf8')) };

// The harness registry owns the description of anything it carries.
const harnessPaths = new Set(
  parseCsv(readFileSync(path.join(repoRoot, 'docs', 'harness.csv'), 'utf8')).map(t => t.path));

// The catalog used to carry `hub` and a `plugin` block, and this test asserted
// them. Both were copies: .claude-plugin/marketplace.json is the file the
// platform actually reads, and it names the owner and every plugin. A CSV holds
// rows and not config, so the split forced the question and the answer was the
// one the owners table already gives, read the original.
const marketplace = JSON.parse(
  readFileSync(path.join(repoRoot, '.claude-plugin', 'marketplace.json'), 'utf8'));

test('the set is typed and non-empty, and the plugins match the marketplace', () => {
  assert.equal(`${marketplace.owner.name}/${marketplace.name}`, 'mehrlander/web-tools');
  assert.ok(marketplace.plugins.map(p => p.name).includes('portable'));
  assert.ok(manifest.items.length > 10);
  for (const it of manifest.items) {
    assert.ok(['skill', 'doc', 'dir', 'script'].includes(it.kind), it.path + ': kind');
    assert.ok(it.path && it.title, it.path + ': path/title');
    // `role` is required only where no registry already describes the file. The
    // set inherits from `harness`: on the nine scripts docs/harness.csv describes, a
    // role here would be a second copy of one claim, which is what the
    // ownership gate in properties-registry.test.mjs now forbids. The Map view
    // joins the registry value for display, so the row is not left blank to a
    // reader. See docs/registries.md, "the inheritance shape".
    assert.ok(it.role || harnessPaths.has(it.path),
      it.path + ': needs a role, since no registry carries a description for it');
  }
});

test('every manifest path exists in the repo', () => {
  for (const it of manifest.items) {
    assert.ok(existsSync(path.join(repoRoot, it.path)), 'missing on disk: ' + it.path);
  }
});



// The registry. The plugin's source boundary is ./.claude/skills (see
// .claude-plugin/marketplace.json), so every skill directory on disk SHIPS,
// catalogued or not. Four shipped uncatalogued for a while (measured
// 2026-08-04: disk 15, manifest 9, MARKETPLACE.md 5), because the tests above
// gate the Docs/Scripts tables and never counted skills. Disk is the
// authoritative for membership; the manifest is the gated copy.
test('every skill directory on disk is a manifest skill item', () => {
  const skillsDir = path.join(repoRoot, '.claude', 'skills');
  const onDisk = readdirSync(skillsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && existsSync(path.join(skillsDir, e.name, 'SKILL.md')))
    .map(e => `.claude/skills/${e.name}/SKILL.md`);
  const inManifest = new Set(manifest.items.filter(i => i.kind === 'skill').map(i => i.path));
  for (const p of onDisk) {
    assert.ok(inManifest.has(p), 'ships in the plugin but not catalogued: ' + p);
  }
  assert.equal(inManifest.size, onDisk.length, 'manifest lists a skill with no directory on disk');
});

// The vendored copies. The plugin ships CONVENTIONS.md and SURFACING.md inside
// the web-tools skill so loading them costs no fetch; docs/ is the
// authoritative and these are copies by design. They have drifted
// before and were resynced by hand (2b785b2), which is exactly the failure
// mode of an ungated copy.

// A traveling doc's links have to resolve where it lands, not only where it is
// written. These two ship inside the plugin and are also fetched into a
// consumer session's context, so a relative link is dead in both places unless
// its target travels with them. CONVENTIONS.md and SURFACING.md ship together,
// so their mutual links stay relative; everything else in docs/ does not, and
// is written as an absolute hub URL. Thirteen such links were dead in the
// vendored copies until 2026-08-05 (dead-links.py found them); this is the
// gate that keeps the next one from shipping.
const SHIPPED_TOGETHER = ['SURFACING.md'];
const MD_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

test('the traveling docs link only to targets that travel with them', () => {
  const skillDir = path.join(repoRoot, 'docs');
  for (const name of SHIPPED_TOGETHER) {
    const text = readFileSync(path.join(skillDir, name), 'utf8');
    for (const [, target] of text.matchAll(MD_LINK)) {
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      const rel = target.split('#')[0];
      // Both docs quote link TEMPLATES ([branch-name](url), the caption's
      // (…) stand-ins). Only a target shaped like a repo path is a real link.
      if (!/^[\w.-]+(?:\/[\w.-]+)*\/?$/.test(rel)) continue;
      if (!rel.includes('/') && !/\.\w+$/.test(rel)) continue;
      assert.ok(existsSync(path.join(skillDir, rel)),
        `${name} links relatively to "${target}", which does not ship in the plugin; ` +
        'write it as an absolute https://github.com/mehrlander/web-tools/... URL in docs/' + name);
    }
  }
});
