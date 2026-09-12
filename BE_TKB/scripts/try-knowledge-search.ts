import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { KnowledgeService } from '../src/ai/knowledge/knowledge.service';

const QUERIES = [
  'Buổi chiều được xếp mấy tiết?',
  'một buổi học tối đa mấy tiết',
  'định mức tiết dạy',
  'dinh muc tiet day',            // khong dau
  'giáo viên chủ nhiệm được giảm mấy tiết',
  'chào cờ có tính vào số tiết dạy không',
  'thể dục xếp buổi nào',
  'vì sao hệ thống chặn không cho xếp lịch',
  'muốn đổi tiết với đồng nghiệp thì làm sao',
  'giá vàng hôm nay',             // phai khong tim thay
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const knowledge = app.get(KnowledgeService);

  for (const q of QUERIES) {
    const hits = await knowledge.search(q, 2);
    console.log(`\n"${q}"`);
    if (hits.length === 0) {
      console.log('  (khong tim thay — dung nhu mong doi neu cau nay ngoai tai lieu)');
      continue;
    }
    hits.forEach((h) => console.log(`  ${h.score}  [${h.source}${h.article ? ', ' + h.article : ''}] ${h.title}`));
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
