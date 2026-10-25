"""Copy pages and screenshots into a blind folder under random codes.

Usage: python3 blind.py <pages-dir> <shots-dir> <blind-dir> <key-file>
Writes <blind-dir>/<subject>/<code>.html and <code>.{desktop,phone,full}.png,
and the code-to-page key to <key-file> (JSON), which judges never see.
"""
import json, os, random, re, shutil, sys


def scrub(html):
    """Drop comments, which can name a builder's arm (a model file, a rule)."""
    html = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    html = re.sub(r'/\*.*?\*/', '', html, flags=re.S)
    html = re.sub(r'(?m)^[ \t]*//.*\n', '', html)
    return re.sub(r'[\w-]+\.model\.md', 'the data file', html)

pages, shots, blind, keyfile = sys.argv[1:5]
rng = random.Random(20261025)
key = {}
names = sorted(f[:-5] for f in os.listdir(pages) if f.endswith('.html'))
by_subject = {}
for n in names:
    by_subject.setdefault(n.split('-')[0], []).append(n)
for subject, group in by_subject.items():
    codes = rng.sample([f'{c}{d}' for c in 'KMPRTVXZ' for d in '2345789'], len(group))
    os.makedirs(f'{blind}/{subject}', exist_ok=True)
    for code, n in zip(codes, group):
        key[f'{subject}/{code}'] = n
        open(f'{blind}/{subject}/{code}.html', 'w').write(scrub(open(f'{pages}/{n}.html').read()))
        for vp in ('desktop', 'phone', 'full'):
            src = f'{shots}/{n}.{vp}.png'
            if os.path.exists(src):
                shutil.copy(src, f'{blind}/{subject}/{code}.{vp}.png')
json.dump(key, open(keyfile, 'w'), indent=1, sort_keys=True)
print(json.dumps({s: sorted(k.split('/')[1] for k in key if k.startswith(s + '/')) for s in by_subject}))
