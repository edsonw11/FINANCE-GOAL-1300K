#!/usr/bin/env bash
# The Android app (Capacitor shell around the same web app).
#   scripts/mobile.sh doctor    what this machine has and lacks for building the app
#   scripts/mobile.sh web       build mobile/www (the page with its own CSP; no network allowed)
#   scripts/mobile.sh sync      web + copy it into the Android project (Capacitor 8 needs Node 22: it is fetched for this command only)
#   scripts/mobile.sh apk       sync + build the debug APK  (needs JDK 21 and the Android SDK: ANDROID_HOME)
# Same through npm: npm run mobile:doctor | mobile:web | mobile:sync | mobile:apk
set -euo pipefail
cd "$(dirname "$0")/.."
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

cap() { # runs the Capacitor CLI with Node 22 whatever the node of this shell is
  if [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ]; then npx cap "$@"; else npm exec --yes --package=node@22 -- npx cap "$@"; fi
}

doctor() {
  local bad=0
  have() { if "$@" >/dev/null 2>&1; then echo "ok      $LABEL"; else echo "MISSING $LABEL"; bad=1; fi; }
  LABEL="node $(node -v) (22 is fetched on demand for the Capacitor CLI)"; have node -v
  LABEL="java 17+ ($(java -version 2>&1 | head -1))"; have bash -c '[ "$(java -version 2>&1 | sed -n "s/.*version \"\([0-9]*\).*/\1/p")" -ge 17 ]'
  LABEL="ANDROID_HOME points to an SDK with platforms;android-36 (${ANDROID_HOME:-unset})"; have bash -c '[ -d "${ANDROID_HOME:-/nonexistent}/platforms/android-36" ]'
  LABEL="Android build-tools installed"; have bash -c 'ls "${ANDROID_HOME:-/nonexistent}"/build-tools/* >/dev/null'
  [ "$bad" = 0 ] && echo "ready to build the APK" || echo "not ready: see README, section Android"
  return 0
}

web() { python3 scripts/build-mobile.py; }
sync() { web; cap sync android; }
apk() {
  [ -d "${ANDROID_HOME:-/nonexistent}/platforms" ] || die "ANDROID_HOME is not set to an Android SDK (scripts/mobile.sh doctor)"
  sync
  (cd android && ./gradlew --no-daemon assembleDebug)
  echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
}

case "${1:-}" in
  doctor) doctor ;;
  web) web ;;
  sync) sync ;;
  apk) apk ;;
  *) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; [ -z "${1:-}" ] || exit 2 ;;
esac
