#!/usr/bin/env python3
"""Builds dist/finance_goal_1300k.html and dist/index.html (same single file, works from file://).

CSS files are inlined. The ES modules (entry src/app.js) are bundled by tools/module-graph.cjs
into one classic script in the order the browser would evaluate them.
"""
import re, pathlib, subprocess
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
def inline_css(m):
    return '<style>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '</style>'
def inline_module(m):
    js = subprocess.run(['node', 'tools/module-graph.cjs', 'bundle', m.group(1)], cwd=root,
                        check=True, capture_output=True, text=True).stdout
    return '<script>\n' + js.replace('</script', '<\\/script') + '</script>'
html, r = re.subn(r'<!-- file-redirect:[\s\S]*?<!-- /file-redirect -->\n?', '', html)
assert r == 1, 'file-redirect block not found in index.html'
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
html, n = re.subn(r'<script type="module" src="([^"]+)"></script>', inline_module, html)
assert n == 1, 'expected exactly one module entry in index.html'
out = root / 'dist' / 'finance_goal_1300k.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
# same file as index.html, so http://<pc-ip>:8080/ (no file name) also opens the current build
(out.parent / 'index.html').write_text(html, encoding='utf-8')
print('built', out, '(+ dist/index.html)', len(html), 'bytes')
