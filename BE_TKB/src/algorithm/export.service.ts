import { Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { applyHeaderRow, thinBorder } from '../excel/excel.utils';

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportScheduleToExcel(
    semesterId: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const semester = await this.prisma.semester.findUnique({
      where: { id: semesterId },
      include: { academic_year: true },
    });

    if (!semester) {
      throw new NotFoundException('Không tìm thấy học kỳ cần xuất.');
    }

    const latestTimetable = await this.prisma.generatedTimetable.findFirst({
      where: { semester_id: semesterId },
      orderBy: { created_at: 'desc' },
      include: { slots: true },
    });

    if (!latestTimetable) {
      throw new NotFoundException('Chưa có dữ liệu thời khóa biểu cho học kỳ này.');
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
    applyHeaderRow(worksheet.getRow(1));

    const classMap = new Map(classes.map((item) => [item.id, item]));
    const subjectMap = new Map(subjects.map((item) => [item.id, item]));
    const teacherMap = new Map(teachers.map((item) => [item.id, item]));
    const slotMap = new Map<string, (typeof latestTimetable.slots)[number]>();

    latestTimetable.slots.forEach((slot) => {
      const classInfo = classMap.get(slot.class_id);
      if (!classInfo) return;
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
          const rowValues: Record<string, string | number> = {
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
            cell.border = thinBorder();
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
}
