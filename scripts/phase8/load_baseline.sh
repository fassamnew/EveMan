#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

ITERATIONS="${ITERATIONS:-3}"
if [[ "$ITERATIONS" -lt 1 ]]; then
  echo "ITERATIONS must be >= 1"
  exit 1
fi

OUT_DIR="$ROOT_DIR/artifacts/phase8"
mkdir -p "$OUT_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="$OUT_DIR/load-baseline-report-${TIMESTAMP}.txt"

declare -a durations=()
failures=0

for i in $(seq 1 "$ITERATIONS"); do
  log_file="$OUT_DIR/load-baseline-run-${TIMESTAMP}-${i}.log"
  start_ms="$(node -e 'console.log(Date.now())')"

  if npm run test:integration:analytics:local >"$log_file" 2>&1; then
    end_ms="$(node -e 'console.log(Date.now())')"
    duration_ms=$((end_ms - start_ms))
    durations+=("$duration_ms")
    echo "[phase8] iteration=${i} status=PASS duration_ms=${duration_ms}"
  else
    end_ms="$(node -e 'console.log(Date.now())')"
    duration_ms=$((end_ms - start_ms))
    durations+=("$duration_ms")
    failures=$((failures + 1))
    echo "[phase8] iteration=${i} status=FAIL duration_ms=${duration_ms} log=${log_file}"
  fi
done

count="${#durations[@]}"
sum=0
min="${durations[0]}"
max="${durations[0]}"
for d in "${durations[@]}"; do
  sum=$((sum + d))
  if [[ "$d" -lt "$min" ]]; then min="$d"; fi
  if [[ "$d" -gt "$max" ]]; then max="$d"; fi
done
avg=$((sum / count))

sorted=( $(printf '%s\n' "${durations[@]}" | sort -n) )
p95_index=$(( (95 * count + 99) / 100 - 1 ))
if [[ "$p95_index" -lt 0 ]]; then p95_index=0; fi
if [[ "$p95_index" -ge "$count" ]]; then p95_index=$((count - 1)); fi
p95="${sorted[$p95_index]}"

status="PASS"
if [[ "$failures" -gt 0 ]]; then
  status="FAIL"
fi

error_rate_pct=$((failures * 100 / count))

{
  echo "phase8_load_status=${status}"
  echo "timestamp=${TIMESTAMP}"
  echo "iterations=${count}"
  echo "failures=${failures}"
  echo "error_rate_percent=${error_rate_pct}"
  echo "min_ms=${min}"
  echo "avg_ms=${avg}"
  echo "p95_ms=${p95}"
  echo "max_ms=${max}"
  echo "notes=Each iteration executes npm run test:integration:analytics:local"
} | tee "$REPORT_FILE"

echo "Load baseline report: ${REPORT_FILE}"

if [[ "$status" != "PASS" ]]; then
  exit 2
fi
