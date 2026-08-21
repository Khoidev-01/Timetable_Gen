import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EffectiveScheduleService } from './effective-schedule.service';

/**
 * Bell times. A calendar entry without real clock times is useless on a phone, and these
 * are the standard periods at a Vietnamese secondary school: five in the morning, five in
 * the afternoon, with a longer break after the second and seventh.
 */
const BELL_TIMES: Record<number, [string, string]> = {
  1: ['07:00', '07:45'],
  2: ['07:50', '08:35'],
  3: ['08:45', '09:30'],
  4: ['09:35', '10:20'],
  5: ['10:25', '11:10'],
  6: ['13:30', '14:15'],
  7: ['14:20', '15:05'],
  8: ['15:15', '16:00'],
  9: ['16:05', '16:50'],
  10: ['16:55', '17:40'],
};

/**
 * Publishes a teacher's timetable as an iCalendar feed.
 *
 * Events are written out date by date rather than as a weekly recurrence, because a
 * recurring rule cannot express "on this Thursday someone else is covering". Expanding
 * them means the phone calendar shows the schedule that will actually happen.
 */
@Injectable()
export class IcalService {
  constructor(
    private prisma: PrismaService,
    private effective: EffectiveScheduleService,
  ) {}

  async forTeacher(publicToken: string, teacherCode: string): Promise<{ fileName: string; body: string }> {
    const timetable = await this.prisma.generatedTimetable.findUnique({
      where: { public_token: publicToken },
      select: { semester_id: true, name: true },
    });
    if (!timetable) throw new NotFoundException('Liên kết không hợp lệ.');

    const teacher = await this.prisma.teacher.findUnique({ where: { code: teacherCode } });
    if (!teacher) throw new NotFoundException('Không tìm thấy giáo viên.');

    const semester = await this.prisma.semester.findUnique({
      where: { id: timetable.semester_id },
      include: { academic_year: true },
    });
    if (!semester) throw new NotFoundException('Không tìm thấy học kỳ.');

    const { from, to } = this.termRange(semester);
    const events: string[] = [];

    for (let cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
      const day = cursor.getDay();
      if (day === 0) continue; // Sunday

      const iso = this.isoDate(cursor);
      const view = await this.effective.forDate(timetable.semester_id, iso, { teacherId: teacher.id });

      for (const period of view.periods) {
        const bell = BELL_TIMES[period.period];
        if (!bell) continue;

        const summary = `${period.subjectName} · ${period.className}`;
        const description = [
          period.roomName ? `Phòng ${period.roomName}` : null,
          period.change?.note,
        ]
          .filter(Boolean)
          .join(' — ');

        events.push(
          [
            'BEGIN:VEVENT',
            `UID:${period.slotId}-${iso}@tkb`,
            `DTSTAMP:${this.stamp(new Date())}`,
            `DTSTART:${this.localStamp(iso, bell[0])}`,
            `DTEND:${this.localStamp(iso, bell[1])}`,
            `SUMMARY:${this.escape(summary)}`,
            description ? `DESCRIPTION:${this.escape(description)}` : null,
            period.roomName ? `LOCATION:${this.escape(period.roomName)}` : null,
            'END:VEVENT',
          ]
            .filter(Boolean)
            .join('\r\n'),
        );
      }
    }

    const body = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TKB THPT//Lich giao vien//VI',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${this.escape(`TKB ${teacher.full_name}`)}`,
      'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');

    return { fileName: `tkb-${teacher.code}.ics`, body };
  }

  /** Term 1 takes the first half of the school year, term 2 the rest. */
  private termRange(semester: { term_order: number; academic_year: { start_date: Date; end_date: Date } }) {
    const start = new Date(semester.academic_year.start_date);
    const end = new Date(semester.academic_year.end_date);
    const middle = new Date((start.getTime() + end.getTime()) / 2);

    return semester.term_order === 1 ? { from: start, to: middle } : { from: middle, to: end };
  }

  private isoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /** Floating local time - the school and every teacher are in the same timezone. */
  private localStamp(isoDate: string, clock: string): string {
    return `${isoDate.replace(/-/g, '')}T${clock.replace(':', '')}00`;
  }

  private stamp(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  private escape(value: string): string {
    return value.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  }
}
