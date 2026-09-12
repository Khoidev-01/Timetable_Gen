/**
 * Truong nay du nguoi va du phong chua, va tai sao co giao vien khong co ngay nghi nao.
 *
 * "Thieu nguoi" va "chia viec khong deu" cho ra cung mot trieu chung — vai giao vien kin
 * lich — nhung cach sua nguoc nhau han: mot ben phai tuyen, mot ben chi phai chia lai. Do
 * theo tung mon thi phan biet duoc.
 */
import '../src/load-env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const QUOTA = 17;

(async () => {
  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });

  // ------------------------------------------------------------ buoi hoc
  const classes = await prisma.class.findMany({ select: { name: true, main_session: true, grade_level: true } });
  const morning = classes.filter((c) => c.main_session === 0).length;
  const afternoon = classes.length - morning;
  console.log(`LOP: ${classes.length} lop — ${morning} hoc sang, ${afternoon} hoc chieu\n`);

  // ------------------------------------------------------------ phong
  const rooms = await prisma.room.groupBy({ by: ['type'], _count: true });
  console.log('PHONG: ' + rooms.map((r) => `${r.type}=${r._count}`).join('  '));
  const classrooms = rooms.find((r) => r.type === 'CLASSROOM')?._count ?? 0;
  console.log(`  Phong hoc thuong: ${classrooms} cho ${classes.length} lop` +
    (classrooms >= classes.length
      ? ' — du de moi lop mot phong'
      : ` — THIEU ${classes.length - classrooms}, nen hai lop phai dung chung theo buoi`));
  console.log('');

  // ------------------------------------------------------------ giao vien theo mon
  const all = await prisma.teachingAssignment.findMany({
    where: { semester_id: semester!.id },
    include: { subject: { select: { code: true, name: true, is_special: true } } },
  });

  // Chao co va sinh hoat cuoi tuan la nhiem vu chu nhiem, da duoc bu bang phan giam tru dinh
  // muc, nen khong phai tiet day. Dem chung vao day la dem hai lan — va do la loi chinh kich
  // ban nay tung mac: no bao "nang nhat 25 tiet, sau nguoi o tran 17" trong khi that ra nang
  // nhat la 15 va khong ai toi tran.
  const assignments = all.filter((a) => !a.subject.is_special);
  const ceremonies = all.filter((a) => a.subject.is_special);

  const perSubject = new Map<string, { name: string; periods: number; teachers: Set<string> }>();
  for (const a of assignments) {
    const entry = perSubject.get(a.subject.code) ?? { name: a.subject.name, periods: 0, teachers: new Set<string>() };
    entry.periods += a.total_periods;
    entry.teachers.add(a.teacher_id);
    perSubject.set(a.subject.code, entry);
  }

  console.log('THEO MON — nhu cau, so nguoi, tai moi nguoi');
  console.log('Mon        | tiet/tuan | so GV | tai/nguoi | can it nhat | thieu/thua');
  console.log('-----------|-----------|-------|-----------|-------------|-----------');

  const rows = [...perSubject].sort((a, b) => b[1].periods - a[1].periods);
  let shortfall = 0;
  for (const [code, entry] of rows) {
    const count = entry.teachers.size;
    const load = entry.periods / count;
    // Can it nhat bao nhieu nguoi de khong ai vuot dinh muc
    const needed = Math.ceil(entry.periods / QUOTA);
    const gap = count - needed;
    if (gap < 0) shortfall += -gap;

    console.log(
      `${code.padEnd(10)} | ${String(entry.periods).padStart(9)} | ${String(count).padStart(5)} | ` +
      `${load.toFixed(1).padStart(9)} | ${String(needed).padStart(11)} | ${(gap >= 0 ? '+' + gap : String(gap)).padStart(10)}`,
    );
  }

  // ------------------------------------------------------------ tai tung nguoi
  const teachers = await prisma.teacher.findMany({ select: { id: true, code: true, full_name: true } });
  const load = new Map<string, number>();
  for (const a of assignments) load.set(a.teacher_id, (load.get(a.teacher_id) ?? 0) + a.total_periods);

  const loads = teachers.map((t) => load.get(t.id) ?? 0);
  const atQuota = loads.filter((n) => n >= QUOTA).length;
  const light = loads.filter((n) => n <= 10).length;

  console.log(`\nTAI TUNG NGUOI — chi tinh TIET DAY, khong tinh ${ceremonies.reduce((sum, a) => sum + a.total_periods, 0)} tiet nghi le`);
  console.log(`  ${teachers.length} giao vien, tong ${loads.reduce((a, b) => a + b, 0)} tiet day/tuan`);
  console.log(`  Trung binh ${(loads.reduce((a, b) => a + b, 0) / teachers.length).toFixed(1)} tiet — nhe nhat ${Math.min(...loads)}, nang nhat ${Math.max(...loads)}`);
  console.log(`  ${atQuota} nguoi o dung tran ${QUOTA} tiet; ${light} nguoi duoi 10 tiet`);
  console.log(`  Tong tran: ${teachers.length * QUOTA} tiet — dang dung ${Math.round((loads.reduce((a, b) => a + b, 0) / (teachers.length * QUOTA)) * 100)}%`);

  console.log(`\nSo mon con thieu nguoi: ${shortfall === 0 ? 'khong mon nao' : shortfall + ' suat'}`);
  console.log('Ti le chuan cho THPT: 2,25 giao vien moi lop => ' +
    `${classes.length} lop can ${(classes.length * 2.25).toFixed(0)} giao vien (dang co ${teachers.length})`);

  await prisma.$disconnect();
})();
