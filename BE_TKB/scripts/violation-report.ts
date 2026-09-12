import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConstraintService } from '../src/algorithm/constraint.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const constraints = app.get(ConstraintService);

  // Phuong an 1 la phuong an tot nhat — bo giai sap xep san, doc phuong an cuoi la doc
  // ban kem nhat trong so ba ban duoc giu
  const all = await prisma.generatedTimetable.findMany({
    orderBy: [{ fitness_score: 'desc' }],
    include: { slots: true },
  });
  console.log('Cac phuong an: ' + all.map((t) => `${t.name.split(' —')[0]}=${t.fitness_score}`).join(' | '));
  const timetable = all[0];
  if (!timetable) { console.log('Chua co thoi khoa bieu nao.'); process.exit(0); }

  await constraints.initialize(timetable.semester_id);
  const slots = timetable.slots.map((s) => ({
    id: s.id, day: s.day, period: s.period, classId: s.class_id,
    subjectId: s.subject_id, teacherId: s.teacher_id, roomId: s.room_id ?? undefined,
  }));

  const result: any = constraints.getFitnessDetails(slots);
  console.log(`"${timetable.name}": ${slots.length} tiet, diem ${result.score}, hop le=${result.isValid}, loi cung=${result.hardViolations}`);
  console.log('\nChi tiet:');
  (result.details ?? []).slice(0, 25).forEach((d: string) => console.log('  ' + d));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
