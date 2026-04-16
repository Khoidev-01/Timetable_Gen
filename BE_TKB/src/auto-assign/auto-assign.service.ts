import { BadRequestException, Injectable } from '@nestjs/common';
import { PeriodType } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import {
  GDPT2018_CURRICULUM,
  getCurriculumPeriods,
  getPracticePeriods,
  SUBJECT_CATALOG,
} from '../excel/excel.constants';
import { applyHeaderRow, applyBodyRow, applyTitleRow, thinBorder, resetBodyRowIndex } from '../excel/excel.utils';

// ──────────────────────────────
// Types
// ──────────────────────────────

interface TeacherInput {
  code: string;
  fullName: string;
  majorSubject: string;
  teachableGrades: number[];
  position: string;
  baseLoad: number;
  reduction: number;
  effectiveLoad: number;
  homeroomClass?: string;
  department?: string;
  notes?: string;
}

interface ClassDemand {
  classId: string;
  className: string;
  gradeLevel: number;
  combinationCode?: string;
  subjectCode: string;
  subjectName: string;
  periodsNeeded: number;
  periodType: PeriodType;
  assignedTeacherCode?: string;
  assignedTeacherName?: string;
}

export interface AssignmentResult {
  summary: {
    totalDemands: number;
    assigned: number;
    unassigned: number;
    teacherStats: Array<{
      code: string;
      name: string;
      effectiveLoad: number;
      assignedPeriods: number;
      surplus: number;
    }>;
  };
  assignments: ClassDemand[];
  warnings: string[];
}

// ──────────────────────────────
// Helper: set cell values + apply style on a row
// ──────────────────────────────
function setRowValues(row: ExcelJS.Row, values: (string | number | null | undefined)[]) {
  values.forEach((v, i) => {
    row.getCell(i + 1).value = v ?? '';
  });
}

// ──────────────────────────────
// Service
// ──────────────────────────────

@Injectable()
export class AutoAssignService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // 1. Generate Excel Input Template
  // ==========================================
  async generateInputTemplate(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();

    // --- Sheet 1: Danh sách GV ---
    const ws = wb.addWorksheet('Danh_sach_GV');
    const headers = [
      'Mã GV', 'Họ và tên', 'Môn chuyên môn', 'Khối dạy',
      'Chức vụ', 'Tiết chuẩn/tuần', 'Giảm trừ', 'Tiết thực dạy',
      'Chủ nhiệm lớp', 'Ghi chú',
    ];

    // Title row
    applyTitleRow(ws, 1, 'DANH SÁCH GIÁO VIÊN — PHÂN CÔNG TỰ ĐỘNG', headers.length);

    // Header row
    const headerRow = ws.getRow(2);
    setRowValues(headerRow, headers);
    applyHeaderRow(headerRow);

    // Column widths
    const widths = [10, 25, 20, 15, 15, 15, 12, 15, 15, 20];
    widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

    // Sample data
    const samples: (string | number)[][] = [
      ['GV001', 'Nguyễn Văn A', 'TOAN', '10,11', 'GV', 17, 0, 17, '10C1', ''],
      ['GV002', 'Trần Thị B', 'VAN', '10,11,12', 'TT', 17, 3, 14, '', 'Tổ trưởng Văn'],
      ['GV003', 'Lê Văn C', 'LY', '10,12', 'GV', 17, 0, 17, '12A1', ''],
    ];
    resetBodyRowIndex();
    samples.forEach((vals, i) => {
      const r = ws.getRow(i + 3);
      setRowValues(r, vals);
      applyBodyRow(r);
    });

    // --- Sheet 2: Hướng dẫn ---
    const guideWs = wb.addWorksheet('Huong_dan');
    applyTitleRow(guideWs, 1, 'HƯỚNG DẪN NHẬP DỮ LIỆU', 2);

    const guides: [string, string][] = [
      ['Mã GV', 'Mã giáo viên duy nhất (VD: GV001)'],
      ['Họ và tên', 'Họ tên đầy đủ'],
      ['Môn chuyên môn', `Mã môn: ${SUBJECT_CATALOG.filter(s => !s.isSpecial).map(s => s.code).join(', ')}`],
      ['Khối dạy', 'Danh sách khối, cách nhau bằng dấu phẩy: 10,11,12'],
      ['Chức vụ', 'GV = Giáo viên, HT = Hiệu trưởng, PHT = Phó HT, TT = Tổ trưởng, TP = Tổ phó'],
      ['Tiết chuẩn/tuần', 'Định mức tiết chuẩn (thường 17)'],
      ['Giảm trừ', 'Số tiết giảm trừ do chức vụ/kiêm nhiệm'],
      ['Tiết thực dạy', 'Tự tính = Tiết chuẩn - Giảm trừ'],
      ['Chủ nhiệm lớp', 'Tên lớp chủ nhiệm (để trống nếu không có)'],
    ];
    guides.forEach(([label, desc], i) => {
      const r = guideWs.getRow(i + 2);
      r.getCell(1).value = label;
      r.getCell(1).font = { name: 'Calibri', bold: true };
      r.getCell(2).value = desc;
    });
    guideWs.getColumn(1).width = 18;
    guideWs.getColumn(2).width = 70;

    // --- Sheet 3: Danh mục mã môn ---
    const refWs = wb.addWorksheet('DM_Mon');
    applyTitleRow(refWs, 1, 'DANH MỤC MÃ MÔN HỌC', 3);

    const refHeader = refWs.getRow(2);
    setRowValues(refHeader, ['Mã môn', 'Tên môn', 'Nhóm']);
    applyHeaderRow(refHeader);

    resetBodyRowIndex();
    SUBJECT_CATALOG.filter(s => !s.isSpecial).forEach((s, i) => {
      const r = refWs.getRow(i + 3);
      setRowValues(r, [s.code, s.name, s.group]);
      applyBodyRow(r);
    });
    refWs.getColumn(1).width = 12;
    refWs.getColumn(2).width = 35;
    refWs.getColumn(3).width = 20;

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ==========================================
  // 2. Parse uploaded teacher Excel
  // ==========================================
  private async parseTeacherInput(buffer: Buffer): Promise<TeacherInput[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    const ws = wb.getWorksheet('Danh_sach_GV') || wb.getWorksheet(1);
    if (!ws) throw new BadRequestException('Không tìm thấy sheet "Danh_sach_GV"');

    const teachers: TeacherInput[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return;

      const code = String(row.getCell(1).value ?? '').trim();
      const fullName = String(row.getCell(2).value ?? '').trim();
      if (!code || !fullName) return;

      const majorSubject = String(row.getCell(3).value ?? '').trim().toUpperCase();
      const gradesStr = String(row.getCell(4).value ?? '');
      const teachableGrades = gradesStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      const position = String(row.getCell(5).value ?? 'GV').trim().toUpperCase();
      const baseLoad = Number(row.getCell(6).value) || 17;
      const reduction = Number(row.getCell(7).value) || 0;
      const effectiveLoad = Number(row.getCell(8).value) || (baseLoad - reduction);
      const homeroomClass = String(row.getCell(9).value ?? '').trim() || undefined;
      const notes = String(row.getCell(10).value ?? '').trim() || undefined;

      teachers.push({
        code, fullName, majorSubject, teachableGrades, position,
        baseLoad, reduction, effectiveLoad, homeroomClass, notes,
      });
    });

    if (teachers.length === 0) {
      throw new BadRequestException('File Excel không chứa dữ liệu giáo viên nào.');
    }
    return teachers;
  }

  // ==========================================
  // 3. Build class demands from curriculum
  // ==========================================
  private async buildClassDemands(_yearId: string): Promise<ClassDemand[]> {
    const classes = await this.prisma.class.findMany({
      orderBy: [{ grade_level: 'asc' }, { name: 'asc' }],
    });

    const combinations = await this.prisma.curriculumCombination.findMany();
    const comboMap = new Map<string, typeof combinations[0]>();
    combinations.forEach(c => comboMap.set(`${c.code}:${c.grade_level}`, c));

    const demands: ClassDemand[] = [];

    for (const cls of classes) {
      const grade = cls.grade_level;
      const combo = cls.combination_code
        ? comboMap.get(`${cls.combination_code}:${grade}`)
        : null;

      for (const curricItem of GDPT2018_CURRICULUM) {
        const subjectCode = curricItem.subjectCode;
        const catalogEntry = SUBJECT_CATALOG.find(s => s.code === subjectCode);
        if (!catalogEntry) continue;

        // Elective subjects: only if class combination includes this subject
        if (catalogEntry.group === 'Lựa chọn') {
          if (!combo) continue;
          const comboSubjects = [
            combo.elective_subject_code_1,
            combo.elective_subject_code_2,
            combo.elective_subject_code_3,
            combo.elective_subject_code_4,
            // Chuyên đề đã gộp vào môn gốc, không cần check special_topic
          ];
          if (!comboSubjects.includes(subjectCode)) continue;
        }

        // Theory periods
        const theoryPeriods = getCurriculumPeriods(subjectCode, grade);
        if (theoryPeriods > 0) {
          demands.push({
            classId: cls.id,
            className: cls.name,
            gradeLevel: grade,
            combinationCode: cls.combination_code ?? undefined,
            subjectCode,
            subjectName: catalogEntry.name,
            periodsNeeded: theoryPeriods,
            periodType: catalogEntry.isSpecial ? PeriodType.SPECIAL : PeriodType.THEORY,
          });
        }

        // Practice periods
        const practicePeriods = getPracticePeriods(subjectCode, grade);
        if (practicePeriods > 0) {
          demands.push({
            classId: cls.id,
            className: cls.name,
            gradeLevel: grade,
            combinationCode: cls.combination_code ?? undefined,
            subjectCode,
            subjectName: `${catalogEntry.name} (TH)`,
            periodsNeeded: practicePeriods,
            periodType: PeriodType.PRACTICE,
          });
        }
      }
    }

    return demands;
  }

  // ==========================================
  // 4. GREEDY ASSIGNMENT ALGORITHM
  // ==========================================
  private assignTeachers(
    teachers: TeacherInput[],
    demands: ClassDemand[],
  ): AssignmentResult {
    const warnings: string[] = [];

    // Track each teacher's assigned periods
    const teacherLoad = new Map<string, number>();
    teachers.forEach(t => teacherLoad.set(t.code, 0));

    // Track which classes each teacher is assigned to
    const teacherClasses = new Map<string, Set<string>>();
    teachers.forEach(t => teacherClasses.set(t.code, new Set()));

    // Sort demands: harder to fill first (fewer eligible teachers → higher priority)
    const demandWithEligible = demands.map(d => {
      const eligible = teachers.filter(t =>
        t.majorSubject === d.subjectCode &&
        t.teachableGrades.includes(d.gradeLevel) &&
        t.effectiveLoad > 0,
      );
      return { demand: d, eligibleCount: eligible.length };
    });
    demandWithEligible.sort((a, b) => a.eligibleCount - b.eligibleCount);

    // Assign
    for (const { demand } of demandWithEligible) {
      // Skip special activities (Chào cờ, SH cuối tuần)
      if (demand.periodType === PeriodType.SPECIAL) continue;

      const candidates = teachers
        .filter(t =>
          t.majorSubject === demand.subjectCode &&
          t.teachableGrades.includes(demand.gradeLevel) &&
          (teacherLoad.get(t.code) ?? 0) + demand.periodsNeeded <= t.effectiveLoad,
        )
        .map(t => {
          const currentLoad = teacherLoad.get(t.code) ?? 0;
          const classes = teacherClasses.get(t.code) ?? new Set();
          let score = 0;

          // Prefer homeroom teacher for their class
          if (t.homeroomClass === demand.className) score += 100;

          // Prefer teacher already teaching this class (continuity)
          if (classes.has(demand.className)) score += 30;

          // Prefer teacher with more remaining capacity
          score += (t.effectiveLoad - currentLoad - demand.periodsNeeded);

          // Prefer fewer total classes (less fragmented)
          score -= classes.size * 2;

          return { teacher: t, score };
        })
        .sort((a, b) => b.score - a.score);

      if (candidates.length > 0) {
        const best = candidates[0].teacher;
        demand.assignedTeacherCode = best.code;
        demand.assignedTeacherName = best.fullName;
        teacherLoad.set(best.code, (teacherLoad.get(best.code) ?? 0) + demand.periodsNeeded);
        teacherClasses.get(best.code)?.add(demand.className);
      } else {
        warnings.push(
          `Không tìm được GV cho: ${demand.className} - ${demand.subjectName} (${demand.periodsNeeded} tiết)`,
        );
      }
    }

    // Build summary
    const teacherStats = teachers.map(t => ({
      code: t.code,
      name: t.fullName,
      effectiveLoad: t.effectiveLoad,
      assignedPeriods: teacherLoad.get(t.code) ?? 0,
      surplus: (teacherLoad.get(t.code) ?? 0) - t.effectiveLoad,
    }));

    const assigned = demands.filter(d => d.assignedTeacherCode).length;
    const unassigned = demands.filter(d => !d.assignedTeacherCode && d.periodType !== PeriodType.SPECIAL).length;

    return {
      summary: {
        totalDemands: demands.length,
        assigned,
        unassigned,
        teacherStats,
      },
      assignments: demands,
      warnings,
    };
  }

  // ==========================================
  // 5. Main: Generate Assignments
  // ==========================================
  async generateAssignments(yearId: string, fileBuffer: Buffer): Promise<AssignmentResult> {
    // 1. Parse teacher input
    const teachers = await this.parseTeacherInput(fileBuffer);

    // 2. Upsert teachers into DB
    for (const t of teachers) {
      await this.prisma.teacher.upsert({
        where: { code: t.code },
        create: {
          code: t.code,
          full_name: t.fullName,
          major_subject: t.majorSubject,
          teachable_grades: JSON.stringify(t.teachableGrades),
          position: t.position,
          max_periods_per_week: t.effectiveLoad,
          department: t.department,
          workload_reduction: t.reduction,
          status: 'Dang_day',
          notes: t.notes,
        },
        update: {
          full_name: t.fullName,
          major_subject: t.majorSubject,
          teachable_grades: JSON.stringify(t.teachableGrades),
          position: t.position,
          max_periods_per_week: t.effectiveLoad,
          workload_reduction: t.reduction,
          notes: t.notes,
        },
      });
    }

    // 3. Build curriculum demands
    const demands = await this.buildClassDemands(yearId);

    // 4. Run assignment algorithm
    const result = this.assignTeachers(teachers, demands);

    return result;
  }

  // ==========================================
  // 6. Export result as Excel
  // ==========================================
  async exportAssignmentResult(yearId: string): Promise<Buffer> {
    const year = await this.prisma.academicYear.findUnique({
      where: { id: yearId },
      include: { semesters: { orderBy: { term_order: 'asc' } } },
    });
    if (!year) throw new BadRequestException('Năm học không tồn tại.');

    const semesterIds = year.semesters.map(s => s.id);
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { semester_id: { in: semesterIds } },
      include: { teacher: true, class: true, subject: true, semester: true },
      orderBy: [
        { class: { grade_level: 'asc' } },
        { class: { name: 'asc' } },
        { subject: { code: 'asc' } },
      ],
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Phan_cong');

    const headers = [
      'STT', 'Năm học', 'Khối', 'Lớp', 'Mã tổ hợp',
      'Mã môn', 'Tên môn', 'Nhóm CT',
      'Tiết HK1', 'Tiết HK2',
      'GV HK1 - Mã', 'GV HK1 - Họ tên', 'GV HK1 - Định mức',
      'GV HK2 - Mã', 'GV HK2 - Họ tên',
    ];

    applyTitleRow(ws, 1, `BẢNG PHÂN CÔNG CHUYÊN MÔN — NĂM HỌC ${year.name}`, headers.length);

    const headerRow = ws.getRow(2);
    setRowValues(headerRow, headers);
    applyHeaderRow(headerRow);

    // Group by class+subject, merge HK1/HK2
    const rowMap = new Map<string, any>();
    assignments.forEach(a => {
      const key = `${a.class.name}:${a.subject.code}:${a.period_type}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          className: a.class.name,
          gradeLevel: a.class.grade_level,
          combinationCode: a.class.combination_code ?? '',
          subjectCode: a.subject.code,
          subjectName: a.subject.name + (a.period_type === 'PRACTICE' ? ' (TH)' : ''),
          programGroup: a.period_type === 'PRACTICE' ? 'Thực hành' : (a.subject.is_special ? 'Hoạt động' : 'Lý thuyết'),
          periodsHk1: 0, periodsHk2: 0,
          hk1Code: '', hk1Name: '', hk1Load: 0,
          hk2Code: '', hk2Name: '',
        });
      }
      const row = rowMap.get(key)!;
      if (a.semester.term_order === 1) {
        row.periodsHk1 = a.total_periods;
        row.hk1Code = a.teacher.code;
        row.hk1Name = a.teacher.full_name;
        row.hk1Load = a.teacher.max_periods_per_week;
      } else {
        row.periodsHk2 = a.total_periods;
        row.hk2Code = a.teacher.code;
        row.hk2Name = a.teacher.full_name;
      }
    });

    let stt = 1;
    for (const row of rowMap.values()) {
      const r = ws.getRow(stt + 2);
      const vals = [
        stt++, year.name, row.gradeLevel, row.className, row.combinationCode,
        row.subjectCode, row.subjectName, row.programGroup,
        row.periodsHk1, row.periodsHk2,
        row.hk1Code, row.hk1Name, row.hk1Load,
        row.hk2Code, row.hk2Name,
      ];
      setRowValues(r, vals);
      applyBodyRow(r);
    }

    // Auto-width
    [6, 8, 6, 8, 10, 8, 28, 12, 8, 8, 12, 22, 10, 12, 22].forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
