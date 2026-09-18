import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelService } from '../excel/excel.service';
import { NotificationService } from '../notifications/notification.service';
import { AlgorithmProducer } from '../worker/algorithm.producer';
import { SUBJECT_CATALOG } from '../excel/excel.constants';
import { getCellText } from '../excel/excel.utils';
import {
  buildDemands,
  CEREMONY_CODES,
  checkSubmission,
  completeAssignments,
  Demand,
  departmentOfSubject,
  eligibleMajorsOf,
  isMandatory,
  Issue,
  PlanClass,
  PlanCombination,
  PlanTeacher,
  subjectsOfDepartment,
  SubmittedRow,
} from './department-plan';
import { addTableSheet, writeSchoolWorkbook } from './school-workbook';

const TEMPLATE_SHEET = 'Phan_cong_to';
const META_SHEET = '_meta';
const TEACHER_SHEET = 'GV_to';

const subjectName = (code: string) => SUBJECT_CATALOG.find((s) => s.code === code)?.name ?? code;
const sortVi = (a: string, b: string) => a.localeCompare(b, 'vi', { numeric: true });

@Injectable()
export class DepartmentAssignmentsService {
  private readonly logger = new Logger(DepartmentAssignmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly excel: ExcelService,
    private readonly notifications: NotificationService,
    private readonly algorithm: AlgorithmProducer,
  ) {}

  // ================================================================== du lieu chung

  private async currentYear(yearId?: string) {
    const year = yearId
      ? await this.prisma.academicYear.findUnique({ where: { id: yearId }, include: { semesters: { orderBy: { term_order: 'asc' } } } })
      : await this.prisma.academicYear.findFirst({ orderBy: { name: 'desc' }, include: { semesters: { orderBy: { term_order: 'asc' } } } });
    if (!year) throw new NotFoundException('Chưa có năm học.');
    const weeks = year.weeks > 0 ? year.weeks : 35;
    return { year, hk1Weeks: Math.ceil(weeks / 2), hk2Weeks: Math.floor(weeks / 2) };
  }

  private async loadPlan() {
    const [teachers, classes, combinations, rooms] = await Promise.all([
      this.prisma.teacher.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.class.findMany({ include: { homeroom_teacher: true, fixed_room: true } }),
      this.prisma.curriculumCombination.findMany(),
      this.prisma.room.findMany({ orderBy: { name: 'asc' } }),
    ]);
    const planTeachers: PlanTeacher[] = teachers.map((t) => ({
      code: t.code,
      name: t.full_name,
      major: t.major_subject,
      department: t.department,
      position: t.position,
      capacity: t.max_periods_per_week,
    }));
    const planClasses: PlanClass[] = classes.map((c) => ({
      id: c.id,
      name: c.name,
      grade: c.grade_level,
      session: c.main_session,
      combinationCode: c.combination_code,
      homeroomTeacherCode: c.homeroom_teacher?.code ?? null,
    }));
    const planCombinations: PlanCombination[] = combinations.map((c) => ({
      code: c.code,
      grade: c.grade_level,
      electives: [c.elective_subject_code_1, c.elective_subject_code_2, c.elective_subject_code_3, c.elective_subject_code_4].filter(Boolean) as string[],
    }));
    return {
      teachers,
      classes,
      rooms,
      planTeachers,
      planClasses,
      planCombinations,
      demands: buildDemands(planClasses, planCombinations),
    };
  }

  private departmentsOf(teachers: PlanTeacher[]) {
    return [...new Set(teachers.map((t) => t.department).filter(Boolean) as string[])].sort(sortVi);
  }

  /** Môn một tổ phải nộp (đã loại môn kiêm nhiệm thuộc về tổ khác). */
  private ownedSubjects(department: string, teachers: PlanTeacher[]) {
    return subjectsOfDepartment(department, teachers).filter((s) => departmentOfSubject(s, teachers) === department);
  }

  // ================================================================== to truong

  /** Tổ của người đang đăng nhập; chỉ tổ trưởng mới được nộp. */
  private async headOf(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { teacher_profile: true } });
    const teacher = user?.teacher_profile;
    if (!teacher) throw new ForbiddenException('Tài khoản chưa gắn với hồ sơ giáo viên.');
    if (teacher.position !== 'TT' || !teacher.department) {
      throw new ForbiddenException('Chỉ tổ trưởng chuyên môn mới nộp được bảng phân công của tổ.');
    }
    return { user: user!, teacher, department: teacher.department };
  }

  async mine(userId: string) {
    const { teacher, department } = await this.headOf(userId);
    const { year } = await this.currentYear();
    const plan = await this.loadPlan();
    const subjects = this.ownedSubjects(department, plan.planTeachers);
    const latest = await this.prisma.departmentSubmission.findFirst({
      where: { year_id: year.id, department, is_latest: true },
      orderBy: { submitted_at: 'desc' },
    });
    return {
      yearId: year.id,
      yearName: year.name,
      department,
      head: { code: teacher.code, name: teacher.full_name },
      subjects: subjects.map((code) => ({ code, name: subjectName(code) })),
      rowCount: plan.demands.filter((d) => subjects.includes(d.subjectCode)).length,
      teacherCount: plan.planTeachers.filter((t) => t.department === department).length,
      latest: latest && {
        fileName: latest.file_name,
        submittedAt: latest.submitted_at,
        rows: (latest.rows as unknown as SubmittedRow[]).length,
        issues: latest.issues,
      },
    };
  }

  /** Mẫu điền sẵn mọi dòng Lớp - Môn của tổ; tổ trưởng chỉ điền mã giáo viên. */
  async template(userId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const { department } = await this.headOf(userId);
    const { year } = await this.currentYear();
    const plan = await this.loadPlan();
    const subjects = this.ownedSubjects(department, plan.planTeachers);
    const demands = plan.demands.filter((d) => subjects.includes(d.subjectCode));
    const latest = await this.prisma.departmentSubmission.findFirst({ where: { year_id: year.id, department, is_latest: true } });
    const previous = new Map(((latest?.rows as unknown as SubmittedRow[]) ?? []).map((r) => [`${r.className}:${r.subjectCode}`, r]));
    const members = plan.planTeachers.filter((t) => t.department === department || subjects.some((s) => eligibleMajorsOf(s).includes(t.major ?? '')));
    const homeroomOf = new Map(plan.planClasses.filter((c) => c.homeroomTeacherCode).map((c) => [c.homeroomTeacherCode!, c.name]));

    const wb = new ExcelJS.Workbook();
    const ws = addTableSheet(wb, TEMPLATE_SHEET, `Phân công ${department} - Năm học ${year.name}`,
      ['STT', 'Khối', 'Lớp', 'Buổi', 'Mã môn', 'Tên môn', 'Tiết LT/tuần', 'Tiết TH/tuần', 'GV HK1 Mã', 'GV HK2 Mã', 'Ghi chú'],
      demands.map((d, i) => {
        const prev = previous.get(`${d.className}:${d.subjectCode}`);
        return [i + 1, d.grade, d.className, d.session === 0 ? 'Sáng' : 'Chiều', d.subjectCode, subjectName(d.subjectCode), d.theory, d.practice || '', prev?.hk1TeacherCode ?? '', prev?.hk2TeacherCode ?? '',
          eligibleMajorsOf(d.subjectCode).length > 1 ? `GV ${eligibleMajorsOf(d.subjectCode).map(subjectName).join(' / ')} kiêm nhiệm` : ''];
      }),
      [6, 6, 7, 7, 10, 30, 11, 11, 12, 12, 34]);
    // Chỉ cho chọn mã giáo viên có trong sheet GV_to; HK2 để trống = giữ người của HK1
    const lastTeacherRow = members.length + 2;
    for (let r = 3; r < 3 + demands.length; r++) {
      for (const col of [9, 10]) {
        ws.getCell(r, col).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`${TEACHER_SHEET}!$A$3:$A$${lastTeacherRow}`],
          showErrorMessage: true,
          errorTitle: 'Mã giáo viên',
          error: 'Chọn mã giáo viên trong danh sách của tổ (sheet GV_to).',
        };
        ws.getCell(r, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7D6' } };
      }
    }
    addTableSheet(wb, TEACHER_SHEET, `Giáo viên nhận được phần việc của ${department}`,
      ['Mã GV', 'Họ tên', 'Môn chính', 'Tổ', 'Định mức hiệu lực', 'Chủ nhiệm lớp', 'Ghi chú'],
      members.map((t) => [t.code, t.name, subjectName(t.major ?? ''), t.department ?? '', t.capacity, homeroomOf.get(t.code) ?? '',
        homeroomOf.has(t.code) ? 'GVCN: hệ thống tự giao thêm HĐTN 3 tiết' : '']),
      [9, 24, 16, 30, 12, 12, 40]);
    addTableSheet(wb, 'Huong_dan', 'Hướng dẫn', ['Mục', 'Nội dung'], [
      ['Điền gì', 'Chỉ điền cột GV HK1 Mã (và GV HK2 Mã nếu học kỳ 2 đổi người). Không sửa các cột khác.'],
      ['Lý thuyết - thực hành', 'Mỗi dòng gồm cả tiết lý thuyết và thực hành: một giáo viên dạy cả hai.'],
      ['Bỏ trống', 'Dòng bỏ trống sẽ được hệ thống tự phân công khi tổng hợp.'],
      ['Không cần điền', 'HĐTN-HN, Chào cờ, Sinh hoạt: hệ thống giao cho giáo viên chủ nhiệm.'],
      ['Nộp', 'Đăng nhập hệ thống, mục Phân công tổ, tải file lên và bấm Nộp. Nộp lại sẽ thay bản trước.'],
    ], [22, 100]);
    const meta = wb.addWorksheet(META_SHEET, { state: 'veryHidden' });
    meta.getCell('A1').value = department;
    meta.getCell('A2').value = year.id;

    return {
      buffer: Buffer.from(await wb.xlsx.writeBuffer()),
      fileName: `phan-cong-${department.replace(/\s+/g, '-').toLowerCase()}-${year.name}.xlsx`,
    };
  }

  async submit(userId: string, fileName: string, buffer: Buffer) {
    const { user, teacher, department } = await this.headOf(userId);
    const { year } = await this.currentYear();
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException('Không đọc được file. Hãy dùng đúng mẫu tải về từ hệ thống (.xlsx).');
    }
    const ws = wb.getWorksheet(TEMPLATE_SHEET);
    if (!ws) throw new BadRequestException(`File không có sheet ${TEMPLATE_SHEET}. Hãy tải mẫu của tổ và điền vào đó.`);
    const metaDepartment = getCellText(wb.getWorksheet(META_SHEET)?.getCell('A1') as ExcelJS.Cell).trim();
    if (metaDepartment && metaDepartment !== department) {
      throw new BadRequestException(`Đây là mẫu của ${metaDepartment}, không phải của ${department}.`);
    }

    // Đọc theo tiêu đề cột, không theo vị trí
    let headerRow = 0;
    const col: Record<string, number> = {};
    for (let r = 1; r <= Math.min(ws.rowCount, 6) && !headerRow; r++) {
      ws.getRow(r).eachCell((cell, c) => {
        const text = getCellText(cell).trim();
        if (text) col[text] = c;
      });
      if (col['Lớp'] && col['Mã môn']) headerRow = r;
      else Object.keys(col).forEach((k) => delete col[k]);
    }
    if (!headerRow || !col['GV HK1 Mã']) throw new BadRequestException('Không tìm thấy các cột Lớp, Mã môn, GV HK1 Mã trong file.');

    const rows: SubmittedRow[] = [];
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const className = getCellText(row.getCell(col['Lớp'])).trim();
      const subjectCode = getCellText(row.getCell(col['Mã môn'])).trim().toUpperCase();
      if (!className || !subjectCode) continue;
      rows.push({
        className,
        subjectCode,
        hk1TeacherCode: getCellText(row.getCell(col['GV HK1 Mã'])).trim().toUpperCase(),
        hk2TeacherCode: col['GV HK2 Mã'] ? getCellText(row.getCell(col['GV HK2 Mã'])).trim().toUpperCase() : '',
      });
    }
    if (rows.length === 0) throw new BadRequestException('File không có dòng phân công nào.');

    const plan = await this.loadPlan();
    const issues = checkSubmission(department, rows, plan.demands, plan.planTeachers);

    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.departmentSubmission.updateMany({ where: { year_id: year.id, department, is_latest: true }, data: { is_latest: false } });
      return tx.departmentSubmission.create({
        data: {
          year_id: year.id,
          department,
          submitted_by: user.id,
          head_teacher_id: teacher.id,
          file_name: fileName,
          rows: rows as any,
          issues: issues as any,
        },
      });
    });

    const errors = issues.filter((i) => i.level === 'ERROR').length;
    const filled = rows.filter((r) => r.hk1TeacherCode).length;
    await this.notifications.create({
      category: 'SYSTEM' as any,
      title: `${department} đã nộp phân công`,
      message: `${teacher.full_name} nộp ${filled}/${rows.length} dòng có giáo viên${errors ? `, ${errors} lỗi cần xem` : ''}.`,
      metadata: { submissionId: saved.id, department, yearId: year.id },
    });

    return { id: saved.id, submittedAt: saved.submitted_at, rows: rows.length, filled, issues };
  }

  // ================================================================== admin

  async overview(yearId?: string) {
    const { year } = await this.currentYear(yearId);
    const plan = await this.loadPlan();
    const submissions = await this.prisma.departmentSubmission.findMany({ where: { year_id: year.id, is_latest: true } });
    const latestConsolidation = await this.prisma.assignmentConsolidation.findFirst({
      where: { year_id: year.id },
      orderBy: { created_at: 'desc' },
      select: { id: true, created_at: true, report: true },
    });

    const departments = this.departmentsOf(plan.planTeachers).map((department) => {
      const subjects = this.ownedSubjects(department, plan.planTeachers);
      const head = plan.planTeachers.find((t) => t.department === department && t.position === 'TT');
      const submission = submissions.find((s) => s.department === department);
      const rows = (submission?.rows as unknown as SubmittedRow[]) ?? [];
      const issues = (submission?.issues as unknown as Issue[]) ?? [];
      return {
        department,
        head: head ? { code: head.code, name: head.name } : null,
        subjects: subjects.map((code) => ({ code, name: subjectName(code) })),
        expectedRows: plan.demands.filter((d) => subjects.includes(d.subjectCode)).length,
        submission: submission && {
          id: submission.id,
          fileName: submission.file_name,
          submittedAt: submission.submitted_at,
          filled: rows.filter((r) => r.hk1TeacherCode).length,
          errors: issues.filter((i) => i.level === 'ERROR').length,
          warnings: issues.filter((i) => i.level === 'WARNING').length,
          issues,
        },
      };
    });

    return {
      yearId: year.id,
      yearName: year.name,
      departments,
      latestConsolidation: latestConsolidation && { id: latestConsolidation.id, createdAt: latestConsolidation.created_at, report: latestConsolidation.report },
    };
  }

  private async complete(yearId?: string) {
    const context = await this.currentYear(yearId);
    const plan = await this.loadPlan();
    const submissions = await this.prisma.departmentSubmission.findMany({ where: { year_id: context.year.id, is_latest: true } });
    const result = completeAssignments({
      classes: plan.planClasses,
      teachers: plan.planTeachers,
      demands: plan.demands,
      submissions: submissions.map((s) => ({ department: s.department, rows: s.rows as unknown as SubmittedRow[] })),
    });
    const departments = this.departmentsOf(plan.planTeachers);
    const report = {
      yearName: context.year.name,
      classes: plan.planClasses.length,
      teachers: plan.planTeachers.length,
      totalRows: plan.demands.length,
      stats: result.stats,
      submittedDepartments: submissions.map((s) => s.department).sort(sortVi),
      missingDepartments: departments.filter((d) => !submissions.some((s) => s.department === d)),
      errors: result.issues.filter((i) => i.level === 'ERROR'),
      warnings: result.issues.filter((i) => i.level === 'WARNING'),
      loads: plan.planTeachers
        .map((t) => ({ code: t.code, name: t.name, capacity: t.capacity, hk1: result.loads[0].get(t.code) ?? 0, hk2: result.loads[1].get(t.code) ?? 0 }))
        .sort((a, b) => b.hk1 / (b.capacity || 1) - a.hk1 / (a.capacity || 1)),
    };
    return { context, plan, result, report };
  }

  /** "Tổng hợp": gộp bài nộp và cho xem trước bảng hoàn chỉnh, chưa ghi gì. */
  async consolidate(yearId?: string) {
    const { report } = await this.complete(yearId);
    return report;
  }

  /**
   * "Phân công tự động": hoàn thiện bảng, ghi ra đúng mẫu nhập, nhập qua đường Nhập Excel thật,
   * rồi xếp thời khóa biểu cả hai học kỳ. Còn lỗi thì dừng, không nhập gì.
   */
  async autoAssign(userId: string, yearId?: string) {
    const { context, plan, result, report } = await this.complete(yearId);
    if (report.errors.length > 0) {
      throw new BadRequestException({ message: `Còn ${report.errors.length} lỗi, chưa thể phân công.`, report });
    }

    const teacherByCode = new Map(plan.teachers.map((t) => [t.code, t]));
    const homeroomOf = new Map(plan.classes.filter((c) => c.homeroom_teacher).map((c) => [c.homeroom_teacher!.code, c.name]));
    const assignments = result.assignments.flatMap((a) => {
      const hk1 = teacherByCode.get(a.hk1TeacherCode)!;
      const hk2 = teacherByCode.get(a.hk2TeacherCode)!;
      const ceremony = (CEREMONY_CODES as readonly string[]).includes(a.subjectCode);
      const group = ceremony ? 'Hoạt động tập thể' : isMandatory(a.subjectCode) ? 'Bắt buộc' : 'Lựa chọn';
      const base = {
        className: a.className, grade: a.grade, combinationCode: a.combinationCode, subjectCode: a.subjectCode,
        hk1TeacherCode: hk1.code, hk1TeacherName: hk1.full_name, hk2TeacherCode: hk2.code, hk2TeacherName: hk2.full_name,
      };
      const source = a.source === 'DEPARTMENT' ? 'Tổ trưởng phân công' : a.source === 'HOMEROOM' ? 'GV chủ nhiệm' : 'Hệ thống tự phân công';
      if (a.practice > 0) {
        return [
          { ...base, subjectName: subjectName(a.subjectCode), group, weekly: a.theory, practice: false, note: `Lý thuyết - ${source}` },
          { ...base, subjectName: `${subjectName(a.subjectCode)} (TH)`, group: `${group} - Thực hành`, weekly: a.practice, practice: true, note: `Thực hành - ${source}` },
        ];
      }
      const offSession = ['GDTC', 'GDQP'].includes(a.subjectCode) ? 'Học khác buổi - Sân bãi - ' : '';
      return [{ ...base, subjectName: subjectName(a.subjectCode), group, weekly: a.theory, practice: false, note: `${offSession}${source}` }];
    });

    const workbook = await writeSchoolWorkbook({
      yearName: context.year.name,
      hk1Weeks: context.hk1Weeks,
      hk2Weeks: context.hk2Weeks,
      teachers: plan.teachers.map((t) => ({
        code: t.code, name: t.full_name, homeroomClass: homeroomOf.get(t.code), phone: t.phone, email: t.email,
        department: t.department, major: t.major_subject, position: t.position,
        baseLoad: t.max_periods_per_week + t.workload_reduction, reduction: t.workload_reduction, effectiveLoad: t.max_periods_per_week, notes: t.notes,
      })),
      classes: plan.classes
        .sort((a, b) => sortVi(a.name, b.name))
        .map((c) => ({ name: c.name, grade: c.grade_level, students: c.student_count, session: c.main_session, combinationCode: c.combination_code, roomName: c.fixed_room?.name, homeroomCode: c.homeroom_teacher?.code, homeroomName: c.homeroom_teacher?.full_name })),
      rooms: plan.rooms.map((r) => ({ name: r.name, type: r.type, floor: r.floor, capacity: r.capacity, fixedClasses: plan.classes.filter((c) => c.fixed_room_id === r.id).map((c) => c.name).sort(sortVi) })),
      combinations: plan.planCombinations,
      assignments,
    });

    const imported = await this.excel.importWorkbook(context.year.id, workbook);
    if ((imported as any).errors?.length) {
      throw new BadRequestException({ message: 'Nhập bảng hoàn chỉnh thất bại.', errors: (imported as any).errors, report });
    }

    const saved = await this.prisma.assignmentConsolidation.create({
      data: { year_id: context.year.id, created_by: userId, workbook, report: { ...report, imported: imported.summary } as any },
    });

    // Xếp lịch cả hai học kỳ. Không chờ: mỗi lần xếp mất vài phút, tiến độ hiện ở trang Thời khóa biểu.
    const scheduling: Array<{ semester: string; jobId?: string; error?: string }> = [];
    for (const semester of context.year.semesters) {
      try {
        const started: any = await Promise.race([
          this.algorithm.startOptimization(semester.id),
          new Promise((resolve) => setTimeout(() => resolve({ jobId: 'dang-chay', background: true }), 3000)),
        ]);
        scheduling.push({ semester: semester.name, jobId: started?.jobId });
      } catch (error) {
        this.logger.error(`Không bắt đầu xếp lịch ${semester.name}: ${error}`);
        scheduling.push({ semester: semester.name, error: 'Không bắt đầu xếp được' });
      }
    }

    const importedSummary = imported.summary as unknown as Record<string, unknown>;
    return { consolidationId: saved.id, report, imported: importedSummary, scheduling };
  }

  async download(consolidationId: string) {
    const row = await this.prisma.assignmentConsolidation.findUnique({ where: { id: consolidationId }, include: { academic_year: true } });
    if (!row) throw new NotFoundException('Không tìm thấy bảng tổng hợp.');
    return { buffer: Buffer.from(row.workbook), fileName: `bang-phan-cong-hoan-chinh-${row.academic_year.name}.xlsx` };
  }

  /** Dùng cho kiểm thử: nhu cầu của một tổ. */
  demandsOf(department: string, demands: Demand[], teachers: PlanTeacher[]) {
    const owned = this.ownedSubjects(department, teachers);
    return demands.filter((d) => owned.includes(d.subjectCode));
  }
}
