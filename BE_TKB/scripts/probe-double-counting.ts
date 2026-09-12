/**
 * Co tieu chi nao dang dem trung cung mot su viec khong?
 *
 * Cach kiem: lay thoi khoa bieu that, doi MOT tiet sang cho khac, roi xem nhung tieu chi nao
 * cung thay doi. Neu hai tieu chi luon doi cung luc va cung chieu, chung dang do cung mot
 * thu — va su viec do bi tinh tien hai lan.
 *
 * Khong doc ma nguon de doan: hai ham co the trong khac nhau ma van dem cung mot dieu.
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

  const tt = await prisma.generatedTimetable.findFirst({
    where: { is_official: true }, orderBy: { created_at: 'desc' }, include: { slots: true },
  });
  await constraints.initialize(tt!.semester_id);

  const slots: TimeSlot[] = tt!.slots.map((s) => ({
    id: s.id, day: s.day, period: s.period, classId: s.class_id,
    subjectId: s.subject_id, teacherId: s.teacher_id, roomId: s.room_id ?? undefined,
  }));

  const countsOf = (schedule: TimeSlot[]) => {
    const detail = constraints.getFitnessDetails(schedule);
    const map = new Map<string, number>();
    for (const item of detail.breakdown.soft) map.set(item.label, item.count);
    return map;
  };

  const base = countsOf(slots);

  // Doi cho ngau nhien hai tiet cung lop, nhieu lan, va ghi lai tieu chi nao cung doi
  const together = new Map<string, number>();
  const alone = new Map<string, number>();
  let samples = 0;

  const byClass = new Map<string, TimeSlot[]>();
  for (const s of slots) {
    if (!byClass.has(s.classId)) byClass.set(s.classId, []);
    byClass.get(s.classId)!.push(s);
  }
  const classIds = [...byClass.keys()];

  for (let attempt = 0; attempt < 120; attempt++) {
    const own = byClass.get(classIds[attempt % classIds.length])!;
    const a = own[Math.floor(Math.random() * own.length)];
    const b = own[Math.floor(Math.random() * own.length)];
    if (a === b) continue;

    const before = { day: a.day, period: a.period };
    a.day = b.day; a.period = b.period;
    b.day = before.day; b.period = before.period;

    const after = countsOf(slots);

    // Tra lai nguyen trang: mot phep do khong duoc lam doi thoi khoa bieu
    const revert = { day: a.day, period: a.period };
    a.day = b.day; a.period = b.period;
    b.day = revert.day; b.period = revert.period;

    const changed = [...after.keys()].filter((label) => after.get(label) !== base.get(label));
    if (changed.length === 0) continue;
    samples += 1;

    for (const label of changed) alone.set(label, (alone.get(label) ?? 0) + 1);
    for (const first of changed) {
      for (const second of changed) {
        if (first >= second) continue;
        const key = `${first}  ||  ${second}`;
        together.set(key, (together.get(key) ?? 0) + 1);
      }
    }
  }

  console.log(`${samples} phep doi cho lam thay doi bang diem\n`);
  console.log('Cap tieu chi luon doi CUNG LUC (ty le tren so lan ca hai cung xuat hien):');

  const pairs = [...together]
    .map(([key, n]) => {
      const [first, second] = key.split('  ||  ');
      const union = (alone.get(first) ?? 0) + (alone.get(second) ?? 0) - n;
      return { first, second, n, ratio: n / Math.max(1, union) };
    })
    .filter((p) => p.n >= 5)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 8);

  for (const p of pairs) {
    console.log(`  ${(p.ratio * 100).toFixed(0).padStart(3)}%  ${p.first}  +  ${p.second}  (${p.n} lan)`);
  }
  console.log('\nTy le cang gan 100% thi hai tieu chi cang do cung mot thu.');

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
