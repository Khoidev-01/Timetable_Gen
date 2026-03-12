
import { Injectable, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExcelService {
    constructor(private prisma: PrismaService) { }

    async readTeachers(buffer: any) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);

        if (!worksheet) {
            throw new BadRequestException('Worksheet not found');
        }

        const teachers: Prisma.TeacherCreateManyInput[] = [];
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

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
        } catch (error) {
            throw new BadRequestException('Import failed: ' + (error as Error).message);
        }
    }

    async readAssignments(buffer: any) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) throw new BadRequestException('Worksheet not found');

        const assignments: Prisma.TeachingAssignmentCreateManyInput[] = [];
        const errors: string[] = [];

        const teachers = await this.prisma.teacher.findMany();
        const subjects = await this.prisma.subject.findMany();
        const classes = await this.prisma.class.findMany();

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const className = row.getCell(1).text?.trim();
            const subjectCode = row.getCell(2).text?.trim();
            const teacherCode = row.getCell(3).text?.trim();
            const totalPeriods = parseInt(String(row.getCell(4).value)) || 0;

            if (!className || !subjectCode || !teacherCode) return;

            const cls = classes.find(c => c.name === className);
            const sub = subjects.find(s => s.code === subjectCode);
            const tea = teachers.find(t => t.code === teacherCode);

            if (!cls) { errors.push(`Row ${rowNumber}: Class ${className} not found`); return; }
            if (!sub) { errors.push(`Row ${rowNumber}: Subject ${subjectCode} not found`); return; }
            if (!tea) { errors.push(`Row ${rowNumber}: Teacher ${teacherCode} not found`); return; }

            assignments.push({
                class_id: cls.id,
                subject_id: sub.id,
                teacher_id: tea.id,
                total_periods: totalPeriods,
                semester_id: 'TEMP_ID' // Need external semester ID in real usage
            });
        });

        // Note: semester_id is required. This function signature might need update or we skip simpler import for now.
        // Assuming this simple import is not used heavily or will be refactored.
        // For now, returning warning if no semester_id provided (which it isn't in original code either).

        return { count: 0, errors: ["Function needs refactor for Semester ID support"] };
    }

    async readComplexAssignment(buffer: any, semesterId?: string) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) throw new BadRequestException('Worksheet not found');

        const subjects = await this.prisma.subject.findMany();
        const classes = await this.prisma.class.findMany();

        let successCount = 0;
        const errors: string[] = [];

        const findClass = (name: string) => classes.find(c => c.name.toLowerCase() === name.toLowerCase());

        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            const full_name = row.getCell(2).text?.trim(); // Col 2: Full Name
            if (!full_name) continue;

            const teacherCode = row.getCell(3).text?.trim() || `GV_${Date.now()}_${i}`;
            const assignmentStr = row.getCell(6).text?.trim(); // "Toán 10A..."

            // 1. Upsert Teacher
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

            // 2. Constraints (Skipped for now)

            // 3. Assignments
            if (assignmentStr && semesterId) {
                // Clear old assignments for this teacher in this semester
                await this.prisma.teachingAssignment.deleteMany({
                    where: {
                        teacher_id: teacher.id,
                        semester_id: semesterId
                    }
                });

                const groups = assignmentStr.split(/\.|\n/).map(s => s.trim()).filter(Boolean);

                for (const group of groups) {
                    let bestSub: any = null;
                    let bestLen = 0;

                    for (const s of subjects) {
                        if (group.toLowerCase().startsWith(s.name.toLowerCase()) && s.name.length > bestLen) {
                            bestSub = s;
                            bestLen = s.name.length;
                        } else if (group.toLowerCase().startsWith(s.code.toLowerCase()) && s.code.length > bestLen) {
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
                                        total_periods: 3 // Default
                                    }
                                });
                                successCount++;
                            } else {
                                errors.push(`Row ${i}: Class '${clsName}' not found.`);
                            }
                        }
                    } else {
                        errors.push(`Row ${i}: No subject found in '${group}'`);
                    }
                }
            }
        }

        return { successCount, errors };
    }
}
