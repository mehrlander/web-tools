#!/usr/bin/env python3
"""Run evals/portable/ against the portable plugin as this checkout has it.

`claude plugin eval` reads cases from below a plugin root and resolves the
plugin from its .claude-plugin/plugin.json. The portable plugin has no such
file: the marketplace entry in .claude-plugin/marketplace.json declares it
(strict: false). So this copies skills/ to a temporary directory, writes the
marketplace entry there as plugin.json, copies the cases in as evals/, and runs
the eval on the copy, with a no-plugin baseline arm.

  python3 python/portable-eval.py [any claude plugin eval option...]
  python3 python/portable-eval.py --case quick-answer --runs 1

Every case scaffolds a git repository (--scaffold), because the plugin's
SessionStart hook adds its instruction only where it finds a checkout. Results
land in evals/portable/results/<timestamp>/, which git ignores.
"""
import json, shutil, subprocess, sys, tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CASES = ROOT / 'evals' / 'portable'


def main():
    entry = next(p for p in json.loads((ROOT / '.claude-plugin' / 'marketplace.json').read_text())['plugins']
                 if p['name'] == 'portable')
    with tempfile.TemporaryDirectory(prefix='portable-eval-') as tmp:
        plugin = Path(tmp) / 'portable'
        shutil.copytree(ROOT / entry['source'], plugin)
        (plugin / '.claude-plugin').mkdir()
        manifest = {k: entry[k] for k in ('name', 'description', 'author', 'skills', 'agents') if k in entry}
        (plugin / '.claude-plugin' / 'plugin.json').write_text(json.dumps(manifest, indent=1))
        shutil.copytree(CASES, plugin / 'evals', ignore=shutil.ignore_patterns('results', 'README.md'))
        out = CASES / 'results' / datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ')
        cmd = ['claude', 'plugin', 'eval', str(plugin), '--eval-dir', 'evals', '--scaffold', '--trust-plugin',
               '--output-dir', str(out)] + sys.argv[1:]
        sys.exit(subprocess.run(cmd).returncode)


if __name__ == '__main__':
    main()
