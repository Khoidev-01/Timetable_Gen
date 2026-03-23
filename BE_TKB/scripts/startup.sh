#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Seeding admin user if not exists..."
node scripts/seed-admin.js

echo "Starting application..."
exec node dist/src/main.js
