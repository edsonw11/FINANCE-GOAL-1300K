#!/usr/bin/env bash
# Runs the end-to-end scenario (tests/smoke.js) in headless Chrome and prints the result, twice:
#   1. source:  index.html with ES modules, served over http (port 8767 for the duration of the test)
#   2. built:   dist/ single file (rebuilt now) opened from file://, the way the file is used without a server
# Usage: scripts/smoke.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
python3 "$DIR/scripts/build.py" >/dev/null
python3 -I - "$DIR" "$TMP" <<'PY'
import sys
d,t=sys.argv[1],sys.argv[2]
h=open(d+'/index.html').read().replace('href="src/','href="../src/').replace('src="src/','src="../src/')
open(d+'/tests/.smoke.html','w').write(h.replace('</body>','<script src="fixtures/statement-pdf.js"></script><script type="module" src="smoke.js"></script>\n</body>'))
# the sync card: the same page with a scripted API in place of fetch (installed before the app starts)
open(d+'/tests/.smoke-sync.html','w').write(h.replace('<script type="module" src="../src/app.js">','<script src="fixtures/fake-api.js"></script>\n<script type="module" src="../src/app.js">').replace('</body>','<script type="module" src="smoke-sync.js"></script>\n</body>'))
open(d+'/tests/.smoke-xss.html','w').write(h.replace('</body>','<script type="module" src="smoke-xss.js"></script>\n</body>'))
b=open(d+'/dist/finance_goal_1300k.html').read()
open(t+'/dist-smoke.html','w').write(b.replace('</body>','<script>\n'+open(d+'/tests/fixtures/statement-pdf.js').read()+'</script><script>\n'+open(d+'/tests/smoke.js').read()+'</script>\n</body>'))
PY
python3 "$DIR/scripts/serve-csp.py" 8767 "$DIR" >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null; rm -rf "$TMP" "$DIR/tests/.smoke.html" "$DIR/tests/.smoke-sync.html" "$DIR/tests/.smoke-xss.html"' EXIT
sleep 0.6
FAILED=0
run(){ # $1 label, $2 url, $3 profile dir
  local RES
  RES="$("${CHROME:-google-chrome}" --headless=new --no-sandbox --disable-gpu --user-data-dir="$3" --window-size=1280,900 --virtual-time-budget=400000 \
    --dump-dom "$2" 2>/dev/null | python3 -I -c 'import sys,re,html;m=re.search(r"data-smoke=\"([^\"]*)\"",sys.stdin.read());print("data-smoke=\""+html.unescape(m.group(1)).replace("\n"," ")+"\"" if m else "")' || true)"
  echo "== $1"
  echo "$RES" | sed 's/ | /\n/g;s/data-smoke="//;s/"$//'
  if [ -z "$RES" ]; then echo "no result (the page did not run)"; FAILED=1;
  elif echo "$RES" | grep -q 'FAIL\|ERR'; then FAILED=1; fi
}
run "source (ES modules over http)" "http://127.0.0.1:8767/tests/.smoke.html" "$TMP/p1"
run "sync card, signed in (scripted API)" "http://127.0.0.1:8767/tests/.smoke-sync.html" "$TMP/p3"
run "sync card, signed out" "http://127.0.0.1:8767/tests/.smoke-sync.html#signedout" "$TMP/p4"
run "XSS: hostile text in every field, every screen (two loads)" "http://127.0.0.1:8767/tests/.smoke-xss.html" "$TMP/p5"
run "built dist/ (file://)" "file://$TMP/dist-smoke.html" "$TMP/p2"
if [ "$FAILED" = 1 ]; then echo "SMOKE FAILED"; exit 1; fi
echo "SMOKE OK"
