import { getCurriculumPeriods, getPracticePeriods } from '../excel/excel.constants';

/**
 * Phần tính toán thuần của luồng "Tổng hợp phân công" - không đụng CSDL, để kiểm thử được.
 *
 * Tổ trưởng từng tổ nộp "giáo viên nào dạy lớp nào"; admin tổng hợp rồi bấm "Phân công tự
 * động". Hệ thống giữ nguyên những gì tổ trưởng đã chốt, chỉ điền phần còn thiếu:
 *   - HĐTN-HN, Chào cờ, Sinh hoạt: giáo viên chủ nhiệm của lớp
 *   - dòng tổ trưởng bỏ trống, hoặc tổ chưa nộp: giáo viên đúng chuyên môn còn chỗ trống
 * rồi kiểm tra lại mọi quy tắc trước khi cho nhập vào hệ thống.
 */

export const CEREMONY_CODES = ['CHAO_CO', 'SH_CUOI_TUAN'] as const;

/** Môn kiêm nhiệm: những giáo viên có chuyên môn này được dạy. */
export const ELIGIBLE_MAJORS: Record<string, string[]> = {
  CNCN: ['LY', 'TIN'],
  CNNN: ['SINH', 'HOA'],
  GDDP: ['LS', 'DIA'],
};

/** Môn do hệ thống tự giao, không thuộc tổ nào. */
const SYSTEM_SUBJECTS = new Set(['HDTN', ...CEREMONY_CODES]);

export const eligibleMajorsOf = (subjectCode: string) => ELIGIBLE_MAJORS[subjectCode] ?? [subjectCode];

const MANDATORY = ['TOAN', 'VAN', 'ANH', 'LS', 'GDTC', 'GDQP', 'HDTN', 'GDDP'];
const OFF_SESSION = new Set(['GDTC', 'GDQP']);

export interface PlanClass {
  id: string;
  name: string;
  grade: number;
  session: number; // 0 sáng, 1 chiều
  combinationCode?: string | null;
  homeroomTeacherCode?: string | null;
}

export interface PlanTeacher {
  code: string;
  name: string;
  major: string | null;
  department: string | null;
  position: string;
  /** Khối lớp giáo viên được phân công giảng dạy; rỗng = không giới hạn. */
  teachableGrades?: number[];
  /** Định mức hiệu lực (tiết/tuần) */
  capacity: number;
}

export interface PlanCombination {
  code: string;
  grade: number;
  electives: string[];
}

/** Một phần việc: một môn ở một lớp, lý thuyết và thực hành đi chung. */
export interface Demand {
  className: string;
  grade: number;
  session: number;
  combinationCode?: string | null;
  subjectCode: string;
  theory: number;
  practice: number;
}

export const periodsOf = (d: Pick<Demand, 'theory' | 'practice'>) => d.theory + d.practice;

const canTeachDemand = (teacher: PlanTeacher, demand: Demand) =>
  eligibleMajorsOf(demand.subjectCode).includes(teacher.major ?? '') &&
  (!teacher.teachableGrades?.length || teacher.teachableGrades.includes(demand.grade));

export function buildDemands(classes: PlanClass[], combinations: PlanCombination[]): Demand[] {
  const comboOf = new Map(combinations.map((c) => [`${c.code}:${c.grade}`, c]));
  const demands: Demand[] = [];
  const sorted = [...classes].sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }));
  for (const cls of sorted) {
    const combo = cls.combinationCode ? comboOf.get(`${cls.combinationCode}:${cls.grade}`) : undefined;
    const subjects = [...MANDATORY, ...(combo?.electives ?? []), ...CEREMONY_CODES];
    for (const subjectCode of subjects) {
      const theory = getCurriculumPeriods(subjectCode, cls.grade);
      const practice = getPracticePeriods(subjectCode, cls.grade);
      if (theory + practice === 0) continue;
      demands.push({
        className: cls.name,
        grade: cls.grade,
        session: cls.session,
        combinationCode: cls.combinationCode,
        subjectCode,
        theory,
        practice,
      });
    }
  }
  return demands;
}

/** Tổ nào lo môn nào: môn chính của giáo viên trong tổ, cộng các môn kiêm nhiệm tổ đó dạy được. */
export function subjectsOfDepartment(department: string, teachers: PlanTeacher[]): string[] {
  const majors = new Set(teachers.filter((t) => t.department === department && t.major).map((t) => t.major!));
  const subjects = new Set<string>(majors);
  for (const [subject, allowed] of Object.entries(ELIGIBLE_MAJORS)) {
    if (allowed.some((m) => majors.has(m))) subjects.add(subject);
  }
  for (const s of SYSTEM_SUBJECTS) subjects.delete(s);
  return [...subjects];
}

/**
 * Một môn kiêm nhiệm có thể khớp với nhiều tổ (vd. Công nghệ Công nghiệp ở tổ Lý và tổ Tin nếu
 * hai tổ tách riêng). Giao cho tổ đứng đầu theo thứ tự tên để không tổ nào nộp trùng.
 */
export function departmentOfSubject(subjectCode: string, teachers: PlanTeacher[]): string | null {
  const departments = [...new Set(teachers.map((t) => t.department).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'vi'));
  return departments.find((d) => subjectsOfDepartment(d, teachers).includes(subjectCode)) ?? null;
}

// ------------------------------------------------------------------ bai nop

export interface SubmittedRow {
  className: string;
  subjectCode: string;
  hk1TeacherCode: string;
  hk2TeacherCode: string;
}

export interface Issue {
  level: 'ERROR' | 'WARNING';
  message: string;
  className?: string;
  subjectCode?: string;
  teacherCode?: string;
}

/** Kiểm tra bài nộp của một tổ ngay lúc tổ trưởng bấm nộp. */
export function checkSubmission(
  department: string,
  rows: SubmittedRow[],
  demands: Demand[],
  teachers: PlanTeacher[],
): Issue[] {
  const issues: Issue[] = [];
  const mine = new Set(subjectsOfDepartment(department, teachers).filter((s) => departmentOfSubject(s, teachers) === department));
  const expected = demands.filter((d) => mine.has(d.subjectCode));
  const byKey = new Map(expected.map((d) => [`${d.className}:${d.subjectCode}`, d]));
  const byCode = new Map(teachers.map((t) => [t.code, t]));
  const seen = new Set<string>();
  const load = [new Map<string, number>(), new Map<string, number>()];

  for (const row of rows) {
    const key = `${row.className}:${row.subjectCode}`;
    const demand = byKey.get(key);
    if (!demand) {
      issues.push({ level: 'ERROR', message: `Lớp ${row.className} môn ${row.subjectCode} không thuộc phần việc của tổ`, className: row.className, subjectCode: row.subjectCode });
      continue;
    }
    if (seen.has(key)) {
      issues.push({ level: 'ERROR', message: `Lớp ${row.className} môn ${row.subjectCode} bị khai hai lần`, className: row.className, subjectCode: row.subjectCode });
      continue;
    }
    seen.add(key);
    [row.hk1TeacherCode, row.hk2TeacherCode].forEach((code, term) => {
      if (!code) return;
      const teacher = byCode.get(code);
      if (!teacher) {
        issues.push({ level: 'ERROR', message: `Mã giáo viên ${code} không tồn tại (lớp ${row.className}, HK${term + 1})`, className: row.className, subjectCode: row.subjectCode, teacherCode: code });
        return;
      }
      if (!eligibleMajorsOf(row.subjectCode).includes(teacher.major ?? '')) {
        issues.push({ level: 'ERROR', message: `${teacher.name} (${code}) không có chuyên môn dạy ${row.subjectCode} (lớp ${row.className})`, className: row.className, subjectCode: row.subjectCode, teacherCode: code });
        return;
      }
      if (teacher.teachableGrades?.length && !teacher.teachableGrades.includes(demand.grade)) {
        issues.push({ level: 'ERROR', message: `${teacher.name} (${code}) không được phân công dạy khối ${demand.grade} (lớp ${row.className})`, className: row.className, subjectCode: row.subjectCode, teacherCode: code });
        return;
      }
      load[term].set(code, (load[term].get(code) ?? 0) + periodsOf(demand));
    });
    if (!row.hk1TeacherCode && !row.hk2TeacherCode) {
      issues.push({ level: 'WARNING', message: `Lớp ${row.className} môn ${row.subjectCode} chưa phân giáo viên - hệ thống sẽ tự điền`, className: row.className, subjectCode: row.subjectCode });
    }
  }
  for (const d of expected) {
    if (!seen.has(`${d.className}:${d.subjectCode}`)) {
      issues.push({ level: 'WARNING', message: `Thiếu dòng lớp ${d.className} môn ${d.subjectCode} - hệ thống sẽ tự điền`, className: d.className, subjectCode: d.subjectCode });
    }
  }
  load.forEach((map, term) => {
    for (const [code, periods] of map) {
      const teacher = byCode.get(code)!;
      if (periods > teacher.capacity) {
        issues.push({ level: 'WARNING', message: `${teacher.name} (${code}) nhận ${periods} tiết HK${term + 1} trong tổ, vượt định mức ${teacher.capacity} (chưa tính HĐTN nếu là GVCN)`, teacherCode: code });
      }
    }
  });
  return issues;
}

// ------------------------------------------------------------------ hoan thien

export type Source = 'DEPARTMENT' | 'HOMEROOM' | 'AUTO';

export interface FinalAssignment extends Demand {
  hk1TeacherCode: string;
  hk2TeacherCode: string;
  source: Source;
}

export interface CompletionResult {
  assignments: FinalAssignment[];
  issues: Issue[];
  /** Tiết/tuần mỗi giáo viên theo học kỳ (không tính chào cờ, sinh hoạt) */
  loads: Array<Map<string, number>>;
  stats: { fromDepartments: number; homeroom: number; auto: number; unassigned: number };
}

/**
 * Giữ nguyên phân công tổ trưởng đã chốt, điền phần thiếu, kiểm tra lại.
 * Có lỗi (ERROR) thì không được nhập vào hệ thống.
 */
export function completeAssignments(input: {
  classes: PlanClass[];
  teachers: PlanTeacher[];
  demands: Demand[];
  /** Bài nộp mới nhất của từng tổ */
  submissions: Array<{ department: string; rows: SubmittedRow[] }>;
}): CompletionResult {
  const { classes, teachers, demands } = input;
  const issues: Issue[] = [];
  const byCode = new Map(teachers.map((t) => [t.code, t]));
  const classByName = new Map(classes.map((c) => [c.name, c]));
  const loads = [new Map<string, number>(), new Map<string, number>()];
  const sessionsOf = new Map<string, Set<number>>();
  const classesOf = new Map<string, Set<string>>();
  const addLoad = (code: string, term: number, d: Demand) => {
    if ((CEREMONY_CODES as readonly string[]).includes(d.subjectCode)) return;
    loads[term].set(code, (loads[term].get(code) ?? 0) + periodsOf(d));
    if (!OFF_SESSION.has(d.subjectCode)) sessionsOf.set(code, (sessionsOf.get(code) ?? new Set()).add(d.session));
    classesOf.set(code, (classesOf.get(code) ?? new Set()).add(d.className));
  };

  // Bài nộp: lấy đúng dòng của tổ, bỏ qua dòng sai (đã báo lúc nộp)
  const submitted = new Map<string, SubmittedRow>();
  for (const submission of input.submissions) {
    const owned = new Set(subjectsOfDepartment(submission.department, teachers).filter((s) => departmentOfSubject(s, teachers) === submission.department));
    for (const row of submission.rows) {
      if (owned.has(row.subjectCode)) submitted.set(`${row.className}:${row.subjectCode}`, row);
    }
  }
  const valid = (code: string, demand: Demand) => {
    const t = code ? byCode.get(code) : undefined;
    return t && canTeachDemand(t, demand) ? t : undefined;
  };

  const result: FinalAssignment[] = [];
  const pending: Demand[] = [];
  let fromDepartments = 0;
  let homeroom = 0;

  for (const d of demands) {
    const cls = classByName.get(d.className)!;
    if (d.subjectCode === 'HDTN' || (CEREMONY_CODES as readonly string[]).includes(d.subjectCode)) {
      const code = cls.homeroomTeacherCode ?? '';
      if (!code || !byCode.has(code)) {
        issues.push({ level: 'ERROR', message: `Lớp ${d.className} chưa có giáo viên chủ nhiệm nên không giao được ${d.subjectCode}`, className: d.className, subjectCode: d.subjectCode });
        continue;
      }
      result.push({ ...d, hk1TeacherCode: code, hk2TeacherCode: code, source: 'HOMEROOM' });
      addLoad(code, 0, d);
      addLoad(code, 1, d);
      homeroom++;
      continue;
    }
    const row = submitted.get(`${d.className}:${d.subjectCode}`);
    const t1 = row ? valid(row.hk1TeacherCode, d) : undefined;
    // HK2 bỏ trống nghĩa là giữ người của HK1
    const t2 = row ? valid(row.hk2TeacherCode || row.hk1TeacherCode, d) : undefined;
    if (t1 && t2) {
      result.push({ ...d, hk1TeacherCode: t1.code, hk2TeacherCode: t2.code, source: 'DEPARTMENT' });
      addLoad(t1.code, 0, d);
      addLoad(t2.code, 1, d);
      fromDepartments++;
    } else {
      pending.push(d);
    }
  }

  // Điền phần thiếu: việc khó trước (ít người nhận được nhất)
  const candidatesFor = (d: Demand) => teachers.filter((t) => canTeachDemand(t, d));
  pending.sort((a, b) => candidatesFor(a).length - candidatesFor(b).length || periodsOf(b) - periodsOf(a));

  // Mức tải "công bằng" của một giáo viên: tổng tiết cả nhóm môn chia đều cho số người dạy được.
  // Dùng để không dồn việc cho vài người trong khi người khác rảnh, mà vẫn giữ mỗi người một buổi.
  const fairLoad = new Map<string, number>();
  for (const t of teachers) {
    const share = demands
      .filter((d) => !(CEREMONY_CODES as readonly string[]).includes(d.subjectCode) && canTeachDemand(t, d))
      .reduce((n, d) => n + periodsOf(d), 0);
    const peers = teachers.filter((o) => o.major === t.major).length || 1;
    fairLoad.set(t.code, share / peers);
  }

  let auto = 0;
  let unassigned = 0;
  for (const d of pending) {
    const periods = periodsOf(d);
    const load = (t: PlanTeacher) => Math.max(loads[0].get(t.code) ?? 0, loads[1].get(t.code) ?? 0);
    const free = (t: PlanTeacher) => t.capacity - load(t);
    const fits = candidatesFor(d).filter((t) => free(t) >= periods);
    const homeroom = classByName.get(d.className)?.homeroomTeacherCode;
    const offSession = OFF_SESSION.has(d.subjectCode);
    const sameSession = (t: PlanTeacher) => offSession || (sessionsOf.get(t.code)?.has(d.session) ?? false);
    const fresh = (t: PlanTeacher) => !offSession && (sessionsOf.get(t.code)?.size ?? 0) === 0;
    const underFair = (t: PlanTeacher) => load(t) < (fairLoad.get(t.code) ?? t.capacity);
    const mostFree = (list: PlanTeacher[]) => [...list].sort((a, b) => free(b) - free(a))[0];

    // Thứ tự ưu tiên: GVCN dạy lớp mình → cùng buổi và chưa quá mức công bằng → chưa có lớp nào
    // → cùng buổi (dù đã quá mức) → khác buổi (bất đắc dĩ: thêm một buổi đến trường)
    const chosen =
      fits.find((t) => t.code === homeroom) ??
      mostFree(fits.filter((t) => sameSession(t) && underFair(t))) ??
      mostFree(fits.filter(fresh)) ??
      mostFree(fits.filter(sameSession)) ??
      mostFree(fits);
    if (!chosen) {
      issues.push({ level: 'ERROR', message: `Không còn giáo viên ${eligibleMajorsOf(d.subjectCode).join('/')} đủ chỗ cho lớp ${d.className} môn ${d.subjectCode} (${periods} tiết)`, className: d.className, subjectCode: d.subjectCode });
      unassigned++;
      continue;
    }
    result.push({ ...d, hk1TeacherCode: chosen.code, hk2TeacherCode: chosen.code, source: 'AUTO' });
    addLoad(chosen.code, 0, d);
    addLoad(chosen.code, 1, d);
    auto++;
  }

  // Kiểm tra cuối: định mức (lỗi cứng của bộ xếp lịch)
  loads.forEach((map, term) => {
    for (const [code, periods] of map) {
      const t = byCode.get(code)!;
      if (periods > t.capacity) {
        issues.push({ level: 'ERROR', message: `${t.name} (${code}) ${periods} tiết/tuần HK${term + 1}, vượt định mức ${t.capacity}`, teacherCode: code });
      }
    }
  });

  const order = new Map(demands.map((d, i) => [`${d.className}:${d.subjectCode}`, i]));
  result.sort((a, b) => order.get(`${a.className}:${a.subjectCode}`)! - order.get(`${b.className}:${b.subjectCode}`)!);
  return { assignments: result, issues, loads, stats: { fromDepartments, homeroom, auto, unassigned } };
}

export const isMandatory = (subjectCode: string) => MANDATORY.includes(subjectCode);
