"""Verify the retained PR 792 review without launching Excel or a browser."""
from pathlib import Path
from hashlib import sha256
import json
import zipfile

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'source/evidence-manifest.json').read_text(encoding='utf-8'))

def require(condition, message):
    if not condition:
        raise SystemExit(message)

seen = set()
for entry in manifest['files']:
    target = (root / entry['path']).resolve()
    require(root in target.parents, 'Inventory path leaves this run: ' + entry['path'])
    require(entry['path'] not in seen, 'Duplicate path: ' + entry['path'])
    seen.add(entry['path'])
    data = target.read_bytes()
    require(len(data) == entry['bytes'], 'Size mismatch: ' + entry['path'])
    require(sha256(data).hexdigest() == entry['sha256'], 'Hash mismatch: ' + entry['path'])

report = json.loads((root / 'source/probe-results.json').read_text(encoding='utf-8'))
require(report['head'] == manifest['rendererRevision'], 'Renderer revision mismatch')
current = root / 'source/pr792-demonstration-charts.xlsx'
prior = root / 'source/prior-gemini/Demonstration-Charts.xlsx'
comparison = report['priorDemoComparison']
require(sha256(current.read_bytes()).hexdigest() == comparison['currentWorkbookSha256'], 'Current demo mismatch')
require(sha256(prior.read_bytes()).hexdigest() == comparison['workbookSha256'], 'Earlier demo mismatch')
with zipfile.ZipFile(current) as current_zip, zipfile.ZipFile(prior) as prior_zip:
    for entry in comparison['chartParts']:
        a = current_zip.read(entry['part'])
        b = prior_zip.read(entry['part'])
        require(a == b, 'Chart parts differ: ' + entry['part'])
        require(sha256(b).hexdigest() == entry['priorSha256'], 'Chart-part hash mismatch')

native = root.parent / 'excel-validation-2026-09-24/source/charts/chart-cases.xlsx'
expected = next(f['sha256'] for f in report['fixtures'] if f['name'] == 'native-cases')
require(sha256(native.read_bytes()).hexdigest() == expected, 'Adjacent native fixture mismatch')
native_image = native.parent / 'excel-line.png'
require(native_image.read_bytes() == (root / 'source/excel-line-reference.png').read_bytes(), 'Native line image mismatch')
print(f"Verified {len(seen)} retained files, four chart parts, and adjacent native references.")
