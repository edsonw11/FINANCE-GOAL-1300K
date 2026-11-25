#!/usr/bin/env bash
# export-images.sh
# Responsibility: turns the SVG of every diagram page (miro/svg) into a PNG at 2x (miro/png) and a PDF with the page cut to the drawing (miro/pdf), with headless Chrome.
# These are the files to drag onto a Miro board. Usage: bash docs/architecture/diagrams/tools/export-images.sh   (CHROME=/path/to/chrome to choose the browser)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; OUT="$(cd "$HERE/.." && pwd)"
CHROME="${CHROME:-google-chrome}"
mkdir -p "$OUT/miro/png" "$OUT/miro/pdf"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
for svg in "$OUT"/miro/svg/*.svg; do
  name="$(basename "$svg" .svg)"
  w="$(grep -o ' width="[0-9]*"' "$svg" | head -1 | tr -dc 0-9)"; h="$(grep -o ' height="[0-9]*"' "$svg" | head -1 | tr -dc 0-9)"
  "$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size="$w,$h" --screenshot="$OUT/miro/png/$name.png" "file://$svg" >/dev/null 2>&1
  printf '<!doctype html><meta charset=utf-8><style>@page{size:%spx %spx;margin:0}html,body{margin:0}img{display:block}</style><img src="file://%s" width="%s" height="%s">' "$w" "$h" "$svg" "$w" "$h" > "$TMP/$name.html"
  "$CHROME" --headless=new --no-sandbox --disable-gpu --no-pdf-header-footer --print-to-pdf="$OUT/miro/pdf/$name.pdf" "file://$TMP/$name.html" >/dev/null 2>&1
  echo "$name  ${w}x${h}"
done
