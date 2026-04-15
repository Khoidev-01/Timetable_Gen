import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PeriodType, Prisma, RoomType } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import {
  GUIDE_ROWS,
  HEADER_ALIASES,
  REFERENCE_ROWS,
  SHEET_ALIASES,
  SUBJECT_CATALOG,
  SubjectCatalogItem,
  WORKBOOK_SHEET_NAMES,
} from './excel.constants';
import {
  applyBodyRow,
  applyHeaderRow,
  applyTitleRow,
  getCellNumber,
  getCellText,
  normalizeKey,
} from './excel.utils';

type PrismaTx = Prisma.TransactionClient;

interface WorkbookMessage {
  sheet: string;
  row: number;
  column: string;
  code: string;
  message: string;
}

interface WorkbookSummary {
  subjects: { upserted: number };
  teachers: { created: number; updated: number };
  classes: { created: number; updated: number };
  combinations: { replaced: number };
  assignments: { deleted: number; created: number };
}

interface TeacherImportRow {
  rowNumber: number;
  code: string;
  fullName: string;
  department?: string;
  majorSubject?: string;
  status: string;
  baseLoad: number;
  reduction: number;
  effectiveLoad: number;
  homeroomClass?: string;
  notes?: string;
}

interface ClassImportRow {
  rowNumber: number;
  name: string;
  gradeLevel: number;
  studentCount?: number;
  session: number;
  combinationCode?: string;
  homeroomCode?: string;
  homeroomName?: string;
  notes?: string;
}

interface CombinationImportRow {
  rowNumber: number;
  code: string;
  gradeLevel: number;
  elective1: string;
  elective2: string;
  elective3: string;
  elective4: string;
  special1: string;
  special2: string;
  special3: string;
  notes?: string;
}

interface RoomImportRow {
  rowNumber: number;
  name: string;
  type: string;
  floor: number;
  capacity: number;
  session?: string;       // Sáng, Chiều, Cả ngày
  fixedClass?: string;    // Tên lớp cố định
  notes?: string;
}

interface AssignmentImportRow {
  rowNumber: number;
  schoolYear?: string;
  gradeLevel?: number;
  className: string;
  combinationCode?: string;
  subjectCode?: string;
  subjectName?: string;
  programGroup?: string;
  periodsHk1: number;
  periodsHk2: number;
  teacherHk1Code?: string;
  teacherHk1Name?: string;
  teacherHk2Code?: string;
  teacherHk2Name?: string;
  notes?: string;
}

interface PreparedAssignmentTerm {
  semesterId: string;
  teacherCode: string;
  totalPeriods: number;
}

interface PreparedAssignmentRow {
  rowNumber: number;
  className: string;
  combinationCode?: string;
  subjectCode: string;
  subjectName: string;
  periodType: PeriodType;
  notes?: string;
  hk1?: PreparedAssignmentTerm;
  hk2?: PreparedAssignmentTerm;
}

interface ParsedWorkbook {
  teachers: TeacherImportRow[];
  classes: ClassImportRow[];
  rooms: RoomImportRow[];
  combinations: CombinationImportRow[];
  assignments: AssignmentImportRow[];
  warnings: WorkbookMessage[];
}

interface WorkbookTeacherRow {
  code: string;
  fullName: string;
  department?: string;
  majorSubject?: string;
  status: string;
  baseLoad: number;
  reduction: number;
  effectiveLoad: number;
  homeroomClass?: string;
  notes?: string;
}

interface WorkbookClassRow {
  name: string;
  gradeLevel: number;
  studentCount?: number;
  sessionLabel: string;
  combinationCode?: string;
  homeroomCode?: string;
  homeroomName?: string;
  notes?: string;
}

interface WorkbookCombinationRow {
  code: string;
  gradeLevel: number;
  elective1: string;
  elective2: string;
  elective3: string;
  elective4: string;
  special1: string;
  special2: string;
  special3: string;
  notes?: string;
}

interface WorkbookAssignmentRow {
  order: number;
  schoolYear: string;
  gradeLevel: number;
  className: string;
  combinationCode?: string;
  subjectCode: string;
  subjectName: string;
  programGroup: string;
  periodsHk1: number;
  periodsHk2: number;
  teacherHk1Code?: string;
  teacherHk1Name?: string;
  teacherHk1Load?: number;
  teacherHk2Code?: string;
  teacherHk2Name?: string;
  teacherHk2Load?: number;
  notes?: string;
}

interface WorkbookTeacherSummaryRow {
  code: string;
  fullName: string;
  department?: string;
  baseLoad: number;
  reduction: number;
  effectiveLoad: number;
  totalHk1: number;
  totalHk2: number;
  deltaHk1: number;
  deltaHk2: number;
  totalYear: number;
  assignmentRowsHk1: number;
  assignmentRowsHk2: number;
  notes?: string;
}

interface WorkbookBuildData {
  yearName: string;
  teachers: WorkbookTeacherRow[];
  classes: WorkbookClassRow[];
  combinations: WorkbookCombinationRow[];
  assignments: WorkbookAssignmentRow[];
  teacherSummaries: WorkbookTeacherSummaryRow[];
  subjects: SubjectCatalogItem[];
}

interface ExportPayload {
  buffer: Buffer;
  fileName: string;
}

@Injectable()
export class ExcelService {
  private readonly subjectColors = [
    '#2563EB',
    '#0F766E',
    '#D97706',
    '#9333EA',
    '#DC2626',
    '#4F46E5',
    '#059669',
    '#EA580C',
    '#0891B2',
    '#65A30D',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async downloadTemplate(academicYearId: string): Promise<ExportPayload> {
    const context = await this.getYearContext(academicYearId);
    await this.ensureSubjectCatalog();

    const buffer = await this.buildWorkbookBuffer({
      yearName: context.year.name,
      teachers: [],
      classes: [],
      combinations: [],
      assignments: [],
      teacherSummaries: [],
      subjects: SUBJECT_CATALOG,
    });

    return {
      buffer,
      fileName: `mau-phan-cong-gdpt2018-${context.year.name}.xlsx`,
    };
  }

  async exportWorkbook(academicYearId: string): Promise<ExportPayload> {
    const context = await this.getYearContext(academicYearId);
    await this.ensureSubjectCatalog();
    const data = await this.loadWorkbookData(context.hk1.id, context.hk2.id, context.year.name);
    const buffer = await this.buildWorkbookBuffer(data);

    return {
      buffer,
      fileName: `phan-cong-giang-day-${context.year.name}.xlsx`,
    };
  }

  async importWorkbook(academicYearId: string, buffer: Buffer): Promise<{
    summary: WorkbookSummary;
    warnings: WorkbookMessage[];
    errors: WorkbookMessage[];
  }> {
    const context = await this.getYearContext(academicYearId);
    const subjectMap = await this.ensureSubjectCatalog();
    const parsed = await this.parseWorkbook(buffer);
    const { warnings, preparedAssignments } = await this.validateWorkbook(
      context.year.name,
      parsed,
      subjectMap,
      context.hk1.id,
      context.hk2.id,
    );

    const summary = await this.prisma.$transaction(async (tx) => {
      const teacherSummary = await this.upsertTeachers(tx, parsed.teachers);
      const teacherMap = await this.fetchTeacherMap(tx);
      const classSummary = await this.upsertClasses(tx, parsed.classes, teacherMap);
      const classMap = await this.fetchClassMap(tx);

      // Assign homeroom teachers from teacher sheet GVCN column
      for (const teacher of parsed.teachers) {
        if (!teacher.homeroomClass) continue;
        const classEntity = classMap.get(normalizeKey(teacher.homeroomClass));
        const teacherEntity = teacherMap.get(teacher.code);
        if (classEntity && teacherEntity) {
          await tx.class.update({
            where: { id: classEntity.id },
            data: { homeroom_teacher_id: teacherEntity.id },
          });
        }
      }

      // Upsert rooms and assign fixed rooms to classes
      if (parsed.rooms.length > 0) {
        await this.upsertRooms(tx, parsed.rooms, classMap);
      }

      await tx.curriculumCombination.deleteMany({});
      if (parsed.combinations.length > 0) {
        await tx.curriculumCombination.createMany({
          data: parsed.combinations.map((item) => ({
            code: item.code,
            grade_level: item.gradeLevel,
            elective_subject_code_1: item.elective1,
            elective_subject_code_2: item.elective2,
            elective_subject_code_3: item.elective3,
            elective_subject_code_4: item.elective4,
            special_topic_code_1: item.special1,
            special_topic_code_2: item.special2,
            special_topic_code_3: item.special3,
            notes: item.notes ?? null,
          })),
        });
      }

      const referencedTeacherCodes = new Set<string>();
      preparedAssignments.forEach((row) => {
        if (row.hk1) referencedTeacherCodes.add(row.hk1.teacherCode);
        if (row.hk2) referencedTeacherCodes.add(row.hk2.teacherCode);
      });

      const assignmentTeacherMap = await this.fetchTeacherMap(tx, [...referencedTeacherCodes]);
      const assignmentsToCreate: Prisma.TeachingAssignmentCreateManyInput[] = [];

      preparedAssignments.forEach((row) => {
        const classEntity = classMap.get(normalizeKey(row.className));
        const subjectEntity = subjectMap.get(row.subjectCode);

        if (!classEntity || !subjectEntity) {
          return;
        }

        if (row.hk1) {
          const teacher = assignmentTeacherMap.get(row.hk1.teacherCode);
          if (teacher) {
            assignmentsToCreate.push({
              semester_id: row.hk1.semesterId,
              class_id: classEntity.id,
              subject_id: subjectEntity.id,
              teacher_id: teacher.id,
              total_periods: row.hk1.totalPeriods,
              period_type: row.periodType,
              required_room_type:
                row.periodType === PeriodType.PRACTICE
                  ? this.resolveLabRoomType(row.subjectCode)
                  : null,
              block_config: row.notes ?? null,
            });
          }
        }

        if (row.hk2) {
          const teacher = assignmentTeacherMap.get(row.hk2.teacherCode);
          if (teacher) {
            assignmentsToCreate.push({
              semester_id: row.hk2.semesterId,
              class_id: classEntity.id,
              subject_id: subjectEntity.id,
              teacher_id: teacher.id,
              total_periods: row.hk2.totalPeriods,
              period_type: row.periodType,
              required_room_type:
                row.periodType === PeriodType.PRACTICE
                  ? this.resolveLabRoomType(row.subjectCode)
                  : null,
              block_config: row.notes ?? null,
            });
          }
        }
      });

      const deletedAssignments = await tx.teachingAssignment.deleteMany({
        where: { semester_id: { in: [context.hk1.id, context.hk2.id] } },
      });

      if (assignmentsToCreate.length > 0) {
        await tx.teachingAssignment.createMany({ data: assignmentsToCreate });
      }

      return {
        subjects: { upserted: subjectMap.size },
        teachers: teacherSummary,
        classes: classSummary,
        combinations: { replaced: parsed.combinations.length },
        assignments: {
          deleted: deletedAssignments.count,
          created: assignmentsToCreate.length,
        },
      };
    });

    // Send notification about successful import
    try {
      await this.notificationService.notifyImportSuccess(summary);
    } catch (e) {
      // Don't fail import if notification fails
    }

    return {
      summary,
      warnings: [...parsed.warnings, ...warnings],
      errors: [],
    };
  }

  private async parseWorkbook(buffer: Buffer): Promise<ParsedWorkbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const teachersSheet = this.findWorksheet(workbook, WORKBOOK_SHEET_NAMES.teachers);
    const classesSheet = this.findWorksheet(workbook, WORKBOOK_SHEET_NAMES.classes);
    const combinationsSheet = this.findWorksheet(workbook, WORKBOOK_SHEET_NAMES.combinations);
    const assignmentsSheet = this.findWorksheet(workbook, WORKBOOK_SHEET_NAMES.assignments);

    const errors: WorkbookMessage[] = [];
    const warnings: WorkbookMessage[] = [];

    const teachers = this.parseTeachersSheet(teachersSheet, errors);
    const classes = this.parseClassesSheet(classesSheet, errors);
    const combinations = this.parseCombinationsSheet(combinationsSheet, errors);
    const assignments = this.parseAssignmentsSheet(assignmentsSheet, errors, warnings);

    // Rooms sheet is optional
    const roomsSheet = this.findWorksheet(workbook, WORKBOOK_SHEET_NAMES.rooms, true);
    const rooms = roomsSheet ? this.parseRoomsSheet(roomsSheet, errors) : [];

    if (errors.length > 0) {
      throw new BadRequestException({
        summary: null,
        warnings: [],
        errors,
      });
    }

    return {
      teachers,
      classes,
      rooms,
      combinations,
      assignments,
      warnings,
    };
  }

  private async validateWorkbook(
    yearName: string,
    parsed: ParsedWorkbook,
    subjectMap: Map<
      string,
      { id: number; code: string; name: string; is_special: boolean; is_practice: boolean }
    >,
    hk1Id: string,
    hk2Id: string,
  ): Promise<{ warnings: WorkbookMessage[]; preparedAssignments: PreparedAssignmentRow[] }> {
    const errors: WorkbookMessage[] = [];
    const warnings: WorkbookMessage[] = [];

    this.validateDuplicateCodes(
      parsed.teachers.map((teacher) => ({ value: teacher.code, rowNumber: teacher.rowNumber })),
      WORKBOOK_SHEET_NAMES.teachers,
      'Mã_GV',
      'duplicate_teacher_code',
      errors,
    );
    this.validateDuplicateCodes(
      parsed.classes.map((item) => ({ value: item.name, rowNumber: item.rowNumber })),
      WORKBOOK_SHEET_NAMES.classes,
      'Lớp',
      'duplicate_class_name',
      errors,
    );
    this.validateDuplicateCodes(
      parsed.combinations.map((item) => ({ value: `${item.code}__${item.gradeLevel}`, rowNumber: item.rowNumber })),
      WORKBOOK_SHEET_NAMES.combinations,
      'Mã_tổ_hợp',
      'duplicate_combination_code',
      errors,
    );

    const existingTeachers = await this.fetchTeacherMap(this.prisma);
    const existingClasses = await this.fetchClassMap(this.prisma);
    const futureTeacherCodes = new Set([
      ...existingTeachers.keys(),
      ...parsed.teachers.map((item) => item.code),
    ]);
    const futureClassNames = new Set([
      ...existingClasses.keys(),
      ...parsed.classes.map((item) => normalizeKey(item.name)),
    ]);
    const futureCombinationCodes = new Set(parsed.combinations.map((item) => item.code));
    const preparedAssignments: PreparedAssignmentRow[] = [];

    parsed.classes.forEach((item) => {
      if (item.homeroomCode && !futureTeacherCodes.has(item.homeroomCode)) {
        errors.push({
          sheet: WORKBOOK_SHEET_NAMES.classes,
          row: item.rowNumber,
          column: 'GVCN_Mã',
          code: 'homeroom_teacher_not_found',
          message: `Không tìm thấy giáo viên chủ nhiệm có mã ${item.homeroomCode}.`,
        });
      }

      if (item.combinationCode && !futureCombinationCodes.has(item.combinationCode)) {
        errors.push({
          sheet: WORKBOOK_SHEET_NAMES.classes,
          row: item.rowNumber,
          column: 'Mã_tổ_hợp',
          code: 'combination_not_found',
          message: `Tổ hợp ${item.combinationCode} không có trong sheet DM_To_hop.`,
        });
      }
    });

    const seenAssignmentKeys = new Set<string>();
    parsed.assignments.forEach((item) => {
      if (item.schoolYear && normalizeKey(item.schoolYear) !== normalizeKey(yearName)) {
        warnings.push({
          sheet: WORKBOOK_SHEET_NAMES.assignments,
          row: item.rowNumber,
          column: 'Năm_học',
          code: 'school_year_mismatch',
          message: `Dòng này khai báo năm học ${item.schoolYear}, hệ thống vẫn import vào năm học ${yearName}.`,
        });
      }

      const classKey = normalizeKey(item.className);
      if (!futureClassNames.has(classKey)) {
        errors.push({
          sheet: WORKBOOK_SHEET_NAMES.assignments,
          row: item.rowNumber,
          column: 'Lớp',
          code: 'class_not_found',
          message: `Không tìm thấy lớp ${item.className}.`,
        });
        return;
      }

      if (item.combinationCode && !futureCombinationCodes.has(item.combinationCode)) {
        errors.push({
          sheet: WORKBOOK_SHEET_NAMES.assignments,
          row: item.rowNumber,
          column: 'Mã_tổ_hợp',
          code: 'combination_not_found',
          message: `Tổ hợp ${item.combinationCode} không có trong sheet DM_To_hop.`,
        });
      }

      const resolved = this.resolveSubject(item.subjectCode, item.subjectName, subjectMap);
      if (!resolved) {
        errors.push({
          sheet: WORKBOOK_SHEET_NAMES.assignments,
          row: item.rowNumber,
          column: 'Mã_môn',
          code: 'subject_not_found',
          message: `Không nhận diện được môn học từ mã "${item.subjectCode ?? ''}" hoặc tên "${item.subjectName ?? ''}".`,
        });
        return;
      }

      if (item.periodsHk1 > 0) {
        if (!item.teacherHk1Code) {
          errors.push({
            sheet: WORKBOOK_SHEET_NAMES.assignments,
            row: item.rowNumber,
            column: 'GV_HK1_Mã',
            code: 'missing_teacher_hk1',
            message: 'Có tiết HK1 nhưng chưa khai báo mã giáo viên HK1.',
          });
        } else if (!futureTeacherCodes.has(item.teacherHk1Code)) {
          errors.push({
            sheet: WORKBOOK_SHEET_NAMES.assignments,
            row: item.rowNumber,
            column: 'GV_HK1_Mã',
            code: 'teacher_not_found_hk1',
            message: `Không tìm thấy giáo viên HK1 có mã ${item.teacherHk1Code}.`,
          });
        }
      } else if (item.teacherHk1Code) {
        errors.push({
          sheet: WORKBOOK_SHEET_NAMES.assignments,
          row: item.rowNumber,
          column: 'Tiết_HK1',
          code: 'periods_hk1_zero',
          message: 'Đã nhập giáo viên HK1 nhưng số tiết HK1 bằng 0.',
        });
      }

      if (item.periodsHk2 > 0) {
        if (!item.teacherHk2Code) {
          errors.push({
            sheet: WORKBOOK_SHEET_NAMES.assignments,
            row: item.rowNumber,
            column: 'GV_HK2_Mã',
            code: 'missing_teacher_hk2',
            message: 'Có tiết HK2 nhưng chưa khai báo mã giáo viên HK2.',
          });
        } else if (!futureTeacherCodes.has(item.teacherHk2Code)) {
          errors.push({
            sheet: WORKBOOK_SHEET_NAMES.assignments,
            row: item.rowNumber,
            column: 'GV_HK2_Mã',
            code: 'teacher_not_found_hk2',
            message: `Không tìm thấy giáo viên HK2 có mã ${item.teacherHk2Code}.`,
          });
        }
      } else if (item.teacherHk2Code) {
        errors.push({
          sheet: WORKBOOK_SHEET_NAMES.assignments,
          row: item.rowNumber,
          column: 'Tiết_HK2',
          code: 'periods_hk2_zero',
          message: 'Đã nhập giáo viên HK2 nhưng số tiết HK2 bằng 0.',
        });
      }

      if (item.periodsHk1 <= 0 && item.periodsHk2 <= 0) {
        errors.push({
          sheet: WORKBOOK_SHEET_NAMES.assignments,
          row: item.rowNumber,
          column: 'Tiết_HK1',
          code: 'missing_periods',
          message: 'Dòng phân công phải có ít nhất một giá trị Tiết_HK1 hoặc Tiết_HK2 lớn hơn 0.',
        });
      }

      const refinedPeriodType = this.refinePeriodType(resolved.periodType, item.programGroup, item.notes);

      const assignmentKey = `${classKey}:${resolved.subjectCode}:${refinedPeriodType}`;
      if (item.periodsHk1 > 0) {
        const hk1Key = `${assignmentKey}:1`;
        if (seenAssignmentKeys.has(hk1Key)) {
          errors.push({
            sheet: WORKBOOK_SHEET_NAMES.assignments,
            row: item.rowNumber,
            column: 'Lớp',
            code: 'duplicate_assignment_hk1',
            message: `Trùng dòng phân công HK1 cho lớp ${item.className} và môn ${resolved.subjectCode}.`,
          });
        }
        seenAssignmentKeys.add(hk1Key);
      }

      if (item.periodsHk2 > 0) {
        const hk2Key = `${assignmentKey}:2`;
        if (seenAssignmentKeys.has(hk2Key)) {
          errors.push({
            sheet: WORKBOOK_SHEET_NAMES.assignments,
            row: item.rowNumber,
            column: 'Lớp',
            code: 'duplicate_assignment_hk2',
            message: `Trùng dòng phân công HK2 cho lớp ${item.className} và môn ${resolved.subjectCode}.`,
          });
        }
        seenAssignmentKeys.add(hk2Key);
      }

      preparedAssignments.push({
        rowNumber: item.rowNumber,
        className: item.className,
        combinationCode: item.combinationCode,
        subjectCode: resolved.subjectCode,
        subjectName: resolved.subjectName,
        periodType: refinedPeriodType,
        notes: item.notes,
        hk1:
          item.periodsHk1 > 0 && item.teacherHk1Code
            ? {
                semesterId: hk1Id,
                teacherCode: item.teacherHk1Code,
                totalPeriods: item.periodsHk1,
              }
            : undefined,
        hk2:
          item.periodsHk2 > 0 && item.teacherHk2Code
            ? {
                semesterId: hk2Id,
                teacherCode: item.teacherHk2Code,
                totalPeriods: item.periodsHk2,
              }
            : undefined,
      });
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        summary: null,
        warnings: [],
        errors,
      });
    }

    return {
      warnings,
      preparedAssignments,
    };
  }

  private async upsertTeachers(
    tx: PrismaTx,
    teachers: TeacherImportRow[],
  ): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const teacher of teachers) {
      const existing = await tx.teacher.findUnique({ where: { code: teacher.code } });
      const data = {
        code: teacher.code,
        full_name: teacher.fullName,
        department: teacher.department || null,
        status: teacher.status,
        workload_reduction: teacher.reduction,
        max_periods_per_week: teacher.effectiveLoad,
        notes: teacher.notes || null,
      };

      if (existing) {
        await tx.teacher.update({
          where: { code: teacher.code },
          data,
        });
        updated += 1;
      } else {
        await tx.teacher.create({
          data: {
            ...data,
            short_name: teacher.fullName.split(' ').pop() || teacher.fullName,
          },
        });
        created += 1;
      }
    }

    return { created, updated };
  }

  private async upsertClasses(
    tx: PrismaTx,
    classes: ClassImportRow[],
    teacherMap: Map<string, { id: string; code: string }>,
  ): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const classRow of classes) {
      const homeroomTeacher = classRow.homeroomCode
        ? teacherMap.get(classRow.homeroomCode)
        : undefined;
      const data = {
        name: classRow.name,
        grade_level: classRow.gradeLevel,
        student_count: classRow.studentCount ?? null,
        main_session: classRow.session,
        combination_code: classRow.combinationCode ?? null,
        homeroom_teacher_id: homeroomTeacher?.id ?? null,
        notes: classRow.notes ?? null,
      };

      const existing = await tx.class.findFirst({ where: { name: classRow.name } });
      if (existing) {
        await tx.class.update({
          where: { id: existing.id },
          data,
        });
        updated += 1;
      } else {
        await tx.class.create({ data });
        created += 1;
      }
    }

    return { created, updated };
  }

  private resolveRoomType(typeStr: string): RoomType {
    const normalized = normalizeKey(typeStr);
    if (normalized.includes('labvatly') || normalized.includes('lably') || normalized.includes('thinghiemvatly') || normalized.includes('phongtnly'))
      return RoomType.LAB_PHYSICS;
    if (normalized.includes('labhoahoc') || normalized.includes('labhoa') || normalized.includes('thinghiemhoahoc') || normalized.includes('phongtnhoa'))
      return RoomType.LAB_CHEM;
    if (normalized.includes('labsinhhoc') || normalized.includes('labsinh') || normalized.includes('thinghiemsinhhoc'))
      return RoomType.LAB_BIO;
    if (normalized.includes('labtinhoc') || normalized.includes('labtin') || normalized.includes('labmaytinh') || normalized.includes('phongmaytinh'))
      return RoomType.LAB_IT;
    if (normalized.includes('san') || normalized.includes('sanbai') || normalized.includes('sanchoi'))
      return RoomType.YARD;
    if (normalized.includes('dadung') || normalized.includes('danang') || normalized.includes('hoitruong'))
      return RoomType.MULTI_PURPOSE;
    return RoomType.CLASSROOM;
  }

  private parseRoomsSheet(
    worksheet: ExcelJS.Worksheet,
    errors: WorkbookMessage[],
  ): RoomImportRow[] {
    const config = this.resolveColumns(
      worksheet,
      HEADER_ALIASES.rooms,
      (columns) => Boolean(columns.name),
      WORKBOOK_SHEET_NAMES.rooms,
      errors,
    );
    if (!config) return [];

    const rows: RoomImportRow[] = [];
    for (let rowNumber = config.headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      if (!this.rowHasValue(row, Object.values(config.columns))) continue;

      const name = this.readString(row, config.columns.name);
      if (!name) continue;

      const typeStr = this.readString(row, config.columns.type) || 'Phòng học';
      const floor = this.readInteger(row, config.columns.floor) ?? 1;
      const capacity = this.readInteger(row, config.columns.capacity) ?? 45;
      const session = this.readString(row, config.columns.session);
      const fixedClass = this.readString(row, config.columns.fixedClass);
      const notes = this.readString(row, config.columns.notes);

      rows.push({
        rowNumber,
        name,
        type: typeStr,
        floor,
        capacity,
        session,
        fixedClass,
        notes,
      });
    }
    return rows;
  }

  private async upsertRooms(
    tx: PrismaTx,
    rooms: RoomImportRow[],
    classMap: Map<string, { id: string; name: string }>,
  ): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const room of rooms) {
      const roomType = this.resolveRoomType(room.type);
      const data = {
        name: room.name,
        type: roomType,
        floor: room.floor,
        capacity: room.capacity,
      };

      const existing = await tx.room.findFirst({ where: { name: room.name } });
      let roomId: number;

      if (existing) {
        await tx.room.update({ where: { id: existing.id }, data });
        roomId = existing.id;
        updated += 1;
      } else {
        const created_room = await tx.room.create({ data });
        roomId = created_room.id;
        created += 1;
      }

      // Assign fixed room to class if specified
      if (room.fixedClass) {
        // fixedClass can be comma-separated: "12A1, 11B1"
        const classNames = room.fixedClass.split(',').map((s) => s.trim()).filter(Boolean);
        for (const className of classNames) {
          const classEntity = classMap.get(normalizeKey(className));
          if (classEntity) {
            await tx.class.update({
              where: { id: classEntity.id },
              data: { fixed_room_id: roomId },
            });
          }
        }
      }
    }

    return { created, updated };
  }

  private async loadWorkbookData(
    hk1Id: string,
    hk2Id: string,
    yearName: string,
  ): Promise<WorkbookBuildData> {
    const [teachers, classes, combinations, assignments] = await Promise.all([
      this.prisma.teacher.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.class.findMany({
        orderBy: { name: 'asc' },
        include: { homeroom_teacher: true },
      }),
      this.prisma.curriculumCombination.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.teachingAssignment.findMany({
        where: { semester_id: { in: [hk1Id, hk2Id] } },
        include: {
          teacher: true,
          class: true,
          subject: true,
        },
        orderBy: [{ class: { name: 'asc' } }, { subject: { code: 'asc' } }],
      }),
    ]);

    const teacherMajorMap = this.buildTeacherMajorSubjectMap(assignments);
    const homeroomMap = new Map<string, string>();
    classes.forEach((cls) => {
      if (cls.homeroom_teacher_id) {
        homeroomMap.set(cls.homeroom_teacher_id, cls.name);
      }
    });
    const workbookTeachers: WorkbookTeacherRow[] = teachers.map((teacher) => ({
      code: teacher.code,
      fullName: teacher.full_name,
      department: teacher.department ?? '',
      majorSubject: teacherMajorMap.get(teacher.id) ?? '',
      status: teacher.status,
      baseLoad: teacher.max_periods_per_week + teacher.workload_reduction,
      reduction: teacher.workload_reduction,
      effectiveLoad: teacher.max_periods_per_week,
      homeroomClass: homeroomMap.get(teacher.id) ?? '',
      notes: teacher.notes ?? '',
    }));

    const workbookClasses: WorkbookClassRow[] = classes.map((item) => ({
      name: item.name,
      gradeLevel: item.grade_level,
      studentCount: item.student_count ?? undefined,
      sessionLabel: item.main_session === 0 ? 'Sáng' : 'Chiều',
      combinationCode: item.combination_code ?? '',
      homeroomCode: item.homeroom_teacher?.code ?? '',
      homeroomName: item.homeroom_teacher?.full_name ?? '',
      notes: item.notes ?? '',
    }));

    const workbookCombinations: WorkbookCombinationRow[] = combinations.map((item) => ({
      code: item.code,
      gradeLevel: item.grade_level,
      elective1: item.elective_subject_code_1,
      elective2: item.elective_subject_code_2,
      elective3: item.elective_subject_code_3,
      elective4: item.elective_subject_code_4,
      special1: item.special_topic_code_1,
      special2: item.special_topic_code_2,
      special3: item.special_topic_code_3,
      notes: item.notes ?? '',
    }));

    const groupedAssignments = new Map<string, WorkbookAssignmentRow>();
    assignments.forEach((assignment) => {
      const exportedSubjectCode =
        assignment.period_type === PeriodType.SPECIAL && !assignment.subject.is_special
          ? `CD_${assignment.subject.code}`
          : assignment.subject.code;
      const exportedSubjectName =
        assignment.period_type === PeriodType.SPECIAL && !assignment.subject.is_special
          ? `Chuyên đề ${assignment.subject.name}`
          : assignment.subject.name;
      const key = `${assignment.class_id}:${exportedSubjectCode}`;

      const existing = groupedAssignments.get(key) ?? {
        order: groupedAssignments.size + 1,
        schoolYear: yearName,
        gradeLevel: assignment.class.grade_level,
        className: assignment.class.name,
        combinationCode: assignment.class.combination_code ?? '',
        subjectCode: exportedSubjectCode,
        subjectName: exportedSubjectName,
        programGroup: this.resolveProgramGroup(assignment.subject.code, assignment.period_type),
        periodsHk1: 0,
        periodsHk2: 0,
        notes: assignment.block_config ?? '',
      };

      if (assignment.semester_id === hk1Id) {
        existing.periodsHk1 = assignment.total_periods;
        existing.teacherHk1Code = assignment.teacher.code;
        existing.teacherHk1Name = assignment.teacher.full_name;
        existing.teacherHk1Load = assignment.teacher.max_periods_per_week;
      }

      if (assignment.semester_id === hk2Id) {
        existing.periodsHk2 = assignment.total_periods;
        existing.teacherHk2Code = assignment.teacher.code;
        existing.teacherHk2Name = assignment.teacher.full_name;
        existing.teacherHk2Load = assignment.teacher.max_periods_per_week;
      }

      groupedAssignments.set(key, existing);
    });

    const summaryByTeacher = new Map<string, WorkbookTeacherSummaryRow>();
    teachers.forEach((teacher) => {
      summaryByTeacher.set(teacher.id, {
        code: teacher.code,
        fullName: teacher.full_name,
        department: teacher.department ?? '',
        baseLoad: teacher.max_periods_per_week + teacher.workload_reduction,
        reduction: teacher.workload_reduction,
        effectiveLoad: teacher.max_periods_per_week,
        totalHk1: 0,
        totalHk2: 0,
        deltaHk1: 0,
        deltaHk2: 0,
        totalYear: 0,
        assignmentRowsHk1: 0,
        assignmentRowsHk2: 0,
        notes: teacher.notes ?? '',
      });
    });

    assignments.forEach((assignment) => {
      const summary = summaryByTeacher.get(assignment.teacher_id);
      if (!summary) {
        return;
      }

      if (assignment.semester_id === hk1Id) {
        summary.totalHk1 += assignment.total_periods;
        summary.assignmentRowsHk1 += 1;
      } else if (assignment.semester_id === hk2Id) {
        summary.totalHk2 += assignment.total_periods;
        summary.assignmentRowsHk2 += 1;
      }

      summary.totalYear = summary.totalHk1 + summary.totalHk2;
      summary.deltaHk1 = summary.totalHk1 - summary.effectiveLoad;
      summary.deltaHk2 = summary.totalHk2 - summary.effectiveLoad;
    });

    return {
      yearName,
      teachers: workbookTeachers,
      classes: workbookClasses,
      combinations: workbookCombinations,
      assignments: [...groupedAssignments.values()],
      teacherSummaries: [...summaryByTeacher.values()].sort((a, b) => a.code.localeCompare(b.code)),
      subjects: SUBJECT_CATALOG,
    };
  }

  private async buildWorkbookBuffer(data: WorkbookBuildData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Codex';
    workbook.created = new Date();
    workbook.modified = new Date();

    this.buildGuideSheet(workbook);
    this.buildReferencesSheet(workbook);
    this.buildSubjectCatalogSheet(workbook, data.subjects);
    this.buildTeachersSheet(workbook, data.teachers);
    this.buildClassesSheet(workbook, data.classes);
    this.buildRoomsSheet(workbook);
    this.buildCombinationsSheet(workbook, data.combinations);
    this.buildAssignmentsSheet(workbook, data.assignments);
    this.buildTeacherSummarySheet(workbook, data.teacherSummaries);

    const rawBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);
  }

  private buildRoomsSheet(workbook: ExcelJS.Workbook): void {
    const worksheet = workbook.addWorksheet(WORKBOOK_SHEET_NAMES.rooms, {
      views: [{ state: 'frozen', ySplit: 2 }],
    });

    const headers = ['Tên phòng', 'Loại', 'Tầng', 'Sức chứa', 'Buổi', 'Lớp cố định', 'Ghi chú'];
    applyTitleRow(worksheet, 1, 'DANH MỤC PHÒNG HỌC', headers.length);

    const headerRow = worksheet.getRow(2);
    headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
    applyHeaderRow(headerRow);

    // Sample data
    const samples: (string | number)[][] = [
      ['101', 'Phòng học', 1, 45, 'Sáng', '12A1', 'Phòng học chính lớp 12A1'],
      ['201', 'Phòng học', 2, 45, 'Chiều', '10C1', 'Phòng học chính lớp 10C1'],
      ['301', 'Lab Vật lý', 3, 40, 'Cả ngày', '', 'Phòng thí nghiệm Vật lý'],
      ['302', 'Lab Hóa học', 3, 40, 'Cả ngày', '', 'Phòng thí nghiệm Hóa học'],
    ];
    samples.forEach((vals, i) => {
      const r = worksheet.getRow(i + 3);
      vals.forEach((v, j) => { r.getCell(j + 1).value = v; });
      applyBodyRow(r);
    });

    [12, 15, 8, 10, 12, 20, 30].forEach((w, i) => { worksheet.getColumn(i + 1).width = w; });
  }

  private buildGuideSheet(workbook: ExcelJS.Workbook): void {
    const worksheet = workbook.addWorksheet(WORKBOOK_SHEET_NAMES.guide, {
      views: [{ state: 'frozen', ySplit: 2 }],
    });
    worksheet.columns = [
      { header: 'Mục', key: 'section', width: 24 },
      { header: 'Nội dung', key: 'content', width: 100 },
    ];
    applyTitleRow(worksheet, 1, 'Hướng dẫn sử dụng workbook import phân công giảng dạy', 2);
    applyHeaderRow(worksheet.getRow(2));
    worksheet.addRows(GUIDE_ROWS);
    for (let rowNumber = 3; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      applyBodyRow(worksheet.getRow(rowNumber));
    }
  }

  private buildReferencesSheet(workbook: ExcelJS.Workbook): void {
    const worksheet = workbook.addWorksheet(WORKBOOK_SHEET_NAMES.references, {
      views: [{ state: 'frozen', ySplit: 2 }],
    });
    worksheet.columns = [
      { header: 'Văn bản', key: 'document', width: 36 },
      { header: 'Nội dung', key: 'content', width: 100 },
    ];
    applyTitleRow(worksheet, 1, 'Nguồn tham khảo và căn cứ chuẩn hóa cấu trúc file', 2);
    applyHeaderRow(worksheet.getRow(2));
    worksheet.addRows(REFERENCE_ROWS);
    for (let rowNumber = 3; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      applyBodyRow(worksheet.getRow(rowNumber));
    }
  }

  private buildSubjectCatalogSheet(workbook: ExcelJS.Workbook, subjects: SubjectCatalogItem[]): void {
    const worksheet = workbook.addWorksheet(WORKBOOK_SHEET_NAMES.subjects, {
      views: [{ state: 'frozen', ySplit: 2 }],
    });
    worksheet.columns = [
      { header: 'Mã_môn', key: 'code', width: 18 },
      { header: 'Tên_môn', key: 'name', width: 32 },
      { header: 'Nhóm_CT', key: 'group', width: 24 },
      { header: 'Ghi_chú', key: 'note', width: 50 },
    ];
    applyTitleRow(worksheet, 1, 'Danh mục môn học chuẩn GDPT 2018', 4);
    applyHeaderRow(worksheet.getRow(2));
    subjects.forEach((subject) => {
      const row = worksheet.addRow({
        code: subject.code,
        name: subject.name,
        group: subject.group,
        note: subject.note ?? '',
      });
      applyBodyRow(row);
    });
  }

  private buildTeachersSheet(workbook: ExcelJS.Workbook, teachers: WorkbookTeacherRow[]): void {
    const worksheet = workbook.addWorksheet(WORKBOOK_SHEET_NAMES.teachers, {
      views: [{ state: 'frozen', ySplit: 2 }],
    });
    worksheet.columns = [
      { header: 'Mã_GV', key: 'code', width: 16 },
      { header: 'Họ_tên', key: 'fullName', width: 28 },
      { header: 'Tổ_CM', key: 'department', width: 20 },
      { header: 'Môn_chuyên_môn_chính', key: 'majorSubject', width: 24 },
      { header: 'Trạng_thái', key: 'status', width: 18 },
      { header: 'Định_mức_tuần', key: 'baseLoad', width: 16 },
      { header: 'Giảm_trừ_tuần', key: 'reduction', width: 16 },
      { header: 'Định_mức_hiệu_lực', key: 'effectiveLoad', width: 18 },
      { header: 'GVCN', key: 'homeroomClass', width: 14 },
      { header: 'Ghi_chú', key: 'notes', width: 36 },
    ];
    applyTitleRow(worksheet, 1, 'Danh mục giáo viên', 10);
    applyHeaderRow(worksheet.getRow(2));
    teachers.forEach((teacher) => {
      const row = worksheet.addRow(teacher);
      applyBodyRow(row);
    });
  }

  private buildClassesSheet(workbook: ExcelJS.Workbook, classes: WorkbookClassRow[]): void {
    const worksheet = workbook.addWorksheet(WORKBOOK_SHEET_NAMES.classes, {
      views: [{ state: 'frozen', ySplit: 2 }],
    });
    worksheet.columns = [
      { header: 'Lớp', key: 'name', width: 16 },
      { header: 'Khối', key: 'gradeLevel', width: 10 },
      { header: 'Sĩ_số', key: 'studentCount', width: 12 },
      { header: 'Buổi_học', key: 'sessionLabel', width: 14 },
      { header: 'Mã_tổ_hợp', key: 'combinationCode', width: 18 },
      { header: 'GVCN_Mã', key: 'homeroomCode', width: 18 },
      { header: 'GVCN_Họ_tên', key: 'homeroomName', width: 28 },
      { header: 'Ghi_chú', key: 'notes', width: 36 },
    ];
    applyTitleRow(worksheet, 1, 'Danh mục lớp', 8);
    applyHeaderRow(worksheet.getRow(2));
    classes.forEach((item) => {
      const row = worksheet.addRow(item);
      applyBodyRow(row);
    });
  }

  private buildCombinationsSheet(workbook: ExcelJS.Workbook, combinations: WorkbookCombinationRow[]): void {
    const worksheet = workbook.addWorksheet(WORKBOOK_SHEET_NAMES.combinations, {
      views: [{ state: 'frozen', ySplit: 2 }],
    });
    worksheet.columns = [
      { header: 'Mã_tổ_hợp', key: 'code', width: 18 },
      { header: 'Khối', key: 'gradeLevel', width: 10 },
      { header: 'Môn_tự_chọn_1', key: 'elective1', width: 18 },
      { header: 'Môn_tự_chọn_2', key: 'elective2', width: 18 },
      { header: 'Môn_tự_chọn_3', key: 'elective3', width: 18 },
      { header: 'Môn_tự_chọn_4', key: 'elective4', width: 18 },
      { header: 'Chuyên_đề_1', key: 'special1', width: 18 },
      { header: 'Chuyên_đề_2', key: 'special2', width: 18 },
      { header: 'Chuyên_đề_3', key: 'special3', width: 18 },
      { header: 'Ghi_chú', key: 'notes', width: 32 },
    ];
    applyTitleRow(worksheet, 1, 'Danh mục tổ hợp môn học', 10);
    applyHeaderRow(worksheet.getRow(2));
    combinations.forEach((item) => {
      const row = worksheet.addRow(item);
      applyBodyRow(row);
    });
  }

  private buildAssignmentsSheet(workbook: ExcelJS.Workbook, assignments: WorkbookAssignmentRow[]): void {
    const worksheet = workbook.addWorksheet(WORKBOOK_SHEET_NAMES.assignments, {
      views: [{ state: 'frozen', ySplit: 2, xSplit: 4 }],
    });
    worksheet.columns = [
      { header: 'STT', key: 'order', width: 10 },
      { header: 'Năm_học', key: 'schoolYear', width: 16 },
      { header: 'Khối', key: 'gradeLevel', width: 10 },
      { header: 'Lớp', key: 'className', width: 14 },
      { header: 'Mã_tổ_hợp', key: 'combinationCode', width: 18 },
      { header: 'Mã_môn', key: 'subjectCode', width: 16 },
      { header: 'Tên_môn', key: 'subjectName', width: 28 },
      { header: 'Nhóm_CT', key: 'programGroup', width: 18 },
      { header: 'Tiết_HK1', key: 'periodsHk1', width: 12 },
      { header: 'Tiết_HK2', key: 'periodsHk2', width: 12 },
      { header: 'GV_HK1_Mã', key: 'teacherHk1Code', width: 16 },
      { header: 'GV_HK1_Họ_tên', key: 'teacherHk1Name', width: 26 },
      { header: 'GV_HK1_Định_mức', key: 'teacherHk1Load', width: 18 },
      { header: 'GV_HK2_Mã', key: 'teacherHk2Code', width: 16 },
      { header: 'GV_HK2_Họ_tên', key: 'teacherHk2Name', width: 26 },
      { header: 'GV_HK2_Định_mức', key: 'teacherHk2Load', width: 18 },
      { header: 'Ghi_chú', key: 'notes', width: 28 },
    ];
    applyTitleRow(worksheet, 1, 'Bảng phân công giảng dạy theo năm học', 17);
    applyHeaderRow(worksheet.getRow(2));
    assignments.forEach((assignment) => {
      const row = worksheet.addRow(assignment);
      applyBodyRow(row);
    });
  }

  private buildTeacherSummarySheet(
    workbook: ExcelJS.Workbook,
    rows: WorkbookTeacherSummaryRow[],
  ): void {
    const worksheet = workbook.addWorksheet(WORKBOOK_SHEET_NAMES.summary, {
      views: [{ state: 'frozen', ySplit: 2 }],
    });
    worksheet.columns = [
      { header: 'Mã_GV', key: 'code', width: 16 },
      { header: 'Họ_tên', key: 'fullName', width: 28 },
      { header: 'Tổ_CM', key: 'department', width: 18 },
      { header: 'Định_mức_tuần', key: 'baseLoad', width: 16 },
      { header: 'Giảm_trừ_tuần', key: 'reduction', width: 16 },
      { header: 'Định_mức_hiệu_lực', key: 'effectiveLoad', width: 18 },
      { header: 'Tổng_tiết_HK1', key: 'totalHk1', width: 16 },
      { header: 'Tổng_tiết_HK2', key: 'totalHk2', width: 16 },
      { header: 'Chênh_HK1', key: 'deltaHk1', width: 12 },
      { header: 'Chênh_HK2', key: 'deltaHk2', width: 12 },
      { header: 'Tổng_tiết_năm', key: 'totalYear', width: 16 },
      { header: 'Số_dòng_PC_HK1', key: 'assignmentRowsHk1', width: 16 },
      { header: 'Số_dòng_PC_HK2', key: 'assignmentRowsHk2', width: 16 },
      { header: 'Ghi_chú', key: 'notes', width: 28 },
    ];
    applyTitleRow(worksheet, 1, 'Tổng hợp tải giảng dạy theo giáo viên', 14);
    applyHeaderRow(worksheet.getRow(2));
    rows.forEach((item) => {
      const row = worksheet.addRow(item);
      applyBodyRow(row);
    });
  }

  private parseTeachersSheet(
    worksheet: ExcelJS.Worksheet,
    errors: WorkbookMessage[],
  ): TeacherImportRow[] {
    const config = this.resolveColumns(
      worksheet,
      HEADER_ALIASES.teachers,
      (columns) => Boolean(columns.code && columns.fullName),
      WORKBOOK_SHEET_NAMES.teachers,
      errors,
    );
    if (!config) return [];

    const rows: TeacherImportRow[] = [];
    for (let rowNumber = config.headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      if (!this.rowHasValue(row, Object.values(config.columns))) continue;

      const code = this.readString(row, config.columns.code, true).toUpperCase();
      const fullName = this.readString(row, config.columns.fullName);
      if (!code || !fullName) {
        errors.push({
          sheet: WORKBOOK_SHEET_NAMES.teachers,
          row: rowNumber,
          column: !code ? 'Mã_GV' : 'Họ_tên',
          code: 'missing_required_field',
          message: 'Thiếu mã giáo viên hoặc họ tên.',
        });
        continue;
      }

      const reduction = this.readInteger(row, config.columns.reduction) ?? 0;
      const effectiveLoad = this.readInteger(row, config.columns.effectiveLoad);
      const baseLoad = this.readInteger(row, config.columns.baseLoad);
      const resolvedEffective = effectiveLoad ?? Math.max((baseLoad ?? 17) - reduction, 0);
      const resolvedBase = baseLoad ?? resolvedEffective + reduction;

      rows.push({
        rowNumber,
        code,
        fullName,
        department: this.readString(row, config.columns.department),
        majorSubject: this.readString(row, config.columns.majorSubject, true).toUpperCase(),
        status: this.readString(row, config.columns.status) || 'Đang dạy',
        baseLoad: resolvedBase,
        reduction,
        effectiveLoad: resolvedEffective,
        homeroomClass: this.readString(row, config.columns.homeroomClass) || undefined,
        notes: this.readString(row, config.columns.notes),
      });
    }

    return rows;
  }

  private parseClassesSheet(
    worksheet: ExcelJS.Worksheet,
    errors: WorkbookMessage[],
  ): ClassImportRow[] {
    const config = this.resolveColumns(
      worksheet,
      HEADER_ALIASES.classes,
      (columns) => Boolean(columns.name),
      WORKBOOK_SHEET_NAMES.classes,
      errors,
    );
    if (!config) return [];

    const rows: ClassImportRow[] = [];
    for (let rowNumber = config.headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      if (!this.rowHasValue(row, Object.values(config.columns))) continue;

      const name = this.readString(row, config.columns.name);
      const gradeLevel = this.readInteger(row, config.columns.gradeLevel) ?? this.inferGradeLevel(name);
      const session = this.parseSessionLabel(this.readString(row, config.columns.session));
      if (!name || !gradeLevel || session === null) {
        errors.push({
          sheet: WORKBOOK_SHEET_NAMES.classes,
          row: rowNumber,
          column: !name ? 'Lớp' : !gradeLevel ? 'Khối' : 'Buổi_học',
          code: 'invalid_class_row',
          message: 'Dòng lớp thiếu thông tin bắt buộc hoặc buổi học không hợp lệ.',
        });
        continue;
      }

      rows.push({
        rowNumber,
        name,
        gradeLevel,
        studentCount: this.readInteger(row, config.columns.studentCount) ?? undefined,
        session,
        combinationCode: this.readString(row, config.columns.combinationCode, true).toUpperCase(),
        homeroomCode: this.readString(row, config.columns.homeroomCode, true).toUpperCase(),
        homeroomName: this.readString(row, config.columns.homeroomName),
        notes: this.readString(row, config.columns.notes),
      });
    }
    return rows;
  }

  private parseCombinationsSheet(
    worksheet: ExcelJS.Worksheet,
    errors: WorkbookMessage[],
  ): CombinationImportRow[] {
    const config = this.resolveColumns(
      worksheet,
      HEADER_ALIASES.combinations,
      (columns) => Boolean(columns.code && columns.gradeLevel),
      WORKBOOK_SHEET_NAMES.combinations,
      errors,
    );
    if (!config) return [];

    const rows: CombinationImportRow[] = [];
    for (let rowNumber = config.headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      if (!this.rowHasValue(row, Object.values(config.columns))) continue;

      const code = this.readString(row, config.columns.code, true).toUpperCase();
      const gradeLevel = this.readInteger(row, config.columns.gradeLevel);
      if (!code || !gradeLevel) {
        errors.push({
          sheet: WORKBOOK_SHEET_NAMES.combinations,
          row: rowNumber,
          column: !code ? 'Mã_tổ_hợp' : 'Khối',
          code: 'missing_combination_field',
          message: 'Dòng tổ hợp thiếu mã tổ hợp hoặc khối.',
        });
        continue;
      }

      rows.push({
        rowNumber,
        code,
        gradeLevel,
        elective1: this.normalizeSubjectEntry(this.readString(row, config.columns.elective1)),
        elective2: this.normalizeSubjectEntry(this.readString(row, config.columns.elective2)),
        elective3: this.normalizeSubjectEntry(this.readString(row, config.columns.elective3)),
        elective4: this.normalizeSubjectEntry(this.readString(row, config.columns.elective4)),
        special1: this.normalizeSpecialTopicEntry(this.readString(row, config.columns.special1)),
        special2: this.normalizeSpecialTopicEntry(this.readString(row, config.columns.special2)),
        special3: this.normalizeSpecialTopicEntry(this.readString(row, config.columns.special3)),
        notes: this.readString(row, config.columns.notes),
      });
    }
    return rows;
  }

  private parseAssignmentsSheet(
    worksheet: ExcelJS.Worksheet,
    errors: WorkbookMessage[],
    warnings: WorkbookMessage[],
  ): AssignmentImportRow[] {
    const config = this.resolveColumns(
      worksheet,
      HEADER_ALIASES.assignments,
      (columns) =>
        Boolean(columns.className && (columns.subjectCode || columns.subjectName) && columns.periodsHk1 && columns.periodsHk2),
      WORKBOOK_SHEET_NAMES.assignments,
      errors,
    );
    if (!config) return [];

    const rows: AssignmentImportRow[] = [];
    for (let rowNumber = config.headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      if (!this.rowHasValue(row, Object.values(config.columns))) continue;

      const className = this.readString(row, config.columns.className);
      const subjectCode = this.readString(row, config.columns.subjectCode, true).toUpperCase();
      const subjectName = this.readString(row, config.columns.subjectName);
      const periodsHk1 = this.readInteger(row, config.columns.periodsHk1) ?? 0;
      const periodsHk2 = this.readInteger(row, config.columns.periodsHk2) ?? 0;

      if (!className || (!subjectCode && !subjectName)) {
        errors.push({
          sheet: WORKBOOK_SHEET_NAMES.assignments,
          row: rowNumber,
          column: !className ? 'Lớp' : 'Mã_môn',
          code: 'missing_assignment_field',
          message: 'Dòng phân công thiếu lớp hoặc môn học.',
        });
        continue;
      }

      const gradeLevel =
        this.readInteger(row, config.columns.gradeLevel) ?? this.inferGradeLevel(className) ?? undefined;
      if (!gradeLevel) {
        warnings.push({
          sheet: WORKBOOK_SHEET_NAMES.assignments,
          row: rowNumber,
          column: 'Khối',
          code: 'missing_grade_level',
          message: 'Không suy ra được khối từ dòng phân công; hệ thống sẽ dùng dữ liệu lớp hiện có.',
        });
      }

      rows.push({
        rowNumber,
        schoolYear: this.readString(row, config.columns.schoolYear),
        gradeLevel,
        className,
        combinationCode: this.readString(row, config.columns.combinationCode, true).toUpperCase(),
        subjectCode,
        subjectName,
        programGroup: this.readString(row, config.columns.programGroup),
        periodsHk1,
        periodsHk2,
        teacherHk1Code: this.readString(row, config.columns.teacherHk1Code, true).toUpperCase(),
        teacherHk1Name: this.readString(row, config.columns.teacherHk1Name),
        teacherHk2Code: this.readString(row, config.columns.teacherHk2Code, true).toUpperCase(),
        teacherHk2Name: this.readString(row, config.columns.teacherHk2Name),
        notes: this.readString(row, config.columns.notes),
      });
    }
    return rows;
  }

  private async getYearContext(academicYearId: string) {
    const year = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      include: {
        semesters: {
          orderBy: { term_order: 'asc' },
        },
      },
    });

    if (!year) {
      throw new NotFoundException('Không tìm thấy năm học.');
    }

    const hk1 = year.semesters.find((semester) => semester.term_order === 1);
    const hk2 = year.semesters.find((semester) => semester.term_order === 2);
    if (!hk1 || !hk2 || year.semesters.length !== 2) {
      throw new BadRequestException(
        'Năm học phải có đúng 2 học kỳ với term_order lần lượt là 1 và 2.',
      );
    }

    return { year, hk1, hk2 };
  }

  private async ensureSubjectCatalog(prismaClient: PrismaService | PrismaTx = this.prisma) {
    for (let index = 0; index < SUBJECT_CATALOG.length; index += 1) {
      const subject = SUBJECT_CATALOG[index];
      await prismaClient.subject.upsert({
        where: { code: subject.code },
        create: {
          code: subject.code,
          name: subject.name,
          color: this.subjectColors[index % this.subjectColors.length],
          is_special: subject.isSpecial ?? false,
          is_practice: subject.isPractice ?? false,
        },
        update: {
          name: subject.name,
          color: this.subjectColors[index % this.subjectColors.length],
          is_special: subject.isSpecial ?? false,
          is_practice: subject.isPractice ?? false,
        },
      });
    }

    const subjects = await prismaClient.subject.findMany();
    return new Map(subjects.map((subject) => [subject.code, subject]));
  }

  private async fetchTeacherMap(
    prismaClient: PrismaService | PrismaTx,
    codes?: string[],
  ): Promise<Map<string, { id: string; code: string }>> {
    const teachers = await prismaClient.teacher.findMany({
      where: codes && codes.length > 0 ? { code: { in: codes } } : undefined,
      select: { id: true, code: true },
    });
    return new Map(teachers.map((teacher) => [teacher.code, teacher]));
  }

  private async fetchClassMap(
    prismaClient: PrismaService | PrismaTx,
  ): Promise<Map<string, { id: string; name: string }>> {
    const classes = await prismaClient.class.findMany({
      select: { id: true, name: true },
    });
    return new Map(classes.map((item) => [normalizeKey(item.name), item]));
  }

  private findWorksheet(workbook: ExcelJS.Workbook, expectedName: string): ExcelJS.Worksheet;
  private findWorksheet(workbook: ExcelJS.Workbook, expectedName: string, optional: true): ExcelJS.Worksheet | null;
  private findWorksheet(workbook: ExcelJS.Workbook, expectedName: string, optional?: boolean): ExcelJS.Worksheet | null {
    const normalizedExpected = normalizeKey(expectedName);
    for (const worksheet of workbook.worksheets) {
      const normalizedName = normalizeKey(worksheet.name);
      if (normalizedName === normalizedExpected) return worksheet;
      const aliases = SHEET_ALIASES[expectedName] ?? [];
      if (aliases.includes(normalizedName)) return worksheet;
    }

    if (optional) return null;

    throw new BadRequestException({
      summary: null,
      warnings: [],
      errors: [
        {
          sheet: expectedName,
          row: 0,
          column: '',
          code: 'missing_sheet',
          message: `Không tìm thấy sheet ${expectedName}.`,
        },
      ],
    });
  }

  private resolveColumns<T extends Record<string, readonly string[]>>(
    worksheet: ExcelJS.Worksheet,
    aliasMap: T,
    isValid: (columns: Partial<Record<keyof T, number>>) => boolean,
    sheetName: string,
    errors: WorkbookMessage[],
  ): { headerRow: number; columns: Partial<Record<keyof T, number>> } | null {
    let bestMatch: { headerRow: number; columns: Partial<Record<keyof T, number>>; score: number } | null = null;

    for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount, 15); rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const columns: Partial<Record<keyof T, number>> = {};
      const cellValues: string[] = [];

      row.eachCell((cell, colNumber) => {
        const normalized = normalizeKey(getCellText(cell));
        if (!normalized) return;
        cellValues.push(normalized);

        (Object.entries(aliasMap) as Array<[keyof T, readonly string[]]>).forEach(([field, aliases]) => {
          if (!columns[field] && aliases.includes(normalized)) {
            columns[field] = colNumber;
          }
        });
      });

      // Skip merged title rows (all cells have same value)
      if (cellValues.length > 1 && new Set(cellValues).size === 1) continue;

      const score = Object.keys(columns).length;
      if (score === 0) continue;
      if (isValid(columns) && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { headerRow: rowNumber, columns, score };
      }
    }

    if (!bestMatch) {
      // Build debug info: show what the first 5 rows contain
      const debugRows: string[] = [];
      for (let r = 1; r <= Math.min(worksheet.rowCount, 5); r++) {
        const vals: string[] = [];
        worksheet.getRow(r).eachCell((c) => {
          const t = getCellText(c);
          if (t) vals.push(t.substring(0, 20));
        });
        if (vals.length > 0) debugRows.push(`Row ${r}: [${vals.join(', ')}]`);
      }

      errors.push({
        sheet: sheetName,
        row: 0,
        column: '',
        code: 'invalid_header',
        message: `Không tìm thấy hàng tiêu đề hợp lệ cho sheet ${sheetName}. ${debugRows.length > 0 ? 'Dữ liệu tìm thấy: ' + debugRows.join(' | ') : 'Sheet trống.'}`,
      });
      return null;
    }

    return { headerRow: bestMatch.headerRow, columns: bestMatch.columns };
  }

  private resolveSubject(
    rawCode: string | undefined,
    rawName: string | undefined,
    subjectMap: Map<
      string,
      { id: number; code: string; name: string; is_special: boolean; is_practice: boolean }
    >,
  ) {
    const subjectAliasMap = new Map<string, string>();
    SUBJECT_CATALOG.forEach((item) => {
      subjectAliasMap.set(normalizeKey(item.code), item.code);
      subjectAliasMap.set(normalizeKey(item.name), item.code);
      item.aliases?.forEach((alias) => subjectAliasMap.set(normalizeKey(alias), item.code));
    });
    subjectMap.forEach((item) => {
      subjectAliasMap.set(normalizeKey(item.code), item.code);
      subjectAliasMap.set(normalizeKey(item.name), item.code);
    });

    let forcedPeriodType: PeriodType | null = null;
    let candidateCode = normalizeKey(rawCode);
    if (candidateCode.startsWith('cd')) {
      candidateCode = candidateCode.replace(/^cd/, '');
      forcedPeriodType = PeriodType.SPECIAL;
    }

    let subjectCode = candidateCode ? subjectAliasMap.get(candidateCode) : undefined;
    if (!subjectCode && rawName) {
      const normalizedName = normalizeKey(rawName);
      if (normalizedName.startsWith('chuyende')) {
        const subjectPart = normalizedName.replace(/^chuyende/, '');
        subjectCode = subjectAliasMap.get(subjectPart);
        forcedPeriodType = PeriodType.SPECIAL;
      } else {
        subjectCode = subjectAliasMap.get(normalizedName);
      }
    }
    if (!subjectCode) return null;

    const subject = subjectMap.get(subjectCode);
    if (!subject) return null;

    const periodType =
      forcedPeriodType ??
      (subject.is_special
        ? PeriodType.SPECIAL
        : subject.is_practice
          ? PeriodType.PRACTICE
          : PeriodType.THEORY);

    return {
      subjectCode,
      subjectName:
        periodType === PeriodType.SPECIAL && !subject.is_special
          ? `Chuyên đề ${subject.name}`
          : subject.name,
      periodType,
    };
  }

  private resolveProgramGroup(subjectCode: string, periodType: PeriodType): string {
    if (periodType === PeriodType.SPECIAL) {
      const catalog = SUBJECT_CATALOG.find((item) => item.code === subjectCode);
      if (catalog?.isSpecial) return catalog.group;
      return 'Chuyên đề học tập';
    }
    return SUBJECT_CATALOG.find((item) => item.code === subjectCode)?.group ?? 'Khác';
  }

  private buildTeacherMajorSubjectMap(
    assignments: Array<{
      teacher_id: string;
      subject: { code: string };
      total_periods: number;
    }>,
  ): Map<string, string> {
    const scoreMap = new Map<string, Map<string, number>>();
    assignments.forEach((assignment) => {
      const teacherEntry = scoreMap.get(assignment.teacher_id) ?? new Map<string, number>();
      teacherEntry.set(
        assignment.subject.code,
        (teacherEntry.get(assignment.subject.code) ?? 0) + assignment.total_periods,
      );
      scoreMap.set(assignment.teacher_id, teacherEntry);
    });

    const result = new Map<string, string>();
    scoreMap.forEach((subjectScores, teacherId) => {
      let bestCode = '';
      let bestScore = -1;
      subjectScores.forEach((score, subjectCode) => {
        if (score > bestScore) {
          bestCode = subjectCode;
          bestScore = score;
        }
      });
      result.set(teacherId, bestCode);
    });
    return result;
  }

  private validateDuplicateCodes(
    rows: Array<{ value: string; rowNumber: number }>,
    sheet: string,
    column: string,
    code: string,
    errors: WorkbookMessage[],
  ): void {
    const seen = new Map<string, number>();
    rows.forEach((row) => {
      const key = normalizeKey(row.value);
      if (!key) return;
      if (seen.has(key)) {
        errors.push({
          sheet,
          row: row.rowNumber,
          column,
          code,
          message: `Giá trị ${row.value} bị lặp trong file import.`,
        });
      } else {
        seen.set(key, row.rowNumber);
      }
    });
  }

  private rowHasValue(row: ExcelJS.Row, columns: number[]): boolean {
    return columns.some((column) => Boolean(this.readString(row, column)));
  }

  private readString(row: ExcelJS.Row, column?: number, preserveCase = false): string {
    if (!column) return '';
    const value = getCellText(row.getCell(column));
    return preserveCase ? value : value.trim();
  }

  private readInteger(row: ExcelJS.Row, column?: number): number | null {
    if (!column) return null;
    const value = getCellNumber(row.getCell(column));
    return value === null ? null : Math.trunc(value);
  }

  private inferGradeLevel(className?: string): number | null {
    if (!className) return null;
    const match = className.match(/\b(10|11|12)\b|^(10|11|12)/);
    const value = match?.[1] || match?.[2];
    return value ? Number(value) : null;
  }

  private parseSessionLabel(value: string): number | null {
    const normalized = normalizeKey(value);
    if (!normalized) return 0;
    if (['0', 'sang', 'sng', 'buoisang', 'morning'].includes(normalized)) return 0;
    if (['1', 'chieu', 'chiu', 'buoichieu', 'afternoon'].includes(normalized)) return 1;
    return null;
  }

  private normalizeSubjectEntry(value: string): string {
    if (!value) return '';
    const normalized = normalizeKey(value);
    const match = SUBJECT_CATALOG.find(
      (item) =>
        normalizeKey(item.code) === normalized ||
        normalizeKey(item.name) === normalized ||
        item.aliases?.some((alias) => normalizeKey(alias) === normalized),
    );
    return match?.code ?? value.toUpperCase();
  }

  private normalizeSpecialTopicEntry(value: string): string {
    if (!value) return '';
    const normalized = normalizeKey(value);
    if (normalized.startsWith('cd')) {
      const canonical = this.normalizeSubjectEntry(normalized.replace(/^cd/, ''));
      return canonical ? `CD_${canonical}` : value.toUpperCase();
    }
    const canonical = this.normalizeSubjectEntry(value);
    return canonical ? `CD_${canonical}` : value.toUpperCase();
  }

  private resolveLabRoomType(subjectCode: string): RoomType {
    switch (subjectCode) {
      case 'LY':
        return RoomType.LAB_PHYSICS;
      case 'HOA':
        return RoomType.LAB_CHEM;
      case 'SINH':
        return RoomType.LAB_BIO;
      case 'TIN':
        return RoomType.LAB_IT;
      default:
        return RoomType.LAB_IT;
    }
  }

  private refinePeriodType(
    basePeriodType: PeriodType,
    programGroup?: string,
    notes?: string,
  ): PeriodType {
    if (basePeriodType !== PeriodType.THEORY) return basePeriodType;
    const pg = normalizeKey(programGroup ?? '');
    const n = normalizeKey(notes ?? '');
    if (pg.includes('thuchanh') || n.includes('thuchanh')) {
      return PeriodType.PRACTICE;
    }
    return basePeriodType;
  }
}
