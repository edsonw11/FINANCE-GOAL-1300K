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
import os
os.makedirs(t+'/native',exist_ok=True)
sys.path.insert(0,d+'/scripts')
import importlib.util
sp=importlib.util.spec_from_file_location('bm',d+'/scripts/build-mobile.py');bm=importlib.util.module_from_spec(sp);sp.loader.exec_module(bm)
page=bm.build(open(d+'/dist/index.html').read())
open(t+'/native/index.html','w').write(page.replace('</title>','</title>\n<script src="fake-native.js"></script>',1).replace('</body>','<script src="smoke-native.js"></script>\n</body>'))
import shutil
for f in ('fake-native.js','statement-pdf.js','import-samples.js'):shutil.copy(d+'/tests/fixtures/'+f,t+'/native/'+f)
shutil.copy(d+'/tests/smoke-native.js',t+'/native/smoke-native.js')
shutil.copy(d+'/tests/smoke-native-import.js',t+'/native/smoke-native-import.js')
bm.copy_pdfjs(__import__('pathlib').Path(t+'/native'))
# the same Android page with the file formats scenario instead of the lock one
open(t+'/native/import.html','w').write(open(t+'/native/index.html').read().replace('<script src="smoke-native.js"></script>','<script src="statement-pdf.js"></script><script src="import-samples.js"></script><script src="smoke-native-import.js"></script>'))
b=open(d+'/dist/finance_goal_1300k.html').read()
open(t+'/dist-smoke.html','w').write(b.replace('</body>','<script>\n'+open(d+'/tests/fixtures/statement-pdf.js').read()+'</script><script>\n'+open(d+'/tests/smoke.js').read()+'</script>\n</body>'))
PY
python3 "$DIR/scripts/serve-csp.py" 8767 "$DIR" >/dev/null 2>&1 & SRV=$!
python3 -m http.server 8769 --bind 127.0.0.1 --directory "$TMP/native" >/dev/null 2>&1 & SRV2=$!
trap 'kill $SRV $SRV2 2>/dev/null; rm -rf "$TMP" "$DIR/tests/.smoke.html" "$DIR/tests/.smoke-sync.html" "$DIR/tests/.smoke-xss.html"' EXIT
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
run "Android shell: page with its own CSP and a scripted Capacitor" "http://127.0.0.1:8769/index.html" "$TMP/p6"
run "Android shell, app lock on: starts locked (scripted AppLock)" "http://127.0.0.1:8769/index.html#locked" "$TMP/p7"
run "Android shell: CSV, OFX and PDF imports under its CSP" "http://127.0.0.1:8769/import.html" "$TMP/p8"
run "built dist/ (file://)" "file://$TMP/dist-smoke.html" "$TMP/p2"
if [ "$FAILED" = 1 ]; then echo "SMOKE FAILED"; exit 1; fi
echo "SMOKE OK"
