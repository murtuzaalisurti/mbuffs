#!/usr/bin/env bash
#
# Clone a Neon project (production + dev branches, schema + data) into a new project.
#
# Usage:
#   ./cloneNeonProject.sh <OLD_PROJECT_ID> <NEW_PROJECT_ID> [--verify-only]
#
# Prereqs:
#   - neon CLI installed and authenticated (`npm i -g neon && neon auth`)
#     or NEON_API_KEY exported
#   - libpq client tools (`brew install libpq`)
#   - The new project must already exist (`neon projects create --name mbuffs --pg-version 17`)
#   - Rename its default branch once so names match the old project:
#       neon branches rename main production --project-id <NEW_PROJECT_ID>
#     (if 'main' doesn't exist, the script will create 'production' as a new
#     branch instead, leaving an unused default 'main' behind)
#
# Notes:
#   - Safe to re-run: each restore wipes the target branch's public schema first.
#     Re-run it right before cutover for the final sync (after freezing writes).
#   - The old project is never written to.
set -euo pipefail

# --- config ---------------------------------------------------------------
BRANCHES=("production" "dev")
VERIFY_TABLES=('"user"' collections collection_movies collection_collaborators session account media_comments media_ratings notifications _migrations)
PG_BIN="/opt/homebrew/opt/libpq/bin"
[ -x "$PG_BIN/pg_dump" ] || PG_BIN="$(dirname "$(command -v pg_dump || true)")"
DUMP_DIR="$(mktemp -d /tmp/neon-clone.XXXXXX)"
# --------------------------------------------------------------------------

if [ $# -lt 2 ]; then
  sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
  exit 1
fi

OLD_PROJECT="$1"
NEW_PROJECT="$2"
MODE="${3:-clone}"

if [ ! -x "$PG_BIN/pg_dump" ]; then
  echo "ERROR: pg_dump not found. Run: brew install libpq" >&2
  exit 1
fi
command -v neon >/dev/null || { echo "ERROR: neon CLI not found. Run: npm i -g neon" >&2; exit 1; }

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

conn() { # conn <project-id> <branch>
  neon connection-string "$2" --project-id "$1"
}

preflight() { # ensure all branch endpoints are reachable before doing any work
  log "Preflight: checking connectivity to all branches"
  for BR in "${BRANCHES[@]}"; do
    local URL
    URL=$(conn "$OLD_PROJECT" "$BR")
    if ! "$PG_BIN/psql" "$URL" -tAc "SELECT 1" >/dev/null 2>&1; then
      cat >&2 <<EOF
ERROR: cannot connect to '$BR' on old project ($OLD_PROJECT).
If the error is "exceeded the compute time quota", the project's computes are
suspended: upgrade the org to Launch (console -> Billing) to unsuspend, run
this script, then downgrade back to Free after cutover. Or wait for the
monthly CU-hour reset.
EOF
      exit 1
    fi
    echo "  old/$BR reachable"
  done
}

verify_branch() { # verify_branch <branch> <old-url> <new-url>
  log "Verifying row counts: $1"
  local ok=1
  for T in "${VERIFY_TABLES[@]}"; do
    local old_n new_n
    old_n=$("$PG_BIN/psql" "$2" -tAc "SELECT count(*) FROM $T" 2>/dev/null || echo "n/a")
    new_n=$("$PG_BIN/psql" "$3" -tAc "SELECT count(*) FROM $T" 2>/dev/null || echo "n/a")
    if [ "$old_n" = "$new_n" ]; then
      printf '  %-28s old=%-8s new=%-8s OK\n' "$T" "$old_n" "$new_n"
    else
      printf '  %-28s old=%-8s new=%-8s MISMATCH\n' "$T" "$old_n" "$new_n"
      ok=0
    fi
  done
  [ "$ok" = 1 ] || { echo "ERROR: verification failed for branch $1" >&2; exit 1; }
}

clone_branch() { # clone_branch <branch>
  local BR="$1"

  log "Branch '$BR': resolving connection strings"
  local OLD_URL NEW_URL
  OLD_URL=$(conn "$OLD_PROJECT" "$BR")

  if ! NEW_URL=$(conn "$NEW_PROJECT" "$BR" 2>/dev/null); then
    log "Branch '$BR' missing in new project; creating"
    neon branches create --project-id "$NEW_PROJECT" --name "$BR" >/dev/null
    NEW_URL=$(conn "$NEW_PROJECT" "$BR")
  fi

  log "Branch '$BR': dumping from old project"
  "$PG_BIN/pg_dump" -Fc -d "$OLD_URL" -f "$DUMP_DIR/$BR.dump"

  log "Branch '$BR': wiping target schema (idempotent restore)"
  "$PG_BIN/psql" "$NEW_URL" -v ON_ERROR_STOP=1 \
    -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

  log "Branch '$BR': restoring into new project"
  "$PG_BIN/pg_restore" -d "$NEW_URL" --no-owner --no-privileges "$DUMP_DIR/$BR.dump"

  verify_branch "$BR" "$OLD_URL" "$NEW_URL"
}

log "Old project: $OLD_PROJECT"
log "New project: $NEW_PROJECT"

if [ "$MODE" = "--verify-only" ]; then
  for BR in "${BRANCHES[@]}"; do
    verify_branch "$BR" "$(conn "$OLD_PROJECT" "$BR")" "$(conn "$NEW_PROJECT" "$BR")"
  done
else
  preflight
  for BR in "${BRANCHES[@]}"; do
    clone_branch "$BR"
  done
fi

rm -rf "$DUMP_DIR"

log "Done. Next steps:"
cat <<'EOF'
  1. Point local .env DATABASE_URL at the new project's dev branch:
       neon connection-string dev --project-id <NEW_PROJECT_ID>
  2. Smoke-test the app locally against new dev.
  3. For cutover: pause writes (or accept the gap), re-run this script
     for a final sync, then update DATABASE_URL in Vercel to the new
     production branch and redeploy.
  4. Keep the old project as rollback for ~1 week, then delete it:
       neon projects delete <OLD_PROJECT_ID>
EOF
