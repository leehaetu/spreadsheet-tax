#!/usr/bin/env bash
# Capacity platform evidence runner (does not claim 800k MET).
# Usage:
#   bash scripts/capacity-evidence-run.sh
# Optional:
#   DATABASE_URL=... REDIS_URL=... CAPACITY_SEED_FULL=0 bash scripts/capacity-evidence-run.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="${CAPACITY_EVIDENCE_DIR:-$ROOT/data/exports/capacity-evidence}"
mkdir -p "$OUT"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$OUT/run-$STAMP.log"

{
  echo "=== capacity evidence $STAMP ==="
  echo "cwd=$ROOT"
  echo "DATABASE_URL set? ${DATABASE_URL:+yes}"
  echo "REDIS_URL set? ${REDIS_URL:+yes}"
  echo "CAPACITY_SEED_FULL=${CAPACITY_SEED_FULL:-0}"
  node -e "import('./src/lib/platform-config.js').then(m=>console.log(JSON.stringify(m.evaluateCapacityPlatform(),null,2)))"
  if [[ -n "${DATABASE_URL:-}" ]]; then
    node -e "import('./src/lib/pg-pool.js').then(async m=>{await m.migratePostgres(); console.log('postgres migrate+rls ok'); process.exit(0)}).catch(e=>{console.error(e); process.exit(1)})"
  fi
  npm run seed:capacity
  npm run load:capacity
  echo "=== done $STAMP — review $OUT — capacity still NOT MET unless full gate criteria satisfied ==="
} 2>&1 | tee "$LOG"

echo "Wrote $LOG"
