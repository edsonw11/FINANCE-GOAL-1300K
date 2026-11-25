#!/usr/bin/env bash
# The Android app (Capacitor shell around the same web app).
#   scripts/mobile.sh doctor    what this machine has and lacks for building the app
#   scripts/mobile.sh web       build mobile/www (the page with its own CSP; no network allowed)
#   scripts/mobile.sh sync      web + copy it into the Android project (Capacitor 8 needs Node 22: it is fetched for this command only)
#   scripts/mobile.sh emulator  start the virtual phone (AVD everfox_35, created once by `scripts/mobile.sh emulator create`) and wait for it to boot
#   scripts/mobile.sh test      build the test APK (WebView debugging on), install it on the running device/emulator and run scripts/device-test.mjs
#   scripts/mobile.sh apk       sync + build the debug APK  (needs JDK 21 and the Android SDK: ANDROID_HOME)
#                               MOBILE_DEBUG=1 also turns WebView debugging on, for scripts/device-test.mjs (test build only)
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
  if [ "${MOBILE_DEBUG:-0}" = 1 ]; then
    # for the device tests only: WebView debugging on in the generated copy of the config (never in capacitor.config.json)
    sed -i 's/"webContentsDebuggingEnabled": false/"webContentsDebuggingEnabled": true/' android/app/src/main/assets/capacitor.config.json
    grep -q '"webContentsDebuggingEnabled": true' android/app/src/main/assets/capacitor.config.json || die "could not enable WebView debugging in the generated config"
    echo "MOBILE_DEBUG=1: WebView debugging is ON in this APK (test build, do not share)"
  fi
  (cd android && ./gradlew --no-daemon assembleDebug)
  echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
}

emulator() {
  local sdk="${ANDROID_HOME:-$HOME/Android/Sdk}" avd=everfox_35
  if [ "${1:-}" = create ]; then
    "$sdk/cmdline-tools/latest/bin/sdkmanager" "emulator" "system-images;android-35;google_apis;x86_64"
    echo no | "$sdk/cmdline-tools/latest/bin/avdmanager" create avd -n "$avd" -k "system-images;android-35;google_apis;x86_64" -d pixel_7 --force
    return
  fi
  [ -x "$sdk/emulator/emulator" ] || die "no emulator: run scripts/mobile.sh emulator create"
  if "$sdk/platform-tools/adb" get-state >/dev/null 2>&1; then echo "a device is already connected"; return; fi
  [ -r /dev/kvm ] && [ -w /dev/kvm ] || die "/dev/kvm is not usable: the emulator would be far too slow"
  nohup "$sdk/emulator/emulator" -avd "$avd" -no-window -no-audio -no-snapshot -gpu swiftshader_indirect -no-boot-anim -memory 3072 >/tmp/everfox-emulator.log 2>&1 &
  for _ in $(seq 1 90); do [ "$("$sdk/platform-tools/adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ] && { echo "emulator ready"; return; }; sleep 5; done
  die "the emulator did not boot (see /tmp/everfox-emulator.log)"
}

device_test() {
  local sdk="${ANDROID_HOME:-}"; [ -n "$sdk" ] || die "set ANDROID_HOME"
  "$sdk/platform-tools/adb" get-state >/dev/null 2>&1 || die "no device or emulator connected (scripts/mobile.sh emulator)"
  MOBILE_DEBUG=1 apk
  if [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ]; then node scripts/device-test.mjs; else npm exec --yes --package=node@22 -- node scripts/device-test.mjs; fi
}

case "${1:-}" in
  doctor) doctor ;;
  web) web ;;
  sync) sync ;;
  apk) apk ;;
  emulator) shift; emulator "$@" ;;
  test) device_test ;;
  *) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; [ -z "${1:-}" ] || exit 2 ;;
esac
