/**
 * Cong bo phuong an tot nhat. Khong co ban chinh thuc thi giao vien khong xem duoc lich ca
 * nhan, va moi luong dua tren "thoi khoa bieu dang dung" — bao vang, doi tiet, lich iCal —
 * deu tra ve loi.
 *
 * Diem luu trong CSDL duoc cham bang cong thuc CO HIEU LUC LUC LUU. Cong thuc thi co doi:
 * hom nay "mon uu tien o tiet cuoi" moi bat dau nhin ca buoi chieu. Xep hang bang con so cu
 * la xep hang bang hai thuoc do khac nhau — nen cham lai het bang cong thuc hien tai roi
 * moi so, va ghi de diem cu de man hinh khong con so la.
 */
import '../src/load-env';
import { randomBytes } from 'crypto';
import { writeSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConstraintService, TimeSlot } from '../src/algorithm/constraint.service';

/**
 * Ghi thẳng xuống mô tả tệp, không qua bộ đệm.
 *
 * `console.log` ghi vào bộ đệm khi đầu ra là một ống dẫn, còn `process.exit` thì cắt ngang
 * phần chưa kịp xả. Đã mất trọn vẹn đầu ra của kịch bản này một lần vì đúng cặp ấy, và vì
 * đầu ra trống trông y như "chưa chạy" nên mất thêm một lượt nữa mới nhận ra.
 */
const say = (line = '') => writeSync(1, `${line}
`);

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const constraints = app.get(ConstraintService);

  const candidates = await prisma.generatedTimetable.findMany({ include: { slots: true } });
  if (candidates.length === 0) {
    say('Chua co phuong an nao.');
    process.exit(1);
  }

  const scored: Array<{ id: string; name: string; score: number; hard: number; was: number | null }> = [];
  let semesterId = '';

  for (const candidate of candidates) {
    if (candidate.semester_id !== semesterId) {
      semesterId = candidate.semester_id;
      await constraints.initialize(semesterId);
    }

    const slots: TimeSlot[] = candidate.slots.map((s) => ({
      id: s.id, day: s.day, period: s.period, classId: s.class_id,
      subjectId: s.subject_id, teacherId: s.teacher_id, roomId: s.room_id ?? undefined,
    }));

    const detail = constraints.getFitnessDetails(slots);
    scored.push({
      id: candidate.id,
      name: candidate.name,
      score: detail.score,
      hard: detail.hardViolations,
      was: candidate.fitness_score,
    });
  }

  // Mot ban dung duoc luon hon mot ban dep hon ma con loi cung
  scored.sort((a, b) => (a.hard !== b.hard ? a.hard - b.hard : b.score - a.score));

  say('Cham lai bang cong thuc hien tai:');
  for (const row of scored) {
    const moved = row.was !== null && row.was !== row.score ? ` (luu la ${row.was})` : '';
    say(`  ${String(row.score).padStart(7)}${moved.padEnd(18)} ${row.hard} loi cung  ${row.name}`);
  }

  const best = scored[0];
  if (best.hard > 0) {
    say(`\nKhong cong bo: ban tot nhat van con ${best.hard} loi cung.`);
    process.exit(1);
  }

  await prisma.$transaction([
    ...scored.map((row) =>
      prisma.generatedTimetable.update({ where: { id: row.id }, data: { fitness_score: row.score } }),
    ),
    prisma.generatedTimetable.updateMany({ where: { is_official: true }, data: { is_official: false } }),
    // Cap luon ma lien ket cong khai, nhu nut Cong bo tren giao dien: thieu no thi ban chinh
    // thuc khong lay duoc ma QR
    prisma.generatedTimetable.update({
      where: { id: best.id },
      data: { is_official: true, public_token: (await prisma.generatedTimetable.findUnique({ where: { id: best.id } }))?.public_token ?? randomBytes(16).toString('hex') },
    }),
  ]);

  const official = await prisma.generatedTimetable.findMany({ where: { is_official: true } });
  say(`\nDa cong bo: "${best.name}", diem ${best.score}`);
  say(`So ban dang mang co chinh thuc: ${official.length} (phai la 1)`);
  process.exit(0);
}

main().catch((e) => { say(`Hong: ${e?.stack ?? e}`); process.exit(1); });
