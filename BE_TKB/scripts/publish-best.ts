/**
 * Cong bo phuong an tot nhat. Khong co ban chinh thuc thi giao vien khong xem duoc lich ca
 * nhan, va moi luong dua tren "thoi khoa bieu dang dung" — bao vang, doi tiet, lich iCal —
 * deu tra ve loi.
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);

  const best = await prisma.generatedTimetable.findFirst({ orderBy: { fitness_score: 'desc' } });
  if (!best) { console.log('Chua co phuong an nao.'); process.exit(1); }

  await prisma.$transaction([
    prisma.generatedTimetable.updateMany({ where: { is_official: true }, data: { is_official: false } }),
    prisma.generatedTimetable.update({ where: { id: best.id }, data: { is_official: true } }),
  ]);

  const official = await prisma.generatedTimetable.findMany({ where: { is_official: true } });
  console.log(`Da cong bo: "${best.name}", diem ${best.fitness_score}`);
  console.log(`So ban dang mang co chinh thuc: ${official.length} (phai la 1)`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
