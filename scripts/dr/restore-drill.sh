#!/usr/bin/env bash
# Disaster recovery drill — backup PostgreSQL, restore into fresh DB, verify marker.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ -z "${VIS_DATABASE_URL:-}" ]]; then
  echo "VIS_DATABASE_URL is required (do not embed passwords in this script)" >&2
  exit 1
fi
if [[ -z "${PGPASSWORD:-}" ]]; then
  # Derive from URL userinfo when possible without printing it
  export PGPASSWORD="$(python3 - <<'PY'
import os, urllib.parse
u=urllib.parse.urlparse(os.environ['VIS_DATABASE_URL'])
print(urllib.parse.unquote(u.password or ''))
PY
)"
fi
BACKUP_DIR="${VIS_DR_BACKUP_DIR:-/tmp/vis-dr-backup}"
mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_FILE="$BACKUP_DIR/vis_platform_$STAMP.sql"
REPORT="${VIS_DR_REPORT:-/opt/cursor/artifacts/vis-dr-report.json}"
mkdir -p "$(dirname "$REPORT")"

echo "DR_DRILL_START $STAMP"
START=$(date +%s)

cd "$ROOT/backend"
npx tsx -e "
const { PrismaClient } = require('./src/vis/generated/prisma');
const p = new PrismaClient({ datasources: { db: { url: process.env.VIS_DATABASE_URL } } });
(async () => {
  await p.visDocument.create({ data: { collection: 'dr_marker', payload: { marker: 'pre-backup', at: new Date().toISOString() } } });
  console.log('marker_written');
  await p.\$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
"

echo "Backing up..."
pg_dump -h 127.0.0.1 -U vis -d vis_platform -F p -f "$BACKUP_FILE"
BACKUP_END=$(date +%s)

echo "Creating restore target database..."
psql -h 127.0.0.1 -U vis -d postgres -c "DROP DATABASE IF EXISTS vis_platform_restore;" >/dev/null
psql -h 127.0.0.1 -U vis -d postgres -c "CREATE DATABASE vis_platform_restore OWNER vis;" >/dev/null

echo "Restoring..."
RESTORE_START=$(date +%s)
psql -h 127.0.0.1 -U vis -d vis_platform_restore -v ON_ERROR_STOP=1 -f "$BACKUP_FILE" >/tmp/vis-dr-restore.log 2>&1
RESTORE_END=$(date +%s)

# Build restore URL from VIS_DATABASE_URL host/user, swapping DB name only
RESTORE_URL="$(python3 - <<'PY'
import os, urllib.parse
u=urllib.parse.urlparse(os.environ['VIS_DATABASE_URL'])
path='/vis_platform_restore'
print(urllib.parse.urlunparse((u.scheme,u.netloc,path,u.params,u.query,u.fragment)))
PY
)"
VIS_DATABASE_URL="$RESTORE_URL" npx tsx -e "
const { PrismaClient } = require('./src/vis/generated/prisma');
const p = new PrismaClient({ datasources: { db: { url: process.env.VIS_DATABASE_URL } } });
(async () => {
  const rows = await p.visDocument.findMany({ where: { collection: 'dr_marker' } });
  if (!rows.length) { console.error('RESTORE_VERIFY_FAIL'); process.exit(2); }
  console.log('RESTORE_VERIFY_OK', rows.length);
  await p.\$disconnect();
})();
"

END=$(date +%s)
cat >"$REPORT" <<EOF
{
  "stamp": "$STAMP",
  "backupFile": "$BACKUP_FILE",
  "rpo_minutes_target": 15,
  "rto_minutes_target": 60,
  "actual_total_seconds": $((END - START)),
  "actual_backup_seconds": $((BACKUP_END - START)),
  "actual_restore_seconds": $((RESTORE_END - RESTORE_START)),
  "restoreVerified": true,
  "method": "pg_dump logical backup → restore into fresh database vis_platform_restore",
  "notes": "Redis treated as ephemeral; queues rebuild from DB checkpoints."
}
EOF

echo "DR_DRILL_PASS"
cat "$REPORT"
