#!/usr/bin/env python3
"""Static server for the browser tests that sends the same content-security-policy as the API sends for the page (tests/page-csp.txt).

A script, style or request the policy forbids is blocked by the browser, so the end-to-end scenario fails instead of passing on a policy it would break.
Usage: serve-csp.py <port> <directory>
"""
import http.server, pathlib, sys
port, root = int(sys.argv[1]), sys.argv[2]
csp = (pathlib.Path(root) / 'tests' / 'page-csp.txt').read_text().strip()

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=root, **k)
    def end_headers(self):
        if self.path.split('?')[0].endswith('.html'):
            self.send_header('Content-Security-Policy', csp)
        super().end_headers()
    def log_message(self, *a):
        pass

http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
