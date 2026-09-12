/**
 * Khoan phat nam rai deu hay don cuc?
 *
 * Vong tim kiem dang boc ngau nhien MOT trong 956 tiet roi thu doi cho no. Neu khoan phat
 * don vao mot so it lop / mot so it giao vien, thi phan lon nhung lan boc ay roi vao cho
 * VON DA on — cong suat do dem khong khong.
 *
 * Phep do nay xem ty le: bao nhieu phan tram khoan phat nam o 30% lop (giao vien) nang nhat.
 * Cang lech thi viec huong nuoc di vao cho dang loi cang dang gia.
 */
import '../src/load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AlgorithmService } from '../src/algorithm/algorithm.service';
import { ConstraintService, TimeSlot } from '../src/algorithm/constraint.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const algorithm = app.get(AlgorithmService);
  const constraints = app.get(ConstraintService);

  const tt = await prisma.generatedTimetable.findFirst({
    where: { is_official: true }, orderBy: { created_at: 'desc' }, include: { slots: true },
  });
  await constraints.initialize(tt!.semester_id);

  const slots: TimeSlot[] = tt!.slots.map((s) => ({
    id: s.id, day: s.day, period: s.period, classId: s.class_id,
    subjectId: s.subject_id, teacherId: s.teacher_id, roomId: s.room_id ?? undefined,
  }));

  const byClass = new Map<string, TimeSlot[]>();
  const byTeacher = new Map<string, TimeSlot[]>();
  for (const slot of slots) {
    if (!byClass.has(slot.classId)) byClass.set(slot.classId, []);
    byClass.get(slot.classId)!.push(slot);
    if (!byTeacher.has(slot.teacherId)) byTeacher.set(slot.teacherId, []);
    byTeacher.get(slot.teacherId)!.push(slot);
  }

  const report = (
    title: string,
    penalties: Array<{ key: string; penalty: number; slots: number }>,
  ) => {
    penalties.sort((a, b) => b.penalty - a.penalty);
    const total = penalties.reduce((sum, p) => sum + p.penalty, 0);
    const cut = Math.max(1, Math.round(penalties.length * 0.3));
    const top = penalties.slice(0, cut).reduce((sum, p) => sum + p.penalty, 0);
    const clean = penalties.filter((p) => p.penalty === 0).length;

    console.log(`\n${title} — ${penalties.length} muc, tong phat ${total}`);
    console.log(`  30% nang nhat (${cut} muc) giu ${((top / total) * 100).toFixed(0)}% khoan phat`);
    console.log(`  ${clean} muc khong loi gi ca (${((clean / penalties.length) * 100).toFixed(0)}%)`);
    console.log(`  nang nhat: ${penalties[0].penalty}  |  nhe nhat: ${penalties[penalties.length - 1].penalty}`);
  };

  report(
    'Theo lop',
    [...byClass].map(([key, own]) => ({ key, penalty: constraints.classPenalty(own), slots: own.length })),
  );
  report(
    'Theo giao vien',
    [...byTeacher].map(([key, own]) => ({ key, penalty: constraints.teacherPenalty(key, own), slots: own.length })),
  );

  // Mot lan cham toan bo het bao lau? Quyet dinh duoc viec lam moi bao nhieu vong thi lam moi.
  const started = Date.now();
  for (let i = 0; i < 20; i++) constraints.calculatePenalty(slots);
  console.log(`\nCham toan bo mot lan: ${((Date.now() - started) / 20).toFixed(1)}ms`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
