/**
 * Xep lai thoi khoa bieu cho bo du lieu vua nhap, qua dung duong ma nut "Bat dau xep" goi.
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AlgorithmService } from '../src/algorithm/algorithm.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const algorithm = app.get(AlgorithmService);

  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });
  const assignments = await prisma.teachingAssignment.count({ where: { semester_id: semester!.id } });
  console.log(`Hoc ky: ${semester!.name} (${semester!.id}) — ${assignments} dong phan cong`);

  const started = Date.now();
  const result: any = await algorithm.runAlgorithm(semester!.id);
  const seconds = (Date.now() - started) / 1000;

  console.log(`\nXep xong trong ${seconds.toFixed(1)}s`);
  console.log(`  thanh cong: ${result.success}`);
  console.log(`  diem: ${result.fitness_score ?? result.score ?? 'n/a'}`);
  console.log(`  tiet da xep: ${result.placed ?? 'n/a'} / ${result.required ?? 'n/a'}`);
  if (result.message) console.log(`  ghi chu: ${result.message}`);

  const timetable = await prisma.generatedTimetable.findFirst({ orderBy: { created_at: 'desc' } });
  const slots = await prisma.timetableSlot.count({ where: { timetable_id: timetable!.id } });
  console.log(`\nThoi khoa bieu "${timetable!.name}": ${slots} tiet, diem ${timetable!.fitness_score}, chinh thuc=${timetable!.is_official}`);

  // app.close() treo o day vi ket noi Redis khong dong, ma viec da xong roi
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
