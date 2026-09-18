/**
 * Kiem tra bo du lieu dang nam trong CSDL co dung cac quy tac phan cong khong - doc thang tu
 * CSDL, khong tin vao script da sinh ra file.
 *
 * Dung: npx ts-node --transpile-only scripts/audit-sample-data.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CEREMONY = new Set(['CHAO_CO', 'SH_CUOI_TUAN']);

(async () => {
  let failures = 0;
  const check = (label: string, bad: string[], ok: string) => {
    console.log(`${bad.length === 0 ? 'DAT ' : 'HONG'}  ${label}: ${bad.length === 0 ? ok : `${bad.length} cho sai, vd ${bad.slice(0, 4).join(' | ')}`}`);
    if (bad.length) failures++;
  };

  const semesters = await prisma.semester.findMany({ orderBy: { term_order: 'asc' } });
  const classes = await prisma.class.findMany({ include: { fixed_room: true } });
  const teachers = await prisma.teacher.findMany();
  const byTeacher = new Map(teachers.map((t) => [t.id, t]));

  for (const semester of semesters) {
    console.log(`\n=== ${semester.name}`);
    const rows = await prisma.teachingAssignment.findMany({
      where: { semester_id: semester.id },
      include: { subject: true, class: true },
    });
    const major = (id: string) => byTeacher.get(id)?.major_subject ?? '?';

    // Moi lop 29 tiet day, 26 buoi chinh, du Chao co + Sinh hoat
    const perClass = new Map<string, typeof rows>();
    for (const r of rows) perClass.set(r.class.name, [...(perClass.get(r.class.name) ?? []), r]);
    const shape: string[] = [];
    for (const cls of classes) {
      const list = perClass.get(cls.name) ?? [];
      const teaching = list.filter((r) => !CEREMONY.has(r.subject.code)).reduce((n, r) => n + r.total_periods, 0);
      const off = list.filter((r) => ['GDTC', 'GDQP'].includes(r.subject.code)).reduce((n, r) => n + r.total_periods, 0);
      const ceremonies = list.filter((r) => CEREMONY.has(r.subject.code)).length;
      if (teaching !== 29 || teaching - off !== 26 || ceremonies !== 2) shape.push(`${cls.name} ${teaching}/${teaching - off}/${ceremonies}`);
    }
    check('Moi lop 29 tiet, 26 buoi chinh, 2 hoat dong tap the', shape, `${classes.length} lop`);

    check('CN Nong nghiep do GV Sinh/Hoa', rows.filter((r) => r.subject.code === 'CNNN' && !['SINH', 'HOA'].includes(major(r.teacher_id))).map((r) => `${r.class.name}:${major(r.teacher_id)}`), `${rows.filter((r) => r.subject.code === 'CNNN').length} dong`);
    check('CN Cong nghiep do GV Ly/Tin', rows.filter((r) => r.subject.code === 'CNCN' && !['LY', 'TIN'].includes(major(r.teacher_id))).map((r) => `${r.class.name}:${major(r.teacher_id)}`), `${rows.filter((r) => r.subject.code === 'CNCN').length} dong`);
    check('GDDP do GV Su/Dia', rows.filter((r) => r.subject.code === 'GDDP' && !['LS', 'DIA'].includes(major(r.teacher_id))).map((r) => `${r.class.name}:${major(r.teacher_id)}`), `${rows.filter((r) => r.subject.code === 'GDDP').length} dong`);
    const homeroomOf = new Map(classes.map((c) => [c.id, c.homeroom_teacher_id]));
    check('HDTN do GVCN cua lop', rows.filter((r) => r.subject.code === 'HDTN' && r.teacher_id !== homeroomOf.get(r.class_id)).map((r) => r.class.name), `${rows.filter((r) => r.subject.code === 'HDTN').length} dong`);
    check('Chao co, Sinh hoat dung ten GVCN', rows.filter((r) => CEREMONY.has(r.subject.code) && r.teacher_id !== homeroomOf.get(r.class_id)).map((r) => `${r.class.name}:${r.subject.code}`), `${rows.filter((r) => CEREMONY.has(r.subject.code)).length} dong`);
    check('Khong co GV chi day mon kiem nhiem', teachers.filter((t) => ['CNCN', 'CNNN', 'GDDP', 'HDTN', 'CN'].includes(t.major_subject ?? '')).map((t) => t.code), 'khong ai');

    // LT va TH cung giao vien
    const pairs = new Map<string, Set<string>>();
    for (const r of rows.filter((x) => ['THEORY', 'PRACTICE'].includes(x.period_type))) {
      const key = `${r.class.name}:${r.subject.code}`;
      pairs.set(key, (pairs.get(key) ?? new Set()).add(r.teacher_id));
    }
    check('Ly thuyet va thuc hanh cung GV', [...pairs].filter(([, s]) => s.size > 1).map(([k]) => k), `${[...pairs].length} cap lop-mon`);

    // Dinh muc (khong tinh hoat dong tap the)
    const load = new Map<string, number>();
    for (const r of rows) if (!CEREMONY.has(r.subject.code)) load.set(r.teacher_id, (load.get(r.teacher_id) ?? 0) + r.total_periods);
    check('Khong GV nao vuot dinh muc hieu luc', teachers.filter((t) => (load.get(t.id) ?? 0) > t.max_periods_per_week).map((t) => `${t.code} ${load.get(t.id)}>${t.max_periods_per_week}`), `${teachers.length} GV`);
    check('Moi GV deu co tiet day', teachers.filter((t) => !load.get(t.id)).map((t) => t.code), 'du');
    check('Dinh muc hieu luc = 17 - giam tru', teachers.filter((t) => t.max_periods_per_week + t.workload_reduction !== 17).map((t) => `${t.code} ${t.max_periods_per_week}+${t.workload_reduction}`), 'khop');

    // Giao vien chi day mot buoi (tru GDTC, GDQP)
    const sessions = new Map<string, Set<number>>();
    for (const r of rows) {
      if (['GDTC', 'GDQP'].includes(r.subject.code)) continue;
      sessions.set(r.teacher_id, (sessions.get(r.teacher_id) ?? new Set()).add(r.class.main_session));
    }
    check('GV van hoa chi day mot buoi', [...sessions].filter(([, s]) => s.size > 1).map(([id]) => byTeacher.get(id)!.code), 'dung');
  }

  // Lop va phong
  check('Moi lop co GVCN va phong co dinh', classes.filter((c) => !c.homeroom_teacher_id || !c.fixed_room_id).map((c) => c.name), `${classes.length} lop`);
  const homeroomCount = new Map<string, number>();
  for (const c of classes) homeroomCount.set(c.homeroom_teacher_id!, (homeroomCount.get(c.homeroom_teacher_id!) ?? 0) + 1);
  check('Moi GV chu nhiem toi da mot lop', [...homeroomCount].filter(([, n]) => n > 1).map(([id]) => byTeacher.get(id)!.code), 'dung');
  const reductionOk = teachers.filter((t) => {
    const isHomeroom = homeroomCount.has(t.id);
    return isHomeroom && t.workload_reduction < 4;
  }).map((t) => t.code);
  check('GVCN duoc giam it nhat 4 tiet', reductionOk, 'dung');
  const roomSharing = new Map<string, string[]>();
  for (const c of classes) {
    const key = `${c.fixed_room_id}:${c.main_session}`;
    roomSharing.set(key, [...(roomSharing.get(key) ?? []), c.name]);
  }
  check('Khong hai lop cung buoi chung phong', [...roomSharing.values()].filter((v) => v.length > 1).map((v) => v.join('+')), 'dung');
  const rooms = await prisma.room.groupBy({ by: ['type'], _count: true });
  console.log('\nPhong:', rooms.map((r) => `${r.type}=${r._count}`).join(' '));
  const roles = teachers.filter((t) => t.workload_reduction > 0);
  console.log(`Giao vien co giam tru: ${roles.length}/${teachers.length}, tong ${roles.reduce((n, t) => n + t.workload_reduction, 0)} tiet`);

  console.log(failures === 0 ? '\nTat ca dat.' : `\n${failures} muc hong.`);
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
})();
