import '../src/load-env';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const available: any[] = await prisma.$queryRawUnsafe(
    `SELECT name, default_version, installed_version FROM pg_available_extensions
     WHERE name IN ('vector','pg_trgm','unaccent') ORDER BY name`);
  console.log('Extension:', available.map((e) => `${e.name} (co ban ${e.default_version}, da cai: ${e.installed_version ?? 'chua'})`).join(' | ') || '(khong co cai nao)');
  const ver: any[] = await prisma.$queryRawUnsafe('SELECT version()');
  console.log(String(ver[0].version).slice(0, 60));
  await prisma.$disconnect();
})();
