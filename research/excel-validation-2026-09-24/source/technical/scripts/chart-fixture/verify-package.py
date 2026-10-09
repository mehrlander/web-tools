import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

WORK = Path(__file__).parent
OUTPUT = Path(r'C:\Users\mehrl\Documents\Codex\2026-09-24\tak\outputs\excel-validation\charts')
FILE = OUTPUT / 'chart-cases.xlsx'
NS = {'c':'http://schemas.openxmlformats.org/drawingml/2006/chart', 's':'http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'a':'http://schemas.openxmlformats.org/drawingml/2006/main', 'xdr':'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'}

def attrs(element):
    return None if element is None else dict(element.attrib)

def chart_details(z, name):
    root = ET.fromstring(z.read(name))
    chart_type = next((tag for tag in ['barChart','lineChart','scatterChart'] if root.find('.//c:'+tag,NS) is not None), None)
    axes = []
    for axis in root.findall('.//c:valAx',NS):
        axes.append({'position':attrs(axis.find('c:axPos',NS)), 'minimum':attrs(axis.find('c:scaling/c:min',NS)), 'maximum':attrs(axis.find('c:scaling/c:max',NS)), 'majorUnit':attrs(axis.find('c:majorUnit',NS))})
    series = []
    for item in root.findall('.//c:ser',NS):
        series.append({'references':[v.text for v in item.findall('.//c:f',NS)], 'numericCaches':[[{'index':int(p.attrib['idx']), 'value':p.findtext('c:v',namespaces=NS)} for p in cache.findall('c:pt',NS)] for cache in item.findall('.//c:numCache',NS)], 'marker':attrs(item.find('c:marker/c:symbol',NS))})
    return {'part':name,'type':chart_type,'axes':axes,'blankPolicy':attrs(root.find('.//c:dispBlanksAs',NS)),'series':series}

with zipfile.ZipFile(FILE) as z:
    names = z.namelist()
    chart_parts = [n for n in names if '/charts/' in n and n.endswith('.xml') and '/_rels/' not in n]
    chart_rows = [chart_details(z,n) for n in chart_parts]
    sheet_parts = [n for n in names if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')]
    sheets = [ET.fromstring(z.read(n)) for n in sheet_parts]
    line_blank = sheets[1].find('.//s:c[@r="B5"]',NS)
    formula_count = sum(len(s.findall('.//s:f',NS)) for s in sheets)
    extents = []
    for sheet_index,name in enumerate([n for n in names if n.startswith('xl/drawings/drawing') and n.endswith('.xml')]):
        drawing = ET.fromstring(z.read(name))
        start = drawing.find('.//xdr:from',NS)
        end = drawing.find('.//xdr:to',NS)
        start_col = int(start.findtext('xdr:col',namespaces=NS))
        end_col = int(end.findtext('xdr:col',namespaces=NS))
        start_row = int(start.findtext('xdr:row',namespaces=NS))
        end_row = int(end.findtext('xdr:row',namespaces=NS))
        column_definitions = sheets[sheet_index].findall('.//s:col',NS)
        def column_pixels(index):
            definition = next(c for c in column_definitions if int(c.attrib['min'])<=index+1<=int(c.attrib['max']))
            return math.floor(((256*float(definition.attrib['width'])+math.floor(128/7))/256)*7)
        width = sum(column_pixels(c) for c in range(start_col,end_col))+(int(end.findtext('xdr:colOff',namespaces=NS))-int(start.findtext('xdr:colOff',namespaces=NS)))/9525
        height = (end_row-start_row)*20+(int(end.findtext('xdr:rowOff',namespaces=NS))-int(start.findtext('xdr:rowOff',namespaces=NS)))/9525
        extents.append({'part':name,'fromRow':start_row,'fromColumn':start_col,'toRow':end_row,'toColumn':end_col,'widthPx':width,'heightPx':height,'dimensionMethod':'two-cell anchors, explicit 20px rows and Excel 7px maximum-digit column-width conversion at 96dpi'})
    result = {
        'file':FILE.name,'sha256':hashlib.sha256(FILE.read_bytes()).hexdigest(),'bytes':FILE.stat().st_size,
        'writer':{'name':'XlsxWriter','version':'3.2.9','runtimeBundle':'26.904.11930'},
        'purpose':'Synthetic, controlled Excel/browser chart comparison. No business data or formulas.',
        'expected':json.loads((WORK/'specification.json').read_text(encoding='utf-8')),
        'packageVerification':{'nativeChartCount':len(chart_parts),'embeddedImageCount':len([n for n in names if n.startswith('xl/media/')]),'vbaParts':[n for n in names if 'vba' in n.lower()],'externalLinkParts':[n for n in names if n.startswith('xl/externalLinks/')],'worksheetFormulaCount':formula_count,'lineB5HasNumericValue':line_blank is not None and line_blank.find('s:v',NS) is not None,'charts':chart_rows,'drawingDimensions':extents,'blankPolicySerialization':'show_blanks_as(gap) was requested. XlsxWriter omits the default dispBlanksAs element; its documented default is gap. The Line B5 input is genuinely blank and its cache point is omitted.','blankPolicyDocumentation':'https://xlsxwriter.readthedocs.io/chart.html#chart-show-blanks-as'},
        'authoringRouteNote':'Artifact Tool 2.8.59 was tried first; the supplied documentation/help did not expose explicit axis minimum/maximum or a line blank policy. The limited attempt is retained under work/native-test/chart-fixture/artifact-tool-attempt.xlsx. XlsxWriter was used for the final controlled fixture; no OOXML was patched.',
        'validationStatus':'Package semantics checked. Native Excel rendering is being checked separately by the root task.'
    }
assert len(chart_rows)==3
assert formula_count==0
assert result['packageVerification']['embeddedImageCount']==0
assert not result['packageVerification']['vbaParts']
assert not result['packageVerification']['externalLinkParts']
assert not result['packageVerification']['lineB5HasNumericValue']
expected_axes = [[(-5,15,5)],[(0,10,2)],[(0,10,2),(0,10,2)]]
for row,expected in zip(chart_rows,expected_axes):
    observed=[(float(a['minimum']['val']),float(a['maximum']['val']),float(a['majorUnit']['val'])) for a in row['axes']]
    assert observed==expected,(row['part'],observed,expected)
assert all(d['widthPx']==700 and d['heightPx']==400 and d['fromColumn']==4 and d['fromRow']==1 for d in extents)
assert chart_rows[1]['blankPolicy'] in (None,{'val':'gap'})
line_cache = chart_rows[1]['series'][0]['numericCaches'][0]
assert next(p['value'] for p in line_cache if p['index'] == 1) == '0'
result['packageVerification']['blankPolicySerialization'] = ('Line B5 has no numeric value or formula. XlsxWriter serializes its February chart-cache point as 0 and omits the default dispBlanksAs element. Native Excel was observed to show a gap at February; the source blank and native rendering must be distinguished from the cache value.')
(OUTPUT/'chart-manifest.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'file':str(FILE),'sha256':result['sha256'],'bytes':result['bytes'],'nativeCharts':len(chart_rows),'formulaCount':formula_count,'dimensions':extents,'chartDetails':chart_rows},indent=2))

with zipfile.ZipFile(WORK/'artifact-tool-attempt.xlsx') as z:
    attempt = [chart_details(z,n) for n in z.namelist() if '/charts/' in n and n.endswith('.xml') and '/_rels/' not in n]
    (WORK/'artifact-attempt-evidence.json').write_text(json.dumps({'writer':'@oai/artifact-tool 2.8.59','note':'Limited documented API attempt, not proof the library lacks every equivalent control. Native chart parts exist; explicit bounds were not authored. No package mutation.', 'charts':attempt},indent=2)+'\n',encoding='utf-8')
