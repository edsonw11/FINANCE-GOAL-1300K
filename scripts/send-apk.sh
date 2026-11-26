#!/usr/bin/env bash
# Builds the debug APK and sends it to Telegram, in one command.
#   scripts/send-apk.sh             build, show where it goes, ask, then send
#   scripts/send-apk.sh --yes       build and send without asking
#   scripts/send-apk.sh --dry-run   build and show what would be sent, send nothing
# Any other option is passed on to services/telegram-apk/send-apk.mjs (--chat NAME, --note "text", --file <apk>).
# Under the hood: send-apk.mjs --build runs `bash scripts/mobile.sh apk` first, then sends the APK.
set -euo pipefail
cd "$(dirname "$0")/.."
exec node services/telegram-apk/send-apk.mjs --build "$@"
