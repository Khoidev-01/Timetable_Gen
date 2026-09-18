#!/bin/sh
set -e

echo "Syncing database schema..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "Warning: prisma db push had issues, continuing..."

echo "Running one-time data migrations..."
node scripts/run-data-migrations.js

echo "Seeding admin user if not exists..."
node scripts/seed-admin.js

echo "Starting application..."
exec node dist/src/main.js
