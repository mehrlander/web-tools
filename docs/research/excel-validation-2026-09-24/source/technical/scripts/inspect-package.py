import hashlib, json, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

file = Path(__file__).parents[2] / 'outputs' / 'excel-validation' / 'demonstration-workbooks.xlsx'
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(file) as z:
    names = z.namelist()
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    sheets = [dict(s.attrib) for s in wb.findall('s:sheets/s:sheet', ns)]
    tables = []
    pivots = []
    for name in names:
        if name.startswith('xl/tables/') and name.endswith('.xml'):
            root = ET.fromstring(z.read(name))
            tables.append({'part': name, **root.attrib, 'style': dict(root.find('s:tableStyleInfo', ns).attrib)})
        if name.startswith('xl/pivotTables/') and name.endswith('.xml'):
            root = ET.fromstring(z.read(name))
            pivots.append({'part': name, **root.attrib, 'location': dict(root.find('s:location', ns).attrib)})
    summary = {
        'file': str(file), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'bytes': file.stat().st_size,
        'rendererRevision': '5109699ac5eea3ca510947859ff9e5cb3980676e', 'zipCRC': z.testzip(),
        'sheets': sheets, 'tables': tables, 'pivots': pivots,
        'charts': [n for n in names if n.startswith('xl/charts/') and n.endswith('.xml')],
        'externalLinks': [n for n in names if n.startswith('xl/externalLinks/')],
        'macros': [n for n in names if 'vba' in n.lower()],
        'connections': [n for n in names if 'connections' in n.lower() or 'queryTable' in n],
    }
    print(json.dumps(summary, indent=2))
    (Path(__file__).parent / 'package-inventory.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
