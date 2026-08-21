import { Injectable, NotFoundException } from '@nestjs/common';
import { OverlayType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CoverageMode = 'SUBSTITUTE' | 'MERGED' | 'SELF_STUDY' | 'CANCELLED';

export interface EffectivePeriod {
  slotId: string;
  day: number;
  period: number;
  className: string;
  subjectName: string;
  subjectCode: string;
  teacherId: string;
  teacherName: string;
  roomName?: string;
  /** Set when an overlay changed this period on this date. */
  change?: {
    type: OverlayType;
    mode?: CoverageMode;
    note: string;
    originalTeacherName?: string;
  };
}

export interface EffectiveDay {
  date: string;
  dayOfWeek: number;
  isSchoolDay: boolean;
  notes: string[];
  periods: EffectivePeriod[];
}

/**
 * The timetable a school actually runs on a given date.
 *
 * The generated schedule is the master plan; overlays are the dated corrections laid on
 * top - a holiday, a teacher off sick, an exam week. Resolving them here means the master
 * plan is never edited, so an absence next Tuesday cannot quietly damage the rest of the
 * term, and it repairs itself the day after.
 */
@Injectable()
export class EffectiveScheduleService {
  constructor(private prisma: PrismaService) {}

  /** Vietnamese convention: Monday is "Thứ 2" = 2 ... Saturday = 7. Sunday has no school. */
  private dayOfWeek(date: Date): number {
    const js = date.getDay();
    return js === 0 ? 8 : js + 1;
  }

  async forDate(semesterId: string, dateInput: string, filter?: { teacherId?: string; classId?: string }): Promise<EffectiveDay> {
    const date = new Date(`${dateInput}T00:00:00`);
    if (Number.isNaN(date.getTime())) throw new NotFoundException('Ngày không hợp lệ.');

    const dayOfWeek = this.dayOfWeek(date);
    const notes: string[] = [];

    if (dayOfWeek === 8) {
      return { date: dateInput, dayOfWeek, isSchoolDay: false, notes: ['Chủ nhật - không có lịch học'], periods: [] };
    }

    // Every period of the day is loaded, not just the ones matching the filter: an
    // overlay can hand a period to a different teacher, so who teaches what is only
    // known after the overlays have been applied
    const timetable = await this.prisma.generatedTimetable.findFirst({
      // publish() clears the flag on the others in one transaction, but nothing at the
      // database level enforces that only one row carries it. Without an ordering,
      // findFirst returns an arbitrary row, so a stray write leaves the whole app
      // reading a different timetable from the one the school published.
      where: { semester_id: semesterId, is_official: true },
      orderBy: { created_at: 'desc' },
      include: {
        slots: {
          where: { day: dayOfWeek },
          include: { class: true, subject: true, teacher: true, room: true },
        },
      },
    });

    if (!timetable) {
      return {
        date: dateInput,
        dayOfWeek,
        isSchoolDay: true,
        notes: ['Chưa công bố thời khóa biểu chính thức cho học kỳ này'],
        periods: [],
      };
    }

    const overlays = await this.prisma.scheduleOverlay.findMany({
      where: {
        semester_id: semesterId,
        date_from: { lte: date },
        date_to: { gte: date },
      },
      orderBy: { priority: 'asc' },
    });

    const teacherNames = new Map(
      (await this.prisma.teacher.findMany({ select: { id: true, full_name: true } })).map((t) => [t.id, t.full_name]),
    );

    let periods: EffectivePeriod[] = timetable.slots
      .map((slot) => ({
        slotId: slot.id,
        day: slot.day,
        period: slot.period,
        className: slot.class.name,
        subjectName: slot.subject.name,
        subjectCode: slot.subject.code,
        teacherId: slot.teacher_id,
        teacherName: slot.teacher?.full_name ?? '',
        roomName: slot.room?.name,
      }));

    // Lower priority first, so a later overlay can override an earlier decision
    for (const overlay of overlays) {
      const payload = (overlay.payload ?? {}) as any;

      if (overlay.type === OverlayType.HOLIDAY) {
        if (this.appliesToWholeDay(overlay, periods)) {
          notes.push(overlay.reason ?? 'Nghỉ lễ');
          periods = [];
          continue;
        }
      }

      if (overlay.type === OverlayType.ABSENCE) {
        const coverage: Array<{ slotId: string; mode: CoverageMode; substituteTeacherId?: string }> =
          payload.coverage ?? [];

        for (const item of coverage) {
          const index = periods.findIndex((p) => p.slotId === item.slotId);
          if (index === -1) continue;

          const period = periods[index];
          const originalTeacherName = period.teacherName;

          if (item.mode === 'CANCELLED') {
            periods.splice(index, 1);
            notes.push(`${period.className} tiết ${period.period}: nghỉ (${overlay.reason ?? 'giáo viên vắng'})`);
            continue;
          }

          if (item.mode === 'SUBSTITUTE' && item.substituteTeacherId) {
            period.teacherId = item.substituteTeacherId;
            period.teacherName = teacherNames.get(item.substituteTeacherId) ?? '';
          }

          period.change = {
            type: overlay.type,
            mode: item.mode,
            originalTeacherName,
            note:
              item.mode === 'SUBSTITUTE'
                ? `Dạy thay cho ${originalTeacherName}`
                : item.mode === 'MERGED'
                  ? 'Ghép lớp'
                  : 'Học sinh tự học có giám thị',
          };
        }

        if (coverage.length > 0) notes.push(overlay.reason ?? 'Có tiết dạy thay');
      }
    }

    // Filter last. Asking for a teacher's day means the periods they will actually
    // teach - a covered absence belongs in the stand-in's day, not theirs.
    if (filter?.teacherId) periods = periods.filter((p) => p.teacherId === filter.teacherId);
    if (filter?.classId) {
      const classIds = new Map(timetable.slots.map((s) => [s.id, s.class_id]));
      periods = periods.filter((p) => classIds.get(p.slotId) === filter.classId);
    }

    periods.sort((a, b) => a.period - b.period);
    return { date: dateInput, dayOfWeek, isSchoolDay: true, notes, periods };
  }

  private appliesToWholeDay(overlay: { scope: string; scope_ref: string | null }, periods: EffectivePeriod[]): boolean {
    if (overlay.scope === 'SCHOOL') return true;
    if (overlay.scope === 'CLASS' && overlay.scope_ref) {
      return periods.some((p) => p.className === overlay.scope_ref);
    }
    return false;
  }

  /**
   * The same day view, reached by an unguessable token instead of a login. This is what
   * the QR code on the staff noticeboard points at.
   */
  async byPublicToken(token: string, dateInput: string, filter?: { className?: string; teacherName?: string }) {
    const timetable = await this.prisma.generatedTimetable.findUnique({
      where: { public_token: token },
      select: { semester_id: true, is_official: true, name: true },
    });
    if (!timetable) throw new NotFoundException('Liên kết không hợp lệ hoặc đã bị thu hồi.');

    const day = await this.forDate(timetable.semester_id, dateInput);

    // Filtering happens by name here: a public visitor has no ids and no account
    const periods = day.periods.filter((p) => {
      if (filter?.className && p.className !== filter.className) return false;
      if (filter?.teacherName && p.teacherName !== filter.teacherName) return false;
      return true;
    });

    const classNames = [...new Set(day.periods.map((p) => p.className))].sort();
    const teacherNames = [...new Set(day.periods.map((p) => p.teacherName))].sort();

    return { ...day, periods, timetableName: timetable.name, classNames, teacherNames };
  }

  async listOverlays(semesterId: string) {
    return this.prisma.scheduleOverlay.findMany({
      where: { semester_id: semesterId },
      orderBy: { date_from: 'desc' },
      take: 50,
    });
  }

  async removeOverlay(id: string) {
    await this.prisma.scheduleOverlay.delete({ where: { id } });
    return { success: true };
  }
}
