#!/usr/bin/env bash
# Runs the smoke scenario in headless Chrome and prints the result.
# Usage: scripts/smoke.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
# test page = index.html + smoke.js before </body>
python3 -I - "$DIR" "$TMP" <<'PY'
import sys
d,t=sys.argv[1],sys.argv[2]
h=open(d+'/index.html').read().replace('</body>','<script src="src/../tests/smoke.js"></script>\n</body>')
open(d+'/tests/.smoke.html','w').write(h.replace('href="src/','href="../src/').replace('src="src/','src="../src/').replace('src="src/../tests/','src="../tests/'))
PY
CHROME="${CHROME:-google-chrome}"
"$CHROME" --headless=new --no-sandbox --disable-gpu --user-data-dir="$TMP/profile" --virtual-time-budget=4000 \
  --dump-dom "file://$DIR/tests/.smoke.html" 2>/dev/null > "$TMP/dom.html"
RES="$(grep -o 'data-smoke="[^"]*"' "$TMP/dom.html" | head -1 || true)"
rm -f "$DIR/tests/.smoke.html"
echo "$RES" | sed 's/ | /\n/g;s/data-smoke="//;s/"$//'
if echo "$RES" | grep -q 'FAIL\|ERR'; then echo "SMOKE FAILED"; exit 1; fi
if [ -z "$RES" ]; then echo "SMOKE no result"; exit 1; fi
echo "SMOKE OK"
