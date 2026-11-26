#!/usr/bin/env bash
# Checks how scripts/mobile.sh finds the Android SDK: ANDROID_HOME is optional when the SDK is at ~/Android/Sdk, and an explicit value always wins.
# Runs only `doctor` (it builds nothing). Usage: scripts/test-mobile-env.sh
set -uo pipefail
cd "$(dirname "$0")/.."
FAIL=0
check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; FAIL=1; fi; }
FAKE="$(mktemp -d)"; trap 'rm -rf "$FAKE"' EXIT
mkdir -p "$FAKE/home/Android/Sdk/platforms" "$FAKE/other/platforms/android-36" "$FAKE/empty"

out="$(env -u ANDROID_HOME HOME="$FAKE/home" bash scripts/mobile.sh doctor 2>&1)"
check "no ANDROID_HOME and an SDK at ~/Android/Sdk: that SDK is used" 'grep -q "ANDROID_HOME points to an SDK.*(.*/home/Android/Sdk)" <<<"$out"'
out="$(env -u ANDROID_HOME HOME="$FAKE/empty" bash scripts/mobile.sh doctor 2>&1)"
check "no ANDROID_HOME and no SDK anywhere: reported as unset, not invented" 'grep -q "(unset)" <<<"$out"'
out="$(ANDROID_HOME="$FAKE/other" HOME="$FAKE/home" bash scripts/mobile.sh doctor 2>&1)"
check "an explicit ANDROID_HOME wins over ~/Android/Sdk" 'grep -q "(.*/other)" <<<"$out" && ! grep -q "home/Android/Sdk" <<<"$out"'
[ "$FAIL" = 0 ] && echo "MOBILE ENV OK" || { echo "MOBILE ENV FAILED"; exit 1; }
