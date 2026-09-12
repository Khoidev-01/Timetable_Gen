/**
 * Diem mem thap den dau la khong the tranh duoc?
 *
 * Diem tong la mot TONG TUYET DOI tren toan bo tiet, khong chia cho quy mo. Truong 30 lop co
 * 961 tiet, hon bo du lieu cu 4,4 lan, nen cung mot chat luong tren moi tiet se cho ra mot
 * con so lon hon 4,4 lan. So sanh hai con so do voi nhau la so sanh hai thu khac nhau.
 *
 * Kich ban nay tinh SAN cua hai khoan phat lon nhat: phan khong the xoa duoc du xep gioi den
 * dau, vi chinh du lieu khong cho phep.
 */
import '../src/load-env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Cac mon duoc cham diem ghep tiet doi, giong danh sach trong checkBlock2. */
const BLOCK_SUBJECTS = ['TOAN', 'VAN', 'NGU_VAN', 'TIN', 'LY', 'HOA', 'SINH'];

(async () => {
  const timetable = await prisma.generatedTimetable.findFirst({
    where: { is_official: true },
    orderBy: { created_at: 'desc' },
    include: { slots: { include: { subject: true, class: true } } },
  });
  if (!timetable) {
    console.log('Chua cong bo thoi khoa bieu nao.');
    process.exit(1);
  }

  const slots = timetable.slots;
  console.log(`Thoi khoa bieu: ${slots.length} tiet, diem ${timetable.fitness_score}`);
  console.log(`Diem mem = 1000 - diem = ${1000 - (timetable.fitness_score ?? 0)}`);
  console.log(`Tren moi tiet: ${((1000 - (timetable.fitness_score ?? 0)) / slots.length).toFixed(2)} diem phat\n`);

  // ------------------------------------------------------------ tiet doi bi xe le
  // Mon co so tiet LE thi luon con mot tiet le loi, du xep the nao: hai tiet thanh mot cap,
  // con lai mot tiet khong co ai ben canh.
  const perClassSubject = new Map<string, { count: number; code: string }>();
  for (const s of slots) {
    const code = s.subject.code.toUpperCase();
    if (!BLOCK_SUBJECTS.some((b) => code.includes(b))) continue;
    const key = `${s.class_id}|${s.subject_id}`;
    const entry = perClassSubject.get(key) ?? { count: 0, code };
    entry.count += 1;
    perClassSubject.set(key, entry);
  }

  let blockFloor = 0;
  const byOddness = new Map<number, number>();
  for (const [, entry] of perClassSubject) {
    byOddness.set(entry.count, (byOddness.get(entry.count) ?? 0) + 1);
    if (entry.count > 1 && entry.count % 2 === 1) blockFloor += 1;
  }
  console.log('TIET DOI BI XE LE');
  console.log(`  ${perClassSubject.size} cap (lop, mon) duoc cham diem ghep doi`);
  console.log('  So tiet moi tuan: ' + [...byOddness].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n} tiet: ${c} cap`).join(', '));
  console.log(`  SAN khong the tranh: ${blockFloor} (moi mon co so tiet le luon con dung mot tiet le loi)\n`);

  // ------------------------------------------------------------ buoi di lai
  // Cong thuc trong ma nguon lay san = ceil(so tiet / 5), tuc la coi nhu moi tiet cua giao
  // vien deu co the don vao bat ky buoi nao. That ra khong: lop hoc sang thi tiet cua lop do
  // BUOC PHAI o buoi sang. San that = ceil(tiet sang / 5) + ceil(tiet chieu / 5).
  const byTeacher = new Map<string, { morning: number; afternoon: number; sessions: Set<string> }>();
  for (const s of slots) {
    const entry = byTeacher.get(s.teacher_id) ?? { morning: 0, afternoon: 0, sessions: new Set<string>() };
    if (s.period <= 5) entry.morning += 1;
    else entry.afternoon += 1;
    entry.sessions.add(`${s.day}-${s.period <= 5 ? 0 : 1}`);
    byTeacher.set(s.teacher_id, entry);
  }

  let formulaFloor = 0;
  let realFloor = 0;
  let actual = 0;
  for (const [, entry] of byTeacher) {
    const total = entry.morning + entry.afternoon;
    formulaFloor += Math.ceil(total / 5);
    realFloor += Math.ceil(entry.morning / 5) + Math.ceil(entry.afternoon / 5);
    actual += entry.sessions.size;
  }

  console.log('BUOI GIAO VIEN PHAI TOI TRUONG');
  console.log(`  ${byTeacher.size} giao vien, tong ${actual} buoi thuc te`);
  console.log(`  San theo cong thuc dang dung  = ${formulaFloor}  -> bi phat ${actual - formulaFloor}`);
  console.log(`  San that (tach sang/chieu)     = ${realFloor}  -> thua that ${actual - realFloor}`);
  console.log(`  => ${realFloor - formulaFloor} diem phat nay la KHONG THE XOA: cong thuc do voi mot`);
  console.log('     muc san ma du lieu khong cho phep dat toi.\n');

  await prisma.$disconnect();
})();
