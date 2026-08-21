#!/bin/sh
set -e

echo "Syncing database schema..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "Warning: prisma db push had issues, continuing..."

echo "Seeding admin user if not exists..."
node scripts/seed-admin.js || echo "Warning: seed-admin had issues, continuing..."

echo "Starting application..."
exec node dist/src/main.js
