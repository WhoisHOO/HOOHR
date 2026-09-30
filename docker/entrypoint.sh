#!/bin/sh
# HOOHR container entrypoint.
#
# Turns `docker compose up` into a usable install: a container that is merely
# *running* is not enough - without migrations the schema is absent and every
# page 500s, and without the seed there is no account to log in with. Both are
# idempotent, so this is safe on every restart.
#
# Invoked as `sh docker/entrypoint.sh` rather than directly, so it does not
# depend on the executable bit surviving a Windows checkout.

set -e

echo "==> HOOHR starting up"

# --- 1. wait for PostgreSQL -------------------------------------------------
# compose already gates on `service_healthy`, but this survives a bare
# `docker run` and a DB that was still accepting connections a moment ago.
i=0
until node -e "
  const {Client}=require('pg');
  const c=new Client({connectionString:process.env.DATABASE_URL});
  c.connect().then(()=>c.end()).then(()=>process.exit(0)).catch(()=>process.exit(1));
" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "!! Database never became reachable. Check docker-compose.yml service 'db'." >&2
    exit 1
  fi
  [ $((i % 5)) -eq 1 ] && echo "    waiting for the database..."
  sleep 2
done
echo "==> Database is up"

# --- 2. migrations ----------------------------------------------------------
echo "==> Applying migrations"
npx prisma migrate deploy

# --- 3. seed ----------------------------------------------------------------
# A seed failure must not loop the container: `restart: unless-stopped` would
# restart it forever and bury the real error. The app still serves, and the
# reason is right here in the log window the user is watching.
echo "==> Seeding (skipped automatically if already done)"
if ! npx prisma db seed; then
  echo "" >&2
  echo "!! The seed FAILED, so there may be no account to log in with." >&2
  echo "!! Scroll up for the reason. Fix it, then run start.bat again." >&2
  echo "" >&2
fi

# --- 4. serve ---------------------------------------------------------------
# The published port is chosen on the host (APP_PORT in .env); no need to guess
# it here, and guessing wrong is how a wrong address ends up in the docs.
echo "==> HOOHR is starting up"
echo ""
exec npm run start
