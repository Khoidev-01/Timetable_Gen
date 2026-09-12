/**
 * "Mon uu tien o tiet cuoi" co bo sot lop hoc buoi chieu khong?
 *
 * Phep kiem viet: `s.period > 3 && s.period <= 5`. Nghia la no chi nhin buoi sang. Mot tiet
 * Toan xep vao tiet 4 buoi sang bi phat 15 diem; cung tiet Toan ay xep vao tiet 9 buoi
 * chieu — tiet ap chot cua buoi, hoc sinh met tuong duong — thi khong bi phat gi.
 *
 * Truong nay co lop hoc sang va lop hoc chieu. Neu so tiet uu tien nam o cuoi buoi chieu la
 * dang ke, thi day khong phai mot chi tiet, no la mot mang cua bang diem dang mu.
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConstraintService, TimeSlot } from '../src/algorithm/constraint.service';

const PRIORITY = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH'];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const constraints = app.get(ConstraintService);

  const tt = await prisma.generatedTimetable.findFirst({
    where: { is_official: true }, orderBy: { created_at: 'desc' }, include: { slots: true },
  });
  await constraints.initialize(tt!.semester_id);

  const slots: TimeSlot[] = tt!.slots.map((s) => ({
    id: s.id, day: s.day, period: s.period, classId: s.class_id,
    subjectId: s.subject_id, teacherId: s.teacher_id, roomId: s.room_id ?? undefined,
  }));

  const codeOf = (id: number) => (constraints as any).getSubjectCode(id) as string;
  const isPriority = (id: number) => PRIORITY.some((p) => codeOf(id).includes(p));

  // Buoi chinh cua moi lop: buoi ma lop do co nhieu tiet nhat
  const sessionOfClass = new Map<string, number>();
  const tally = new Map<string, [number, number]>();
  for (const s of slots) {
    const t = tally.get(s.classId) ?? [0, 0];
    t[s.period <= 5 ? 0 : 1] += 1;
    tally.set(s.classId, t);
  }
  for (const [classId, [morning, afternoon]] of tally) {
    sessionOfClass.set(classId, morning >= afternoon ? 0 : 1);
  }

  let morningClasses = 0;
  let afternoonClasses = 0;
  for (const [, session] of sessionOfClass) session === 0 ? morningClasses++ : afternoonClasses++;

  let caught = 0;   // dang bi phat: tiet 4-5
  let missed = 0;   // dang khong bi phat: tiet 9-10
  for (const s of slots) {
    if (!isPriority(s.subjectId)) continue;
    if (s.period === 4 || s.period === 5) caught += 1;
    if (s.period === 9 || s.period === 10) missed += 1;
  }

  const w = constraints.weights.morningPriority;
  console.log(`${morningClasses} lop hoc chinh buoi sang, ${afternoonClasses} lop hoc chinh buoi chieu\n`);
  console.log(`Tiet uu tien o tiet 4-5 (bi phat)      : ${caught} -> ${caught * w} diem`);
  console.log(`Tiet uu tien o tiet 9-10 (KHONG bi phat): ${missed} -> le ra ${missed * w} diem`);
  console.log(`\nPhep kiem hien tai: s.period > 3 && s.period <= 5`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
