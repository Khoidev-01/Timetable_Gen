/**
 * Tieu chi "den truong them buoi" co dang doi mot thu ma tieu chi khac cam khong?
 *
 * checkTeacherAttendance lay muc chuan la ceil(so tiet / 5): coi nhu giao vien co the day
 * kin ca nam tiet cua mot buoi. Nhung day nam tiet lien nhau la mot mach 5 tiet, va
 * checkConsecutiveTeaching phat "day qua 4 tiet lien tiep". Xep thua ra mot tiet trong buoi
 * (1,2,3,5) thi lai dinh "tiet trong giao vien".
 *
 * Nghia la muc 4 tiet moi la muc day duoc ma khong dinh tieu chi nao khac. Phep do nay dem
 * xem bao nhieu trong khoan phat "den truong them buoi" thuc ra la cai gia cua viec KHONG
 * day nam tiet lien nhau — tuc la mot khoan ma bo giai khong co ly do gi de duoi theo.
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

  const byTeacher = new Map<string, TimeSlot[]>();
  for (const slot of slots) {
    if (!byTeacher.has(slot.teacherId)) byTeacher.set(slot.teacherId, []);
    byTeacher.get(slot.teacherId)!.push(slot);
  }

  let counted = 0;       // khoan phat cong thuc dang dem
  let priceOfFour = 0;   // phan chi vi khong day 5 tiet lien nhau
  let sessionSplit = 0;  // phan vi lop sang lan lop chieu
  let real = 0;          // phan con lai — bo giai that su co the go

  for (const [, own] of byTeacher) {
    const sessions = new Set(own.map((s) => `${s.day}-${s.period <= 5 ? 0 : 1}`)).size;
    const n = own.length;

    const morning = own.filter((s) => s.period <= 5).length;
    const afternoon = n - morning;

    const formulaFloor = Math.ceil(n / 5);                                   // muc cong thuc lay chuan
    const sessionFloor = Math.ceil(morning / 5) + Math.ceil(afternoon / 5);  // buoc phai tach sang/chieu
    const cleanFloor = Math.ceil(morning / 4) + Math.ceil(afternoon / 4);    // khong dinh tieu chi nao khac

    counted += Math.max(0, sessions - formulaFloor);
    sessionSplit += Math.max(0, sessionFloor - formulaFloor);
    priceOfFour += Math.max(0, cleanFloor - sessionFloor);
    real += Math.max(0, sessions - cleanFloor);
  }

  const w = constraints.weights;
  console.log(`Trong so: den truong them buoi ${w.teacherAttendance}, qua 4 tiet lien tiep ${w.consecutiveTeaching}`);
  console.log(`Day 5 tiet lien nhau de bot mot buoi: duoc ${w.teacherAttendance}, mat ${w.consecutiveTeaching} -> loi ${w.teacherAttendance - w.consecutiveTeaching}\n`);

  console.log(`Cong thuc dang dem                                  : ${counted} loi = ${counted * w.teacherAttendance} diem`);
  console.log(`  trong do, lop sang lan lop chieu nen buoc phai the: ${sessionSplit}`);
  console.log(`  trong do, cai gia cua viec khong day 5 tiet lien  : ${priceOfFour}`);
  console.log(`  con lai, bo giai that su co the go                : ${real} loi = ${real * w.teacherAttendance} diem`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
