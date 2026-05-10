#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

OUT_DIR="$ROOT_DIR/artifacts/phase8"
mkdir -p "$OUT_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
RAW_FILE="$OUT_DIR/security-audit-raw-${TIMESTAMP}.json"
SUMMARY_FILE="$OUT_DIR/security-audit-summary-${TIMESTAMP}.txt"

# npm audit exits non-zero when vulnerabilities exist, so capture JSON regardless.
if npm audit --omit=dev --json > "$RAW_FILE" 2>/dev/null; then
  audit_exit=0
else
  audit_exit=$?
fi

counts="$(node -e "const fs=require('fs');const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,'utf8'));const v=(j.metadata&&j.metadata.vulnerabilities)||{};console.log([v.critical||0,v.high||0,v.moderate||0,v.low||0,v.total||0].join(' '));" "$RAW_FILE")"
read -r critical high moderate low total <<< "$counts"

status="PASS"
if [[ "$critical" -gt 0 ]]; then
  status="FAIL"
fi

{
  echo "phase8_security_audit_status=${status}"
  echo "timestamp=${TIMESTAMP}"
  echo "npm_audit_exit_code=${audit_exit}"
  echo "critical=${critical}"
  echo "high=${high}"
  echo "moderate=${moderate}"
  echo "low=${low}"
  echo "total=${total}"
  echo "raw_report=${RAW_FILE}"
} | tee "$SUMMARY_FILE"

echo "Security audit summary: ${SUMMARY_FILE}"

if [[ "$status" != "PASS" ]]; then
  echo "Critical vulnerabilities detected."
  exit 2
fi
