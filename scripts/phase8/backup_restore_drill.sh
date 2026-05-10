#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="$ROOT_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env. Run: cp .env.example .env"
  exit 1
fi

MYSQL_DATABASE="$(grep '^MYSQL_DATABASE=' "$ENV_FILE" | cut -d'=' -f2-)"
MYSQL_USER="$(grep '^MYSQL_USER=' "$ENV_FILE" | cut -d'=' -f2-)"
MYSQL_PASSWORD="$(grep '^MYSQL_PASSWORD=' "$ENV_FILE" | cut -d'=' -f2-)"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root_dev}"
MYSQL_CONTAINER="evemange-mysql"

if [[ -z "$MYSQL_DATABASE" || -z "$MYSQL_USER" || -z "$MYSQL_PASSWORD" ]]; then
  echo "Missing MySQL variables in .env"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
  echo "MySQL container ${MYSQL_CONTAINER} is not running. Run: npm run docker:up"
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT_DIR/artifacts/phase8"
BACKUP_FILE="$BACKUP_DIR/mysql-backup-${TIMESTAMP}.sql"
RESTORE_DB="${MYSQL_DATABASE}_restore_drill"
REPORT_FILE="$BACKUP_DIR/backup-restore-report-${TIMESTAMP}.txt"
mkdir -p "$BACKUP_DIR"

start_epoch="$(date +%s)"

echo "[phase8] Creating backup ${BACKUP_FILE}"
docker exec "$MYSQL_CONTAINER" sh -lc "MYSQL_PWD='$MYSQL_PASSWORD' mysqldump --no-tablespaces --single-transaction --quick -u'$MYSQL_USER' '$MYSQL_DATABASE'" > "$BACKUP_FILE"

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "Backup file is empty: ${BACKUP_FILE}"
  exit 1
fi

echo "[phase8] Restoring backup into ${RESTORE_DB}"
docker exec "$MYSQL_CONTAINER" sh -lc "MYSQL_PWD='$MYSQL_ROOT_PASSWORD' mysql -uroot -e 'DROP DATABASE IF EXISTS ${RESTORE_DB}; CREATE DATABASE ${RESTORE_DB}; GRANT ALL PRIVILEGES ON ${RESTORE_DB}.* TO \"${MYSQL_USER}\"@\"%\";'"
docker exec -i "$MYSQL_CONTAINER" sh -lc "MYSQL_PWD='$MYSQL_ROOT_PASSWORD' mysql -uroot '$RESTORE_DB'" < "$BACKUP_FILE"

registrants_src="$(docker exec "$MYSQL_CONTAINER" sh -lc "MYSQL_PWD='$MYSQL_PASSWORD' mysql -N -u'$MYSQL_USER' -e \"SELECT COUNT(*) FROM ${MYSQL_DATABASE}.registrants;\"")"
registrants_restore="$(docker exec "$MYSQL_CONTAINER" sh -lc "MYSQL_PWD='$MYSQL_PASSWORD' mysql -N -u'$MYSQL_USER' -e \"SELECT COUNT(*) FROM ${RESTORE_DB}.registrants;\"")"
checkins_src="$(docker exec "$MYSQL_CONTAINER" sh -lc "MYSQL_PWD='$MYSQL_PASSWORD' mysql -N -u'$MYSQL_USER' -e \"SELECT COUNT(*) FROM ${MYSQL_DATABASE}.checkins;\"")"
checkins_restore="$(docker exec "$MYSQL_CONTAINER" sh -lc "MYSQL_PWD='$MYSQL_PASSWORD' mysql -N -u'$MYSQL_USER' -e \"SELECT COUNT(*) FROM ${RESTORE_DB}.checkins;\"")"
audit_src="$(docker exec "$MYSQL_CONTAINER" sh -lc "MYSQL_PWD='$MYSQL_PASSWORD' mysql -N -u'$MYSQL_USER' -e \"SELECT COUNT(*) FROM ${MYSQL_DATABASE}.audit_logs;\"")"
audit_restore="$(docker exec "$MYSQL_CONTAINER" sh -lc "MYSQL_PWD='$MYSQL_PASSWORD' mysql -N -u'$MYSQL_USER' -e \"SELECT COUNT(*) FROM ${RESTORE_DB}.audit_logs;\"")"

end_epoch="$(date +%s)"
duration="$((end_epoch - start_epoch))"

status="PASS"
if [[ "$registrants_src" != "$registrants_restore" || "$checkins_src" != "$checkins_restore" || "$audit_src" != "$audit_restore" ]]; then
  status="FAIL"
fi

{
  echo "phase8_backup_restore_status=${status}"
  echo "timestamp=${TIMESTAMP}"
  echo "backup_file=${BACKUP_FILE}"
  echo "restore_db=${RESTORE_DB}"
  echo "duration_seconds=${duration}"
  echo "registrants_source=${registrants_src}"
  echo "registrants_restore=${registrants_restore}"
  echo "checkins_source=${checkins_src}"
  echo "checkins_restore=${checkins_restore}"
  echo "audit_logs_source=${audit_src}"
  echo "audit_logs_restore=${audit_restore}"
} | tee "$REPORT_FILE"

if [[ "$status" != "PASS" ]]; then
  echo "Backup/restore drill failed consistency check"
  exit 2
fi

echo "Backup/restore drill passed. Report: ${REPORT_FILE}"
