#!/usr/bin/env python3
"""Passage embeddings beside the shingle scan: which Markdown files restate each other.

The Themes tab's shingle graph (scripts/duplicated-claims.py -> docs/themes.csv)
sees only copied wording. This pass embeds each prose passage and records, for
every ordered pair of files, each passage's best match in the other file when
the cosine clears FLOOR. Scores nominate passages for reading. They do not say
two passages agree: the model scores opposing instructions near 1.0.

Ported 2026-09-29 from mehrlander/home's
projects/text/runs/2026-09-28-document-overlap/overlap.py, the experiment that
measured this corpus first (its README carries the findings and limits). The
port keeps its segmentation and scoring and drops its viewer payload: what is
committed here is two small tables of source offsets, and the Map reads the
passage text from the files themselves.

    data/doc-overlap/docs.csv     one row per file the scan read
    data/doc-overlap/matches.csv  one row per passage and other file, cosine >= FLOOR

Offsets are UTF-16 code units, the unit a JavaScript string slices by, so a
file with an emoji does not shift every passage after it. `hash` is the first
12 hex digits of sha256 over the passage text, and `sha` the same over the
whole file: a reader that finds a file's hash changed knows its offsets are
stale without running the model.

Not hook-owned. It needs Python 3.12+, numpy, model2vec and a one-time model
download, none of which the commit hook or CI has, so it runs by hand:

    python3.12 -m venv /tmp/overlap && /tmp/overlap/bin/pip install \\
      model2vec==0.9.0 numpy==2.5.3 tokenizers==0.23.2 huggingface-hub==1.33.0
    /tmp/overlap/bin/python scripts/doc-overlap.py
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'doc-overlap'
MODEL = 'minishlab/potion-base-8M'
REVISION = 'bf8b056651a2c21b8d2565580b8569da283cab23'
FLOOR = 0.75
MAX_WORDS = 120


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj


def h12(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()[:12]


def clean(text):
    """The model's input; the source span stays exact and separate."""
    text = re.sub(r'!?\[([^\]]*)\]\([^)]*\)', r'\1', text)
    text = re.sub(r'https?://\S+', ' ', text)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'(?m)^\s*(?:[-*+]|\d+[.)])\s+', '', text)
    return ' '.join(re.sub(r'[`*_]', '', text).split())


def extract(raw, segment):
    """Paragraph and list-item passages, split at sentences to MAX_WORDS.

    The experiment's extract() at paragraph grain, unchanged in what it keeps."""
    masked = re.sub(r'\A---\s*\n.*?\n---[^\n]*', lambda m: re.sub(r'[^\n]', ' ', m[0]), raw, flags=re.S)
    masked = re.sub(r'(?ms)^\s*~~~[^\n]*\n.*?^\s*~~~[^\n]*', lambda m: re.sub(r'[^\n]', ' ', m[0]), masked)
    pending, out = [], []

    def flush():
        if not pending:
            return
        a, b = pending[0][0], pending[-1][1]
        tokens = list(re.finditer(r'\S+', raw[a:b]))
        for start in range(0, len(tokens), MAX_WORDS):
            chunk = tokens[start:start + MAX_WORDS]
            lo, hi = a + chunk[0].start(), a + chunk[-1].end()
            text = clean(raw[lo:hi])
            words = len(text.split())
            if words and re.search(r'[A-Za-z]', text):
                out.append(dict(start=lo, end=hi, input=text, words=words))
        pending.clear()

    cursor = 0
    for _, _, kind, unit_text in segment.units(masked, 0):
        # The segmenter's abbreviation guards shift its offsets; re-anchor each
        # unit against the untouched, length-preserving input, in order.
        a = masked.find(unit_text, cursor)
        if a < 0:
            raise ValueError(f'cannot anchor segment after character {cursor}')
        b = a + len(unit_text)
        cursor = b
        if kind.startswith('h'):
            flush()
        elif kind == 'sent':
            text = clean(raw[a:b])
            if not text or re.fullmatch(r'[\W_]+', text):
                continue
            boundary = pending and (re.search(r'\n\s*\n', raw[pending[-1][1]:a]) or
                                    re.match(r'\s*(?:[-*+]|\d+[.)])\s+', raw[a:b]) or
                                    len(clean(raw[pending[0][0]:b]).split()) > MAX_WORDS)
            if boundary:
                flush()
            pending.append((a, b))
        else:
            flush()
    flush()
    return out


def utf16(raw):
    """Code point index -> UTF-16 index, for every position in raw."""
    idx, n = [0], 0
    for ch in raw:
        n += 2 if ord(ch) > 0xFFFF else 1
        idx.append(n)
    return idx


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', type=Path, default=OUT)
    args = ap.parse_args()

    import numpy as np
    from model2vec import StaticModel
    from huggingface_hub import snapshot_download

    scan = module(ROOT / 'scripts' / 'duplicated-claims.py', 'shingle_scan')
    segment = module(ROOT / 'scripts' / 'annotate' / 'segment.py', 'segment')
    records = scan.record_paths(ROOT)
    tracked = subprocess.check_output(['git', '-C', str(ROOT), 'ls-files'], text=True).splitlines()
    paths = sorted(p for p in tracked if p.endswith('.md') and p not in records
                   and p not in scan.EXCLUDE_PATHS and not p.startswith(scan.EXCLUDE_PREFIXES))

    docs, passages = [], []
    for path in paths:
        raw = (ROOT / path).read_text(encoding='utf-8')
        u = utf16(raw)
        units = extract(raw, segment)
        words = scan.WORD.findall(scan.prose(raw).lower())
        shingles = {' '.join(words[i:i + scan.SHINGLE]) for i in range(len(words) - scan.SHINGLE + 1)}
        for p in units:
            passages.append(dict(doc=len(docs), start=u[p['start']], end=u[p['end']],
                                 line=raw.count('\n', 0, p['start']) + 1, words=p['words'],
                                 hash=h12(raw[p['start']:p['end']]), input=p['input']))
        docs.append(dict(path=path, sha=h12(raw), prose_words=sum(p['words'] for p in units),
                         passages=len(units), shingles=len(shingles)))

    model = StaticModel.from_pretrained(snapshot_download(
        MODEL, revision=REVISION, allow_patterns=['config.json', 'tokenizer.json', 'model.safetensors']))
    texts = list(dict.fromkeys(p['input'] for p in passages))
    vec = np.asarray(model.encode(texts, show_progress_bar=False), dtype=np.float32)
    vec /= np.maximum(np.linalg.norm(vec, axis=1, keepdims=True), 1e-12)
    at = {t: i for i, t in enumerate(texts)}
    emb = vec[[at[p['input']] for p in passages]]

    by_doc = [[] for _ in docs]
    for i, p in enumerate(passages):
        by_doc[p['doc']].append(i)

    rows = []
    for a, ia in enumerate(by_doc):
        for b, ib in enumerate(by_doc):
            if a == b or not ia or not ib:
                continue
            scores = emb[ia] @ emb[ib].T
            best = scores.argmax(axis=1)
            for k, j in enumerate(best):
                s = round(float(scores[k, j]), 3)
                if s < FLOOR:
                    continue
                src, tgt = passages[ia[k]], passages[ib[int(j)]]
                rows.append(dict(source=docs[a]['path'], start=src['start'], end=src['end'],
                                 line=src['line'], words=src['words'], hash=src['hash'],
                                 target=docs[b]['path'], target_start=tgt['start'],
                                 target_end=tgt['end'], target_line=tgt['line'],
                                 target_words=tgt['words'], target_hash=tgt['hash'],
                                 cosine=f'{s:.3f}'))
    rows.sort(key=lambda r: (r['source'], r['start'], r['target']))

    args.out.mkdir(parents=True, exist_ok=True)
    with (args.out / 'docs.csv').open('w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['path', 'sha', 'prose_words', 'passages', 'shingles'], lineterminator='\n')
        w.writeheader()
        w.writerows(docs)
    with (args.out / 'matches.csv').open('w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator='\n')
        w.writeheader()
        w.writerows(rows)
    print(f'doc-overlap: {len(docs)} files, {len(passages)} passages, '
          f'{len(rows)} matches at cosine >= {FLOOR}', file=sys.stderr)


if __name__ == '__main__':
    main()
