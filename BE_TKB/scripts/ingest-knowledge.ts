/**
 * Nap kho tai lieu tro ly duoc phep trich dan. Chay lai duoc nhieu lan: no thay hang, khong
 * cong don, nen sua file nguon roi chay lai la du.
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { KnowledgeService } from '../src/ai/knowledge/knowledge.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const knowledge = app.get(KnowledgeService);
  const prisma = app.get(PrismaService);

  const result = await knowledge.ingest();
  console.log(`Da nap ${result.chunks} mau tu ${result.files} file.`);

  const rows = await prisma.knowledgeChunk.findMany({ select: { source: true, article: true, title: true } });
  const bySource = new Map<string, number>();
  rows.forEach((r) => bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1));
  console.log('\nTheo nguon:');
  [...bySource].forEach(([source, n]) => console.log(`  ${source}: ${n} mau`));
  console.log('\nCo so hieu dieu khoan:', rows.filter((r) => r.article).length, '/', rows.length);

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
