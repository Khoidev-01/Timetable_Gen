/**
 * Chuyen bot tiet cua nhung giao vien bi phan cong vuot dinh muc sang dong nghiep cung mon
 * con cho — dung viec ma pre-flight dang goi y ("Chuyen 1 tiet sang giao vien khac").
 *
 * Khong dong vao dinh muc: nang tran len cho het bao do la giau loi, khong phai sua loi.
 * Chi doi nguoi day mot dong phan cong, va chi doi sang nguoi DA day dung mon do.
 *
 * Chay kem --apply moi ghi; khong co thi chi in ra xem truoc.
 */
import '../src/load-env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

(async () => {
  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });
  const teachers = await prisma.teacher.findMany({
    select: { id: true, code: true, full_name: true, max_periods_per_week: true },
  });
  // Chao co va sinh hoat cuoi tuan khong phai tiet day va khong tinh vao dinh muc — dung
  // quy tac voi phep kiem tien xep lich. Dem chung vao day thi kich ban nay bao vuot dinh
  // muc cho nhung nguoi that ra khong vuot, roi di tim cho chuyen khong bao gio tim ra.
  const assignments = (await prisma.teachingAssignment.findMany({
    where: { semester_id: semester!.id },
    select: {
      id: true, teacher_id: true, subject_id: true, class_id: true, total_periods: true,
      subject: { select: { is_special: true } },
    },
  })).filter((a) => !a.subject.is_special);

  const loadOf = (teacherId: string) =>
    assignments.filter((a) => a.teacher_id === teacherId).reduce((sum, a) => sum + a.total_periods, 0);

  // Ai day duoc mon nao: lay tu chinh bang phan cong, khong doan theo ma giao vien
  const teachesSubject = new Map<number, Set<string>>();
  for (const a of assignments) {
    if (!teachesSubject.has(a.subject_id)) teachesSubject.set(a.subject_id, new Set());
    teachesSubject.get(a.subject_id)!.add(a.teacher_id);
  }

  const load = new Map(teachers.map((t) => [t.id, loadOf(t.id)]));
  const quota = new Map(teachers.map((t) => [t.id, t.max_periods_per_week || 0]));
  const nameOf = new Map(teachers.map((t) => [t.id, `${t.code} ${t.full_name}`]));
  const subjects = new Map((await prisma.subject.findMany({ select: { id: true, code: true } })).map((s) => [s.id, s.code]));
  const classes = new Map((await prisma.class.findMany({ select: { id: true, name: true } })).map((c) => [c.id, c.name]));

  const moves: Array<{ assignmentId: string; from: string; to: string; label: string }> = [];

  for (const teacher of teachers) {
    let over = (load.get(teacher.id) ?? 0) - (quota.get(teacher.id) ?? 0);
    if (over <= 0) continue;

    // Bo dong nho nhat truoc: chuyen mot dong 1 tiet gay xao tron it hon mot dong 4 tiet
    const mine = assignments
      .filter((a) => a.teacher_id === teacher.id)
      .sort((a, b) => a.total_periods - b.total_periods);

    for (const row of mine) {
      if (over <= 0) break;
      if (row.total_periods > over + 2) continue;

      const candidate = [...(teachesSubject.get(row.subject_id) ?? [])]
        .filter((id) => id !== teacher.id)
        .filter((id) => (load.get(id) ?? 0) + row.total_periods <= (quota.get(id) ?? 0))
        .sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0))[0];

      if (!candidate) continue;

      moves.push({
        assignmentId: row.id,
        from: teacher.id,
        to: candidate,
        label: `${nameOf.get(teacher.id)} -> ${nameOf.get(candidate)} : ${subjects.get(row.subject_id)} lop ${classes.get(row.class_id)} (${row.total_periods} tiet)`,
      });

      load.set(teacher.id, (load.get(teacher.id) ?? 0) - row.total_periods);
      load.set(candidate, (load.get(candidate) ?? 0) + row.total_periods);
      over -= row.total_periods;
    }

    if (over > 0) {
      console.log(`  CHUA GIAI QUYET: ${nameOf.get(teacher.id)} van vuot ${over} tiet, khong co dong nghiep cung mon con cho.`);
    }
  }

  console.log(`\n${moves.length} dong phan cong se doi nguoi day:`);
  moves.forEach((m) => console.log(`  ${m.label}`));

  if (!apply) {
    console.log('\nXem truoc. Them --apply de ghi that.');
    await prisma.$disconnect();
    return;
  }

  for (const move of moves) {
    await prisma.teachingAssignment.update({ where: { id: move.assignmentId }, data: { teacher_id: move.to } });
  }

  const stillOver = teachers.filter((t) => (load.get(t.id) ?? 0) > (quota.get(t.id) ?? 0));
  console.log(`\nDa chuyen ${moves.length} dong. Con ${stillOver.length} giao vien vuot dinh muc.`);
  await prisma.$disconnect();
})();
