"""Read-only verification of the retained Excel research bundle. Standard library only."""
import argparse
import hashlib
import json
import posixpath
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'p': 'http://schemas.openxmlformats.org/package/2006/relationships',
      'c': 'http://schemas.openxmlformats.org/drawingml/2006/chart'}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def sheet(z, name):
    workbook = ET.fromstring(z.read('xl/workbook.xml'))
    item = next(s for s in workbook.findall('s:sheets/s:sheet', NS) if s.get('name') == name)
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    target = next(r.get('Target') for r in rels if r.get('Id') == item.get('{'+NS['r']+'}id'))
    target = target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join('xl', target))
    return ET.fromstring(z.read(target))

def cell(root, address):
    c = root.find('.//s:c[@r="'+address+'"]', NS)
    if c is None:
        return {'address': address, 'present': False}
    return {'address': address, 'present': True, 'type': c.get('t'),
            'value': c.findtext('s:v', namespaces=NS), 'formula': c.findtext('s:f', namespaces=NS)}

def inspect_packages(root):
    findings = {}
    with zipfile.ZipFile(root / 'demonstration-workbooks.xlsx') as z:
        assert z.testzip() is None
        raw = sheet(z, 'RawData')
        values = [cell(raw, f'{col}{row}') for col in ('J','K') for row in range(6,30)]
        assert all(c['value'] is not None and c['formula'] is None for c in values)
        budget = sum(float(c['value']) for c in values[:24])
        actual = sum(float(c['value']) for c in values[24:])
        assert (budget, actual) == (21450, 21595)
        caches = []
        for name in z.namelist():
            if name.startswith('xl/pivotCache/pivotCacheDefinition') and name.endswith('.xml'):
                cache = ET.fromstring(z.read(name))
                source = cache.find('s:cacheSource/s:worksheetSource', NS)
                caches.append({'part': name, 'attributes': cache.attrib,
                               'source': source.attrib if source is not None else None})
        assert any(c['source'] and c['source'].get('sheet') == 'RawData' and c['source'].get('ref') == 'B5:N30' for c in caches)
        rec = sheet(z, 'Reconciliation')
        findings['demonstrationWorkbook'] = {
            'dataRows': 24, 'budgetSum': budget, 'actualSum': actual, 'variance': actual-budget,
            'totalsCells': [cell(raw, x) for x in ('J30','K30','L30')], 'pivotCaches': caches,
            'reconciliationCells': [cell(rec, f'{col}{row}') for row in range(6,10) for col in ('E','F')],
            'calculationProperties': ET.fromstring(z.read('xl/workbook.xml')).find('s:calcPr',NS).attrib}
    with zipfile.ZipFile(root / 'charts/chart-cases.xlsx') as z:
        assert z.testzip() is None
        parts = [n for n in z.namelist() if n.startswith('xl/charts/chart') and n.endswith('.xml')]
        assert len(parts) == 3
        line_blank = cell(sheet(z, 'Line'), 'B5')
        assert line_blank['value'] is None and line_blank['formula'] is None
        chart = ET.fromstring(z.read('xl/charts/chart2.xml'))
        feb = chart.find('.//c:numCache/c:pt[@idx="1"]/c:v', NS)
        assert feb is not None and feb.text == '0'
        findings['chartWorkbook'] = {'nativeChartParts': parts, 'lineSourceCell': line_blank,
            'lineFebruaryNumericCache': feb.text, 'blankPolicyElementPresent': chart.find('.//c:dispBlanksAs',NS) is not None,
            'worksheetFormulaCount': sum(len(sheet(z, name).findall('.//s:f',NS)) for name in ('Column','Line','Scatter'))}
    return findings

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--packages-only', action='store_true', help='Inspect package facts without the archive inventory')
    args = parser.parse_args()
    root = args.bundle.resolve()
    errors = []
    verified = 0
    if not args.packages_only:
        manifest = json.loads((root / 'technical/evidence-manifest.json').read_text(encoding='utf-8'))
        for item in manifest['files']:
            path = (root / item['path']).resolve()
            if not path.is_relative_to(root):
                errors.append(f"Path outside bundle: {item['path']}")
                continue
            try:
                if path.stat().st_size != item['bytes'] or sha(path) != item['sha256']:
                    errors.append(f"Changed: {item['path']}")
                else:
                    verified += 1
            except OSError as e:
                errors.append(f"Unreadable: {item['path']}: {e}")
    try:
        facts = inspect_packages(root)
    except Exception as e:
        facts = None
        errors.append(f"Package check failed: {type(e).__name__}: {e}")
    print(json.dumps({'bundle':str(root), 'verifiedFiles':verified, 'errors':errors, 'packageFacts':facts}, indent=2))
    return 1 if errors else 0

if __name__ == '__main__':
    sys.exit(main())
