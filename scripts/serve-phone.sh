#!/usr/bin/env bash
# Serves the built single file to phones on the same Wi-Fi, with caching disabled
# (so the phone always gets the latest build). Short address: /finance.html (also "/").
# Usage: scripts/serve-phone.sh [port]
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8080}"
IP="$(hostname -I | awk '{print $1}')"
echo "http://$IP:$PORT/finance.html"
cd "$DIR/dist"
exec python3 -c '
import http.server,sys
ALIASES={"/finance.html":"/finance_goal_1300k.html","/":"/finance_goal_1300k.html"}
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self,path):
        clean=path.split("?",1)[0].split("#",1)[0]
        return super().translate_path(ALIASES.get(clean,path))
    def end_headers(self):
        self.send_header("Cache-Control","no-store, must-revalidate")
        super().end_headers()
http.server.ThreadingHTTPServer(("0.0.0.0",int(sys.argv[1])),H).serve_forever()
' "$PORT"
