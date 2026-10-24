#!/bin/sh
set -e

echo "Applying database migrations..."
npm run migrate:deploy

if [ "$SEED_DEMO_DATA" = "true" ]; then
  echo "Seeding demo users and documents..."
  node dist/db/seed.js
  node dist/db/seed-documents.js
fi

# exec makes Node the main process, so it receives SIGTERM and shuts down gracefully
exec node dist/server.js