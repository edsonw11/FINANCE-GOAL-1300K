#!/usr/bin/env bash
# Checks horizontal overflow and touch targets at 320, 360, 375, 390, 430 and 768 px.
# Usage: scripts/mobile-check.sh   (starts a local server on port 8766 for the duration of the test)
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
python3 -I - "$DIR" <<'PY'
import sys
d=sys.argv[1]
h=open(d+'/index.html').read().replace('href="src/','href="../src/').replace('src="src/','src="../src/')
open(d+'/tests/.mobile.html','w').write(h)
open(d+'/tests/.mobile-run.html','w').write('<!DOCTYPE html><html><body><script src="mobile-check.js"></script></body></html>')
PY
python3 -m http.server 8766 --bind 127.0.0.1 --directory "$DIR" >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null; rm -rf "$TMP" "$DIR/tests/.mobile.html" "$DIR/tests/.mobile-run.html"' EXIT
sleep 0.6
RESULT="$("${CHROME:-google-chrome}" --headless=new --no-sandbox --disable-gpu --user-data-dir="$TMP/p" --window-size=1400,1000 --virtual-time-budget=30000 \
  --dump-dom "http://127.0.0.1:8766/tests/.mobile-run.html" 2>/dev/null | grep -o 'data-mobile="[^"]*"' | sed 's/data-mobile="//;s/"$//;s/ | /\n/g')"
printf '%s\n' "$RESULT"
# a width that prints FAIL (or prints nothing) must fail the script, so CI sees it
if [ -z "$RESULT" ] || printf '%s\n' "$RESULT" | grep -q "FAIL"; then exit 1; fi
