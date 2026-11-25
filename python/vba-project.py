#!/usr/bin/env python3
"""Read and write the VBA macro project inside an Excel workbook, without Excel.

    vba-project.py list    <workbook.xlsm>
    vba-project.py extract <workbook.xlsm> <dir>
    vba-project.py build   <in.xlsx|in.xlsm> <out.xlsm> --module <file-or-dir> [...]

A macro-enabled workbook keeps its project in xl/vbaProject.bin, an OLE compound
file (MS-CFB) laid out per MS-OVBA: a PROJECT text stream, PROJECTwm,
VBA/_VBA_PROJECT, VBA/dir (the compressed project records) and one stream per
module holding its compressed source.

`build` writes a source-only project: VBA/_VBA_PROJECT is the 7-byte stream
whose version 0xFFFF says there is no compiled code, so Office compiles from
source on open, and there are no __SRP_* cache streams. Every stream, record and
value follows a script-built workbook that opened cleanly in desktop Excel 16
(budget-wa sources/bill-compare-tool/2026-11-22-v2-draft/dist/BillCompareTool.xlsm).
Where the input already has a project, its references, project properties and
ID carry over and only the modules are rewritten. Every zip member other than
the project, and the few parts a plain .xlsx needs changed to become an .xlsm,
is copied with identical content.

Standard library only, so it runs wherever python3 does. Module files are
VBA source: `.bas` for a standard module, `.cls` for a class or document module
(ThisWorkbook, a sheet). `extract` writes each module exactly as stored, which
is what oletools' olevba returns; `build` accepts that form, a VBE export, or
bare code with no Attribute lines.
"""

import argparse
import hashlib
import io
import os
import re
import struct
import sys
import uuid
import zipfile

# ---------------------------------------------------------------- compression
# MS-OVBA 2.4.1: a signature byte, then chunks of up to 4096 decompressed bytes.


def _copy_token_help(difference):
    bit_count = max((difference - 1).bit_length(), 4)
    length_mask = 0xFFFF >> bit_count
    return bit_count, length_mask, length_mask + 3


def decompress(buf):
    buf = bytes(buf)
    if not buf or buf[0] != 1:
        raise ValueError('not an MS-OVBA compressed container (signature byte)')
    out = bytearray()
    pos = 1
    while pos + 2 <= len(buf):
        header = buf[pos] | buf[pos + 1] << 8
        chunk_end = min(pos + (header & 0x0FFF) + 3, len(buf))
        if (header >> 12) & 7 != 3:
            raise ValueError('bad chunk signature at offset %d' % pos)
        pos += 2
        start = len(out)
        if not header & 0x8000:
            out += buf[pos:pos + 4096]
            pos += 4096
            continue
        while pos < chunk_end:
            flags = buf[pos]
            pos += 1
            for bit in range(8):
                if pos >= chunk_end:
                    break
                if not flags >> bit & 1:
                    out.append(buf[pos])
                    pos += 1
                    continue
                token = buf[pos] | buf[pos + 1] << 8
                pos += 2
                bit_count, length_mask, _ = _copy_token_help(len(out) - start)
                length = (token & length_mask) + 3
                offset = (token >> (16 - bit_count)) + 1
                src = len(out) - offset
                if src < start:
                    raise ValueError('copy token reaches before its chunk')
                for k in range(length):
                    out.append(out[src + k])
        pos = chunk_end
    return bytes(out)


def _match_length(data, cand, cur, limit):
    n = 0
    while n + 32 <= limit and data[cand + n:cand + n + 32] == data[cur + n:cur + n + 32]:
        n += 32
    while n < limit and data[cand + n] == data[cur + n]:
        n += 1
    return n


def _compress_chunk(data, start, end):
    """The token sequences of one chunk. A copy token takes the longest match
    within the chunk, capped at the most the token can say, and the nearest
    candidate among equals. The spec's pseudocode (2.4.1.3.19.4) compares
    lengths before capping them; capping first is what the Excel-tested example
    does, and this reproduces its streams byte for byte. Both decompress to the
    same bytes. A table of 3-byte prefixes only skips candidates that cannot
    reach the 3-byte minimum."""
    out = bytearray()
    heads = {}
    indexed = start
    cur = start
    while cur < end:
        flag_pos = len(out)
        out.append(0)
        flags = 0
        for bit in range(8):
            if cur >= end:
                break
            while indexed < cur:
                if indexed + 3 <= end:
                    heads.setdefault(data[indexed:indexed + 3], []).append(indexed)
                indexed += 1
            best_len, best_cand = 0, 0
            bit_count, _, max_len = _copy_token_help(cur - start)
            if cur + 3 <= end:
                limit = min(end - cur, max_len)
                for cand in reversed(heads.get(data[cur:cur + 3], ())):
                    n = _match_length(data, cand, cur, limit)
                    if n > best_len:
                        best_len, best_cand = n, cand
                        if n == limit:
                            break
            if best_len >= 3:
                token = (cur - best_cand - 1) << (16 - bit_count) | (best_len - 3)
                out += struct.pack('<H', token)
                flags |= 1 << bit
                cur += best_len
            else:
                out.append(data[cur])
                cur += 1
        out[flag_pos] = flags
    return bytes(out)


def compress(data):
    data = bytes(data)
    out = bytearray([1])
    for start in range(0, len(data), 4096):
        end = min(start + 4096, len(data))
        body = _compress_chunk(data, start, end)
        if len(body) <= 4096:
            out += struct.pack('<H', 0xB000 | (len(body) + 2 - 3)) + body
        elif end - start == 4096:
            out += struct.pack('<H', 0x3FFF) + data[start:end]
        else:
            # A raw chunk must hold 4096 bytes, so a short final chunk that
            # does not compress cannot be stored. VBA source never gets here.
            raise ValueError('final chunk does not compress')
    return bytes(out)


# ------------------------------------------------------------------ CFB read

ENDOFCHAIN, FREESECT, FATSECT, NOSTREAM = 0xFFFFFFFE, 0xFFFFFFFF, 0xFFFFFFFD, 0xFFFFFFFF
CFB_SIG = b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'


def read_cfb(blob):
    """Every stream and storage in a compound file, as {path tuple: bytes or
    None (a storage)}, in directory order."""
    if blob[:8] != CFB_SIG:
        raise ValueError('not an OLE compound file')
    sector_shift, mini_shift = struct.unpack_from('<HH', blob, 30)
    ssize, msize = 1 << sector_shift, 1 << mini_shift
    dir_start, = struct.unpack_from('<I', blob, 48)
    cutoff, minifat_start, _, difat_start, difat_count = struct.unpack_from('<IIIII', blob, 56)

    def sector(i):
        off = ssize + i * ssize
        return blob[off:off + ssize]

    difat = [x for x in struct.unpack_from('<109I', blob, 76)]
    nxt = difat_start
    for _ in range(difat_count):
        if nxt >= ENDOFCHAIN:
            break
        vals = struct.unpack('<%dI' % (ssize // 4), sector(nxt))
        difat += vals[:-1]
        nxt = vals[-1]
    fat = []
    for s in difat:
        if s < FATSECT:
            fat += struct.unpack('<%dI' % (ssize // 4), sector(s))

    def chain(s):
        seen = []
        while s < FATSECT:
            if len(seen) > len(fat):
                raise ValueError('FAT chain loops')
            seen.append(s)
            s = fat[s]
        return seen

    def big(s, size):
        return b''.join(sector(x) for x in chain(s))[:size]

    dirdata = big(dir_start, len(blob))
    entries = []
    for i in range(len(dirdata) // 128):
        e = dirdata[i * 128:(i + 1) * 128]
        nlen, = struct.unpack_from('<H', e, 64)
        name = e[:max(nlen - 2, 0)].decode('utf-16le', 'replace')
        etype = e[66]
        left, right, child = struct.unpack_from('<III', e, 68)
        start, size = struct.unpack_from('<IQ', e, 116)
        entries.append((name, etype, left, right, child, start, size))
    root = entries[0]
    ministream = big(root[5], root[6]) if root[6] else b''
    minifat = []
    if minifat_start < FATSECT:
        mf = big(minifat_start, len(blob))
        minifat = list(struct.unpack('<%dI' % (len(mf) // 4), mf))

    def small(s, size):
        out = []
        while s < FATSECT and len(out) * msize < size:
            out.append(ministream[s * msize:(s + 1) * msize])
            s = minifat[s]
        return b''.join(out)[:size]

    found = {}

    def walk(idx, prefix):
        stack = [idx]
        while stack:
            i = stack.pop()
            if i == NOSTREAM or i >= len(entries):
                continue
            name, etype, left, right, child, start, size = entries[i]
            stack += [right, left]
            path = prefix + (name,)
            if etype == 1:
                found[path] = (i, None)
                walk(child, path)
            elif etype == 2:
                found[path] = (i, small(start, size) if size < cutoff else big(start, size))

    walk(root[4], ())
    return {p: v for p, (i, v) in sorted(found.items(), key=lambda kv: kv[1][0])}


# ----------------------------------------------------------------- CFB write


def _cfb_key(name):
    return (len(name), name.upper())


def _balanced(children):
    """A balanced binary tree over the sorted children, coloured as a valid
    red-black tree: black everywhere except an incomplete bottom level, red."""
    items = sorted(children, key=lambda c: _cfb_key(c[0]))
    nodes = {}

    def build(lo, hi, depth):
        if lo >= hi:
            return None
        mid = (lo + hi) // 2
        nodes[items[mid][1]] = [build(lo, mid, depth + 1), build(mid + 1, hi, depth + 1), depth]
        return items[mid][1]

    root = build(0, len(items), 0)
    n = len(items)
    full = ((n + 1) & n) == 0
    bottom = max((v[2] for v in nodes.values()), default=0)
    colour = {i: (0 if (not full and v[2] == bottom and bottom > 0) else 1) for i, v in nodes.items()}
    return root, {i: (v[0], v[1]) for i, v in nodes.items()}, colour


def write_cfb(items):
    """A version 3 compound file from [(path tuple, bytes or None)], in the
    order given, which becomes directory order. Layout follows the Excel-tested
    example: large streams, then the mini stream, the mini FAT, the directory,
    and the FAT last."""
    SS, MS, CUTOFF = 512, 64, 4096
    entries = [{'name': 'Root Entry', 'type': 5, 'path': (), 'data': None}]
    for path, data in items:
        entries.append({'name': path[-1], 'type': 1 if data is None else 2, 'path': path, 'data': data})
    index = {e['path']: i for i, e in enumerate(entries)}
    for e in entries:
        if len(e['name']) > 31 or any(ch in e['name'] for ch in '/\\:!'):
            raise ValueError('invalid compound file name %r' % e['name'])
        e['left'] = e['right'] = e['child'] = NOSTREAM
        e['colour'] = 1
    groups = {}
    for i, e in enumerate(entries[1:], 1):
        groups.setdefault(e['path'][:-1], []).append((e['name'], i))
    for parent, kids in groups.items():
        root, links, colour = _balanced(kids)
        entries[index[parent]]['child'] = root
        for i, (left, right) in links.items():
            entries[i]['left'] = NOSTREAM if left is None else left
            entries[i]['right'] = NOSTREAM if right is None else right
            entries[i]['colour'] = colour[i]

    sectors = []
    fat = []

    def place(data):
        n = (len(data) + SS - 1) // SS
        first = len(sectors)
        for k in range(n):
            sectors.append(data[k * SS:(k + 1) * SS].ljust(SS, b'\0'))
            fat.append(first + k + 1 if k < n - 1 else ENDOFCHAIN)
        return first if n else ENDOFCHAIN

    mini = bytearray()
    minifat = []
    for e in entries:
        e['start'], e['size'] = 0, 0
        if e['type'] != 2:
            continue
        data = e['data']
        e['size'] = len(data)
        if not data:
            e['start'] = ENDOFCHAIN
        elif len(data) >= CUTOFF:
            e['start'] = place(data)
        else:
            n = (len(data) + MS - 1) // MS
            first = len(minifat)
            mini += data.ljust(n * MS, b'\0')
            minifat += [first + k + 1 if k < n - 1 else ENDOFCHAIN for k in range(n)]
            e['start'] = first
    root = entries[0]
    root['start'], root['size'] = (place(bytes(mini)), len(mini)) if mini else (ENDOFCHAIN, 0)
    minifat_start, minifat_count = ENDOFCHAIN, 0
    if minifat:
        minifat += [FREESECT] * (-len(minifat) % (SS // 4))
        raw = struct.pack('<%dI' % len(minifat), *minifat)
        minifat_start, minifat_count = place(raw), len(raw) // SS

    dirbuf = bytearray()
    for e in entries:
        name = e['name'].encode('utf-16le')
        rec = name.ljust(64, b'\0') + struct.pack('<HBB', len(name) + 2, e['type'], e['colour'])
        rec += struct.pack('<III', e['left'], e['right'], e['child'])
        rec += b'\0' * 16 + struct.pack('<IQQ', 0, 0, 0) + struct.pack('<IQ', e['start'], e['size'])
        dirbuf += rec
    while len(dirbuf) % SS:
        dirbuf += b'\0' * 64 + struct.pack('<HBB', 0, 0, 0) + struct.pack('<III', NOSTREAM, NOSTREAM, NOSTREAM) + b'\0' * 48
    dir_start = place(bytes(dirbuf))

    per = SS // 4
    nfat = 1
    while (len(sectors) + nfat + per - 1) // per > nfat:
        nfat += 1
    if nfat > 109:
        raise ValueError('project too large for a FAT without DIFAT sectors')
    fat_first = len(sectors)
    fat += [FATSECT] * nfat
    fat += [FREESECT] * (nfat * per - len(fat))
    for k in range(nfat):
        sectors.append(struct.pack('<%dI' % per, *fat[k * per:(k + 1) * per]))

    header = CFB_SIG + b'\0' * 16 + struct.pack('<HHHHH', 0x3E, 3, 0xFFFE, 9, 6) + b'\0' * 6
    header += struct.pack('<IIIIIIIII', 0, nfat, dir_start, 0, CUTOFF, minifat_start, minifat_count, ENDOFCHAIN, 0)
    difat = [fat_first + k for k in range(nfat)] + [FREESECT] * (109 - nfat)
    header += struct.pack('<109I', *difat)
    return header + b''.join(sectors)


# ------------------------------------------------------- project protection
# MS-OVBA 2.4.3: the CMG, DPB and GC values are the protection state, the
# password and the visibility, each encrypted with a seed and the project ID.


def _encrypt(data, project_id, seed):
    key = sum(project_id.encode('latin-1')) & 0xFF
    venc, kenc = seed ^ 2, seed ^ key
    out = [seed, venc, kenc]
    plain1, enc1, enc2 = key, kenc, venc
    payload = bytes((seed & 6) // 2) + struct.pack('<I', len(data)) + bytes(data)
    for b in payload:
        e = b ^ ((enc2 + plain1) & 0xFF)
        out.append(e)
        enc2, enc1, plain1 = enc1, e, b
    return bytes(out).hex().upper()


def _decrypt(text):
    d = bytes.fromhex(text)
    seed, venc, kenc = d[0], d[1], d[2]
    plain1, enc1, enc2 = seed ^ kenc, kenc, venc
    out = bytearray()
    for e in d[3:]:
        b = e ^ ((enc2 + plain1) & 0xFF)
        out.append(b)
        enc2, enc1, plain1 = enc1, e, b
    skip = (seed & 6) // 2
    length, = struct.unpack_from('<I', out, skip)
    return bytes(out[skip + 4:skip + 4 + length])


def protection_lines(project_id, seeds=(13, 94, 193)):
    """Unprotected, no password, visible. The default seeds are the ones the
    Excel-tested example used; any seed is valid."""
    return [
        'CMG="%s"' % _encrypt(b'\0\0\0\0', project_id, seeds[0]),
        'DPB="%s"' % _encrypt(b'\0', project_id, seeds[1]),
        'GC="%s"' % _encrypt(b'\xff', project_id, seeds[2]),
    ]


# ------------------------------------------------------------ project model

WORKBOOK_BASE = '0{00020819-0000-0000-C000-000000000046}'
SHEET_BASE = '0{00020820-0000-0000-C000-000000000046}'
CLASS_BASE = '0{FCFB3D2A-A0FA-1068-A738-08002B3371B5}'
DOC_ATTRS = ['VB_GlobalNameSpace = False', 'VB_Creatable = False', 'VB_PredeclaredId = True',
             'VB_Exposed = True', 'VB_TemplateDerived = False', 'VB_Customizable = True']
CLASS_ATTRS = ['VB_GlobalNameSpace = False', 'VB_Creatable = False', 'VB_PredeclaredId = False',
               'VB_Exposed = False', 'VB_TemplateDerived = False', 'VB_Customizable = False']


def _rec(rid, data=b''):
    return struct.pack('<HI', rid, len(data)) + data


def _pair(rid, text, uid, codepage):
    return _rec(rid, text.encode(codepage)) + _rec(uid, text.encode('utf-16le'))


# The project information and reference records of the Excel-tested example,
# used for a workbook that has no project yet: Win32, LCID 0x409, code page
# 1252, project "VBAProject" version 1.0, and the one stdole reference.
STDOLE_LIBID = b'*\\G{00020430-0000-0000-C000-000000000046}#2.0#0#C:\\Windows\\System32\\stdole2.tlb#OLE Automation'
FRESH_INFO = (
    _rec(0x01, struct.pack('<I', 1)) + _rec(0x4A, struct.pack('<I', 0x2A))
    + _rec(0x02, struct.pack('<I', 0x409)) + _rec(0x14, struct.pack('<I', 0x409))
    + _rec(0x03, struct.pack('<H', 1252)) + _rec(0x04, b'VBAProject')
    + _rec(0x05) + _rec(0x40) + _rec(0x06) + _rec(0x3D)
    + _rec(0x07, struct.pack('<I', 0)) + _rec(0x08, struct.pack('<I', 0))
    + struct.pack('<HIIH', 0x09, 4, 1, 0) + _rec(0x0C) + _rec(0x3C))
FRESH_REFS = (_rec(0x16, b'stdole') + _rec(0x3E, 'stdole'.encode('utf-16le'))
              + _rec(0x0D, struct.pack('<I', len(STDOLE_LIBID)) + STDOLE_LIBID + b'\0' * 6))
FRESH_PROPS = ['Name="VBAProject"', 'HelpContextID="0"', 'VersionCompatible32="393222000"']
FRESH_HOST = ['&H00000001={3832D640-CF90-11CF-8E43-00A0C911005A};VBE;&H00000000']
REF_IDS = {0x16, 0x33, 0x2F, 0x0D, 0x0E}


class Module:
    def __init__(self, name, kind, source, extra=None):
        self.name, self.kind, self.source = name, kind, source
        self.extra = extra or {}

    def code_lines(self):
        lines = self.source.split(b'\r\n')
        if lines and lines[-1] == b'':
            lines.pop()
        i = 0
        while i < len(lines) and lines[i].startswith(b'Attribute VB_'):
            i += 1
        return len(lines) - i


class Project:
    def __init__(self):
        self.info, self.refs = FRESH_INFO, FRESH_REFS
        self.codepage = 1252
        self.project_id = None
        self.props, self.host = list(FRESH_PROPS), list(FRESH_HOST)
        self.modules = []
        self.compiled = False
        self.protection = None  # CMG, DPB and GC lines; derived from the ID when None
        self.unsupported = []  # what build cannot carry: UserForms, other storages, protection

    def find(self, name):
        for m in self.modules:
            if m.name.lower() == name.lower():
                return m
        return None


def _split_records(d, start, until=0x10):
    """Records from `start` through the first one whose id is `until`. Every
    dir record is id, size, data, except PROJECTVERSION (0x09), whose size
    field says 4 and is followed by 6 bytes."""
    i = start
    out = []
    while i + 6 <= len(d):
        rid, size = struct.unpack_from('<HI', d, i)
        n = 6 + (6 if rid == 0x09 else size)
        out.append((rid, d[i + 6:i + n], i, i + n))
        i += n
        if rid in (until, 0x10):
            break
    return out, i


def parse_project(blob):
    streams = read_cfb(blob)
    proj = Project()
    for path in streams:
        if path[0] not in ('VBA', 'PROJECT', 'PROJECTwm') and len(path) == 1:
            proj.unsupported.append('the storage %s' % path[0])
    vba_project = streams.get(('VBA', '_VBA_PROJECT'))
    proj.compiled = bool(vba_project and vba_project[2:4] != b'\xff\xff')
    d = decompress(streams[('VBA', 'dir')])
    recs, _ = _split_records(d, 0)
    first_ref = next((r[2] for r in recs if r[0] in REF_IDS), None)
    modules_at = next(r[2] for r in recs if r[0] == 0x0F)
    proj.info = d[:first_ref if first_ref is not None else modules_at]
    proj.refs = d[first_ref:modules_at] if first_ref is not None else b''
    for rid, body, _, _ in recs:
        if rid == 0x03:
            proj.codepage, = struct.unpack('<H', body)
    cp = 'cp%d' % proj.codepage

    text = streams[('PROJECT',)].decode(cp)
    kinds, props, host, protection, section = {}, [], [], [], None
    for line in text.split('\r\n'):
        if line.startswith('['):
            section = line
            continue
        if not line:
            continue
        if section is None:
            key, _, value = line.partition('=')
            if key == 'ID':
                proj.project_id = value.strip('"')
            elif key == 'Document':
                kinds[value.split('/')[0].lower()] = 'document'
            elif key == 'Module':
                kinds[value.lower()] = 'standard'
            elif key == 'Class':
                kinds[value.lower()] = 'class'
            elif key == 'BaseClass':
                kinds[value.lower()] = 'form'
                proj.unsupported.append('the UserForm %s' % value)
            elif key == 'Package':
                pass
            elif key in ('CMG', 'DPB', 'GC'):
                expect, why = {'CMG': (b'\0\0\0\0', 'is protected'), 'DPB': (b'\0', 'has a password'),
                               'GC': (b'\xff', 'is locked for viewing')}[key]
                if _decrypt(value.strip('"')) != expect:
                    proj.unsupported.append('protection (the project %s)' % why)
                protection.append(line)
            else:
                props.append(line)
        elif section == '[Host Extender Info]':
            host.append(line)
    proj.props, proj.host = props or list(FRESH_PROPS), host or list(FRESH_HOST)
    if len(protection) == 3:
        proj.protection = protection

    i = modules_at
    while True:
        rid, size = struct.unpack_from('<HI', d, i)
        if rid == 0x10:
            break
        if rid in (0x0F, 0x13):
            i += 6 + size
            continue
        recs, i = _split_records(d, i, until=0x2B)
        fields = {}
        for r, body, _, _ in recs:
            fields.setdefault(r, body)
        name = fields[0x19].decode(cp)
        stream_name = fields.get(0x32, b'').decode('utf-16le') or fields[0x1A].decode(cp)
        offset, = struct.unpack('<I', fields[0x31])
        raw = streams[('VBA', stream_name)]
        source = decompress(raw[offset:])
        kind = kinds.get(name.lower())
        if kind is None:
            kind = 'standard' if 0x21 in fields else 'class'
        extra = {k: fields[k] for k in (0x1C, 0x48, 0x1E, 0x25, 0x28) if k in fields}
        proj.modules.append(Module(name, kind, source, extra))
    return proj


def serialize_project(proj):
    cp = 'cp%d' % proj.codepage
    order = ([m for m in proj.modules if m.kind == 'document'] + [m for m in proj.modules if m.kind == 'standard']
             + [m for m in proj.modules if m.kind == 'class'])
    d = bytearray(proj.info + proj.refs)
    d += _rec(0x0F, struct.pack('<H', len(order))) + _rec(0x13, struct.pack('<H', 0xFFFF))
    for m in order:
        x = m.extra
        d += _pair(0x19, m.name, 0x47, cp)
        d += _pair(0x1A, m.name, 0x32, cp)
        d += _rec(0x1C, x.get(0x1C, b'')) + _rec(0x48, x.get(0x48, b''))
        d += _rec(0x31, struct.pack('<I', 0))
        d += _rec(0x1E, x.get(0x1E, struct.pack('<I', 0)))
        d += _rec(0x2C, struct.pack('<H', 0xFFFF))
        d += _rec(0x21 if m.kind == 'standard' else 0x22)
        if 0x25 in x:
            d += _rec(0x25)
        if 0x28 in x:
            d += _rec(0x28)
        d += _rec(0x2B)
    d += _rec(0x10)

    lines = ['ID="%s"' % proj.project_id]
    for m in order:
        lines.append({'document': 'Document=%s/&H00000000', 'standard': 'Module=%s',
                      'class': 'Class=%s'}[m.kind] % m.name)
    lines += proj.props + (proj.protection or protection_lines(proj.project_id))
    lines += ['', '[Host Extender Info]'] + proj.host
    lines += ['', '[Workspace]'] + ['%s=0, 0, 0, 0, C' % m.name for m in order]
    project_text = ('\r\n'.join(lines) + '\r\n').encode(cp)

    wm = b''.join(m.name.encode(cp) + b'\0' + m.name.encode('utf-16le') + b'\0\0' for m in order) + b'\0\0'
    items = [(('VBA',), None), (('VBA', 'dir'), compress(bytes(d))),
             (('VBA', '_VBA_PROJECT'), b'\xcc\x61\xff\xff\x00\x00\x00')]
    items += [(('VBA', m.name), compress(m.source)) for m in order]
    items += [(('PROJECT',), project_text), (('PROJECTwm',), wm)]
    return write_cfb(items)


# ------------------------------------------------------------ module files


def _attr_block(name, base, attrs):
    lines = ['Attribute VB_Name = "%s"' % name]
    if base:
        lines.append('Attribute VB_Base = "%s"' % base)
    lines += ['Attribute ' + a for a in attrs]
    return ('\r\n'.join(lines) + '\r\n').encode('ascii')


def read_module_file(path, codepage, workbook_code, sheet_codes):
    """(name, kind, stored source) for a .bas or .cls file."""
    ext = os.path.splitext(path)[1].lower()
    stem = os.path.splitext(os.path.basename(path))[0]
    if ext not in ('.bas', '.cls'):
        raise SystemExit('%s: module files are .bas or .cls (UserForms are not supported)' % path)
    with open(path, 'rb') as f:
        raw = f.read()
    cp = 'cp%d' % codepage
    if raw.startswith(b'\xef\xbb\xbf'):
        raw = raw[3:].decode('utf-8').encode(cp)
    elif any(b > 127 for b in raw):
        try:
            raw = raw.decode('utf-8').encode(cp)
        except UnicodeDecodeError:
            pass  # not UTF-8, so already in the project's code page
        except UnicodeEncodeError as e:
            raise SystemExit('%s: %s has no code page %d form' % (path, e.object[e.start:e.end], codepage))
    src = raw.replace(b'\r\n', b'\n').replace(b'\r', b'\n').replace(b'\n', b'\r\n')
    if src.startswith(b'VERSION 1.0 CLASS\r\n'):
        end = src.find(b'\r\nEND\r\n')
        if end < 0:
            raise SystemExit('%s: VERSION header without END' % path)
        src = src[end + 7:]
    if src and not src.endswith(b'\r\n'):
        src += b'\r\n'
    lines = src.split(b'\r\n')
    n = 0
    attrs = {}
    while n < len(lines) and lines[n].startswith(b'Attribute VB_'):
        m = re.match(rb'Attribute (VB_\w+) = (.*)$', lines[n])
        if m:
            attrs[m.group(1).decode()] = m.group(2).decode(cp)
        n += 1
    name = attrs.get('VB_Name', '"%s"' % stem).strip('"')
    if 'VB_Name' in attrs and name.lower() != stem.lower():
        raise SystemExit('%s declares VB_Name "%s"; name the file after its module' % (path, name))
    if not re.match(r'^[A-Za-z][A-Za-z0-9_]{0,30}$', name):
        raise SystemExit('%s: "%s" is not a valid module name' % (path, name))
    is_book = workbook_code and name.lower() == workbook_code.lower()
    is_sheet = name.lower() in {s.lower() for s in sheet_codes}
    if ext == '.bas':
        if 'VB_Base' in attrs:
            raise SystemExit('%s: a .bas file is a standard module and has no VB_Base' % path)
        if is_book or is_sheet:
            raise SystemExit('%s: %s is a document module; give it as a .cls file' % (path, name))
        head = b'' if 'VB_Name' in attrs else _attr_block(name, None, [])
        return name, 'standard', head + src
    base = attrs.get('VB_Base', '').strip('"')
    if base:
        if base.upper() == CLASS_BASE.upper():
            kind = 'class'
        elif base.upper() == WORKBOOK_BASE.upper() and is_book:
            kind = 'document'
        elif base.upper() == SHEET_BASE.upper() and is_sheet:
            kind = 'document'
        else:
            raise SystemExit('%s: VB_Base %s does not match a class or a document of this workbook' % (path, base))
        return name, kind, src
    known = {'VB_Name', 'VB_GlobalNameSpace', 'VB_Creatable', 'VB_PredeclaredId', 'VB_Exposed',
             'VB_TemplateDerived', 'VB_Customizable'}
    if set(attrs) - known:
        raise SystemExit('%s: header attributes %s without VB_Base' % (path, sorted(set(attrs) - known)))
    body = b'\r\n'.join(lines[n:])
    if is_book:
        return name, 'document', _attr_block(name, WORKBOOK_BASE, DOC_ATTRS) + body
    if is_sheet:
        return name, 'document', _attr_block(name, SHEET_BASE, DOC_ATTRS) + body
    return name, 'class', _attr_block(name, CLASS_BASE, CLASS_ATTRS) + body


# ------------------------------------------------------------ the package

REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
VBA_REL = 'http://schemas.microsoft.com/office/2006/relationships/vbaProject'
VBA_CT = 'application/vnd.ms-office.vbaProject'
MAIN_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'
MAIN_XLSM = 'application/vnd.ms-excel.sheet.macroEnabled.main+xml'


def _attr(tag, name):
    m = re.search(r'\s%s\s*=\s*(["\'])(.*?)\1' % re.escape(name), tag)
    return m.group(2) if m else None


def _rels(text):
    return [{k: _attr(t, k) for k in ('Id', 'Type', 'Target')}
            for t in re.findall(r'<(?:\w+:)?Relationship\b[^>]*>', text)]


def _resolve(base_dir, target):
    if target.startswith('/'):
        return target[1:]
    parts = (base_dir + '/' + target).split('/') if base_dir else target.split('/')
    out = []
    for p in parts:
        if p == '..':
            out.pop()
        elif p and p != '.':
            out.append(p)
    return '/'.join(out)


def _rels_path(part):
    d, f = os.path.split(part)
    return (d + '/' if d else '') + '_rels/' + f + '.rels'


def _set_code_name(xml, element, code):
    """Give the first <element> start tag a codeName, inserting the element
    when absent. Returns (xml, whether it changed)."""
    m = re.search(r'<((?:\w+:)?)%s\b([^>]*?)(/?)>' % element, xml)
    if m:
        if _attr(m.group(0), 'codeName') is not None:
            return xml, False
        tag = '<%s%s codeName="%s"%s%s>' % (m.group(1), element, code, m.group(2), m.group(3))
        return xml[:m.start()] + tag + xml[m.end():], True
    return None, True


class Package:
    def __init__(self, path):
        with open(path, 'rb') as f:
            self.raw = f.read()
        self.zip = zipfile.ZipFile(io.BytesIO(self.raw))
        self.names = self.zip.namelist()
        self.changed = {}
        root_rels = _rels(self.read('_rels/.rels'))
        main = [r for r in root_rels if r['Type'].endswith('/officeDocument')]
        if not main:
            raise SystemExit('%s has no workbook part' % path)
        self.main = _resolve('', main[0]['Target'])
        self.main_dir = os.path.dirname(self.main)
        self.main_rels = _rels_path(self.main)
        self.vba_part = None
        for r in _rels(self.read(self.main_rels)):
            if r['Type'] == VBA_REL:
                self.vba_part = _resolve(self.main_dir, r['Target'])
        wb = self.read(self.main)
        m = re.search(r'<(?:\w+:)?workbookPr\b[^>]*>', wb)
        self.workbook_code = _attr(m.group(0), 'codeName') if m else None
        rels = {r['Id']: r for r in _rels(self.read(self.main_rels))}
        self.sheets = []
        for tag in re.findall(r'<(?:\w+:)?sheet\b[^>]*>', wb):
            rid = next((v for k, v in re.findall(r'\s([\w:]+)\s*=\s*"([^"]*)"', tag) if k.endswith(':id')), None)
            rel = rels.get(rid)
            if not rel:
                continue
            part = _resolve(self.main_dir, rel['Target'])
            if not rel['Type'].endswith('/worksheet'):
                print('note: %s is not a worksheet, so it gets no document module' % _attr(tag, 'name'), file=sys.stderr)
                continue
            sm = re.search(r'<(?:\w+:)?sheetPr\b[^>]*>', self.read(part))
            self.sheets.append({'name': _attr(tag, 'name'), 'part': part,
                                'code': _attr(sm.group(0), 'codeName') if sm else None})

    def read(self, name):
        if name in self.changed:
            return self.changed[name].decode('utf-8')
        return self.zip.read(name).decode('utf-8')

    def vba_blob(self):
        return self.zip.read(self.vba_part) if self.vba_part and self.vba_part in self.names else None

    def assign_code_names(self):
        """Give the workbook and each worksheet a codeName, as Excel does when
        it first saves a project, so each document module has its object."""
        if not self.workbook_code:
            wb = self.read(self.main)
            new, _ = _set_code_name(wb, 'workbookPr', 'ThisWorkbook')
            if new is None:
                m = (re.search(r'<(?:\w+:)?fileSharing\b[^>]*>(?:.*?</(?:\w+:)?fileSharing>)?', wb, re.S)
                     or re.search(r'<(?:\w+:)?fileVersion\b[^>]*>', wb) or re.search(r'<(?:\w+:)?workbook\b[^>]*>', wb))
                prefix = re.match(r'<(\w+:)?', m.group(0)).group(1) or ''
                new = wb[:m.end()] + '<%sworkbookPr codeName="ThisWorkbook"/>' % prefix + wb[m.end():]
            self.changed[self.main] = new.encode('utf-8')
            self.workbook_code = 'ThisWorkbook'
        taken = {s['code'].lower() for s in self.sheets if s['code']} | {self.workbook_code.lower()}
        n = 0
        for sheet in self.sheets:
            if sheet['code']:
                continue
            n += 1
            while 'sheet%d' % n in taken:
                n += 1
            code = 'Sheet%d' % n
            taken.add(code.lower())
            xml = self.read(sheet['part'])
            new, _ = _set_code_name(xml, 'sheetPr', code)
            if new is None:
                m = re.search(r'<((?:\w+:)?)worksheet\b[^>]*>', xml)
                new = xml[:m.end()] + '<%ssheetPr codeName="%s"/>' % (m.group(1), code) + xml[m.end():]
            self.changed[sheet['part']] = new.encode('utf-8')
            sheet['code'] = code

    def make_macro_enabled(self):
        ct = self.read('[Content_Types].xml')
        main = '/' + self.main
        m = re.search(r'<Override\b[^>]*PartName="%s"[^>]*>' % re.escape(main), ct)
        if not m:
            raise SystemExit('[Content_Types].xml has no entry for %s' % main)
        kind = _attr(m.group(0), 'ContentType')
        if kind not in (MAIN_XLSX, MAIN_XLSM):
            raise SystemExit('the workbook is %s; only .xlsx and .xlsm are supported' % kind)
        ct = ct[:m.start()] + m.group(0).replace(kind, MAIN_XLSM) + ct[m.end():]
        if self.vba_part is None:
            self.vba_part = (self.main_dir + '/' if self.main_dir else '') + 'vbaProject.bin'
            text = self.read(self.main_rels)
            used = {r['Id'] for r in _rels(text)}
            n = 1
            while 'rId%d' % n in used:
                n += 1
            rel = '<Relationship Id="rId%d" Type="%s" Target="vbaProject.bin"/>' % (n, VBA_REL)
            text = re.sub(r'(</(?:\w+:)?Relationships>)', lambda mm: rel + mm.group(1), text, count=1)
            self.changed[self.main_rels] = text.encode('utf-8')
        default = re.search(r'<Default\b[^>]*Extension="bin"[^>]*>', ct, re.I)
        override = re.search(r'<Override\b[^>]*PartName="/%s"[^>]*>' % re.escape(self.vba_part), ct)
        if override:
            if _attr(override.group(0), 'ContentType') != VBA_CT:
                raise SystemExit('[Content_Types].xml gives /%s another type' % self.vba_part)
        elif default is None:
            defaults = list(re.finditer(r'<Default\b[^>]*>', ct))
            at = defaults[-1].end() if defaults else re.search(r'<Types\b[^>]*>', ct).end()
            ct = ct[:at] + '<Default Extension="bin" ContentType="%s"/>' % VBA_CT + ct[at:]
        elif _attr(default.group(0), 'ContentType') != VBA_CT:
            at = ct.rfind('</Types>')
            ct = ct[:at] + '<Override PartName="/%s" ContentType="%s"/>' % (self.vba_part, VBA_CT) + ct[at:]
        self.changed['[Content_Types].xml'] = ct.encode('utf-8')

    def write(self, out_path, vba_bin):
        self.changed[self.vba_part] = vba_bin
        tmp = out_path + '.tmp'
        with zipfile.ZipFile(tmp, 'w') as z:
            for info in self.zip.infolist():
                data = self.changed.get(info.filename)
                if data is None:
                    data = self.zip.read(info)
                zi = zipfile.ZipInfo(info.filename, info.date_time)
                zi.compress_type = info.compress_type
                zi.external_attr = info.external_attr
                zi.create_system = info.create_system
                z.writestr(zi, data)
            if self.vba_part not in self.names:
                zi = zipfile.ZipInfo(self.vba_part, self.zip.infolist()[0].date_time)
                zi.compress_type = zipfile.ZIP_DEFLATED
                z.writestr(zi, vba_bin)
        os.replace(tmp, out_path)


# --------------------------------------------------------------- commands


def load_project(path):
    pkg = Package(path)
    blob = pkg.vba_blob()
    if blob is None:
        raise SystemExit('%s has no VBA project' % path)
    return pkg, parse_project(blob)


def cmd_list(args):
    _, proj = load_project(args.workbook)
    print('project %s, code page %d, %s' % (proj.project_id, proj.codepage,
                                            'compiled by Office' if proj.compiled else 'source only'))
    width = max([len(m.name) for m in proj.modules] + [6])
    print('%-*s  %-8s  %s' % (width, 'module', 'type', 'lines'))
    for m in proj.modules:
        print('%-*s  %-8s  %d' % (width, m.name, m.kind, m.code_lines()))


def cmd_extract(args):
    _, proj = load_project(args.workbook)
    os.makedirs(args.dir, exist_ok=True)
    for m in proj.modules:
        ext = {'standard': '.bas', 'form': '.frm'}.get(m.kind, '.cls')
        path = os.path.join(args.dir, m.name + ext)
        with open(path, 'wb') as f:
            f.write(m.source)
        print(path)


def module_files(specs):
    files = []
    for spec in specs:
        if os.path.isdir(spec):
            files += sorted(os.path.join(spec, f) for f in os.listdir(spec)
                            if os.path.splitext(f)[1].lower() in ('.bas', '.cls', '.frm'))
        elif os.path.isfile(spec):
            files.append(spec)
        else:
            raise SystemExit('%s: no such file or directory' % spec)
    return files


def cmd_build(args):
    if not args.output.lower().endswith('.xlsm'):
        raise SystemExit('the output must be an .xlsm file, or Excel refuses to open it')
    pkg = Package(args.input)
    sig = _rels_path(pkg.vba_part) if pkg.vba_part else None
    if sig and sig in pkg.names:
        raise SystemExit('the project is signed; rebuilding it would break the signature')
    blob = pkg.vba_blob()
    proj = parse_project(blob) if blob is not None else Project()
    if proj.unsupported:
        raise SystemExit('cannot rebuild this project: it has %s' % ', '.join(proj.unsupported))
    if proj.project_id is None:
        digest = hashlib.sha256(pkg.raw).hexdigest()
        proj.project_id = '{%s}' % str(uuid.uuid5(uuid.NAMESPACE_URL, 'vba-project:' + digest)).upper()
    pkg.assign_code_names()
    pkg.make_macro_enabled()
    if not proj.find(pkg.workbook_code):
        proj.modules.insert(0, Module(pkg.workbook_code, 'document',
                                      _attr_block(pkg.workbook_code, WORKBOOK_BASE, DOC_ATTRS)))
    for sheet in pkg.sheets:
        if not proj.find(sheet['code']):
            proj.modules.append(Module(sheet['code'], 'document',
                                       _attr_block(sheet['code'], SHEET_BASE, DOC_ATTRS)))
    seen = set()
    for path in module_files(args.module):
        name, kind, source = read_module_file(path, proj.codepage, pkg.workbook_code,
                                              [s['code'] for s in pkg.sheets])
        if name.lower() in seen:
            raise SystemExit('module %s is given twice' % name)
        seen.add(name.lower())
        old = proj.find(name)
        if old is None:
            proj.modules.append(Module(name, kind, source))
        elif old.kind != kind:
            raise SystemExit('%s: the project has %s as a %s module, not %s' % (path, name, old.kind, kind))
        else:
            old.source = source
    codes = {pkg.workbook_code.lower()} | {s['code'].lower() for s in pkg.sheets}
    for m in proj.modules:
        if m.kind == 'document' and m.name.lower() not in codes:
            print('note: document module %s matches no sheet in the workbook' % m.name, file=sys.stderr)
    pkg.write(args.output, serialize_project(proj))
    for m in proj.modules:
        print('%-10s %s' % (m.kind, m.name))


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    sub = p.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('list', help='modules with their type and line count')
    s.add_argument('workbook')
    s.set_defaults(fn=cmd_list)
    s = sub.add_parser('extract', help='write each module source to a file')
    s.add_argument('workbook')
    s.add_argument('dir')
    s.set_defaults(fn=cmd_extract)
    s = sub.add_parser('build', help='write a source-only project into a copy of a workbook')
    s.add_argument('input')
    s.add_argument('output')
    s.add_argument('--module', action='append', default=[], metavar='FILE_OR_DIR',
                   help='a .bas or .cls file, or a directory of them; repeatable')
    s.set_defaults(fn=cmd_build)
    args = p.parse_args(argv)
    args.fn(args)


if __name__ == '__main__':
    main()
