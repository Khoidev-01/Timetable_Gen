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
const ExcelJS = __importStar(require("exceljs"));
const prisma_service_1 = require("../prisma/prisma.service");
let ExcelService = class ExcelService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async readTeachers(buffer) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) {
            throw new common_1.BadRequestException('Worksheet not found');
        }
        const teachers = [];
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1)
                return;
            const code = row.getCell(1).text || '';
            const full_name = row.getCell(2).text || '';
            const email = row.getCell(3).text || null;
            const phone = row.getCell(4).text || null;
            if (code && full_name) {
                teachers.push({
                    code,
                    full_name,
                    email,
                    phone
                });
            }
        });
        try {
            const result = await this.prisma.teacher.createMany({
                data: teachers,
                skipDuplicates: true
            });
            return { importedWithSuccess: result.count, totalRows: teachers.length };
        }
        catch (error) {
            throw new common_1.BadRequestException('Import failed: ' + error.message);
        }
    }
    async readAssignments(buffer) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet)
            throw new common_1.BadRequestException('Worksheet not found');
        const assignments = [];
        const errors = [];
        const teachers = await this.prisma.teacher.findMany();
        const subjects = await this.prisma.subject.findMany();
        const classes = await this.prisma.class.findMany();
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1)
                return;
            const className = row.getCell(1).text?.trim();
            const subjectCode = row.getCell(2).text?.trim();
            const teacherCode = row.getCell(3).text?.trim();
            const totalPeriods = parseInt(String(row.getCell(4).value)) || 0;
            if (!className || !subjectCode || !teacherCode)
                return;
            const cls = classes.find(c => c.name === className);
            const sub = subjects.find(s => s.code === subjectCode);
            const tea = teachers.find(t => t.code === teacherCode);
            if (!cls) {
                errors.push(`Row ${rowNumber}: Class ${className} not found`);
                return;
            }
            if (!sub) {
                errors.push(`Row ${rowNumber}: Subject ${subjectCode} not found`);
                return;
            }
            if (!tea) {
                errors.push(`Row ${rowNumber}: Teacher ${teacherCode} not found`);
                return;
            }
            assignments.push({
                class_id: cls.id,
                subject_id: sub.id,
                teacher_id: tea.id,
                total_periods: totalPeriods,
                semester_id: 'TEMP_ID'
            });
        });
        return { count: 0, errors: ["Function needs refactor for Semester ID support"] };
    }
    async readComplexAssignment(buffer, semesterId) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet)
            throw new common_1.BadRequestException('Worksheet not found');
        const subjects = await this.prisma.subject.findMany();
        const classes = await this.prisma.class.findMany();
        let successCount = 0;
        const errors = [];
        const findClass = (name) => classes.find(c => c.name.toLowerCase() === name.toLowerCase());
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            const full_name = row.getCell(2).text?.trim();
            if (!full_name)
                continue;
            const teacherCode = row.getCell(3).text?.trim() || `GV_${Date.now()}_${i}`;
            const assignmentStr = row.getCell(6).text?.trim();
            let teacher = await this.prisma.teacher.findFirst({ where: { full_name: { equals: full_name, mode: 'insensitive' } } });
            if (!teacher) {
                teacher = await this.prisma.teacher.create({
                    data: {
                        code: teacherCode,
                        full_name: full_name,
                        max_periods_per_week: 20
                    }
                });
            }
            if (assignmentStr && semesterId) {
                await this.prisma.teachingAssignment.deleteMany({
                    where: {
                        teacher_id: teacher.id,
                        semester_id: semesterId
                    }
                });
                const groups = assignmentStr.split(/\.|\n/).map(s => s.trim()).filter(Boolean);
                for (const group of groups) {
                    let bestSub = null;
                    let bestLen = 0;
                    for (const s of subjects) {
                        if (group.toLowerCase().startsWith(s.name.toLowerCase()) && s.name.length > bestLen) {
                            bestSub = s;
                            bestLen = s.name.length;
                        }
                        else if (group.toLowerCase().startsWith(s.code.toLowerCase()) && s.code.length > bestLen) {
                            bestSub = s;
                            bestLen = s.code.length;
                        }
                    }
                    if (bestSub) {
                        const classPart = group.substring(bestLen).trim();
                        const potentialClasses = classPart.match(/\b\d+[A-Z]+\d*\b/g) || [];
                        for (const clsName of potentialClasses) {
                            const cls = findClass(clsName);
                            if (cls) {
                                await this.prisma.teachingAssignment.create({
                                    data: {
                                        teacher_id: teacher.id,
                                        subject_id: bestSub.id,
                                        class_id: cls.id,
                                        semester_id: semesterId,
                                        total_periods: 3
                                    }
                                });
                                successCount++;
                            }
                            else {
                                errors.push(`Row ${i}: Class '${clsName}' not found.`);
                            }
                        }
                    }
                    else {
                        errors.push(`Row ${i}: No subject found in '${group}'`);
                    }
                }
            }
        }
        return { successCount, errors };
    }
};
exports.ExcelService = ExcelService;
exports.ExcelService = ExcelService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExcelService);
//# sourceMappingURL=excel.service.js.map