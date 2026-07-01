#!/bin/sh
set -e

export NODE_ENV=production

# Apply database migrations, then hand off (exec) to the app server so the Node
# process is the direct signal target and graceful shutdown (SIGTERM) works.
echo "==> Applying database migrations"
node_modules/.bin/tsx src/db/migrate.ts

# Populate demo data on first boot (idempotent; never blocks startup).
echo "==> Ensuring demo data is seeded"
node_modules/.bin/tsx scripts/seed-if-needed.ts || echo "==> Seed guard reported an issue; continuing startup"

echo "==> Starting SentinelForge (Next.js + Socket.IO)"
exec node_modules/.bin/tsx server.ts
