#!/usr/bin/env bash
# Looks for secrets in the files git tracks (and the ones about to be added): private keys, cloud and token formats, and
# assignments of a real-looking value to a secret-like name. The values that are meant for this machine only are listed in ALLOWED.
# Usage: scripts/secret-scan.sh [directory]      exit 1 when something is found
set -euo pipefail
DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$DIR"
# development-only values that are public on purpose (README says so); anything else is a finding
ALLOWED='everfox_dev_only|everfox_app_dev_only|\$\{|everfox-dev-client-secret|ci_only_password|ci_only_app_password|alice-dev-password|bob-dev-password|DEV_APP_DATABASE_PASSWORD|change-me|example|placeholder'
PATTERNS=(
  'BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY'
  'AKIA[0-9A-Z]{16}'
  'ASIA[0-9A-Z]{16}'
  'gh[pousr]_[A-Za-z0-9]{30,}'
  'xox[abprs]-[A-Za-z0-9-]{10,}'
  'AIza[0-9A-Za-z_-]{35}'
  'eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}'
  '(postgres(ql)?|mysql|mongodb(\+srv)?)://[^:/@ ]+:[^@ ]{6,}@'
  "(secret|password|passwd|token|api[_-]?key)[A-Za-z_]*[\"']?[ ]*[:=][ ]*[\"'][A-Za-z0-9/+_=.-]{16,}[\"']"
)
if git rev-parse --git-dir >/dev/null 2>&1; then FILES="$(git ls-files --cached --others --exclude-standard)"; else FILES="$(find . -type f -not -path './node_modules/*' -not -path './.git/*' | sed 's|^\./||')"; fi
FOUND=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in package-lock.json|*/package-lock.json|vendor/*|dist/*|*.png|*.jpg|*.ico|*.woff2|*.pdf) continue;; esac
  IS_TEST=0; case "$f" in */test/*|test/*|tests/*|*/tests/*|*.test.*) IS_TEST=1;; esac
  for p in "${PATTERNS[@]}"; do
    # fixtures use made-up credentials on purpose: only the formats of real keys (the first patterns) apply to them
    if [ "$IS_TEST" = 1 ] && [[ "$p" == *'://'* || "$p" == *'secret|password'* ]]; then continue; fi
    HITS="$(grep -nEI -- "$p" "$f" 2>/dev/null | grep -vEi -- "$ALLOWED" || true)"
    if [ -n "$HITS" ]; then echo "SECRET? $f"; echo "$HITS" | cut -c1-160 | sed 's/^/    /'; FOUND=1; fi
  done
done <<< "$FILES"
[ "$FOUND" = 0 ] && echo "secret scan: nothing found" || { echo "secret scan: FOUND something (see above)"; exit 1; }
