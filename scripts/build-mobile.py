#!/usr/bin/env python3
"""Builds mobile/www/index.html, the web part of the Android app (what Capacitor copies into the shell).

It is dist/index.html (one file, everything inlined: it works with no network) with one addition: a Content-Security-Policy
meta tag. The policy lists the sha256 of every inline script, so only the app's own code runs, and it allows no network at all
(connect-src 'none'): the Android app is offline-first, its data stays on the phone until the phone has its own sign-in.
Usage: python3 scripts/build-mobile.py
"""
import base64, hashlib, pathlib, re, subprocess, sys

root = pathlib.Path(__file__).resolve().parent.parent


def script_hashes(html):
    """sha256 (CSP format) of every inline <script> that runs. Data blocks (type="text/plain") are not executed and need no hash."""
    out = []
    for m in re.finditer(r'<script(?P<attrs>[^>]*)>(?P<body>[\s\S]*?)</script>', html):
        attrs = m.group('attrs')
        if 'src=' in attrs:
            continue
        t = re.search(r'type="([^"]*)"', attrs)
        if t and t.group(1) not in ('', 'text/javascript', 'module'):
            continue
        out.append("'sha256-" + base64.b64encode(hashlib.sha256(m.group('body').encode('utf-8')).digest()).decode() + "'")
    return out


def policy(hashes):
    return '; '.join([
        "default-src 'self'",
        "script-src 'self' " + ' '.join(hashes),
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'none'",
        "worker-src blob:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
    ])


def build(html):
    hashes = script_hashes(html)
    assert hashes, 'no inline script found: is this the single-file build?'
    assert 'Content-Security-Policy' not in html, 'the page already has a CSP'
    meta = '<meta http-equiv="Content-Security-Policy" content="%s">' % policy(hashes)
    head, n = re.subn(r'(<meta charset="utf-8">\n?)', lambda m: m.group(1) + meta + '\n', html, count=1)
    assert n == 1, 'charset meta not found'
    return head


if __name__ == '__main__':
    subprocess.run([sys.executable, str(root / 'scripts' / 'build.py')], check=True, stdout=subprocess.DEVNULL)
    out = root / 'mobile' / 'www'
    out.mkdir(parents=True, exist_ok=True)
    page = build((root / 'dist' / 'index.html').read_text(encoding='utf-8'))
    (out / 'index.html').write_text(page, encoding='utf-8')
    print('mobile/www/index.html: %d bytes, %d inline scripts allowed by hash' % (len(page), len(script_hashes(page))))
