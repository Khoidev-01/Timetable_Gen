/**
 * Soat toan bo du lieu mau voi dinh muc GDPT 2018 va cac quy dinh lien quan.
 *
 * Moi muc doi chieu voi mot con so cu the trong van ban, va in ra DAT hay LECH kem so do —
 * de nguoi doc tu kiem chung duoc, khong phai tin loi.
 */
import '../src/load-env';
import { PrismaClient } from '@prisma/client';
import { SUBJECT_CATALOG } from '../src/excel/excel.constants';

/** Nhom mon nam trong danh muc hang, khong nam trong bang Subject. */
const GROUP_OF = new Map(SUBJECT_CATALOG.map((item) => [item.code, item.group]));

const prisma = new PrismaClient();
const results: Array<{ area: string; claim: string; ok: boolean; detail: string }> = [];

const check = (area: string, claim: string, ok: boolean, detail: string) =>
  results.push({ area, claim, ok, detail });

(async () => {
  const semester = await prisma.semester.findFirst({ where: { term_order: 1 } });
  const classes = await prisma.class.findMany({
    select: { id: true, name: true, grade_level: true, main_session: true, homeroom_teacher_id: true },
  });
  const teachers = await prisma.teacher.findMany({
    select: { id: true, code: true, max_periods_per_week: true, workload_reduction: true },
  });
  const assignments = await prisma.teachingAssignment.findMany({
    where: { semester_id: semester!.id },
    include: { subject: { select: { code: true, is_special: true } } },
  });

  // ---------------------------------------------------------------- so tiet moi mon
  const STANDARD_PER_WEEK: Record<string, number> = {
    VAN: 3, TOAN: 3, ANH: 3, GDTC: 2, GDQP: 1, HDTN: 3, GDDP: 1,
  };

  const perClassSubject = new Map<string, number>();
  for (const a of assignments) {
    perClassSubject.set(`${a.class_id}|${a.subject.code}`, (perClassSubject.get(`${a.class_id}|${a.subject.code}`) ?? 0) + a.total_periods);
  }

  for (const [code, expected] of Object.entries(STANDARD_PER_WEEK)) {
    const actual = classes
      .map((c) => perClassSubject.get(`${c.id}|${code}`) ?? 0)
      .filter((n) => n > 0);
    const wrong = actual.filter((n) => n !== expected).length;
    check(
      'Số tiết',
      `${code} = ${expected} tiết/tuần`,
      wrong === 0,
      wrong === 0 ? `${actual.length} lớp đều đúng` : `${wrong} lớp lệch (thấy ${[...new Set(actual)].join(', ')})`,
    );
  }

  // Lich su: 52 tiet/nam, chia 2 tiet HK1 va 1 tiet HK2
  const history = classes.map((c) => perClassSubject.get(`${c.id}|LS`) ?? 0).filter((n) => n > 0);
  check('Số tiết', 'Lịch sử = 2 tiết/tuần ở HK1 (52 tiết/năm chia 2+1)', history.every((n) => n === 2),
    `${history.length} lớp, thấy ${[...new Set(history)].join(', ')} tiết`);

  // ---------------------------------------------------------------- mon lua chon
  const chosenPerClass = classes.map((c) => {
    const codes = assignments
      .filter((a) => a.class_id === c.id && GROUP_OF.get(a.subject.code) === 'Lựa chọn')
      .map((a) => a.subject.code);
    return new Set(codes).size;
  });
  check('Môn lựa chọn', 'Mỗi lớp chọn đúng 4 môn', chosenPerClass.every((n) => n === 4),
    `thấy ${[...new Set(chosenPerClass)].sort().join(', ')} môn`);

  // Chuyen de: 3 mon lua chon o 3 tiet, 1 mon o 2 tiet
  const patterns = classes.map((c) => {
    const counts = assignments
      .filter((a) => a.class_id === c.id && GROUP_OF.get(a.subject.code) === 'Lựa chọn')
      .reduce((map, a) => map.set(a.subject.code, (map.get(a.subject.code) ?? 0) + a.total_periods), new Map<string, number>());
    return [...counts.values()].sort().join('+');
  });
  const rightPattern = patterns.filter((p) => p === '2+3+3+3').length;
  check('Chuyên đề', 'Ba môn lựa chọn 3 tiết + một môn 2 tiết (chuyên đề gộp vào môn gốc)',
    rightPattern === classes.length, `${rightPattern}/${classes.length} lớp đúng mẫu; thấy ${[...new Set(patterns)].join(' · ')}`);

  // ---------------------------------------------------------------- tong tiet
  const totals = classes.map((c) =>
    assignments.filter((a) => a.class_id === c.id).reduce((s, a) => s + a.total_periods, 0));
  check('Tổng tiết', 'Khoảng 30-31 tiết/tuần kể cả chào cờ và sinh hoạt',
    totals.every((n) => n >= 30 && n <= 31), `thấy ${[...new Set(totals)].sort().join(', ')} tiết/tuần`);

  // ---------------------------------------------------------------- dinh muc giao vien
  // He thong luu `max_periods_per_week` la dinh muc DA TRU giam tru, con `workload_reduction`
  // giu rieng de hien thi. Nen dinh muc goc = hai cot cong lai, va tru them lan nua la tru
  // hai lan — chinh phep kiem nay tung mac loi do va bao nham 5 nguoi vuot dinh muc.
  const baseQuotas = [...new Set(teachers.map((t) => t.max_periods_per_week + (t.workload_reduction ?? 0)))];
  check('Định mức', 'Định mức gốc giáo viên THPT 17 tiết/tuần (TT 05/2025)',
    baseQuotas.length === 1 && baseQuotas[0] === 17, `thấy ${baseQuotas.join(', ')}`);

  const homeroomIds = new Set(classes.map((c) => c.homeroom_teacher_id).filter(Boolean) as string[]);
  const homeroomReductions = teachers.filter((t) => homeroomIds.has(t.id)).map((t) => t.workload_reduction);
  check('Định mức', 'Giáo viên chủ nhiệm được giảm 4 tiết/tuần (TT 05/2025)',
    homeroomReductions.length > 0 && homeroomReductions.every((n) => n === 4),
    `${homeroomIds.size} giáo viên chủ nhiệm, giảm trừ đang là ${[...new Set(homeroomReductions)].join(', ')}`);

  const teachingLoad = new Map<string, number>();
  for (const a of assignments) {
    if (a.subject.is_special) continue;
    teachingLoad.set(a.teacher_id, (teachingLoad.get(a.teacher_id) ?? 0) + a.total_periods);
  }
  const over = teachers.filter((t) => (teachingLoad.get(t.id) ?? 0) > t.max_periods_per_week);
  check('Định mức', 'Không ai được phân công vượt định mức hiệu lực', over.length === 0,
    over.length === 0 ? `nặng nhất ${Math.max(...teachingLoad.values())} tiết` : `${over.length} người vượt: ${over.map((t) => t.code).join(', ')}`);

  // ---------------------------------------------------------------- ti le nguoi
  const ratio = teachers.length / classes.length;
  check('Nhân sự', 'Tỉ lệ giáo viên/lớp đạt chuẩn 2,25 cho THPT',
    ratio >= 2.25, `${teachers.length} giáo viên / ${classes.length} lớp = ${ratio.toFixed(2)}`);

  // ---------------------------------------------------------------- phong
  const rooms = await prisma.room.groupBy({ by: ['type'], _count: true });
  const have = new Map(rooms.map((r) => [String(r.type), r._count]));
  check('Phòng', 'Đủ phòng học cho mỗi lớp một phòng',
    (have.get('CLASSROOM') ?? 0) >= classes.length,
    `${have.get('CLASSROOM') ?? 0} phòng học / ${classes.length} lớp`);

  const labNeed = await prisma.teachingAssignment.groupBy({
    by: ['required_room_type'],
    where: { semester_id: semester!.id, required_room_type: { not: null } },
    _sum: { total_periods: true },
  });
  for (const need of labNeed) {
    const type = String(need.required_room_type);
    const count = have.get(type) ?? 0;
    const capacity = count * 60; // ca ngay: 10 tiet x 6 ngay
    check('Phòng', `Đủ ${type} cho ${need._sum.total_periods} tiết thực hành`,
      capacity >= (need._sum.total_periods ?? 0), `${count} phòng, sức chứa ${capacity} tiết/tuần`);
  }

  // ---------------------------------------------------------------- si so
  const sizes = await prisma.class.findMany({ select: { student_count: true } });
  const counts = sizes.map((c) => c.student_count ?? 0).filter((n) => n > 0);
  check('Sĩ số', 'Không lớp nào quá 45 học sinh (Điều lệ trường trung học)',
    counts.every((n) => n <= 45), `nhỏ nhất ${Math.min(...counts)}, lớn nhất ${Math.max(...counts)}`);

  // ---------------------------------------------------------------- in
  console.log('SOAT DINH LUONG THEO GDPT 2018\n');
  let area = '';
  for (const r of results) {
    if (r.area !== area) { area = r.area; console.log(`  ${area}`); }
    console.log(`    ${r.ok ? 'DAT ' : 'LECH'}  ${r.claim}`);
    console.log(`          ${r.detail}`);
  }
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} muc dat.`);

  await prisma.$disconnect();
})();
