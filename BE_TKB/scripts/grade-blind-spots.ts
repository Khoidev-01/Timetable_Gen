/**
 * Xep hang tong the che duoc nhung gi?
 *
 * Mot con so cho ca truong la mot con so trung binh, va trung binh che di ca hai dau. Loi
 * phan nan o truong khong den tu "trung binh", no den tu dung mot nguoi co lich xau nhat.
 * Kich ban nay do do lech giua cac giao vien tren chinh thoi khoa bieu duoc danh gia "Tot".
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConstraintService, TimeSlot } from '../src/algorithm/constraint.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const constraints = app.get(ConstraintService);

  const timetable = await prisma.generatedTimetable.findFirst({
    where: { is_official: true },
    orderBy: { created_at: 'desc' },
    include: { slots: true },
  });
  if (!timetable) { console.log('Chua cong bo thoi khoa bieu nao.'); process.exit(1); }

  await constraints.initialize(timetable.semester_id);
  const slots: TimeSlot[] = timetable.slots.map((s) => ({
    id: s.id, day: s.day, period: s.period, classId: s.class_id,
    subjectId: s.subject_id, teacherId: s.teacher_id, roomId: s.room_id ?? undefined,
  }));

  const overall = constraints.getFitnessDetails(slots);
  console.log(`Toan truong: ${overall.quality.usableLabel} · Chat luong ${overall.quality.gradeLabel}`);
  console.log(`             ${overall.quality.avoidablePerSlot} diem phat tranh duoc moi tiet\n`);

  const teachers = await prisma.teacher.findMany({ select: { id: true, code: true, full_name: true } });
  const nameOf = new Map(teachers.map((t) => [t.id, `${t.code} ${t.full_name}`]));

  const byTeacher = new Map<string, TimeSlot[]>();
  for (const slot of slots) {
    if (!byTeacher.has(slot.teacherId)) byTeacher.set(slot.teacherId, []);
    byTeacher.get(slot.teacherId)!.push(slot);
  }

  const rows = [...byTeacher].map(([teacherId, own]) => {
    const penalty = constraints.teacherPenalty(teacherId, own);
    const sessions = new Set(own.map((s) => `${s.day}-${s.period <= 5 ? 0 : 1}`)).size;
    const daysOff = 6 - new Set(own.map((s) => s.day)).size;
    const bothSessions = [...new Set(own.map((s) => s.day))].filter((day) => {
      const inDay = own.filter((s) => s.day === day);
      return inDay.some((s) => s.period <= 5) && inDay.some((s) => s.period > 5);
    }).length;

    return {
      name: nameOf.get(teacherId) ?? teacherId,
      periods: own.length,
      perPeriod: penalty / own.length,
      sessions,
      daysOff,
      bothSessions,
    };
  });

  rows.sort((a, b) => b.perPeriod - a.perPeriod);

  const values = rows.map((r) => r.perPeriod);
  const median = [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

  console.log('NAM GIAO VIEN CO LICH XAU NHAT');
  rows.slice(0, 5).forEach((r) =>
    console.log(`  ${r.name.padEnd(28)} ${r.perPeriod.toFixed(1).padStart(6)} diem/tiet · ${r.periods} tiet · ${r.sessions} buoi · ${r.daysOff} ngay nghi · ${r.bothSessions} ngay ca sang lan chieu`),
  );

  console.log('\nNAM GIAO VIEN CO LICH TOT NHAT');
  rows.slice(-5).reverse().forEach((r) =>
    console.log(`  ${r.name.padEnd(28)} ${r.perPeriod.toFixed(1).padStart(6)} diem/tiet · ${r.periods} tiet · ${r.sessions} buoi · ${r.daysOff} ngay nghi · ${r.bothSessions} ngay ca sang lan chieu`),
  );

  console.log(`\nTrung vi ${median.toFixed(1)} diem/tiet · nguoi xau nhat ${values[0].toFixed(1)} · nguoi tot nhat ${values[values.length - 1].toFixed(1)}`);
  console.log(`Nguoi xau nhat gap ${(values[0] / Math.max(0.01, values[values.length - 1])).toFixed(1)} lan nguoi tot nhat.`);
  console.log(`So giao vien khong co ngay nghi nao: ${rows.filter((r) => r.daysOff === 0).length}/${rows.length}`);
  console.log(`So giao vien phai o truong ca sang lan chieu it nhat 3 ngay: ${rows.filter((r) => r.bothSessions >= 3).length}/${rows.length}`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
