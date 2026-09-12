/**
 * Vi sao mot so giao vien khong co ngay nghi nao?
 *
 * Ba nguyen nhan cho ra cung mot trieu chung nhung sua khac han nhau: qua nhieu tiet (khong
 * phai — nang nhat 15 tren tran 17), day qua nhieu lop khac nhau nen phai rai ra, hoac day
 * ca lop hoc sang lan lop hoc chieu nen buoc phai co mat ca hai buoi.
 */
import '../src/load-env';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  const tt = await prisma.generatedTimetable.findFirst({
    where: { is_official: true }, orderBy: { created_at: 'desc' }, include: { slots: true },
  });
  const semester = tt!.semester_id;
  const classes = new Map(
    (await prisma.class.findMany({ select: { id: true, name: true, main_session: true } }))
      .map((c) => [c.id, c]),
  );
  const teachers = new Map(
    (await prisma.teacher.findMany({ select: { id: true, code: true, full_name: true } }))
      .map((t) => [t.id, t]),
  );

  const byTeacher = new Map<string, typeof tt.slots>();
  for (const s of tt!.slots) {
    if (!byTeacher.has(s.teacher_id)) byTeacher.set(s.teacher_id, []);
    byTeacher.get(s.teacher_id)!.push(s);
  }

  const rows = [...byTeacher].map(([id, own]) => {
    const days = new Set(own.map((s) => s.day)).size;
    const ownClasses = new Set(own.map((s) => s.class_id));
    const sessions = new Set([...ownClasses].map((c) => classes.get(c)?.main_session));
    return {
      code: teachers.get(id)?.code ?? id,
      name: teachers.get(id)?.full_name ?? '',
      periods: own.length,
      days,
      classes: ownClasses.size,
      bothSessions: sessions.size > 1,
    };
  });

  const noDayOff = rows.filter((r) => r.days >= 6);
  const rest = rows.filter((r) => r.days < 6);

  console.log(`${noDayOff.length}/${rows.length} giao vien khong co ngay nghi nao\n`);
  console.log('Ho day bao nhieu lop, va co day ca hai buoi khong:');
  noDayOff.forEach((r) =>
    console.log(`  ${r.code} ${r.name.padEnd(22)} ${String(r.periods).padStart(2)} tiet · ${String(r.classes).padStart(2)} lop · ${r.bothSessions ? 'day CA HAI buoi' : 'chi mot buoi'}`));

  const avg = (list: typeof rows, key: 'classes' | 'periods') =>
    (list.reduce((s, r) => s + r[key], 0) / Math.max(1, list.length)).toFixed(1);

  console.log(`\nSo lop trung binh: nguoi khong co ngay nghi ${avg(noDayOff, 'classes')} lop — nguoi con lai ${avg(rest, 'classes')} lop`);
  console.log(`So tiet trung binh: ${avg(noDayOff, 'periods')} so voi ${avg(rest, 'periods')}`);
  console.log(`Day ca hai buoi: ${noDayOff.filter((r) => r.bothSessions).length}/${noDayOff.length} so voi ${rest.filter((r) => r.bothSessions).length}/${rest.length}`);

  await prisma.$disconnect();
})();
