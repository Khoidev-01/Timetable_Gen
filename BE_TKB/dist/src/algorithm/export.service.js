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
exports.ExportService = void 0;
const common_1 = require("@nestjs/common");
const ExcelJS = __importStar(require("exceljs"));
const prisma_service_1 = require("../prisma/prisma.service");
const excel_utils_1 = require("../excel/excel.utils");
let ExportService = class ExportService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async exportScheduleToExcel(semesterId) {
        const semester = await this.prisma.semester.findUnique({
            where: { id: semesterId },
            include: { academic_year: true },
        });
        if (!semester) {
            throw new common_1.NotFoundException('Không tìm thấy học kỳ cần xuất.');
        }
        const latestTimetable = await this.prisma.generatedTimetable.findFirst({
            where: { semester_id: semesterId },
            orderBy: { created_at: 'desc' },
            include: { slots: true },
        });
        if (!latestTimetable) {
            throw new common_1.NotFoundException('Chưa có dữ liệu thời khóa biểu cho học kỳ này.');
        }
        const [classes, subjects, teachers] = await Promise.all([
            this.prisma.class.findMany({ orderBy: { name: 'asc' } }),
            this.prisma.subject.findMany(),
            this.prisma.teacher.findMany(),
        ]);
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Codex';
        workbook.created = new Date();
        workbook.modified = new Date();
        const worksheet = workbook.addWorksheet('Thời khóa biểu', {
            views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }],
        });
        worksheet.columns = [
            { header: 'Thứ', key: 'day', width: 10 },
            { header: 'Buổi', key: 'session', width: 12 },
            { header: 'Tiết', key: 'period', width: 8 },
            ...classes.map((item) => ({ header: item.name, key: item.id, width: 24 })),
        ];
        (0, excel_utils_1.applyHeaderRow)(worksheet.getRow(1));
        const classMap = new Map(classes.map((item) => [item.id, item]));
        const subjectMap = new Map(subjects.map((item) => [item.id, item]));
        const teacherMap = new Map(teachers.map((item) => [item.id, item]));
        const slotMap = new Map();
        latestTimetable.slots.forEach((slot) => {
            const classInfo = classMap.get(slot.class_id);
            if (!classInfo)
                return;
            slotMap.set(`${slot.class_id}-${slot.day}-${classInfo.main_session}-${slot.period}`, slot);
        });
        const days = [2, 3, 4, 5, 6, 7];
        const sessions = [0, 1];
        const periods = [1, 2, 3, 4, 5];
        let rowIndex = 2;
        for (const day of days) {
            const dayStart = rowIndex;
            for (const session of sessions) {
                const sessionStart = rowIndex;
                for (const period of periods) {
                    const rowValues = {
                        day: `Thứ ${day}`,
                        session: session === 0 ? 'Sáng' : 'Chiều',
                        period,
                    };
                    classes.forEach((item) => {
                        const slot = slotMap.get(`${item.id}-${day}-${session}-${period}`);
                        if (!slot) {
                            rowValues[item.id] = '';
                            return;
                        }
                        const subject = subjectMap.get(slot.subject_id);
                        const teacher = teacherMap.get(slot.teacher_id);
                        const shortTeacher = teacher?.short_name || teacher?.full_name.split(' ').pop() || '';
                        rowValues[item.id] = shortTeacher
                            ? `${subject?.name ?? ''}\n(${shortTeacher})`
                            : `${subject?.name ?? ''}`;
                    });
                    const row = worksheet.addRow(rowValues);
                    row.height = 42;
                    row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    row.eachCell((cell) => {
                        cell.border = (0, excel_utils_1.thinBorder)();
                    });
                    rowIndex += 1;
                }
                worksheet.mergeCells(sessionStart, 2, rowIndex - 1, 2);
            }
            worksheet.mergeCells(dayStart, 1, rowIndex - 1, 1);
        }
        for (let currentRow = 2; currentRow < rowIndex; currentRow += 1) {
            worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getCell(`C${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        const rawBuffer = await workbook.xlsx.writeBuffer();
        const buffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);
        const fileName = `thoi-khoa-bieu-${semester.academic_year.name}-${semester.name}.xlsx`;
        return { buffer, fileName };
    }
};
exports.ExportService = ExportService;
exports.ExportService = ExportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExportService);
//# sourceMappingURL=export.service.js.map