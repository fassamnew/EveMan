#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

REDIS_CONTAINER="evemange-redis"
BACKUP_REPORT_DIR="$ROOT_DIR/artifacts/phase8"
mkdir -p "$BACKUP_REPORT_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="$BACKUP_REPORT_DIR/resilience-smoke-${TIMESTAMP}.txt"

if ! docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
  echo "Redis container ${REDIS_CONTAINER} is not running. Run: npm run docker:up"
  exit 1
fi

echo "[phase8] Pre-check redis ping"
pre_ping="$(docker exec "$REDIS_CONTAINER" redis-cli ping)"

start_epoch="$(date +%s)"
echo "[phase8] Restarting redis container"
docker compose -f infra/docker-compose.yml restart redis >/dev/null

echo "[phase8] Waiting for redis health"
for i in $(seq 1 30); do
  ping="$(docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null || true)"
  if [[ "$ping" == "PONG" ]]; then
    break
  fi
  sleep 1
  if [[ "$i" == "30" ]]; then
    echo "Redis did not recover within timeout"
    exit 2
  fi
done

post_ping="$(docker exec "$REDIS_CONTAINER" redis-cli ping)"

echo "[phase8] Running analytics integration local after redis restart"
npm run test:integration:analytics:local >/tmp/phase8-resilience-test.log
end_epoch="$(date +%s)"
duration="$((end_epoch - start_epoch))"

{
  echo "phase8_resilience_status=PASS"
  echo "timestamp=${TIMESTAMP}"
  echo "redis_pre_ping=${pre_ping}"
  echo "redis_post_ping=${post_ping}"
  echo "recovery_and_validation_seconds=${duration}"
  echo "analytics_integration_after_restart=PASS"
} | tee "$REPORT_FILE"

echo "Resilience smoke passed. Report: ${REPORT_FILE}"
