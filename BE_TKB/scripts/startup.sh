#!/bin/sh
set -e

echo "Syncing database schema..."
npx prisma db push --skip-generate

echo "Seeding admin user if not exists..."
node scripts/seed-admin.js

echo "Starting application..."
exec node dist/src/main.js
