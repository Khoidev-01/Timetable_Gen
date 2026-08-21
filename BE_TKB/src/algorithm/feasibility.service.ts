import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type IssueLevel = 'BLOCK' | 'RISK' | 'NOTE';

export interface FeasibilityIssue {
  level: IssueLevel;
  code: string;
  title: string;
  detail: string;
  suggestion?: string;
  link?: { label: string; href: string };
}

export interface FeasibilityReport {
  score: number;
  canRun: boolean;
  summary: { block: number; risk: number; note: number };
  capacity: {
    periodsRequired: number;
    cellsAvailable: number;
    utilisation: number;
    teacherQuotaTotal: number;
  };
  issues: FeasibilityIssue[];
}

const DAYS = [2, 3, 4, 5, 6, 7];
const OPPOSITE_SESSION_SUBJECTS = ['GDTC', 'GDQP'];

/**
 * Checks the input data can produce a valid timetable *before* the solver runs.
 *
 * Every problem this reports was found the hard way: a teacher assigned exactly their
 * quota with no slack, and a fixed-period rule pinning one teacher to several classes at
 * the same moment. Both only surfaced after a full run, as a timetable quietly missing
 * periods, which is the worst way to learn about them.
 */
@Injectable()
export class FeasibilityService {
  constructor(private prisma: PrismaService) {}

  async analyse(semesterId: string): Promise<FeasibilityReport> {
    const [semester, classes, teachers, subjects, rooms, assignments, fixedRules] =
      await Promise.all([
        this.prisma.semester.findUnique({ where: { id: semesterId } }),
        this.prisma.class.findMany({ include: { homeroom_teacher: true } }),
        this.prisma.teacher.findMany({ include: { constraints: true } }),
        this.prisma.subject.findMany(),
        this.prisma.room.findMany(),
        this.prisma.teachingAssignment.findMany({
          where: { semester_id: semesterId },
          include: { subject: true, teacher: true, class: true },
        }),
        this.prisma.fixedPeriodRule.findMany({ where: { is_active: true } }),
      ]);

    const issues: FeasibilityIssue[] = [];

    if (!semester) {
      return this.buildReport(
        [
          {
            level: 'BLOCK',
            code: 'NO_SEMESTER',
            title: 'Không tìm thấy học kỳ',
            detail: 'Học kỳ được chọn không tồn tại.',
          },
        ],
        { periodsRequired: 0, cellsAvailable: 0, utilisation: 0, teacherQuotaTotal: 0 },
      );
    }

    this.checkDataPresence(issues, classes, teachers, assignments);
    this.checkClassCapacity(issues, classes, assignments);
    this.checkTeacherQuota(issues, teachers, assignments);
    this.checkTeacherAvailability(issues, teachers, assignments);
    this.checkHomeroom(issues, classes, fixedRules);
    this.checkSpecialRooms(issues, rooms, subjects, assignments);
    this.checkFixedRules(issues, classes, assignments, subjects, fixedRules);

    const periodsRequired = assignments.reduce((sum, a) => sum + a.total_periods, 0);
    const cellsAvailable = classes.reduce(
      (sum, cls) => sum + this.usableCells(cls.main_session).length + this.usableCells(1 - cls.main_session).length,
      0,
    );
    const teacherQuotaTotal = teachers.reduce((sum, t) => sum + (t.max_periods_per_week || 0), 0);

    return this.buildReport(issues, {
      periodsRequired,
      cellsAvailable,
      utilisation: cellsAvailable > 0 ? Math.round((periodsRequired / cellsAvailable) * 100) : 0,
      teacherQuotaTotal,
    });
  }

  /** Cells a class can actually be taught in, mirroring the solver's grid policy. */
  private usableCells(session: number): Array<{ day: number; period: number }> {
    const [minP, maxP] = session === 0 ? [1, 5] : [6, 10];
    const cells: Array<{ day: number; period: number }> = [];

    for (const day of DAYS) {
      for (let period = minP; period <= maxP; period++) {
        // Monday's first period belongs to the whole-school assembly
        if (day === 2 && period === 1) continue;
        cells.push({ day, period });
      }
    }
    return cells;
  }

  private checkDataPresence(
    issues: FeasibilityIssue[],
    classes: any[],
    teachers: any[],
    assignments: any[],
  ) {
    if (classes.length === 0) {
      issues.push({
        level: 'BLOCK',
        code: 'NO_CLASSES',
        title: 'Chưa có lớp học nào',
        detail: 'Không có lớp nào trong hệ thống nên không có gì để xếp.',
        suggestion: 'Import danh sách lớp từ file Excel hoặc thêm thủ công.',
        link: { label: 'Quản lý lớp học', href: '/admin/classes' },
      });
    }

    if (assignments.length === 0) {
      issues.push({
        level: 'BLOCK',
        code: 'NO_ASSIGNMENTS',
        title: 'Chưa có phân công giảng dạy',
        detail: 'Học kỳ này chưa có dòng phân công nào.',
        suggestion: 'Import bảng phân công từ file Excel cho năm học đang chọn.',
        link: { label: 'Phân công giảng dạy', href: '/admin/assignments' },
      });
    }

    const assignedClassIds = new Set(assignments.map((a) => a.class_id));
    const emptyClasses = classes.filter((c) => !assignedClassIds.has(c.id));
    if (emptyClasses.length > 0 && assignments.length > 0) {
      issues.push({
        level: 'BLOCK',
        code: 'CLASS_NO_ASSIGNMENT',
        title: `${emptyClasses.length} lớp chưa được phân công môn nào`,
        detail: emptyClasses.map((c) => c.name).join(', '),
        suggestion: 'Bổ sung phân công cho các lớp này, nếu không thời khóa biểu của họ sẽ trống.',
        link: { label: 'Phân công giảng dạy', href: '/admin/assignments' },
      });
    }

    const idleTeachers = teachers.filter(
      (t) => !assignments.some((a) => a.teacher_id === t.id),
    );
    if (idleTeachers.length > 0) {
      issues.push({
        level: 'NOTE',
        code: 'TEACHER_IDLE',
        title: `${idleTeachers.length} giáo viên chưa được phân công tiết nào`,
        detail: idleTeachers.slice(0, 10).map((t) => `${t.code} — ${t.full_name}`).join(' · '),
        suggestion: 'Kiểm tra lại nếu đây không phải giáo viên nghỉ hoặc kiêm nhiệm toàn phần.',
      });
    }
  }

  private checkClassCapacity(issues: FeasibilityIssue[], classes: any[], assignments: any[]) {
    for (const cls of classes) {
      const own = assignments.filter((a) => a.class_id === cls.id);
      if (own.length === 0) continue;

      const oppositeDemand = own
        .filter((a) => OPPOSITE_SESSION_SUBJECTS.includes(a.subject.code))
        .reduce((sum, a) => sum + a.total_periods, 0);
      const mainDemand = own.reduce((sum, a) => sum + a.total_periods, 0) - oppositeDemand;

      const mainCells = this.usableCells(cls.main_session).length;
      const oppositeCells = this.usableCells(1 - cls.main_session).length;

      if (mainDemand > mainCells) {
        issues.push({
          level: 'BLOCK',
          code: 'CLASS_OVER_CAPACITY',
          title: `Lớp ${cls.name} cần nhiều tiết hơn số ô khả dụng`,
          detail: `Cần ${mainDemand} tiết ở buổi chính nhưng chỉ có ${mainCells} ô.`,
          suggestion: `Giảm ${mainDemand - mainCells} tiết, hoặc cho lớp học thêm buổi phụ.`,
          link: { label: 'Phân công giảng dạy', href: '/admin/assignments' },
        });
      } else if (mainDemand > mainCells - 2) {
        issues.push({
          level: 'RISK',
          code: 'CLASS_TIGHT',
          title: `Lớp ${cls.name} gần kín lịch`,
          detail: `Cần ${mainDemand}/${mainCells} ô buổi chính, chỉ dư ${mainCells - mainDemand} ô.`,
          suggestion: 'Bất kỳ trục trặc nhỏ nào cũng có thể làm thiếu tiết. Cân nhắc nới lịch bận giáo viên.',
        });
      }

      if (oppositeDemand > oppositeCells) {
        issues.push({
          level: 'BLOCK',
          code: 'CLASS_OPPOSITE_OVER',
          title: `Lớp ${cls.name}: môn trái buổi vượt sức chứa`,
          detail: `Cần ${oppositeDemand} tiết trái buổi nhưng chỉ có ${oppositeCells} ô.`,
          suggestion: 'Giảm số tiết Thể dục / Quốc phòng hoặc chuyển một phần về buổi chính.',
        });
      }
    }
  }

  private checkTeacherQuota(issues: FeasibilityIssue[], teachers: any[], assignments: any[]) {
    for (const teacher of teachers) {
      const assigned = assignments
        .filter((a) => a.teacher_id === teacher.id)
        .reduce((sum, a) => sum + a.total_periods, 0);
      if (assigned === 0) continue;

      const quota = teacher.max_periods_per_week || 0;
      if (quota <= 0) continue;

      if (assigned > quota) {
        issues.push({
          level: 'BLOCK',
          code: 'TEACHER_OVER_QUOTA',
          title: `${teacher.code} — ${teacher.full_name} vượt định mức`,
          detail: `Được phân công ${assigned} tiết/tuần trên định mức ${quota}.`,
          suggestion: `Chuyển ${assigned - quota} tiết sang giáo viên khác, hoặc điều chỉnh định mức nếu có kiêm nhiệm.`,
          link: { label: 'Quản lý giáo viên', href: '/admin/teachers' },
        });
      } else if (assigned === quota) {
        issues.push({
          level: 'RISK',
          code: 'TEACHER_NO_SLACK',
          title: `${teacher.code} — ${teacher.full_name} kín định mức`,
          detail: `Được phân công đúng ${assigned}/${quota} tiết, không còn dư một tiết nào.`,
          suggestion:
            'Chỉ cần một xung đột lịch là mất tiết vĩnh viễn. Nên chừa lại 1–2 tiết dự phòng.',
          link: { label: 'Phân công giảng dạy', href: '/admin/assignments' },
        });
      }
    }
  }

  private checkTeacherAvailability(issues: FeasibilityIssue[], teachers: any[], assignments: any[]) {
    for (const teacher of teachers) {
      const assigned = assignments
        .filter((a) => a.teacher_id === teacher.id)
        .reduce((sum, a) => sum + a.total_periods, 0);
      if (assigned === 0) continue;

      const busy = (teacher.constraints || []).filter((c: any) => c.type === 'BUSY').length;
      const totalCells = DAYS.length * 10;
      const free = totalCells - busy;

      if (assigned > free) {
        issues.push({
          level: 'BLOCK',
          code: 'TEACHER_BUSY_CONFLICT',
          title: `${teacher.code} — ${teacher.full_name} đăng ký bận quá nhiều`,
          detail: `Phải dạy ${assigned} tiết nhưng chỉ còn ${free} ô rảnh sau khi trừ ${busy} ô đã báo bận.`,
          suggestion: 'Đề nghị giáo viên bỏ bớt ô bận, hoặc giảm số tiết được phân công.',
          link: { label: 'Quản lý giáo viên', href: '/admin/teachers' },
        });
      } else if (busy > 0 && assigned > free * 0.7) {
        issues.push({
          level: 'RISK',
          code: 'TEACHER_BUSY_TIGHT',
          title: `${teacher.code} — ${teacher.full_name} có ít ô xoay xở`,
          detail: `Dạy ${assigned} tiết trong ${free} ô rảnh (đã báo bận ${busy} ô).`,
          suggestion: 'Lịch của giáo viên này sẽ khó tối ưu, dễ bị trống tiết rải rác.',
        });
      }
    }
  }

  private checkHomeroom(issues: FeasibilityIssue[], classes: any[], fixedRules: any[]) {
    const needsHomeroom = fixedRules.some((r) => r.teacher_rule === 'HOMEROOM');
    if (!needsHomeroom) return;

    const without = classes.filter((c) => !c.homeroom_teacher_id);
    if (without.length === 0) return;

    issues.push({
      level: 'BLOCK',
      code: 'CLASS_NO_HOMEROOM',
      title: `${without.length} lớp chưa có giáo viên chủ nhiệm`,
      detail: `${without.map((c) => c.name).join(', ')} — các tiết chào cờ và sinh hoạt sẽ không xếp được.`,
      suggestion: 'Gán giáo viên chủ nhiệm cho các lớp này.',
      link: { label: 'Quản lý lớp học', href: '/admin/classes' },
    });
  }

  private checkSpecialRooms(
    issues: FeasibilityIssue[],
    rooms: any[],
    subjects: any[],
    assignments: any[],
  ) {
    const roomTypeOf = (code: string, isPractice: boolean): string | null => {
      if (code === 'GDTC') return 'YARD';
      if (!isPractice) return null;
      return ({ TIN: 'LAB_IT', LY: 'LAB_PHYSICS', HOA: 'LAB_CHEM', SINH: 'LAB_BIO' } as any)[code] ?? null;
    };

    const capacity = new Map<string, number>();
    for (const room of rooms) capacity.set(room.type, (capacity.get(room.type) || 0) + 1);

    const demand = new Map<string, number>();
    for (const a of assignments) {
      const subject = subjects.find((s) => s.id === a.subject_id);
      if (!subject) continue;
      const type = roomTypeOf(subject.code, subject.is_practice);
      if (!type) continue;
      demand.set(type, (demand.get(type) || 0) + a.total_periods);
    }

    const labels: Record<string, string> = {
      YARD: 'sân thể dục',
      LAB_IT: 'phòng máy tính',
      LAB_PHYSICS: 'phòng thực hành Vật lý',
      LAB_CHEM: 'phòng thực hành Hóa học',
      LAB_BIO: 'phòng thực hành Sinh học',
    };

    for (const [type, needed] of demand) {
      const count = capacity.get(type) || 0;
      const label = labels[type] ?? type;

      if (count === 0) {
        issues.push({
          level: 'BLOCK',
          code: 'ROOM_TYPE_MISSING',
          title: `Chưa khai báo ${label}`,
          detail: `Có ${needed} tiết cần ${label} nhưng hệ thống không có phòng nào thuộc loại này.`,
          suggestion: `Thêm ít nhất một ${label} vào danh mục phòng.`,
          link: { label: 'Quản lý phòng', href: '/admin/classes' },
        });
        continue;
      }

      // A specialised room can host one class per period across the teaching week
      const supply = count * DAYS.length * 10;
      const ratio = needed / supply;

      if (ratio > 1) {
        issues.push({
          level: 'BLOCK',
          code: 'ROOM_TYPE_OVERBOOKED',
          title: `Thiếu ${label}`,
          detail: `Cần ${needed} tiết nhưng ${count} phòng chỉ đáp ứng tối đa ${supply} tiết/tuần.`,
          suggestion: `Bổ sung ${label}, hoặc giảm số tiết thực hành.`,
        });
      } else if (ratio > 0.6) {
        issues.push({
          level: 'RISK',
          code: 'ROOM_TYPE_TIGHT',
          title: `${label} sắp quá tải`,
          detail: `Cần ${needed}/${supply} tiết khả dụng (${Math.round(ratio * 100)}%).`,
          suggestion: 'Nhiều lớp sẽ tranh nhau khung giờ đẹp; cân nhắc bổ sung phòng.',
        });
      }
    }
  }

  /**
   * A rule pinning one subject for several classes only works when each class has its own
   * teacher for it. Sharing one teacher means the solver has to skip all but one class.
   */
  private checkFixedRules(
    issues: FeasibilityIssue[],
    classes: any[],
    assignments: any[],
    subjects: any[],
    fixedRules: any[],
  ) {
    if (fixedRules.length === 0) {
      issues.push({
        level: 'NOTE',
        code: 'NO_FIXED_RULES',
        title: 'Chưa cấu hình tiết cố định nào',
        detail: 'Chào cờ và sinh hoạt sẽ không được xếp tự động.',
        suggestion: 'Thêm quy tắc tiết cố định cho chào cờ và sinh hoạt cuối tuần.',
        link: { label: 'Tiết cố định', href: '/admin/fixed-periods' },
      });
      return;
    }

    for (const rule of fixedRules) {
      const affected = classes.filter(
        (c) =>
          (rule.grade_level === null || rule.grade_level === c.grade_level) &&
          (rule.main_session === null || rule.main_session === c.main_session),
      );
      if (affected.length < 2) continue;

      const teacherFor = (cls: any): string | null => {
        if (rule.teacher_rule === 'HOMEROOM') return cls.homeroom_teacher_id ?? null;
        if (rule.teacher_rule === 'ASSIGNED') {
          const subject = subjects.find((s) => s.code === rule.subject_code);
          if (!subject) return null;
          const match = assignments.find(
            (a) => a.class_id === cls.id && a.subject_id === subject.id,
          );
          return match?.teacher_id ?? null;
        }
        return 'BGH';
      };

      const byTeacher = new Map<string, string[]>();
      for (const cls of affected) {
        const teacherId = teacherFor(cls);
        if (!teacherId) continue;
        if (!byTeacher.has(teacherId)) byTeacher.set(teacherId, []);
        byTeacher.get(teacherId)!.push(cls.name);
      }

      for (const [, classNames] of byTeacher) {
        if (classNames.length < 2) continue;
        issues.push({
          level: 'RISK',
          code: 'FIXED_RULE_TEACHER_CLASH',
          title: `Quy tắc "${rule.name}" trùng giáo viên`,
          detail: `Thứ ${rule.day_of_week} tiết ${rule.period} được ghim cho ${classNames.join(', ')} nhưng cùng một giáo viên phụ trách.`,
          suggestion:
            'Một giáo viên không thể dạy nhiều lớp cùng lúc — chỉ lớp đầu tiên giữ được tiết ghim, các lớp còn lại sẽ do thuật toán tự xếp.',
          link: { label: 'Tiết cố định', href: '/admin/fixed-periods' },
        });
      }
    }
  }

  private buildReport(
    issues: FeasibilityIssue[],
    capacity: FeasibilityReport['capacity'],
  ): FeasibilityReport {
    const block = issues.filter((i) => i.level === 'BLOCK').length;
    const risk = issues.filter((i) => i.level === 'RISK').length;
    const note = issues.filter((i) => i.level === 'NOTE').length;

    const score = Math.max(0, 100 - block * 25 - risk * 6 - note * 1);

    const order: Record<IssueLevel, number> = { BLOCK: 0, RISK: 1, NOTE: 2 };
    issues.sort((a, b) => order[a.level] - order[b.level]);

    return { score, canRun: block === 0, summary: { block, risk, note }, capacity, issues };
  }
}
