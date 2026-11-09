#!/usr/bin/env python3
"""Builds dist/finance_goal_1300k.html (single file) from index.html, keeping the same load order."""
import re, pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
def inline_css(m):
    return '<style>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '</style>'
def inline_js(m):
    return '<script>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '</script>'
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)
out = root / 'dist' / 'finance_goal_1300k.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print('built', out, len(html), 'bytes')
