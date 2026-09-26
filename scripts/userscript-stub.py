#!/usr/bin/env python3
"""Stamp a userscript body and emit its stub and its bookmarklet twin.

A userscript installed on the phone is a file nobody can edit there, so every
script here is a STUB: a header naming what it matches and one @require pulling
the body from raw.githubusercontent. The question is what that @require pins to, and the
answer changed on 2026-09-06.

A COMMIT PIN meant every edit was a reinstall, because a new commit is a new
file to install, and the install is the one step on the device. So the stub
pins a BRANCH and never changes again: push, and the next page load runs the new
body. See the note on REQUIRE below for why the userscript reads raw and the
bookmarklet reads GitHub Pages.

What the commit pin gave for free was knowing which copy ran. The stamp buys it
back: `#BUILD#` in the body is replaced here by a short hash of the body itself,
and the launcher shows it. tools/test/userscript-stubs.test.mjs holds the stamp
to the file it was computed from, so a body edited without re-stamping fails
rather than reporting a build id that was true yesterday.

    python3 scripts/userscript-stub.py launcher --match '*://*/*' \\
        --name 'wt launcher' --description '...'

The body must define window.wt<Lib> and do nothing on load: the stub calls it,
so one body serves the userscript (extension context, exempt from the page's
script-src) and the bookmarklet (a script tag the page's policy may refuse).
"""
import argparse
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import sys

# TWO SOURCES FOR ONE FILE, and the split is forced rather than chosen.
#
# The userscript's @require goes to raw.githubusercontent, whose cache is five
# minutes and follows any ref.
#
# The bookmarklet cannot follow it there. It loads the body through a script
# tag, and raw serves text/plain with nosniff, which a browser refuses to
# execute. GitHub Pages serves the same file as JavaScript, with a ten-minute
# cache and no purge step, but only as main has it: a stub pinned to a branch
# gets a bookmarklet that still runs main. jsDelivr was the host here until
# 2026-09-26; it cached a branch for about twelve hours and rate-limited purges.
REQUIRE = 'https://raw.githubusercontent.com/mehrlander/web-tools/{ref}/userscripts/lib/{lib}.js'
PAGES = 'https://mehrlander.github.io/web-tools/userscripts/lib/{lib}.js'
ROOT = pathlib.Path(__file__).resolve().parent.parent
STAMP = re.compile(r"^const BUILD = '([^']*)';$", re.M)
BUILT = re.compile(r"^const BUILT = '([^']*)';$", re.M)
REF = re.compile(r"^const REF = '([^']*)';$", re.M)
MANIFEST = 'userscripts/builds.json'


def current_branch() -> str:
    return subprocess.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd=ROOT,
                          capture_output=True, text=True, check=True).stdout.strip()


def fn_name(lib: str) -> str:
    return 'wt' + ''.join(p.capitalize() for p in lib.replace('_', '-').split('-'))


def stamp_of(text: str) -> str:
    """The hash is taken with all three stamp lines neutralised, so stamping is
    idempotent: re-running on an unchanged body writes back the same id, and the
    build time is not itself part of what the build id covers."""
    for pat, key in ((STAMP, 'BUILD'), (BUILT, 'BUILT'), (REF, 'REF')):
        text = pat.sub(f"const {key} = '#{key}#';", text)
    return hashlib.sha256(text.encode()).hexdigest()[:7]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('lib', help='basename under userscripts/lib/, without .js')
    ap.add_argument('--name', required=True, help='@name, shown in the install sheet')
    ap.add_argument('--description', required=True, help='@description')
    ap.add_argument('--match', action='append', required=True,
                    help='@match pattern; repeatable')
    ap.add_argument('--run-at', default='document-end')
    ap.add_argument('--ref', help='branch to pin (default: the current one)')
    a = ap.parse_args()

    body = ROOT / 'userscripts' / 'lib' / f'{a.lib}.js'
    if not body.exists():
        print(f'no such body: {body.relative_to(ROOT)}', file=sys.stderr)
        return 1

    text = body.read_text(encoding='utf-8')
    fn = fn_name(a.lib)
    if f'window.{fn}' not in text:
        print(f'{body.relative_to(ROOT)} does not define window.{fn}', file=sys.stderr)
        return 1
    if not STAMP.search(text):
        print(f"{body.relative_to(ROOT)} has no \"const BUILD = '...';\" line to stamp",
              file=sys.stderr)
        return 1

    ref = a.ref or current_branch()
    build = stamp_of(text)
    was = STAMP.search(text).group(1)
    # The build time only moves when the build id does. Re-running the generator
    # on an unchanged body must not make it look freshly published.
    built = (BUILT.search(text).group(1) if was == build and BUILT.search(text)
             else datetime.datetime.now(datetime.timezone.utc)
             .replace(microsecond=0).isoformat().replace('+00:00', 'Z'))
    stamped = text
    for pat, key, val in ((STAMP, 'BUILD', build), (BUILT, 'BUILT', built), (REF, 'REF', ref)):
        stamped = pat.sub(f"const {key} = '{val}';", stamped, count=1)
    if stamped != text:
        body.write_text(stamped, encoding='utf-8', newline='\n')

    # The manifest the launcher reads to answer "am I current?". One row per
    # body, so adding a script does not disturb the others.
    mf = ROOT / MANIFEST
    rows = json.loads(mf.read_text(encoding='utf-8')) if mf.exists() else {}
    rows[a.lib] = {'build': build, 'built': built}
    mf.write_text(json.dumps(dict(sorted(rows.items())), indent=2) + '\n', encoding='utf-8', newline='\n')
    req = REQUIRE.format(ref=ref, lib=a.lib)
    url = PAGES.format(lib=a.lib)
    matches = '\n'.join(f'// @match       {m}' for m in a.match)

    (ROOT / 'userscripts' / f'{a.lib}.user.js').write_text(f"""\
// ==UserScript==
// @name        {a.name}
// @description {a.description}
{matches}
// @version     {build}
// @require     {req}?v={build}
// @grant       GM.xmlHttpRequest
// @grant       GM.getValue
// @grant       GM.setValue
// @grant       GM_xmlhttpRequest
// @grant       GM_getValue
// @grant       GM_setValue
// @run-at      {a.run_at}
// ==/UserScript==
// Generated by scripts/userscript-stub.py. Pinned to a branch, not a commit,
// and auto-updates from raw so editing the body is a push and never a reinstall.
(async () => {{
  const getVal = (typeof GM !== 'undefined' && GM.getValue) ? GM.getValue.bind(GM)
    : (typeof GM_getValue !== 'undefined' ? k => Promise.resolve(GM_getValue(k)) : () => Promise.resolve(null));
  const setVal = (typeof GM !== 'undefined' && GM.setValue) ? GM.setValue.bind(GM)
    : (typeof GM_setValue !== 'undefined' ? (k, v) => Promise.resolve(GM_setValue(k, v)) : () => Promise.resolve());
  const xhr = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest.bind(GM)
    : (typeof GM_xmlhttpRequest !== 'undefined' ? GM_xmlhttpRequest : null);

  try {{
    const cached = await getVal('wt_{a.lib}_code');
    if (cached && cached.includes('window.{fn}')) {{
      (new Function(cached))();
    }}
  }} catch (err) {{
    console.warn('[wt {a.lib}] dynamic evaluation failed, clearing cache:', err);
    try {{ await setVal('wt_{a.lib}_code', ''); }} catch {{}}
  }}

  if (typeof window.{fn} === 'function') {{
    window.{fn}();
  }}

  if (xhr) {{
    try {{
      const now = Date.now();
      const lastCheck = Number(await getVal('wt_{a.lib}_last_check') || 0);
      if (now - lastCheck > 5 * 60 * 1000) {{
        await setVal('wt_{a.lib}_last_check', now);
        xhr({{
          method: 'GET',
          url: 'https://raw.githubusercontent.com/mehrlander/web-tools/{ref}/userscripts/builds.json?_=' + now,
          onload: async res => {{
            try {{
              if (res.status < 200 || res.status >= 300) return;
              const data = JSON.parse(res.responseText);
              const latestBuild = data?.['{a.lib}']?.build;
              const activeBuild = await getVal('wt_{a.lib}_build') || '{build}';
              if (latestBuild && latestBuild !== activeBuild) {{
                xhr({{
                  method: 'GET',
                  url: 'https://raw.githubusercontent.com/mehrlander/web-tools/{ref}/userscripts/lib/{a.lib}.js?_=' + now,
                  onload: async cRes => {{
                    if (cRes.status === 200 && cRes.responseText.includes('window.{fn}')) {{
                      await setVal('wt_{a.lib}_code', cRes.responseText);
                      await setVal('wt_{a.lib}_build', latestBuild);
                    }}
                  }}
                }});
              }}
            }} catch {{}}
          }}
        }});
      }}
    }} catch {{}}
  }}
}})();
""", encoding='utf-8', newline='\n')

    (ROOT / 'bookmarklets' / f'{a.lib}.js').write_text(
        f"javascript:(s=>{{s.src='{url}';s.onload=()=>{fn}();"
        f"document.body.appendChild(s)}})(document.createElement('script'))\n",
        encoding='utf-8', newline='\n')

    print(f'{a.lib} stamped {build} at {built}, pinned to {ref}')
    print(f'  userscripts/{a.lib}.user.js')
    print(f'  bookmarklets/{a.lib}.js')
    print(f'  {MANIFEST}')
    print(f'  the userscript reads raw at {ref} (max-age 300)')
    print(f'  the bookmarklet reads GitHub Pages, which serves main (max-age 600)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
