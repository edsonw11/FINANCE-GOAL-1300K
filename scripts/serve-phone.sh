#!/usr/bin/env bash
# Serves the built single file to phones on the same Wi-Fi, with caching disabled
# (so the phone always gets the latest build). Usage: scripts/serve-phone.sh [port]
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8080}"
IP="$(hostname -I | awk '{print $1}')"
echo "http://$IP:$PORT/finance_goal_1300k.html"
cd "$DIR/dist"
exec python3 -c '
import http.server,sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control","no-store, must-revalidate")
        super().end_headers()
http.server.ThreadingHTTPServer(("0.0.0.0",int(sys.argv[1])),H).serve_forever()
' "$PORT"
