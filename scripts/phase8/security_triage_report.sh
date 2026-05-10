#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

ART_DIR="$ROOT_DIR/artifacts/phase8"
mkdir -p "$ART_DIR"

LATEST_RAW="$(ls -1t "$ART_DIR"/security-audit-raw-*.json 2>/dev/null | head -n 1 || true)"
if [[ -z "$LATEST_RAW" ]]; then
  echo "No security audit raw report found. Run: npm run phase8:security:audit"
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$ART_DIR/security-triage-${TIMESTAMP}.md"

node - "$LATEST_RAW" "$OUT_FILE" <<'NODE'
const fs = require('fs');
const rawPath = process.argv[2];
const outPath = process.argv[3];
const audit = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const vulnerabilities = audit.vulnerabilities || {};
const meta = (audit.metadata && audit.metadata.vulnerabilities) || {};

const entries = Object.values(vulnerabilities)
  .filter(v => v && (v.severity === 'critical' || v.severity === 'high'))
  .sort((a, b) => {
    const sevRank = { critical: 2, high: 1 };
    const d = (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0);
    if (d !== 0) return d;
    return (a.name || '').localeCompare(b.name || '');
  });

const lines = [];
lines.push('# Phase 8 Security Triage Report');
lines.push('');
lines.push(`Source audit: ${rawPath}`);
lines.push(`Generated at: ${new Date().toISOString()}`);
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push(`1. Critical: ${meta.critical || 0}`);
lines.push(`2. High: ${meta.high || 0}`);
lines.push(`3. Moderate: ${meta.moderate || 0}`);
lines.push(`4. Low: ${meta.low || 0}`);
lines.push(`5. Total: ${meta.total || 0}`);
lines.push('');
lines.push('## Critical and High Findings');
lines.push('');
if (!entries.length) {
  lines.push('No critical/high findings.');
} else {
  let i = 1;
  for (const v of entries) {
    const fix = v.fixAvailable;
    let fixText = 'No automatic fix';
    if (fix === true) {
      fixText = 'Fix available (version unspecified by npm audit)';
    } else if (fix && typeof fix === 'object') {
      fixText = `${fix.name || 'package'} -> ${fix.version || 'latest'}${fix.isSemVerMajor ? ' (major)' : ''}`;
    }

    const via = Array.isArray(v.via)
      ? v.via
          .map(item => (typeof item === 'string' ? item : item?.name || item?.title || 'advisory'))
          .slice(0, 5)
          .join(', ')
      : '';

    lines.push(`${i}. ${v.name} (${v.severity})`);
    lines.push(`- Range: ${v.range || 'n/a'}`);
    lines.push(`- Via: ${via || 'n/a'}`);
    lines.push(`- Fix: ${fixText}`);
    i += 1;
  }
}

lines.push('');
lines.push('## Remediation Plan');
lines.push('');
lines.push('1. Prioritize direct dependency upgrades with high findings (e.g., @nestjs/platform-express).');
lines.push('2. Evaluate Expo major upgrade path in isolated branch to address transitive high findings.');
lines.push('3. Re-run `npm run phase8:security:audit` after each upgrade batch and attach new artifact.');
lines.push('4. For remaining accepted highs, add explicit waiver notes with owner and expiration.');

fs.writeFileSync(outPath, lines.join('\n'));
console.log(outPath);
NODE

echo "Security triage report: ${OUT_FILE}"
