// python/vba-project.py writes a VBA project into an .xlsm without Excel. What
// matters is that real Excel opens the result, and no test here can run Excel,
// so the tests hold the tool to two readers that are not the tool: oletools'
// VBA parser (olevba), and a script-built workbook that did open cleanly in
// desktop Excel 16, the Bill Compare 2.0 draft in mehrlander/budget-wa. The
// draft's own modules, extracted and rebuilt, must reproduce every stream of
// its vbaProject.bin byte for byte.
//
// The tool is standard-library Python. The olevba checks skip where oletools
// is not installed (CI installs no Python packages), and the draft checks skip
// where no budget-wa checkout sits beside this one ($BUDGET_WA overrides).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const tool = path.join(repoRoot, 'python', 'vba-project.py');
const budgetWa = process.env.BUDGET_WA || path.join(repoRoot, '..', 'budget-wa');
const draft = path.join(budgetWa, 'sources/bill-compare-tool/2026-11-22-v2-draft/dist/BillCompareTool.xlsm');
const published = path.join(budgetWa, 'sources/published-workbooks/BillCompareTool.xlsm');
const hasOletools = spawnSync('python3', ['-c', 'import olefile, oletools.olevba']).status === 0;

// Every script gets the tool as a module named vp, and the work dir as `work`.
const PRELUDE = `
import importlib.util, io, os, sys, zipfile
spec = importlib.util.spec_from_file_location('vp', sys.argv[1])
vp = importlib.util.module_from_spec(spec); spec.loader.exec_module(vp)
work = sys.argv[2]
def tool(*args):
    import subprocess
    r = subprocess.run([sys.executable, sys.argv[1], *args], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr

def minimal_xlsx(path, sheets=('First', 'Second'), extra_default=''):
    """A plain .xlsx with no codeNames and no project, written by hand."""
    ct = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="xml" ContentType="application/xml"/>' + extra_default +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
          + ''.join('<Override PartName="/xl/worksheets/sheet%d.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' % (i + 1) for i in range(len(sheets)))
          + '</Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
    wb = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
          '<bookViews><workbookView/></bookViews><sheets>'
          + ''.join('<sheet name="%s" sheetId="%d" r:id="rId%d"/>' % (n, i + 1, i + 1) for i, n in enumerate(sheets))
          + '</sheets></workbook>')
    wbrels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
              '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
              + ''.join('<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet%d.xml"/>' % (i + 1, i + 1) for i in range(len(sheets)))
              + '</Relationships>')
    sheet = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>')
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', ct)
        z.writestr('_rels/.rels', rels)
        z.writestr('xl/workbook.xml', wb)
        z.writestr('xl/_rels/workbook.xml.rels', wbrels)
        for i in range(len(sheets)):
            z.writestr('xl/worksheets/sheet%d.xml' % (i + 1), sheet)

def write(path, data):
    with open(path, 'wb') as f:
        f.write(data)

# Module files as a person writes them (LF, no Attribute lines), and the
# stored form the project must hold for each.
MODULES = {
    'modHello.bas': b'Option Explicit\\n\\nPublic Sub SayHello()\\n    MsgBox "Hello, world"\\nEnd Sub\\n',
    'ThisWorkbook.cls': b'Option Explicit\\n\\nPrivate Sub Workbook_Open()\\n    Range("B4").Value = "Opened"\\nEnd Sub\\n',
    'Sheet2.cls': b'Private Sub Worksheet_Activate()\\nEnd Sub',
    'Counter.cls': b'Public Count As Long\\n',
}
DOC = ['VB_GlobalNameSpace = False', 'VB_Creatable = False', 'VB_PredeclaredId = True', 'VB_Exposed = True',
       'VB_TemplateDerived = False', 'VB_Customizable = True']
def head(name, base=None, attrs=()):
    lines = ['Attribute VB_Name = "%s"' % name] + (['Attribute VB_Base = "%s"' % base] if base else [])
    return ('\\r\\n'.join(lines + ['Attribute ' + a for a in attrs]) + '\\r\\n').encode()
EXPECTED = {
    'ThisWorkbook': head('ThisWorkbook', '0{00020819-0000-0000-C000-000000000046}', DOC)
        + b'Option Explicit\\r\\n\\r\\nPrivate Sub Workbook_Open()\\r\\n    Range("B4").Value = "Opened"\\r\\nEnd Sub\\r\\n',
    'Sheet1': head('Sheet1', '0{00020820-0000-0000-C000-000000000046}', DOC),
    'Sheet2': head('Sheet2', '0{00020820-0000-0000-C000-000000000046}', DOC)
        + b'Private Sub Worksheet_Activate()\\r\\nEnd Sub\\r\\n',
    'modHello': head('modHello') + b'Option Explicit\\r\\n\\r\\nPublic Sub SayHello()\\r\\n    MsgBox "Hello, world"\\r\\nEnd Sub\\r\\n',
    'Counter': head('Counter', '0{FCFB3D2A-A0FA-1068-A738-08002B3371B5}',
                    ['VB_GlobalNameSpace = False', 'VB_Creatable = False', 'VB_PredeclaredId = False',
                     'VB_Exposed = False', 'VB_TemplateDerived = False', 'VB_Customizable = False'])
        + b'Public Count As Long\\r\\n',
}

def build_sample():
    src = os.path.join(work, 'src'); os.makedirs(src, exist_ok=True)
    for name, data in MODULES.items():
        write(os.path.join(src, name), data)
    minimal_xlsx(os.path.join(work, 'plain.xlsx'))
    code, out = tool('build', os.path.join(work, 'plain.xlsx'), os.path.join(work, 'built.xlsm'), '--module', src)
    assert code == 0, out
    return os.path.join(work, 'built.xlsm')
`;

function py(script, ...args) {
  const dir = mkdtempSync(path.join(tmpdir(), 'vba-project-'));
  try {
    const r = spawnSync('python3', ['-c', PRELUDE + script, tool, dir, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''));
    return r.stdout;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('compression round-trips text, chunk boundaries, runs and incompressible bytes', () => {
  py(`
import random
random.seed(7)
text = open(sys.argv[1], 'rb').read()
cases = [b'', b'a', b'abc' * 5, b' ' * 9000, text[:4095], text[:4096], text[:4097], text,
         bytes(random.getrandbits(8) for _ in range(10000))]
for data in cases:
    packed = vp.compress(data)
    assert vp.decompress(packed) == data, len(data)
# A full chunk of random bytes cannot shrink, so it is stored raw (flag clear).
packed = vp.compress(cases[-1])
assert packed[1] | packed[2] << 8 == 0x3FFF, hex(packed[1] | packed[2] << 8)
`);
});

test('the protection values reproduce the Excel-tested example from its project ID', () => {
  py(`
lines = vp.protection_lines('{06B35E79-42DD-484C-B613-D3CE5CC2A7B6}')
assert lines == ['CMG="0D0FF709F70DFB0DFB0DFB0DFB"', 'DPB="5E5CA456A456A557A557A5"', 'GC="C1C33BBC3CBC3C43"'], lines
assert [vp._decrypt(l.split('"')[1]) for l in lines] == [b'\\0\\0\\0\\0', b'\\0', b'\\xff']
`);
});

test('build turns a plain .xlsx into an .xlsm whose modules read back exactly', () => {
  py(`
out = build_sample()
code, listing = tool('extract', out, os.path.join(work, 'back'))
assert code == 0, listing
back = {os.path.splitext(f)[0]: open(os.path.join(work, 'back', f), 'rb').read() for f in os.listdir(os.path.join(work, 'back'))}
assert back == EXPECTED, sorted(set(back) ^ set(EXPECTED)) or [k for k in back if back[k] != EXPECTED[k]]
assert sorted(os.listdir(os.path.join(work, 'back'))) == ['Counter.cls', 'Sheet1.cls', 'Sheet2.cls', 'ThisWorkbook.cls', 'modHello.bas']
code, listing = tool('list', out)
rows = [l.split() for l in listing.splitlines()[2:]]
assert rows == [['ThisWorkbook', 'document', '5'], ['Sheet1', 'document', '0'], ['Sheet2', 'document', '2'],
                ['modHello', 'standard', '5'], ['Counter', 'class', '1']], rows

z, plain = zipfile.ZipFile(out), zipfile.ZipFile(os.path.join(work, 'plain.xlsx'))
assert z.testzip() is None
ct = z.read('[Content_Types].xml').decode()
assert 'PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"' in ct
assert '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/>' in ct
assert 'Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"' in z.read('xl/_rels/workbook.xml.rels').decode()
assert '<workbookPr codeName="ThisWorkbook"/><bookViews>' in z.read('xl/workbook.xml').decode()
assert '<sheetPr codeName="Sheet2"/><sheetData/>' in z.read('xl/worksheets/sheet2.xml').decode()
changed = {'[Content_Types].xml', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'}
assert z.namelist() == plain.namelist() + ['xl/vbaProject.bin']
assert all(z.read(n) == plain.read(n) for n in plain.namelist() if n not in changed)

streams = vp.read_cfb(z.read('xl/vbaProject.bin'))
assert list(streams) == [('VBA',), ('VBA', 'dir'), ('VBA', '_VBA_PROJECT'), ('VBA', 'ThisWorkbook'), ('VBA', 'Sheet1'),
                         ('VBA', 'Sheet2'), ('VBA', 'modHello'), ('VBA', 'Counter'), ('PROJECT',), ('PROJECTwm',)], list(streams)
assert streams[('VBA', '_VBA_PROJECT')] == bytes.fromhex('cc61ffff000000')
project = streams[('PROJECT',)].decode()
assert '\\r\\nDocument=ThisWorkbook/&H00000000\\r\\nDocument=Sheet1/&H00000000\\r\\nDocument=Sheet2/&H00000000\\r\\nModule=modHello\\r\\nClass=Counter\\r\\nName="VBAProject"\\r\\n' in project

# Building again from what came back changes nothing in the project.
code, msg = tool('build', out, os.path.join(work, 'again.xlsm'), '--module', os.path.join(work, 'back'))
assert code == 0, msg
assert zipfile.ZipFile(os.path.join(work, 'again.xlsm')).read('xl/vbaProject.bin') == z.read('xl/vbaProject.bin')
`);
});

test('a package that already maps .bin to printer settings gets an Override for the project', () => {
  py(`
minimal_xlsx(os.path.join(work, 'p.xlsx'), sheets=('Only',),
             extra_default='<Default Extension="bin" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings"/>')
write(os.path.join(work, 'm.bas'), b'Sub X()\\nEnd Sub\\n')
code, msg = tool('build', os.path.join(work, 'p.xlsx'), os.path.join(work, 'p.xlsm'), '--module', os.path.join(work, 'm.bas'))
assert code == 0, msg
ct = zipfile.ZipFile(os.path.join(work, 'p.xlsm')).read('[Content_Types].xml').decode()
assert '<Override PartName="/xl/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/>' in ct, ct
assert 'printerSettings' in ct
`);
});

test('build refuses an output Excel would reject and a module of the wrong kind', () => {
  py(`
out = build_sample()
code, msg = tool('build', out, os.path.join(work, 'x.xlsx'))
assert code != 0 and '.xlsm' in msg, msg
write(os.path.join(work, 'Sheet1.bas'), b'Sub X()\\nEnd Sub\\n')
code, msg = tool('build', out, os.path.join(work, 'y.xlsm'), '--module', os.path.join(work, 'Sheet1.bas'))
assert code != 0 and 'document module' in msg, msg
`);
});

test('olevba reads every module of a built project exactly', { skip: !hasOletools && 'oletools is not installed' }, () => {
  py(`
from oletools.olevba import VBA_Parser
out = build_sample()
parser = VBA_Parser(out)
got = {os.path.splitext(fn)[0]: code.encode('cp1252') for (_, _, fn, code) in parser.extract_macros()}
assert got == EXPECTED, [k for k in EXPECTED if got.get(k) != EXPECTED[k]]
import olefile
ole = olefile.OleFileIO(io.BytesIO(zipfile.ZipFile(out).read('xl/vbaProject.bin')))
assert not [p for p in ole.listdir() if p[-1].startswith('__SRP_')]
`);
});

test('the Bill Compare 2.0 draft rebuilds to its own Excel-tested streams, byte for byte',
  { skip: !existsSync(draft) && 'no budget-wa checkout beside this one' }, () => {
    py(`
draft = sys.argv[3]
assert tool('extract', draft, os.path.join(work, 'a'))[0] == 0
code, msg = tool('build', draft, os.path.join(work, 'rebuilt.xlsm'), '--module', os.path.join(work, 'a'))
assert code == 0, msg
assert tool('extract', os.path.join(work, 'rebuilt.xlsm'), os.path.join(work, 'b'))[0] == 0
names = sorted(os.listdir(os.path.join(work, 'a')))
assert len(names) == 17 and names == sorted(os.listdir(os.path.join(work, 'b')))
for n in names:
    assert open(os.path.join(work, 'a', n), 'rb').read() == open(os.path.join(work, 'b', n), 'rb').read(), n
old, new = zipfile.ZipFile(draft), zipfile.ZipFile(os.path.join(work, 'rebuilt.xlsm'))
a, b = vp.read_cfb(old.read('xl/vbaProject.bin')), vp.read_cfb(new.read('xl/vbaProject.bin'))
assert list(a) == list(b), (list(a), list(b))
assert [p for p in a if a[p] != b[p]] == []
assert all(old.read(n) == new.read(n) for n in old.namelist() if n != 'xl/vbaProject.bin')
if ${hasOletools ? 'True' : 'False'}:
    from oletools.olevba import VBA_Parser
    got = {os.path.splitext(fn)[0]: c.encode('cp1252') for (_, _, fn, c) in VBA_Parser(os.path.join(work, 'rebuilt.xlsm')).extract_macros()}
    want = {os.path.splitext(n)[0]: open(os.path.join(work, 'a', n), 'rb').read() for n in names}
    assert got == want
`, draft);
  });

test('an Excel-saved project with UserForms lists and extracts, and build refuses it',
  { skip: !existsSync(published) && 'no budget-wa checkout beside this one' }, () => {
    py(`
src = sys.argv[3]
code, listing = tool('list', src)
assert code == 0 and 'compiled by Office' in listing and ' form ' in listing, listing
assert tool('extract', src, os.path.join(work, 'x'))[0] == 0
code, msg = tool('build', src, os.path.join(work, 'y.xlsm'))
assert code != 0 and 'UserForm' in msg, msg
`, published);
  });
