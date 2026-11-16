#!/usr/bin/env bash
# Serves the project for development (ES modules do not load from file://).
# Usage: scripts/serve.sh [port]   then open http://127.0.0.1:<port>/index.html
# The single-file build (dist/) still opens directly from file://.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8000}"
echo "http://127.0.0.1:$PORT/index.html"
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DIR"
