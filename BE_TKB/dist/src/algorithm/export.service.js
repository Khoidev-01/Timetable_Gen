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
const prisma_service_1 = require("../prisma/prisma.service");
const ExcelJS = __importStar(require("exceljs"));
let ExportService = class ExportService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async exportScheduleToExcel(semesterId) {
        console.log(`[ExportService] Exporting for Semester: ${semesterId}`);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Thời Khóa Biểu Toàn Trường', {
            views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }]
        });
        const classes = await this.prisma.class.findMany({
            orderBy: { name: 'asc' }
        });
        console.log(`[ExportService] Found ${classes.length} classes.`);
        const subjects = await this.prisma.subject.findMany();
        const teachers = await this.prisma.teacher.findMany();
        const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
        const teacherMap = new Map(teachers.map(t => [t.id, t.full_name]));
        const classMap = new Map(classes.map(c => [c.id, c]));
        const latestTkb = await this.prisma.generatedTimetable.findFirst({
            where: { semester_id: semesterId },
            orderBy: { created_at: 'desc' },
            include: { slots: true }
        });
        if (!latestTkb) {
            console.error(`[ExportService] No TKB found for semester: ${semesterId}`);
            throw new common_1.NotFoundException("Chưa có dữ liệu thời khóa biểu cho học kỳ này");
        }
        console.log(`[ExportService] Found TKB ${latestTkb.id} with ${latestTkb.slots.length} slots.`);
        const scheduleData = latestTkb.slots;
        const slotMap = new Map();
        scheduleData.forEach(slot => {
            const cls = classMap.get(slot.class_id);
            if (cls) {
                const session = cls.main_session;
                slotMap.set(`${slot.class_id}-${slot.day}-${session}-${slot.period}`, slot);
            }
        });
        const columns = [
            { header: 'Thứ', key: 'thu', width: 8 },
            { header: 'Buổi', key: 'buoi', width: 10 },
            { header: 'Tiết', key: 'tiet', width: 5 },
            ...classes.map(c => ({ header: c.name, key: c.id, width: 25 }))
        ];
        sheet.columns = columns;
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 30;
        const days = [2, 3, 4, 5, 6, 7];
        const sessions = [0, 1];
        const periods = [1, 2, 3, 4, 5];
        let rowIndex = 2;
        for (const day of days) {
            let firstRowOfDay = rowIndex;
            for (const session of sessions) {
                let firstRowOfSession = rowIndex;
                const sessionName = session === 0 ? 'Sáng' : 'Chiều';
                for (const period of periods) {
                    const rowValues = {
                        thu: `Thứ ${day}`,
                        buoi: sessionName,
                        tiet: period
                    };
                    classes.forEach(cls => {
                        const slot = slotMap.get(`${cls.id}-${day}-${session}-${period}`);
                        if (slot) {
                            const subjectName = subjectMap.get(slot.subject_id) || slot.subject_id + '';
                            const teacherName = slot.teacher_id ? (teacherMap.get(slot.teacher_id) || '') : '';
                            const teacherInitial = (teacherName || '').split(' ').pop() || '';
                            rowValues[cls.id] = `${subjectName}\n(T.${teacherInitial})`;
                        }
                        else {
                            rowValues[cls.id] = '';
                        }
                    });
                    const row = sheet.addRow(rowValues);
                    row.height = 40;
                    row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    classes.forEach(cls => {
                        const cell = row.getCell(cls.id);
                        if (cell.value) {
                            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        }
                        else {
                            cell.border = { top: { style: 'dotted' }, left: { style: 'dotted' }, bottom: { style: 'dotted' }, right: { style: 'dotted' } };
                        }
                    });
                    rowIndex++;
                }
                sheet.mergeCells(firstRowOfSession, 2, rowIndex - 1, 2);
            }
            sheet.mergeCells(firstRowOfDay, 1, rowIndex - 1, 1);
        }
        for (let r = 2; r < rowIndex; r++) {
            sheet.getCell(`A${r}`).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            sheet.getCell(`B${r}`).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            sheet.getCell(`C${r}`).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            sheet.getCell(`A${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
            sheet.getCell(`B${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
            sheet.getCell(`C${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
        }
        console.log(`[ExportService] Writing buffer...`);
        const buffer = await workbook.xlsx.writeBuffer();
        console.log(`[ExportService] Done. Buffer size: ${buffer.byteLength}`);
        return buffer;
    }
};
exports.ExportService = ExportService;
exports.ExportService = ExportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExportService);
//# sourceMappingURL=export.service.js.map