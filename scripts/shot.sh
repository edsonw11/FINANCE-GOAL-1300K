#!/usr/bin/env bash
# Takes a screenshot of the app with test data.
# Usage: scripts/shot.sh <width> <height> <out.png> "<hash instructions>"
# Needs a local server on the project folder: python3 -m http.server 8765 --bind 127.0.0.1
# Example: scripts/shot.sh 390 844 /tmp/a.png "demo&tab=resumo"
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
W="$1"; H="$2"; OUT="$3"; HASH="${4:-demo}"
PROFILE="$(mktemp -d)"
python3 -I - "$DIR" <<'PY'
import sys
d=sys.argv[1]
h=open(d+'/index.html').read().replace('href="src/','href="../src/').replace('src="src/','src="../src/')
h=h.replace('<head>','<head><script>window.__errs=[];addEventListener("error",e=>__errs.push(e.message+"@"+(e.filename||"").split("/").pop()+":"+e.lineno));addEventListener("unhandledrejection",e=>__errs.push("REJ "+e.reason));</script>',1)
open(d+'/tests/.shot.html','w').write(h.replace('</body>','<script type="module" src="shot.js"></script>\n</body>'))
PY
CHROME="${CHROME:-google-chrome}"
"$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars --user-data-dir="$PROFILE" --window-size="$W,$H" \
  --virtual-time-budget=3000 --screenshot="$OUT" "${BASE:-http://127.0.0.1:8765}/tests/.shot.html#$HASH" >/dev/null 2>&1
"$CHROME" --headless=new --no-sandbox --disable-gpu --user-data-dir="$PROFILE" --window-size="$W,$H" \
  --virtual-time-budget=3000 --dump-dom "${BASE:-http://127.0.0.1:8765}/tests/.shot.html#$HASH" 2>/dev/null | grep -o 'data-overflow="[^"]*"' | head -1
rm -rf "$PROFILE" "$DIR/tests/.shot.html"
