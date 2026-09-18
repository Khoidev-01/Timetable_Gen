/**
 * Sinh lai file du lieu mau "happy case" Du_lieu_mau_GDPT2018_30lop.xlsx.
 *
 * Mot bo du lieu ma moi rang buoc deu thoa duoc, de he thong xep ra thoi khoa bieu khong loi:
 *
 *   - 30 lop: khoi 10 (10C1-10C10) va 12 (12A1-12A11) hoc sang, khoi 11 (11B1-11B9) hoc chieu.
 *   - Moi lop dung 29 tiet day/tuan: 26 tiet buoi chinh (vua khit 26 o sau khi tru nghi thu Nam
 *     tiet 4-5, Chao co va Sinh hoat) + GDTC 2, GDQP 1 hoc trai buoi.
 *   - Kiem nhiem dung Thong tu 05/2025/TT-BGDDT: chu nhiem -4, to truong -3, to pho -1, phu trach
 *     phong hoc bo mon -3/mon, phu trach cong nghe thong tin -3. Dinh muc goc THPT 17 tiet/tuan.
 *   - Quy tac phan cong:
 *       Cong nghe Nong nghiep  -> giao vien Sinh hoc hoac Hoa hoc kiem nhiem
 *       Cong nghe Cong nghiep  -> giao vien Vat ly hoac Tin hoc kiem nhiem
 *       Giao duc dia phuong    -> giao vien Lich su hoac Dia ly kiem nhiem
 *       HDTN-HN                -> giao vien chu nhiem cua chinh lop do
 *       Ly thuyet + thuc hanh  -> cung mot giao vien
 *       Chao co, Sinh hoat     -> dung ten GVCN (bo xep lich can mot nguoi dung lop; khong tinh
 *                                 vao dinh muc va khong hien la "mon day")
 *   - Khong giao vien nao vuot dinh muc hieu luc.
 *
 * Giao vien sang va chieu tach rieng (tru GDTC, GDQP von day trai buoi), de khong ai phai den
 * truong ca hai buoi chi vi phan cong.
 *
 * Chay: npx ts-node --transpile-only scripts/build-sample-workbook.ts          (xem truoc)
 *       npx ts-node --transpile-only scripts/build-sample-workbook.ts --apply  (ghi file)
 */
import * as path from 'path';
import * as ExcelJS from 'exceljs';

const OUTPUT = path.join(__dirname, '..', '..', 'Du_lieu_mau_GDPT2018_30lop.xlsx');
const apply = process.argv.includes('--apply');

const SCHOOL_YEAR = '2026-2027';
const HK1_WEEKS = 18;
const HK2_WEEKS = 17;
const BASE_LOAD = 17;

// ------------------------------------------------------------------ danh muc mon

type SubjectCode =
  | 'TOAN' | 'VAN' | 'ANH' | 'LS' | 'GDTC' | 'GDQP' | 'HDTN' | 'GDDP'
  | 'LY' | 'HOA' | 'SINH' | 'TIN' | 'DIA' | 'GDKT' | 'CNCN' | 'CNNN'
  | 'CHAO_CO' | 'SH_CUOI_TUAN';

const SUBJECT_NAMES: Record<SubjectCode, string> = {
  TOAN: 'Toán', VAN: 'Ngữ văn', ANH: 'Tiếng Anh', LS: 'Lịch sử', GDTC: 'Giáo dục thể chất',
  GDQP: 'Giáo dục quốc phòng và an ninh', HDTN: 'Hoạt động trải nghiệm hướng nghiệp',
  GDDP: 'Giáo dục địa phương', LY: 'Vật lý', HOA: 'Hóa học', SINH: 'Sinh học', TIN: 'Tin học',
  DIA: 'Địa lý', GDKT: 'Giáo dục kinh tế và pháp luật', CNCN: 'Công nghệ Công nghiệp',
  CNNN: 'Công nghệ Nông nghiệp', CHAO_CO: 'Chào cờ', SH_CUOI_TUAN: 'Sinh hoạt cuối tuần',
};

const SUBJECT_CATALOG_ROWS: Array<[SubjectCode, string, string]> = [
  ['TOAN', 'Bắt buộc', '3 tiết/tuần'],
  ['VAN', 'Bắt buộc', '3 tiết/tuần'],
  ['ANH', 'Bắt buộc', '3 tiết/tuần'],
  ['LS', 'Bắt buộc', '2 tiết/tuần'],
  ['GDTC', 'Bắt buộc', '2 tiết/tuần, học trái buổi tại sân bãi'],
  ['GDQP', 'Bắt buộc', '1 tiết/tuần, học trái buổi tại sân bãi'],
  ['HDTN', 'Bắt buộc', '3 tiết/tuần, giáo viên chủ nhiệm dạy'],
  ['GDDP', 'Bắt buộc', '1 tiết/tuần, giáo viên Lịch sử hoặc Địa lý kiêm nhiệm'],
  ['LY', 'Lựa chọn', '1 lý thuyết + 2 thực hành (phòng thí nghiệm)'],
  ['HOA', 'Lựa chọn', '1 lý thuyết + 2 thực hành (phòng thí nghiệm)'],
  ['SINH', 'Lựa chọn', '1 lý thuyết + 2 thực hành (phòng thí nghiệm)'],
  ['TIN', 'Lựa chọn', '1 lý thuyết + 2 thực hành (phòng máy tính)'],
  ['DIA', 'Lựa chọn', '3 tiết/tuần'],
  ['GDKT', 'Lựa chọn', '3 tiết/tuần'],
  ['CNCN', 'Lựa chọn', '2 tiết/tuần, giáo viên Vật lý hoặc Tin học kiêm nhiệm'],
  ['CNNN', 'Lựa chọn', '2 tiết/tuần, giáo viên Sinh học hoặc Hóa học kiêm nhiệm'],
  ['CHAO_CO', 'Hoạt động tập thể', 'Thứ hai, không tính vào định mức'],
  ['SH_CUOI_TUAN', 'Hoạt động tập thể', 'Thứ bảy, không tính vào định mức'],
];

// ------------------------------------------------------------------ to hop, lop

/** Mon lua chon: ba mon 3 tiet + mot mon Cong nghe 2 tiet = 11 tiet. */
const COMBINATIONS: Record<string, { electives: SubjectCode[]; note: string }> = {
  TN1: { electives: ['LY', 'HOA', 'SINH', 'CNNN'], note: 'Tự nhiên - Lý, Hóa, Sinh' },
  TN2: { electives: ['LY', 'HOA', 'TIN', 'CNCN'], note: 'Tự nhiên - Lý, Hóa, Tin' },
  XH1: { electives: ['DIA', 'GDKT', 'TIN', 'CNCN'], note: 'Xã hội - Địa, KTPL, Tin' },
  XH2: { electives: ['DIA', 'GDKT', 'SINH', 'CNNN'], note: 'Xã hội - Địa, KTPL, Sinh' },
};

type Session = 0 | 1;
interface ClassSpec { name: string; grade: number; session: Session; combination: string; students: number; room: string }

function buildClasses(): ClassSpec[] {
  const plan: Array<{ grade: number; prefix: string; session: Session; combos: string[]; firstRoom: number }> = [
    { grade: 10, prefix: '10C', session: 0, combos: ['TN1', 'TN1', 'TN1', 'TN2', 'TN2', 'TN2', 'XH1', 'XH1', 'XH2', 'XH2'], firstRoom: 201 },
    { grade: 11, prefix: '11B', session: 1, combos: ['TN1', 'TN1', 'TN1', 'TN2', 'TN2', 'XH1', 'XH1', 'XH2', 'XH2'], firstRoom: 101 },
    { grade: 12, prefix: '12A', session: 0, combos: ['TN1', 'TN1', 'TN1', 'TN2', 'TN2', 'TN2', 'XH1', 'XH1', 'XH1', 'XH2', 'XH2'], firstRoom: 101 },
  ];
  const classes: ClassSpec[] = [];
  for (const grade of plan) {
    grade.combos.forEach((combination, i) => {
      classes.push({
        name: `${grade.prefix}${i + 1}`,
        grade: grade.grade,
        session: grade.session,
        combination,
        students: 38 + ((i * 7 + grade.grade) % 7),
        room: String(grade.firstRoom + i),
      });
    });
  }
  return classes;
}

// ------------------------------------------------------------------ phan viec cua mot lop

/** Mot phan viec giao tron cho mot giao vien: ly thuyet va thuc hanh di chung. */
interface Unit {
  subject: SubjectCode;
  theory: number;
  practice: number;
  /** Nhom giao vien duoc phep nhan. */
  eligible: SubjectCode[];
}

const PRACTICE_SUBJECTS = new Set<SubjectCode>(['LY', 'HOA', 'SINH', 'TIN']);

function unitsOf(cls: ClassSpec): Unit[] {
  const units: Unit[] = [
    { subject: 'TOAN', theory: 3, practice: 0, eligible: ['TOAN'] },
    { subject: 'VAN', theory: 3, practice: 0, eligible: ['VAN'] },
    { subject: 'ANH', theory: 3, practice: 0, eligible: ['ANH'] },
    { subject: 'LS', theory: 2, practice: 0, eligible: ['LS'] },
    { subject: 'GDDP', theory: 1, practice: 0, eligible: ['LS', 'DIA'] },
    { subject: 'GDTC', theory: 2, practice: 0, eligible: ['GDTC'] },
    { subject: 'GDQP', theory: 1, practice: 0, eligible: ['GDQP'] },
  ];
  for (const elective of COMBINATIONS[cls.combination].electives) {
    if (PRACTICE_SUBJECTS.has(elective)) units.push({ subject: elective, theory: 1, practice: 2, eligible: [elective] });
    else if (elective === 'CNCN') units.push({ subject: elective, theory: 2, practice: 0, eligible: ['LY', 'TIN'] });
    else if (elective === 'CNNN') units.push({ subject: elective, theory: 2, practice: 0, eligible: ['SINH', 'HOA'] });
    else units.push({ subject: elective, theory: 3, practice: 0, eligible: [elective] });
  }
  return units;
}

// ------------------------------------------------------------------ giao vien

interface Role { label: string; reduction: number }
interface Teacher {
  code: string;
  name: string;
  major: SubjectCode;
  department: string;
  /** null = GDTC/GDQP, day ca hai buoi (trai buoi cua lop). */
  session: Session | null;
  roles: Role[];
  homeroom?: string;
  load: number;
}

const DEPARTMENTS: Array<{ name: string; majors: SubjectCode[] }> = [
  { name: 'Tổ Toán', majors: ['TOAN'] },
  { name: 'Tổ Ngữ văn', majors: ['VAN'] },
  { name: 'Tổ Ngoại ngữ', majors: ['ANH'] },
  { name: 'Tổ Vật lý - Tin học', majors: ['LY', 'TIN'] },
  { name: 'Tổ Hóa học - Sinh học', majors: ['HOA', 'SINH'] },
  { name: 'Tổ Lịch sử - Địa lý - GDKT&PL', majors: ['LS', 'DIA', 'GDKT'] },
  { name: 'Tổ Thể chất - Quốc phòng', majors: ['GDTC', 'GDQP'] },
];
const departmentOf = (major: SubjectCode) => DEPARTMENTS.find((d) => d.majors.includes(major))!.name;

const reductionOf = (t: Teacher) => t.roles.reduce((sum, r) => sum + r.reduction, 0);
const capacityOf = (t: Teacher) => BASE_LOAD - reductionOf(t);

/** Ten giao vien: sinh tat dinh tu mot hat giong, khong trung nhau. */
function nameFactory() {
  const family = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
  const middle = ['Thị', 'Văn', 'Minh', 'Thanh', 'Ngọc', 'Hoàng', 'Quốc', 'Thu', 'Xuân', 'Bảo', 'Đức', 'Hải', 'Kim', 'Anh'];
  const given = ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hạnh', 'Hiền', 'Hòa', 'Hùng', 'Hương', 'Khánh', 'Lan', 'Linh', 'Long', 'Mai', 'Minh', 'Nam', 'Nga', 'Ngân', 'Nhung', 'Phong', 'Phúc', 'Phương', 'Quân', 'Quỳnh', 'Sơn', 'Tâm', 'Thảo', 'Thắng', 'Trang', 'Trung', 'Tuấn', 'Uyên', 'Vân', 'Việt', 'Yến'];
  let seed = 20262027;
  const next = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  const used = new Set<string>();
  return () => {
    for (;;) {
      const name = `${family[next(family.length)]} ${middle[next(middle.length)]} ${given[next(given.length)]}`;
      if (!used.has(name)) {
        used.add(name);
        return name;
      }
    }
  };
}

// ------------------------------------------------------------------ dung doi ngu va chia viec

interface Assignment { cls: ClassSpec; unit: Unit; teacher: Teacher }
interface Ceremony { cls: ClassSpec; subject: 'CHAO_CO' | 'SH_CUOI_TUAN'; teacher: Teacher }

/** So giao vien ban dau moi (mon, buoi); thieu thi tu tang tung nguoi mot. */
const INITIAL_STAFF: Array<{ major: SubjectCode; session: Session | null; count: number }> = [
  { major: 'TOAN', session: 0, count: 5 }, { major: 'TOAN', session: 1, count: 2 },
  { major: 'VAN', session: 0, count: 5 }, { major: 'VAN', session: 1, count: 2 },
  { major: 'ANH', session: 0, count: 5 }, { major: 'ANH', session: 1, count: 2 },
  { major: 'LS', session: 0, count: 4 }, { major: 'LS', session: 1, count: 2 },
  { major: 'DIA', session: 0, count: 2 }, { major: 'DIA', session: 1, count: 1 },
  { major: 'GDKT', session: 0, count: 2 }, { major: 'GDKT', session: 1, count: 1 },
  { major: 'LY', session: 0, count: 3 }, { major: 'LY', session: 1, count: 1 },
  { major: 'TIN', session: 0, count: 3 }, { major: 'TIN', session: 1, count: 1 },
  { major: 'HOA', session: 0, count: 3 }, { major: 'HOA', session: 1, count: 1 },
  { major: 'SINH', session: 0, count: 3 }, { major: 'SINH', session: 1, count: 1 },
  { major: 'GDTC', session: null, count: 4 },
  { major: 'GDQP', session: null, count: 2 },
];

function tryStaff(classes: ClassSpec[], staff: typeof INITIAL_STAFF) {
  const nextName = nameFactory();
  const teachers: Teacher[] = [];
  const ordered = DEPARTMENTS.flatMap((d) => staff.filter((s) => d.majors.includes(s.major)));
  for (const pool of ordered) {
    for (let i = 0; i < pool.count; i++) {
      teachers.push({
        code: `GV${String(teachers.length + 1).padStart(3, '0')}`,
        name: nextName(),
        major: pool.major,
        department: departmentOf(pool.major),
        session: pool.session,
        roles: [],
        load: 0,
      });
    }
  }

  // Chu nhiem: moi lop mot giao vien cung buoi, lan luot qua cac to de khong to nao gánh het
  const homeroomCandidates = (session: Session) =>
    teachers.filter((t) => t.session === session && !['GDTC', 'GDQP'].includes(t.major));
  for (const session of [0, 1] as Session[]) {
    const pool = homeroomCandidates(session);
    const byMajor = new Map<SubjectCode, Teacher[]>();
    for (const t of pool) byMajor.set(t.major, [...(byMajor.get(t.major) ?? []), t]);
    const rotation: Teacher[] = [];
    for (let round = 0; rotation.length < pool.length; round++) {
      for (const list of byMajor.values()) if (list[round]) rotation.push(list[round]);
    }
    const sessionClasses = classes.filter((c) => c.session === session);
    if (rotation.length < sessionClasses.length) return { error: `buoi ${session}: ${rotation.length} ung vien chu nhiem cho ${sessionClasses.length} lop` } as const;
    sessionClasses.forEach((cls, i) => {
      rotation[i].homeroom = cls.name;
      rotation[i].roles.push({ label: `Chủ nhiệm lớp ${cls.name}`, reduction: 4 });
    });
  }

  // To truong, to pho: nguoi khong chu nhiem, uu tien buoi sang (to dong nguoi nhat)
  for (const dept of DEPARTMENTS) {
    const members = teachers.filter((t) => t.department === dept.name && !t.homeroom);
    const [head, deputy] = members;
    if (head) head.roles.push({ label: `Tổ trưởng ${dept.name}`, reduction: 3 });
    if (deputy) deputy.roles.push({ label: `Tổ phó ${dept.name}`, reduction: 1 });
  }

  // Phu trach phong hoc bo mon (Ly, Hoa, Sinh) va cong nghe thong tin
  const freeOf = (major: SubjectCode) => teachers.find((t) => t.major === major && t.roles.length === 0);
  for (const [major, room] of [['LY', 'phòng thí nghiệm Vật lý'], ['HOA', 'phòng thí nghiệm Hóa học'], ['SINH', 'phòng thí nghiệm Sinh học']] as const) {
    const t = freeOf(major);
    if (t) t.roles.push({ label: `Phụ trách ${room}`, reduction: 3 });
  }
  const it = freeOf('TIN');
  if (it) it.roles.push({ label: 'Phụ trách công nghệ thông tin', reduction: 3 });

  // Chia viec. HDTN, Chao co, Sinh hoat thuoc ve GVCN.
  const assignments: Assignment[] = [];
  const ceremonies: Ceremony[] = [];
  for (const cls of classes) {
    const homeroom = teachers.find((t) => t.homeroom === cls.name)!;
    assignments.push({ cls, unit: { subject: 'HDTN', theory: 3, practice: 0, eligible: [] }, teacher: homeroom });
    homeroom.load += 3;
    ceremonies.push({ cls, subject: 'CHAO_CO', teacher: homeroom }, { cls, subject: 'SH_CUOI_TUAN', teacher: homeroom });
  }

  // Phan viec kho truoc: it nguoi nhan duoc nhat
  const work = classes.flatMap((cls) => unitsOf(cls).map((unit) => ({ cls, unit })));
  const eligibleFor = (cls: ClassSpec, unit: Unit) =>
    teachers.filter((t) =>
      unit.eligible.includes(t.major) &&
      (t.session === null || t.session === cls.session));
  work.sort((a, b) => eligibleFor(a.cls, a.unit).length - eligibleFor(b.cls, b.unit).length);

  for (const { cls, unit } of work) {
    const periods = unit.theory + unit.practice;
    const candidates = eligibleFor(cls, unit).filter((t) => {
      if (t.load + periods > capacityOf(t)) return false;
      // Một giáo viên chỉ có ba ô của buổi chính vào thứ Năm. Giữ tối đa ba lớp GDĐP
      // cùng buổi để toàn bộ các lớp của họ vẫn có thể nhận ưu tiên thứ Năm.
      if (unit.subject === 'GDDP') {
        const thursdayDemand = assignments.filter((a) =>
          a.teacher === t && a.unit.subject === 'GDDP' && a.cls.session === cls.session,
        ).length;
        if (thursdayDemand >= 3) return false;
      }
      return true;
    });
    if (candidates.length === 0) {
      return { error: `thieu nguoi: ${cls.name} ${unit.subject} (${periods} tiet), nhom ${unit.eligible.join('/')} buoi ${cls.session}`, need: { major: unit.eligible[0], session: ['GDTC', 'GDQP'].includes(unit.eligible[0]) ? null : cls.session } } as const;
    }
    // GVCN day mon cua minh cho lop minh; con lai chon nguoi con nhieu cho trong nhat
    const own = candidates.find((t) => t.homeroom === cls.name && t.major === unit.subject);
    const chosen = own ?? candidates.sort((a, b) => (capacityOf(b) - b.load) - (capacityOf(a) - a.load))[0];
    chosen.load += periods;
    assignments.push({ cls, unit, teacher: chosen });
  }

  return { teachers, assignments, ceremonies } as const;
}

function staffSchool(classes: ClassSpec[]) {
  const staff = INITIAL_STAFF.map((s) => ({ ...s }));
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = tryStaff(classes, staff);
    if (!('error' in result)) return result;
    const need = (result as any).need;
    if (!need) throw new Error(result.error);
    const pool = staff.find((s) => s.major === need.major && s.session === need.session)!;
    console.log(`  them 1 giao vien ${need.major} buoi ${need.session ?? 'trai buoi'}: ${result.error}`);
    pool.count++;
  }
  throw new Error('Khong dung duoc doi ngu sau 60 lan thu');
}

// ------------------------------------------------------------------ kiem tra quy tac

function verify(classes: ClassSpec[], teachers: Teacher[], assignments: Assignment[], ceremonies: Ceremony[]) {
  const problems: string[] = [];
  const byClass = new Map<string, Assignment[]>();
  for (const a of assignments) byClass.set(a.cls.name, [...(byClass.get(a.cls.name) ?? []), a]);

  for (const cls of classes) {
    const list = byClass.get(cls.name) ?? [];
    const total = list.reduce((n, a) => n + a.unit.theory + a.unit.practice, 0);
    const offSession = list.filter((a) => ['GDTC', 'GDQP'].includes(a.unit.subject)).reduce((n, a) => n + a.unit.theory, 0);
    if (total !== 29) problems.push(`${cls.name}: ${total} tiet, can 29`);
    if (total - offSession !== 26) problems.push(`${cls.name}: ${total - offSession} tiet buoi chinh, can 26`);
    const homeroom = teachers.find((t) => t.homeroom === cls.name);
    if (!homeroom) problems.push(`${cls.name}: khong co GVCN`);
    for (const a of list) {
      const m = a.teacher.major;
      if (a.unit.subject === 'HDTN' && a.teacher !== homeroom) problems.push(`${cls.name}: HDTN khong do GVCN day`);
      if (a.unit.subject === 'CNNN' && !['SINH', 'HOA'].includes(m)) problems.push(`${cls.name}: CNNN giao cho GV ${m}`);
      if (a.unit.subject === 'CNCN' && !['LY', 'TIN'].includes(m)) problems.push(`${cls.name}: CNCN giao cho GV ${m}`);
      if (a.unit.subject === 'GDDP' && !['LS', 'DIA'].includes(m)) problems.push(`${cls.name}: GDDP giao cho GV ${m}`);
      if (a.teacher.session !== null && a.teacher.session !== cls.session) problems.push(`${cls.name}: ${a.teacher.code} khac buoi`);
    }
    for (const c of ceremonies.filter((x) => x.cls === cls)) if (c.teacher !== homeroom) problems.push(`${cls.name}: ${c.subject} khong dung ten GVCN`);
  }
  for (const t of teachers) {
    if (t.load > capacityOf(t)) problems.push(`${t.code}: ${t.load} tiet > dinh muc ${capacityOf(t)}`);
    if (t.load === 0) problems.push(`${t.code}: khong day tiet nao`);
    for (const session of [0, 1] as Session[]) {
      const localEducationClasses = assignments.filter((a) =>
        a.teacher === t && a.unit.subject === 'GDDP' && a.cls.session === session,
      ).length;
      if (localEducationClasses > 3) {
        problems.push(`${t.code}: day GDDP ${localEducationClasses} lop buoi ${session}, thu Nam chi co 3 o`);
      }
    }
  }
  return problems;
}

// ------------------------------------------------------------------ ghi workbook

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };

function addSheet(wb: ExcelJS.Workbook, name: string, title: string, headers: string[], rows: any[][], widths: number[]) {
  const ws = wb.addWorksheet(name);
  ws.addRow([title]);
  ws.mergeCells(1, 1, 1, headers.length);
  ws.getRow(1).font = { bold: true, size: 13 };
  const header = ws.addRow(headers);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin' } };
  });
  rows.forEach((r) => ws.addRow(r));
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: 'frozen', ySplit: 2 }];
  return ws;
}

async function writeWorkbook(classes: ClassSpec[], teachers: Teacher[], assignments: Assignment[], ceremonies: Ceremony[]) {
  const wb = new ExcelJS.Workbook();
  const byCode = (t: Teacher) => t;
  void byCode;

  addSheet(wb, 'Huong_dan', 'Hướng dẫn sử dụng workbook phân công giảng dạy GDPT 2018', ['Mục', 'Nội dung'], [
    ['Mục đích', 'Bộ dữ liệu mẫu chuẩn: 30 lớp, mọi ràng buộc đều thỏa để hệ thống xếp được thời khóa biểu không lỗi.'],
    ['Phạm vi import', 'Hệ thống đọc các sheet: DM_Giao_vien, DM_Lop, DM_Phong, DM_To_hop, Phan_cong.'],
    ['Tiết HK1/HK2', `Tổng số tiết cả học kỳ (HK1 ${HK1_WEEKS} tuần, HK2 ${HK2_WEEKS} tuần). Hệ thống tự quy đổi ra tiết/tuần.`],
    ['Định mức', `Định mức tiết dạy giáo viên THPT: ${BASE_LOAD} tiết/tuần (Thông tư 05/2025/TT-BGDĐT, Điều 7).`],
    ['Giảm trừ kiêm nhiệm', 'Chủ nhiệm lớp 4 tiết; tổ trưởng chuyên môn 3 tiết; tổ phó 1 tiết; phụ trách phòng học bộ môn 3 tiết/môn; phụ trách công nghệ thông tin 3 tiết.'],
    ['Môn kiêm nhiệm', 'Công nghệ Nông nghiệp: GV Sinh/Hóa. Công nghệ Công nghiệp: GV Lý/Tin. Giáo dục địa phương: GV Sử/Địa. HĐTN-HN: GV chủ nhiệm.'],
    ['Lý thuyết - thực hành', 'Lý thuyết và thực hành của một môn ở một lớp do cùng một giáo viên dạy.'],
    ['Chào cờ, sinh hoạt', 'Ghi tên GV chủ nhiệm để xếp lịch; không tính vào định mức tiết dạy.'],
  ], [24, 110]);

  addSheet(wb, 'Nguon_tham_khao', 'Nguồn tham khảo và căn cứ pháp lý', ['Văn bản', 'Nội dung'], [
    ['Thông tư 32/2018/TT-BGDĐT', 'Chương trình giáo dục phổ thông 2018'],
    ['Thông tư 13/2022/TT-BGDĐT', 'Sửa đổi chương trình GDPT 2018, Lịch sử là môn bắt buộc ở THPT'],
    ['Thông tư 05/2025/TT-BGDĐT', 'Chế độ làm việc của giáo viên phổ thông: định mức 17 tiết/tuần (THPT) và giảm định mức cho nhiệm vụ kiêm nhiệm, hiệu lực từ 22/4/2025'],
  ], [32, 110]);

  addSheet(wb, 'DM_Mon_GDPT2018', 'Danh mục môn học GDPT 2018', ['Mã môn', 'Tên môn', 'Loại', 'Ghi chú'],
    SUBJECT_CATALOG_ROWS.map(([code, group, note]) => [code, SUBJECT_NAMES[code], group, note]), [16, 36, 20, 60]);

  addSheet(wb, 'DM_Giao_vien', `Danh mục giáo viên - Năm học ${SCHOOL_YEAR}`,
    ['Mã GV', 'Họ tên', 'GVCN', 'Liên hệ', 'Tổ CM', 'Chức vụ', 'Môn chuyên môn chính', 'Trạng thái', 'Định mức tuần', 'Giảm trừ tuần', 'Định mức hiệu lực', 'Ghi chú'],
    teachers.map((t, i) => [
      t.code, t.name, t.homeroom ?? '', `09${String(12345678 + i * 7919).slice(-8)}`, t.department,
      t.roles.some((r) => r.label.startsWith('Tổ trưởng')) ? 'Tổ trưởng' : t.roles.some((r) => r.label.startsWith('Tổ phó')) ? 'Tổ phó' : '',
      t.major, 'Đang dạy',
      BASE_LOAD, reductionOf(t), capacityOf(t),
      t.roles.map((r) => `${r.label} (giảm ${r.reduction})`).join('; '),
    ]), [9, 24, 8, 13, 30, 11, 12, 11, 10, 10, 11, 60]);

  addSheet(wb, 'DM_Lop', `Danh mục lớp - Năm học ${SCHOOL_YEAR}`,
    ['Lớp', 'Khối', 'Sĩ số', 'Buổi học', 'Mã tổ hợp', 'Phòng chính', 'GVCN Mã', 'GVCN Họ tên', 'Ghi chú'],
    classes.map((c) => {
      const homeroom = teachers.find((t) => t.homeroom === c.name)!;
      return [c.name, c.grade, c.students, c.session === 0 ? 'Sáng' : 'Chiều', c.combination, c.room, homeroom.code, homeroom.name, `Phòng ${c.room} (buổi ${c.session === 0 ? 'sáng' : 'chiều'})`];
    }), [8, 7, 7, 9, 10, 11, 10, 24, 28]);

  // Phong: tang 1 cho khoi 12 (sang) va khoi 11 (chieu), tang 2 cho khoi 10, tang 3 phong chuc nang
  const roomRows: any[][] = [];
  const classesInRoom = (room: string) => classes.filter((c) => c.room === room).map((c) => c.name);
  for (const floor of [1, 2]) {
    for (let n = 1; n <= 15; n++) {
      const room = String(floor * 100 + n);
      const owners = classesInRoom(room);
      roomRows.push([room, 'Phòng học', floor, 45, 'Cả ngày', owners.join(', '), owners.length ? `Phòng học chính của ${owners.join(', ')}` : 'Phòng học dự phòng']);
    }
  }
  const special: Array<[string, string, string]> = [
    ['301', 'Lab Vật lý', 'Phòng thí nghiệm Vật lý 1'], ['302', 'Lab Vật lý', 'Phòng thí nghiệm Vật lý 2'],
    ['303', 'Lab Hóa học', 'Phòng thí nghiệm Hóa học 1'], ['304', 'Lab Hóa học', 'Phòng thí nghiệm Hóa học 2'],
    ['305', 'Lab Sinh học', 'Phòng thí nghiệm Sinh học 1'], ['306', 'Lab Sinh học', 'Phòng thí nghiệm Sinh học 2'],
    ['307', 'Phòng Tin học', 'Phòng máy tính 1'], ['308', 'Phòng Tin học', 'Phòng máy tính 2'], ['309', 'Phòng Tin học', 'Phòng máy tính 3'],
    ['310', 'Đa năng', 'Phòng đa năng'],
  ];
  for (const [name, type, note] of special) roomRows.push([name, type, 3, 45, 'Cả ngày', '', note]);
  // 21 lớp học sáng đều học GDTC (2 tiết) + GDQP (1 tiết) ở buổi chiều. Theo khung
  // nghỉ, mỗi sân chỉ có ba ô 8-10 mỗi ngày; bốn sân là mức tối thiểu để 63 tiết
  // trái buổi/tuần có chỗ mà GDTC và GDQP của cùng lớp vẫn tách ngày.
  roomRows.push(['SAN_1', 'Sân bãi', 0, 200, 'Cả ngày', '', 'Sân thể dục thể thao 1']);
  roomRows.push(['SAN_2', 'Sân bãi', 0, 200, 'Cả ngày', '', 'Sân thể dục thể thao 2']);
  roomRows.push(['SAN_3', 'Sân bãi', 0, 200, 'Cả ngày', '', 'Sân thể dục thể thao 3']);
  roomRows.push(['SAN_4', 'Sân bãi', 0, 200, 'Cả ngày', '', 'Sân thể dục thể thao 4']);
  addSheet(wb, 'DM_Phong', 'Danh mục phòng học - 3 tầng + sân bãi', ['Tên phòng', 'Loại', 'Tầng', 'Sức chứa', 'Buổi', 'Lớp cố định', 'Ghi chú'], roomRows, [11, 16, 7, 9, 10, 16, 40]);

  const comboRows: any[][] = [];
  for (const grade of [10, 11, 12]) {
    for (const [code, combo] of Object.entries(COMBINATIONS)) comboRows.push([code, grade, ...combo.electives, combo.note]);
  }
  addSheet(wb, 'DM_To_hop', 'Danh mục tổ hợp môn học - Áp dụng cả 3 khối',
    ['Mã tổ hợp', 'Khối', 'Môn tự chọn 1', 'Môn tự chọn 2', 'Môn tự chọn 3', 'Môn tự chọn 4', 'Ghi chú'], comboRows, [11, 7, 14, 14, 14, 14, 30]);

  const pcRows: any[][] = [];
  const pushRow = (cls: ClassSpec, subject: SubjectCode, name: string, group: string, weekly: number, teacher: Teacher, note: string) => {
    pcRows.push([pcRows.length + 1, SCHOOL_YEAR, cls.grade, cls.name, cls.combination, subject, name, group, weekly * HK1_WEEKS, weekly * HK2_WEEKS, teacher.code, teacher.name, teacher.code, teacher.name, note]);
  };
  const ORDER: SubjectCode[] = ['TOAN', 'VAN', 'ANH', 'LS', 'GDTC', 'GDQP', 'HDTN', 'GDDP', 'CHAO_CO', 'SH_CUOI_TUAN', 'LY', 'HOA', 'SINH', 'TIN', 'DIA', 'GDKT', 'CNCN', 'CNNN'];
  for (const cls of classes) {
    const list = assignments.filter((a) => a.cls === cls);
    for (const subject of ORDER) {
      const cer = ceremonies.find((c) => c.cls === cls && c.subject === subject);
      if (cer) {
        pushRow(cls, subject, SUBJECT_NAMES[subject], 'Hoạt động tập thể', 1, cer.teacher, 'GV chủ nhiệm, không tính định mức');
        continue;
      }
      const a = list.find((x) => x.unit.subject === subject);
      if (!a) continue;
      const mandatory = ['TOAN', 'VAN', 'ANH', 'LS', 'GDTC', 'GDQP', 'HDTN', 'GDDP'].includes(subject);
      const group = mandatory ? 'Bắt buộc' : 'Lựa chọn';
      if (a.unit.practice > 0) {
        pushRow(cls, subject, SUBJECT_NAMES[subject], group, a.unit.theory, a.teacher, 'Lý thuyết');
        pushRow(cls, subject, `${SUBJECT_NAMES[subject]} (TH)`, `${group} - Thực hành`, a.unit.practice, a.teacher, subject === 'TIN' ? 'Thực hành - Phòng máy' : 'Thực hành - Phòng lab');
      } else {
        const note = ['GDTC', 'GDQP'].includes(subject) ? 'Học khác buổi - Sân bãi'
          : subject === 'HDTN' ? 'GV chủ nhiệm dạy'
            : ['CNCN', 'CNNN', 'GDDP'].includes(subject) ? `GV ${SUBJECT_NAMES[a.teacher.major]} kiêm nhiệm` : '';
        pushRow(cls, subject, SUBJECT_NAMES[subject], group, a.unit.theory, a.teacher, note);
      }
    }
  }
  addSheet(wb, 'Phan_cong', `Bảng phân công giảng dạy - Năm học ${SCHOOL_YEAR}`,
    ['STT', 'Năm học', 'Khối', 'Lớp', 'Mã tổ hợp', 'Mã môn', 'Tên môn', 'Nhóm CT', 'Tiết HK1', 'Tiết HK2', 'GV HK1 Mã', 'GV HK1 Họ tên', 'GV HK2 Mã', 'GV HK2 Họ tên', 'Ghi chú'],
    pcRows, [6, 10, 6, 7, 9, 13, 30, 22, 8, 8, 10, 22, 10, 22, 30]);

  addSheet(wb, 'Tong_hop_GV', `Tổng hợp tải giảng dạy theo giáo viên - ${SCHOOL_YEAR}`,
    ['Mã GV', 'Họ tên', 'Tổ CM', 'Định mức tuần', 'Giảm trừ tuần', 'Định mức hiệu lực', 'Tiết/tuần HK1', 'Tiết/tuần HK2', 'Còn trống', 'Số lớp dạy', 'Kiêm nhiệm'],
    teachers.map((t) => [
      t.code, t.name, t.department, BASE_LOAD, reductionOf(t), capacityOf(t), t.load, t.load, capacityOf(t) - t.load,
      new Set(assignments.filter((a) => a.teacher === t).map((a) => a.cls.name)).size,
      t.roles.map((r) => r.label).join('; '),
    ]), [9, 24, 30, 10, 10, 11, 11, 11, 9, 9, 50]);

  await wb.xlsx.writeFile(OUTPUT);
}

// ------------------------------------------------------------------ main

async function main() {
  const classes = buildClasses();
  const { teachers, assignments, ceremonies } = staffSchool(classes);
  const problems = verify(classes, teachers, assignments, ceremonies);

  console.log(`\nLop: ${classes.length} (${classes.filter((c) => c.session === 0).length} sang, ${classes.filter((c) => c.session === 1).length} chieu)`);
  console.log(`Giao vien: ${teachers.length}`);
  const bySubject = new Map<string, number>();
  for (const t of teachers) bySubject.set(`${t.major}/${t.session ?? '-'}`, (bySubject.get(`${t.major}/${t.session ?? '-'}`) ?? 0) + 1);
  console.log('  ' + [...bySubject].map(([k, v]) => `${k}=${v}`).join(' '));
  const roles = teachers.flatMap((t) => t.roles);
  console.log(`Kiem nhiem: ${roles.length} vi tri, tong giam ${roles.reduce((n, r) => n + r.reduction, 0)} tiet`);
  const slack = teachers.map((t) => capacityOf(t) - t.load);
  console.log(`Tai: con trong it nhat ${Math.min(...slack)}, nhieu nhat ${Math.max(...slack)}, tong ${slack.reduce((a, b) => a + b, 0)} tiet`);
  console.log(`Dong phan cong: ${assignments.length} phan viec + ${ceremonies.length} chao co/sinh hoat`);

  if (problems.length) {
    console.log(`\nHONG ${problems.length} quy tac:\n  ` + problems.slice(0, 30).join('\n  '));
    process.exit(1);
  }
  console.log('\nMoi quy tac deu dat.');

  if (!apply) {
    console.log('(xem truoc - chay kem --apply de ghi file)');
    return;
  }
  await writeWorkbook(classes, teachers, assignments, ceremonies);
  console.log(`Da ghi ${OUTPUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
