"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ExcelJS = __importStar(require("exceljs"));
const prisma_service_1 = require("../prisma/prisma.service");
const excel_constants_1 = require("./excel.constants");
const excel_utils_1 = require("./excel.utils");
let ExcelService = class ExcelService {
    prisma;
    subjectColors = [
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
    constructor(prisma) {
        this.prisma = prisma;
    }
    async downloadTemplate(academicYearId) {
        const context = await this.getYearContext(academicYearId);
        await this.ensureSubjectCatalog();
        const buffer = await this.buildWorkbookBuffer({
            yearName: context.year.name,
            teachers: [],
            classes: [],
            combinations: [],
            assignments: [],
            teacherSummaries: [],
            subjects: excel_constants_1.SUBJECT_CATALOG,
        });
        return {
            buffer,
            fileName: `mau-phan-cong-gdpt2018-${context.year.name}.xlsx`,
        };
    }
    async exportWorkbook(academicYearId) {
        const context = await this.getYearContext(academicYearId);
        await this.ensureSubjectCatalog();
        const data = await this.loadWorkbookData(context.hk1.id, context.hk2.id, context.year.name);
        const buffer = await this.buildWorkbookBuffer(data);
        return {
            buffer,
            fileName: `phan-cong-giang-day-${context.year.name}.xlsx`,
        };
    }
    async importWorkbook(academicYearId, buffer) {
        const context = await this.getYearContext(academicYearId);
        const subjectMap = await this.ensureSubjectCatalog();
        const parsed = await this.parseWorkbook(buffer);
        const { warnings, preparedAssignments } = await this.validateWorkbook(context.year.name, parsed, subjectMap, context.hk1.id, context.hk2.id);
        const summary = await this.prisma.$transaction(async (tx) => {
            const teacherSummary = await this.upsertTeachers(tx, parsed.teachers);
            const teacherMap = await this.fetchTeacherMap(tx);
            const classSummary = await this.upsertClasses(tx, parsed.classes, teacherMap);
            const classMap = await this.fetchClassMap(tx);
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
            const referencedTeacherCodes = new Set();
            preparedAssignments.forEach((row) => {
                if (row.hk1)
                    referencedTeacherCodes.add(row.hk1.teacherCode);
                if (row.hk2)
                    referencedTeacherCodes.add(row.hk2.teacherCode);
            });
            const assignmentTeacherMap = await this.fetchTeacherMap(tx, [...referencedTeacherCodes]);
            const assignmentsToCreate = [];
            preparedAssignments.forEach((row) => {
                const classEntity = classMap.get((0, excel_utils_1.normalizeKey)(row.className));
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
                            required_room_type: row.periodType === client_1.PeriodType.PRACTICE ? client_1.RoomType.LAB_IT : null,
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
                            required_room_type: row.periodType === client_1.PeriodType.PRACTICE ? client_1.RoomType.LAB_IT : null,
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
        return {
            summary,
            warnings: [...parsed.warnings, ...warnings],
            errors: [],
        };
    }
    async parseWorkbook(buffer) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const teachersSheet = this.findWorksheet(workbook, excel_constants_1.WORKBOOK_SHEET_NAMES.teachers);
        const classesSheet = this.findWorksheet(workbook, excel_constants_1.WORKBOOK_SHEET_NAMES.classes);
        const combinationsSheet = this.findWorksheet(workbook, excel_constants_1.WORKBOOK_SHEET_NAMES.combinations);
        const assignmentsSheet = this.findWorksheet(workbook, excel_constants_1.WORKBOOK_SHEET_NAMES.assignments);
        const errors = [];
        const warnings = [];
        const teachers = this.parseTeachersSheet(teachersSheet, errors);
        const classes = this.parseClassesSheet(classesSheet, errors);
        const combinations = this.parseCombinationsSheet(combinationsSheet, errors);
        const assignments = this.parseAssignmentsSheet(assignmentsSheet, errors, warnings);
        if (errors.length > 0) {
            throw new common_1.BadRequestException({
                summary: null,
                warnings: [],
                errors,
            });
        }
        return {
            teachers,
            classes,
            combinations,
            assignments,
            warnings,
        };
    }
    async validateWorkbook(yearName, parsed, subjectMap, hk1Id, hk2Id) {
        const errors = [];
        const warnings = [];
        this.validateDuplicateCodes(parsed.teachers.map((teacher) => ({ value: teacher.code, rowNumber: teacher.rowNumber })), excel_constants_1.WORKBOOK_SHEET_NAMES.teachers, 'Mã_GV', 'duplicate_teacher_code', errors);
        this.validateDuplicateCodes(parsed.classes.map((item) => ({ value: item.name, rowNumber: item.rowNumber })), excel_constants_1.WORKBOOK_SHEET_NAMES.classes, 'Lớp', 'duplicate_class_name', errors);
        this.validateDuplicateCodes(parsed.combinations.map((item) => ({ value: item.code, rowNumber: item.rowNumber })), excel_constants_1.WORKBOOK_SHEET_NAMES.combinations, 'Mã_tổ_hợp', 'duplicate_combination_code', errors);
        const existingTeachers = await this.fetchTeacherMap(this.prisma);
        const existingClasses = await this.fetchClassMap(this.prisma);
        const futureTeacherCodes = new Set([
            ...existingTeachers.keys(),
            ...parsed.teachers.map((item) => item.code),
        ]);
        const futureClassNames = new Set([
            ...existingClasses.keys(),
            ...parsed.classes.map((item) => (0, excel_utils_1.normalizeKey)(item.name)),
        ]);
        const futureCombinationCodes = new Set(parsed.combinations.map((item) => item.code));
        const preparedAssignments = [];
        parsed.classes.forEach((item) => {
            if (item.homeroomCode && !futureTeacherCodes.has(item.homeroomCode)) {
                errors.push({
                    sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.classes,
                    row: item.rowNumber,
                    column: 'GVCN_Mã',
                    code: 'homeroom_teacher_not_found',
                    message: `Không tìm thấy giáo viên chủ nhiệm có mã ${item.homeroomCode}.`,
                });
            }
            if (item.combinationCode && !futureCombinationCodes.has(item.combinationCode)) {
                errors.push({
                    sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.classes,
                    row: item.rowNumber,
                    column: 'Mã_tổ_hợp',
                    code: 'combination_not_found',
                    message: `Tổ hợp ${item.combinationCode} không có trong sheet DM_To_hop.`,
                });
            }
        });
        const seenAssignmentKeys = new Set();
        parsed.assignments.forEach((item) => {
            if (item.schoolYear && (0, excel_utils_1.normalizeKey)(item.schoolYear) !== (0, excel_utils_1.normalizeKey)(yearName)) {
                warnings.push({
                    sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.assignments,
                    row: item.rowNumber,
                    column: 'Năm_học',
                    code: 'school_year_mismatch',
                    message: `Dòng này khai báo năm học ${item.schoolYear}, hệ thống vẫn import vào năm học ${yearName}.`,
                });
            }
            const classKey = (0, excel_utils_1.normalizeKey)(item.className);
            if (!futureClassNames.has(classKey)) {
                errors.push({
                    sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.assignments,
                    row: item.rowNumber,
                    column: 'Lớp',
                    code: 'class_not_found',
                    message: `Không tìm thấy lớp ${item.className}.`,
                });
                return;
            }
            if (item.combinationCode && !futureCombinationCodes.has(item.combinationCode)) {
                errors.push({
                    sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.assignments,
                    row: item.rowNumber,
                    column: 'Mã_tổ_hợp',
                    code: 'combination_not_found',
                    message: `Tổ hợp ${item.combinationCode} không có trong sheet DM_To_hop.`,
                });
            }
            const resolved = this.resolveSubject(item.subjectCode, item.subjectName, subjectMap);
            if (!resolved) {
                errors.push({
                    sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.assignments,
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
                        sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.assignments,
                        row: item.rowNumber,
                        column: 'GV_HK1_Mã',
                        code: 'missing_teacher_hk1',
                        message: 'Có tiết HK1 nhưng chưa khai báo mã giáo viên HK1.',
                    });
                }
                else if (!futureTeacherCodes.has(item.teacherHk1Code)) {
                    errors.push({
                        sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.assignments,
                        row: item.rowNumber,
                        column: 'GV_HK1_Mã',
                        code: 'teacher_not_found_hk1',
                        message: `Không tìm thấy giáo viên HK1 có mã ${item.teacherHk1Code}.`,
                    });
                }
            }
            else if (item.teacherHk1Code) {
                errors.push({
                    sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.assignments,
                    row: item.rowNumber,
                    column: 'Tiết_HK1',
                    code: 'periods_hk1_zero',
                    message: 'Đã nhập giáo viên HK1 nhưng số tiết HK1 bằng 0.',
                });
            }
            if (item.periodsHk2 > 0) {
                if (!item.teacherHk2Code) {
                    errors.push({
                        sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.assignments,
                        row: item.rowNumber,
                        column: 'GV_HK2_Mã',
                        code: 'missing_teacher_hk2',
                        message: 'Có tiết HK2 nhưng chưa khai báo mã giáo viên HK2.',
                    });
                }
                else if (!futureTeacherCodes.has(item.teacherHk2Code)) {
                    errors.push({
                        sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.assignments,
                        row: item.rowNumber,
                        column: 'GV_HK2_Mã',
                        code: 'teacher_not_found_hk2',
                        message: `Không tìm thấy giáo viên HK2 có mã ${item.teacherHk2Code}.`,
                    });
                }
            }
            else if (item.teacherHk2Code) {
                errors.push({
                    sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.assignments,
                    row: item.rowNumber,
                    column: 'Tiết_HK2',
                    code: 'periods_hk2_zero',
                    message: 'Đã nhập giáo viên HK2 nhưng số tiết HK2 bằng 0.',
                });
            }
            if (item.periodsHk1 <= 0 && item.periodsHk2 <= 0) {
                errors.push({
                    sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.assignments,
                    row: item.rowNumber,
                    column: 'Tiết_HK1',
                    code: 'missing_periods',
                    message: 'Dòng phân công phải có ít nhất một giá trị Tiết_HK1 hoặc Tiết_HK2 lớn hơn 0.',
                });
            }
            const assignmentKey = `${classKey}:${resolved.subjectCode}`;
            if (item.periodsHk1 > 0) {
                const hk1Key = `${assignmentKey}:1`;
                if (seenAssignmentKeys.has(hk1Key)) {
                    errors.push({
                        sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.assignments,
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
                        sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.assignments,
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
                periodType: resolved.periodType,
                notes: item.notes,
                hk1: item.periodsHk1 > 0 && item.teacherHk1Code
                    ? {
                        semesterId: hk1Id,
                        teacherCode: item.teacherHk1Code,
                        totalPeriods: item.periodsHk1,
                    }
                    : undefined,
                hk2: item.periodsHk2 > 0 && item.teacherHk2Code
                    ? {
                        semesterId: hk2Id,
                        teacherCode: item.teacherHk2Code,
                        totalPeriods: item.periodsHk2,
                    }
                    : undefined,
            });
        });
        if (errors.length > 0) {
            throw new common_1.BadRequestException({
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
    async upsertTeachers(tx, teachers) {
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
            }
            else {
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
    async upsertClasses(tx, classes, teacherMap) {
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
            }
            else {
                await tx.class.create({ data });
                created += 1;
            }
        }
        return { created, updated };
    }
    async loadWorkbookData(hk1Id, hk2Id, yearName) {
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
        const workbookTeachers = teachers.map((teacher) => ({
            code: teacher.code,
            fullName: teacher.full_name,
            department: teacher.department ?? '',
            majorSubject: teacherMajorMap.get(teacher.id) ?? '',
            status: teacher.status,
            baseLoad: teacher.max_periods_per_week + teacher.workload_reduction,
            reduction: teacher.workload_reduction,
            effectiveLoad: teacher.max_periods_per_week,
            notes: teacher.notes ?? '',
        }));
        const workbookClasses = classes.map((item) => ({
            name: item.name,
            gradeLevel: item.grade_level,
            studentCount: item.student_count ?? undefined,
            sessionLabel: item.main_session === 0 ? 'Sáng' : 'Chiều',
            combinationCode: item.combination_code ?? '',
            homeroomCode: item.homeroom_teacher?.code ?? '',
            homeroomName: item.homeroom_teacher?.full_name ?? '',
            notes: item.notes ?? '',
        }));
        const workbookCombinations = combinations.map((item) => ({
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
        const groupedAssignments = new Map();
        assignments.forEach((assignment) => {
            const exportedSubjectCode = assignment.period_type === client_1.PeriodType.SPECIAL && !assignment.subject.is_special
                ? `CD_${assignment.subject.code}`
                : assignment.subject.code;
            const exportedSubjectName = assignment.period_type === client_1.PeriodType.SPECIAL && !assignment.subject.is_special
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
        const summaryByTeacher = new Map();
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
            }
            else if (assignment.semester_id === hk2Id) {
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
            subjects: excel_constants_1.SUBJECT_CATALOG,
        };
    }
    async buildWorkbookBuffer(data) {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Codex';
        workbook.created = new Date();
        workbook.modified = new Date();
        this.buildGuideSheet(workbook);
        this.buildReferencesSheet(workbook);
        this.buildSubjectCatalogSheet(workbook, data.subjects);
        this.buildTeachersSheet(workbook, data.teachers);
        this.buildClassesSheet(workbook, data.classes);
        this.buildCombinationsSheet(workbook, data.combinations);
        this.buildAssignmentsSheet(workbook, data.assignments);
        this.buildTeacherSummarySheet(workbook, data.teacherSummaries);
        const rawBuffer = await workbook.xlsx.writeBuffer();
        return Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);
    }
    buildGuideSheet(workbook) {
        const worksheet = workbook.addWorksheet(excel_constants_1.WORKBOOK_SHEET_NAMES.guide, {
            views: [{ state: 'frozen', ySplit: 2 }],
        });
        worksheet.columns = [
            { header: 'Mục', key: 'section', width: 24 },
            { header: 'Nội dung', key: 'content', width: 100 },
        ];
        (0, excel_utils_1.applyTitleRow)(worksheet, 1, 'Hướng dẫn sử dụng workbook import phân công giảng dạy', 2);
        (0, excel_utils_1.applyHeaderRow)(worksheet.getRow(2));
        worksheet.addRows(excel_constants_1.GUIDE_ROWS);
        for (let rowNumber = 3; rowNumber <= worksheet.rowCount; rowNumber += 1) {
            (0, excel_utils_1.applyBodyRow)(worksheet.getRow(rowNumber));
        }
    }
    buildReferencesSheet(workbook) {
        const worksheet = workbook.addWorksheet(excel_constants_1.WORKBOOK_SHEET_NAMES.references, {
            views: [{ state: 'frozen', ySplit: 2 }],
        });
        worksheet.columns = [
            { header: 'Văn bản', key: 'document', width: 36 },
            { header: 'Nội dung', key: 'content', width: 100 },
        ];
        (0, excel_utils_1.applyTitleRow)(worksheet, 1, 'Nguồn tham khảo và căn cứ chuẩn hóa cấu trúc file', 2);
        (0, excel_utils_1.applyHeaderRow)(worksheet.getRow(2));
        worksheet.addRows(excel_constants_1.REFERENCE_ROWS);
        for (let rowNumber = 3; rowNumber <= worksheet.rowCount; rowNumber += 1) {
            (0, excel_utils_1.applyBodyRow)(worksheet.getRow(rowNumber));
        }
    }
    buildSubjectCatalogSheet(workbook, subjects) {
        const worksheet = workbook.addWorksheet(excel_constants_1.WORKBOOK_SHEET_NAMES.subjects, {
            views: [{ state: 'frozen', ySplit: 2 }],
        });
        worksheet.columns = [
            { header: 'Mã_môn', key: 'code', width: 18 },
            { header: 'Tên_môn', key: 'name', width: 32 },
            { header: 'Nhóm_CT', key: 'group', width: 24 },
            { header: 'Ghi_chú', key: 'note', width: 50 },
        ];
        (0, excel_utils_1.applyTitleRow)(worksheet, 1, 'Danh mục môn học chuẩn GDPT 2018', 4);
        (0, excel_utils_1.applyHeaderRow)(worksheet.getRow(2));
        subjects.forEach((subject) => {
            const row = worksheet.addRow({
                code: subject.code,
                name: subject.name,
                group: subject.group,
                note: subject.note ?? '',
            });
            (0, excel_utils_1.applyBodyRow)(row);
        });
    }
    buildTeachersSheet(workbook, teachers) {
        const worksheet = workbook.addWorksheet(excel_constants_1.WORKBOOK_SHEET_NAMES.teachers, {
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
            { header: 'Ghi_chú', key: 'notes', width: 36 },
        ];
        (0, excel_utils_1.applyTitleRow)(worksheet, 1, 'Danh mục giáo viên', 9);
        (0, excel_utils_1.applyHeaderRow)(worksheet.getRow(2));
        teachers.forEach((teacher) => {
            const row = worksheet.addRow(teacher);
            (0, excel_utils_1.applyBodyRow)(row);
        });
    }
    buildClassesSheet(workbook, classes) {
        const worksheet = workbook.addWorksheet(excel_constants_1.WORKBOOK_SHEET_NAMES.classes, {
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
        (0, excel_utils_1.applyTitleRow)(worksheet, 1, 'Danh mục lớp', 8);
        (0, excel_utils_1.applyHeaderRow)(worksheet.getRow(2));
        classes.forEach((item) => {
            const row = worksheet.addRow(item);
            (0, excel_utils_1.applyBodyRow)(row);
        });
    }
    buildCombinationsSheet(workbook, combinations) {
        const worksheet = workbook.addWorksheet(excel_constants_1.WORKBOOK_SHEET_NAMES.combinations, {
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
        (0, excel_utils_1.applyTitleRow)(worksheet, 1, 'Danh mục tổ hợp môn học', 10);
        (0, excel_utils_1.applyHeaderRow)(worksheet.getRow(2));
        combinations.forEach((item) => {
            const row = worksheet.addRow(item);
            (0, excel_utils_1.applyBodyRow)(row);
        });
    }
    buildAssignmentsSheet(workbook, assignments) {
        const worksheet = workbook.addWorksheet(excel_constants_1.WORKBOOK_SHEET_NAMES.assignments, {
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
        (0, excel_utils_1.applyTitleRow)(worksheet, 1, 'Bảng phân công giảng dạy theo năm học', 17);
        (0, excel_utils_1.applyHeaderRow)(worksheet.getRow(2));
        assignments.forEach((assignment) => {
            const row = worksheet.addRow(assignment);
            (0, excel_utils_1.applyBodyRow)(row);
        });
    }
    buildTeacherSummarySheet(workbook, rows) {
        const worksheet = workbook.addWorksheet(excel_constants_1.WORKBOOK_SHEET_NAMES.summary, {
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
        (0, excel_utils_1.applyTitleRow)(worksheet, 1, 'Tổng hợp tải giảng dạy theo giáo viên', 14);
        (0, excel_utils_1.applyHeaderRow)(worksheet.getRow(2));
        rows.forEach((item) => {
            const row = worksheet.addRow(item);
            (0, excel_utils_1.applyBodyRow)(row);
        });
    }
    parseTeachersSheet(worksheet, errors) {
        const config = this.resolveColumns(worksheet, excel_constants_1.HEADER_ALIASES.teachers, (columns) => Boolean(columns.code && columns.fullName), excel_constants_1.WORKBOOK_SHEET_NAMES.teachers, errors);
        if (!config)
            return [];
        const rows = [];
        for (let rowNumber = config.headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
            const row = worksheet.getRow(rowNumber);
            if (!this.rowHasValue(row, Object.values(config.columns)))
                continue;
            const code = this.readString(row, config.columns.code, true).toUpperCase();
            const fullName = this.readString(row, config.columns.fullName);
            if (!code || !fullName) {
                errors.push({
                    sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.teachers,
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
                notes: this.readString(row, config.columns.notes),
            });
        }
        return rows;
    }
    parseClassesSheet(worksheet, errors) {
        const config = this.resolveColumns(worksheet, excel_constants_1.HEADER_ALIASES.classes, (columns) => Boolean(columns.name), excel_constants_1.WORKBOOK_SHEET_NAMES.classes, errors);
        if (!config)
            return [];
        const rows = [];
        for (let rowNumber = config.headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
            const row = worksheet.getRow(rowNumber);
            if (!this.rowHasValue(row, Object.values(config.columns)))
                continue;
            const name = this.readString(row, config.columns.name);
            const gradeLevel = this.readInteger(row, config.columns.gradeLevel) ?? this.inferGradeLevel(name);
            const session = this.parseSessionLabel(this.readString(row, config.columns.session));
            if (!name || !gradeLevel || session === null) {
                errors.push({
                    sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.classes,
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
    parseCombinationsSheet(worksheet, errors) {
        const config = this.resolveColumns(worksheet, excel_constants_1.HEADER_ALIASES.combinations, (columns) => Boolean(columns.code && columns.gradeLevel), excel_constants_1.WORKBOOK_SHEET_NAMES.combinations, errors);
        if (!config)
            return [];
        const rows = [];
        for (let rowNumber = config.headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
            const row = worksheet.getRow(rowNumber);
            if (!this.rowHasValue(row, Object.values(config.columns)))
                continue;
            const code = this.readString(row, config.columns.code, true).toUpperCase();
            const gradeLevel = this.readInteger(row, config.columns.gradeLevel);
            if (!code || !gradeLevel) {
                errors.push({
                    sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.combinations,
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
    parseAssignmentsSheet(worksheet, errors, warnings) {
        const config = this.resolveColumns(worksheet, excel_constants_1.HEADER_ALIASES.assignments, (columns) => Boolean(columns.className && (columns.subjectCode || columns.subjectName) && columns.periodsHk1 && columns.periodsHk2), excel_constants_1.WORKBOOK_SHEET_NAMES.assignments, errors);
        if (!config)
            return [];
        const rows = [];
        for (let rowNumber = config.headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
            const row = worksheet.getRow(rowNumber);
            if (!this.rowHasValue(row, Object.values(config.columns)))
                continue;
            const className = this.readString(row, config.columns.className);
            const subjectCode = this.readString(row, config.columns.subjectCode, true).toUpperCase();
            const subjectName = this.readString(row, config.columns.subjectName);
            const periodsHk1 = this.readInteger(row, config.columns.periodsHk1) ?? 0;
            const periodsHk2 = this.readInteger(row, config.columns.periodsHk2) ?? 0;
            if (!className || (!subjectCode && !subjectName)) {
                errors.push({
                    sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.assignments,
                    row: rowNumber,
                    column: !className ? 'Lớp' : 'Mã_môn',
                    code: 'missing_assignment_field',
                    message: 'Dòng phân công thiếu lớp hoặc môn học.',
                });
                continue;
            }
            const gradeLevel = this.readInteger(row, config.columns.gradeLevel) ?? this.inferGradeLevel(className) ?? undefined;
            if (!gradeLevel) {
                warnings.push({
                    sheet: excel_constants_1.WORKBOOK_SHEET_NAMES.assignments,
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
    async getYearContext(academicYearId) {
        const year = await this.prisma.academicYear.findUnique({
            where: { id: academicYearId },
            include: {
                semesters: {
                    orderBy: { term_order: 'asc' },
                },
            },
        });
        if (!year) {
            throw new common_1.NotFoundException('Không tìm thấy năm học.');
        }
        const hk1 = year.semesters.find((semester) => semester.term_order === 1);
        const hk2 = year.semesters.find((semester) => semester.term_order === 2);
        if (!hk1 || !hk2 || year.semesters.length !== 2) {
            throw new common_1.BadRequestException('Năm học phải có đúng 2 học kỳ với term_order lần lượt là 1 và 2.');
        }
        return { year, hk1, hk2 };
    }
    async ensureSubjectCatalog(prismaClient = this.prisma) {
        for (let index = 0; index < excel_constants_1.SUBJECT_CATALOG.length; index += 1) {
            const subject = excel_constants_1.SUBJECT_CATALOG[index];
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
    async fetchTeacherMap(prismaClient, codes) {
        const teachers = await prismaClient.teacher.findMany({
            where: codes && codes.length > 0 ? { code: { in: codes } } : undefined,
            select: { id: true, code: true },
        });
        return new Map(teachers.map((teacher) => [teacher.code, teacher]));
    }
    async fetchClassMap(prismaClient) {
        const classes = await prismaClient.class.findMany({
            select: { id: true, name: true },
        });
        return new Map(classes.map((item) => [(0, excel_utils_1.normalizeKey)(item.name), item]));
    }
    findWorksheet(workbook, expectedName) {
        const normalizedExpected = (0, excel_utils_1.normalizeKey)(expectedName);
        for (const worksheet of workbook.worksheets) {
            const normalizedName = (0, excel_utils_1.normalizeKey)(worksheet.name);
            if (normalizedName === normalizedExpected)
                return worksheet;
            const aliases = excel_constants_1.SHEET_ALIASES[expectedName] ?? [];
            if (aliases.includes(normalizedName))
                return worksheet;
        }
        throw new common_1.BadRequestException({
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
    resolveColumns(worksheet, aliasMap, isValid, sheetName, errors) {
        let bestMatch = null;
        for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount, 10); rowNumber += 1) {
            const row = worksheet.getRow(rowNumber);
            const columns = {};
            row.eachCell((cell, colNumber) => {
                const normalized = (0, excel_utils_1.normalizeKey)((0, excel_utils_1.getCellText)(cell));
                if (!normalized)
                    return;
                Object.entries(aliasMap).forEach(([field, aliases]) => {
                    if (!columns[field] && aliases.includes(normalized)) {
                        columns[field] = colNumber;
                    }
                });
            });
            const score = Object.keys(columns).length;
            if (score === 0)
                continue;
            if (isValid(columns) && (!bestMatch || score > bestMatch.score)) {
                bestMatch = { headerRow: rowNumber, columns, score };
            }
        }
        if (!bestMatch) {
            errors.push({
                sheet: sheetName,
                row: 0,
                column: '',
                code: 'invalid_header',
                message: `Không tìm thấy hàng tiêu đề hợp lệ cho sheet ${sheetName}.`,
            });
            return null;
        }
        return { headerRow: bestMatch.headerRow, columns: bestMatch.columns };
    }
    resolveSubject(rawCode, rawName, subjectMap) {
        const subjectAliasMap = new Map();
        excel_constants_1.SUBJECT_CATALOG.forEach((item) => {
            subjectAliasMap.set((0, excel_utils_1.normalizeKey)(item.code), item.code);
            subjectAliasMap.set((0, excel_utils_1.normalizeKey)(item.name), item.code);
            item.aliases?.forEach((alias) => subjectAliasMap.set((0, excel_utils_1.normalizeKey)(alias), item.code));
        });
        subjectMap.forEach((item) => {
            subjectAliasMap.set((0, excel_utils_1.normalizeKey)(item.code), item.code);
            subjectAliasMap.set((0, excel_utils_1.normalizeKey)(item.name), item.code);
        });
        let forcedPeriodType = null;
        let candidateCode = (0, excel_utils_1.normalizeKey)(rawCode);
        if (candidateCode.startsWith('cd')) {
            candidateCode = candidateCode.replace(/^cd/, '');
            forcedPeriodType = client_1.PeriodType.SPECIAL;
        }
        let subjectCode = candidateCode ? subjectAliasMap.get(candidateCode) : undefined;
        if (!subjectCode && rawName) {
            const normalizedName = (0, excel_utils_1.normalizeKey)(rawName);
            if (normalizedName.startsWith('chuyende')) {
                const subjectPart = normalizedName.replace(/^chuyende/, '');
                subjectCode = subjectAliasMap.get(subjectPart);
                forcedPeriodType = client_1.PeriodType.SPECIAL;
            }
            else {
                subjectCode = subjectAliasMap.get(normalizedName);
            }
        }
        if (!subjectCode)
            return null;
        const subject = subjectMap.get(subjectCode);
        if (!subject)
            return null;
        const periodType = forcedPeriodType ??
            (subject.is_special
                ? client_1.PeriodType.SPECIAL
                : subject.is_practice
                    ? client_1.PeriodType.PRACTICE
                    : client_1.PeriodType.THEORY);
        return {
            subjectCode,
            subjectName: periodType === client_1.PeriodType.SPECIAL && !subject.is_special
                ? `Chuyên đề ${subject.name}`
                : subject.name,
            periodType,
        };
    }
    resolveProgramGroup(subjectCode, periodType) {
        if (periodType === client_1.PeriodType.SPECIAL) {
            const catalog = excel_constants_1.SUBJECT_CATALOG.find((item) => item.code === subjectCode);
            if (catalog?.isSpecial)
                return catalog.group;
            return 'Chuyên đề học tập';
        }
        return excel_constants_1.SUBJECT_CATALOG.find((item) => item.code === subjectCode)?.group ?? 'Khác';
    }
    buildTeacherMajorSubjectMap(assignments) {
        const scoreMap = new Map();
        assignments.forEach((assignment) => {
            const teacherEntry = scoreMap.get(assignment.teacher_id) ?? new Map();
            teacherEntry.set(assignment.subject.code, (teacherEntry.get(assignment.subject.code) ?? 0) + assignment.total_periods);
            scoreMap.set(assignment.teacher_id, teacherEntry);
        });
        const result = new Map();
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
    validateDuplicateCodes(rows, sheet, column, code, errors) {
        const seen = new Map();
        rows.forEach((row) => {
            const key = (0, excel_utils_1.normalizeKey)(row.value);
            if (!key)
                return;
            if (seen.has(key)) {
                errors.push({
                    sheet,
                    row: row.rowNumber,
                    column,
                    code,
                    message: `Giá trị ${row.value} bị lặp trong file import.`,
                });
            }
            else {
                seen.set(key, row.rowNumber);
            }
        });
    }
    rowHasValue(row, columns) {
        return columns.some((column) => Boolean(this.readString(row, column)));
    }
    readString(row, column, preserveCase = false) {
        if (!column)
            return '';
        const value = (0, excel_utils_1.getCellText)(row.getCell(column));
        return preserveCase ? value : value.trim();
    }
    readInteger(row, column) {
        if (!column)
            return null;
        const value = (0, excel_utils_1.getCellNumber)(row.getCell(column));
        return value === null ? null : Math.trunc(value);
    }
    inferGradeLevel(className) {
        if (!className)
            return null;
        const match = className.match(/\b(10|11|12)\b|^(10|11|12)/);
        const value = match?.[1] || match?.[2];
        return value ? Number(value) : null;
    }
    parseSessionLabel(value) {
        const normalized = (0, excel_utils_1.normalizeKey)(value);
        if (!normalized)
            return 0;
        if (['0', 'sang', 'buoisang', 'morning'].includes(normalized))
            return 0;
        if (['1', 'chieu', 'buoichieu', 'afternoon'].includes(normalized))
            return 1;
        return null;
    }
    normalizeSubjectEntry(value) {
        if (!value)
            return '';
        const normalized = (0, excel_utils_1.normalizeKey)(value);
        const match = excel_constants_1.SUBJECT_CATALOG.find((item) => (0, excel_utils_1.normalizeKey)(item.code) === normalized ||
            (0, excel_utils_1.normalizeKey)(item.name) === normalized ||
            item.aliases?.some((alias) => (0, excel_utils_1.normalizeKey)(alias) === normalized));
        return match?.code ?? value.toUpperCase();
    }
    normalizeSpecialTopicEntry(value) {
        if (!value)
            return '';
        const normalized = (0, excel_utils_1.normalizeKey)(value);
        if (normalized.startsWith('cd')) {
            const canonical = this.normalizeSubjectEntry(normalized.replace(/^cd/, ''));
            return canonical ? `CD_${canonical}` : value.toUpperCase();
        }
        const canonical = this.normalizeSubjectEntry(value);
        return canonical ? `CD_${canonical}` : value.toUpperCase();
    }
};
exports.ExcelService = ExcelService;
exports.ExcelService = ExcelService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExcelService);
//# sourceMappingURL=excel.service.js.map