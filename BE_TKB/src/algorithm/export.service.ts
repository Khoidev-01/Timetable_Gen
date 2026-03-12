
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExportService {
    constructor(private prisma: PrismaService) { }

    async exportScheduleToExcel(semesterId: string): Promise<Buffer> {
        console.log(`[ExportService] Exporting for Semester: ${semesterId}`);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Thời Khóa Biểu Toàn Trường', {
            views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }]
        });

        // 1. Fetch Metadata
        // Fetch Classes directly (assuming one active year or fetching all, 
        // ideally should filter by grade or existence in assignments, but ALL is safer for reference)
        const classes = await this.prisma.class.findMany({
            orderBy: { name: 'asc' }
        });
        console.log(`[ExportService] Found ${classes.length} classes.`);

        // Fetch Subjects and Teachers for lookup
        const subjects = await this.prisma.subject.findMany();
        const teachers = await this.prisma.teacher.findMany();

        const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
        const teacherMap = new Map(teachers.map(t => [t.id, t.full_name]));
        const classMap = new Map(classes.map(c => [c.id, c]));

        // 2. Fetch Schedule Data
        const latestTkb = await this.prisma.generatedTimetable.findFirst({
            where: { semester_id: semesterId },
            orderBy: { created_at: 'desc' },
            include: { slots: true }
        });

        if (!latestTkb) {
            console.error(`[ExportService] No TKB found for semester: ${semesterId}`);
            throw new NotFoundException("Chưa có dữ liệu thời khóa biểu cho học kỳ này");
        }

        console.log(`[ExportService] Found TKB ${latestTkb.id} with ${latestTkb.slots.length} slots.`);

        const scheduleData = latestTkb.slots;

        // Map: Key = `classId-day-session-period` -> Slot Data
        // NOTE: Schema has `period` (1-5). we need to deduce session from Class.
        const slotMap = new Map<string, any>();
        scheduleData.forEach(slot => {
            const cls = classMap.get(slot.class_id);
            if (cls) {
                // Session: 0 (Morning) or 1 (Afternoon)
                const session = cls.main_session;
                slotMap.set(`${slot.class_id}-${slot.day}-${session}-${slot.period}`, slot);
            }
        });

        // 3. Define Columns
        const columns = [
            { header: 'Thứ', key: 'thu', width: 8 },
            { header: 'Buổi', key: 'buoi', width: 10 },
            { header: 'Tiết', key: 'tiet', width: 5 },
            ...classes.map(c => ({ header: c.name, key: c.id, width: 25 }))
        ];
        sheet.columns = columns as any;

        // Style Header
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo-600
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 30;

        // 4. Build Rows
        const days = [2, 3, 4, 5, 6, 7];
        const sessions = [0, 1]; // 0: Morning, 1: Afternoon
        const periods = [1, 2, 3, 4, 5];

        let rowIndex = 2; // Start from row 2

        for (const day of days) {
            let firstRowOfDay = rowIndex;

            for (const session of sessions) {
                let firstRowOfSession = rowIndex;
                const sessionName = session === 0 ? 'Sáng' : 'Chiều';

                for (const period of periods) {
                    const rowValues: any = {
                        thu: `Thứ ${day}`,
                        buoi: sessionName,
                        tiet: period
                    };

                    // Fill Class Columns
                    classes.forEach(cls => {
                        // Only check if logic matches class session?
                        // Usually classes only study in their main session.

                        const slot = slotMap.get(`${cls.id}-${day}-${session}-${period}`);
                        if (slot) {
                            const subjectName = subjectMap.get(slot.subject_id) || slot.subject_id + '';
                            const teacherName = slot.teacher_id ? (teacherMap.get(slot.teacher_id) || '') : '';
                            const teacherInitial = (teacherName || '').split(' ').pop() || '';

                            // Format: "Toán\n(T.Hùng)"
                            rowValues[cls.id] = `${subjectName}\n(T.${teacherInitial})`;
                        } else {
                            rowValues[cls.id] = '';
                        }
                    });

                    const row = sheet.addRow(rowValues);
                    row.height = 40; // Taller for multi-line text
                    row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

                    // Style cells if occupied
                    classes.forEach(cls => {
                        const cell = row.getCell(cls.id);
                        if (cell.value) {
                            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        } else {
                            cell.border = { top: { style: 'dotted' }, left: { style: 'dotted' }, bottom: { style: 'dotted' }, right: { style: 'dotted' } };
                        }
                    });

                    rowIndex++;
                }

                // Merge Session Cells
                sheet.mergeCells(firstRowOfSession, 2, rowIndex - 1, 2); // Merge Column B (Buổi)
            }

            // Merge Day Cells
            sheet.mergeCells(firstRowOfDay, 1, rowIndex - 1, 1); // Merge Column A (Thứ)
        }

        // Border for Day/Session/Period columns
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
        return buffer as unknown as Buffer;
    }
}
