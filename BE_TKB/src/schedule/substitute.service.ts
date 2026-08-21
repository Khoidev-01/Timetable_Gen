import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OverlayType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConstraintService } from '../algorithm/constraint.service';
import { CoverageMode } from './effective-schedule.service';

export interface SubstituteCandidate {
  teacherId: string;
  teacherName: string;
  code: string;
  sameDepartment: boolean;
  hasTaughtClass: boolean;
  weeklyLoad: number;
  quota: number;
  score: number;
  reason: string;
}

export interface UncoveredPeriod {
  slotId: string;
  period: number;
  className: string;
  subjectName: string;
  roomName?: string;
  candidates: SubstituteCandidate[];
}

/**
 * Works out who can cover for an absent teacher.
 *
 * At a Vietnamese secondary school this is a fifteen-minute problem handled by a deputy
 * head with a paper register and a phone: a teacher messages at 6:45 that they are ill
 * and the first period starts at 7:00. Nothing in the timetable software helps, so it
 * happens by hand several times a week at every school in the country.
 */
@Injectable()
export class SubstituteService {
  constructor(
    private prisma: PrismaService,
    private constraints: ConstraintService,
  ) {}

  private dayOfWeek(date: Date): number {
    const js = date.getDay();
    return js === 0 ? 8 : js + 1;
  }

  /** Everything the absent teacher was due to teach that day, with ranked stand-ins. */
  async planCoverage(semesterId: string, teacherId: string, dateInput: string): Promise<{
    teacherName: string;
    date: string;
    periods: UncoveredPeriod[];
  }> {
    const date = new Date(`${dateInput}T00:00:00`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Ngày không hợp lệ.');

    const day = this.dayOfWeek(date);
    const absent = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!absent) throw new NotFoundException('Không tìm thấy giáo viên.');

    const timetable = await this.prisma.generatedTimetable.findFirst({
      where: { semester_id: semesterId, is_official: true },
      include: {
        slots: { include: { class: true, subject: true, room: true } },
      },
    });
    if (!timetable) throw new BadRequestException('Chưa công bố thời khóa biểu chính thức.');

    await this.constraints.initialize(semesterId);

    const teachers = await this.prisma.teacher.findMany();
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { semester_id: semesterId },
      include: { subject: true },
    });

    const affected = timetable.slots.filter((s) => s.day === day && s.teacher_id === teacherId);
    const busyAt = (candidateId: string, period: number) =>
      timetable.slots.some((s) => s.day === day && s.period === period && s.teacher_id === candidateId);

    const weeklyLoad = new Map<string, number>();
    for (const slot of timetable.slots) {
      weeklyLoad.set(slot.teacher_id, (weeklyLoad.get(slot.teacher_id) ?? 0) + 1);
    }

    const periods: UncoveredPeriod[] = affected.map((slot) => {
      const candidates: SubstituteCandidate[] = [];

      for (const candidate of teachers) {
        if (candidate.id === teacherId) continue;
        if (busyAt(candidate.id, slot.period)) continue;
        if (this.constraints.isTeacherBusy(candidate.id, day, slot.period)) continue;

        // Someone already assigned this subject can actually teach the lesson
        const teachesSubject = assignments.some(
          (a) => a.teacher_id === candidate.id && a.subject_id === slot.subject_id,
        );
        const hasTaughtClass = assignments.some(
          (a) => a.teacher_id === candidate.id && a.class_id === slot.class_id,
        );
        const sameDepartment =
          !!candidate.department && candidate.department === absent.department;

        const load = weeklyLoad.get(candidate.id) ?? 0;
        const quota = candidate.max_periods_per_week || 17;

        // Prefer someone who knows the subject, then the class, then whoever has the
        // lightest week - a stand-in already at their quota is the worst choice.
        // Anyone else free is still offered, because a small school often has exactly
        // one Công nghệ teacher and the class still needs supervising.
        const score =
          (teachesSubject ? 100 : 0) +
          (hasTaughtClass ? 40 : 0) +
          (sameDepartment ? 20 : 0) +
          Math.max(0, quota - load) * 2;

        const reasons: string[] = [];
        if (teachesSubject) reasons.push('dạy đúng môn');
        else if (sameDepartment) reasons.push('cùng tổ, không dạy môn này');
        else reasons.push('chỉ trông lớp');
        if (hasTaughtClass) reasons.push('đã dạy lớp này');
        reasons.push(`tải ${load}/${quota}`);

        candidates.push({
          teacherId: candidate.id,
          teacherName: candidate.full_name,
          code: candidate.code,
          sameDepartment,
          hasTaughtClass,
          weeklyLoad: load,
          quota,
          score,
          reason: reasons.join(' · '),
        });
      }

      candidates.sort((a, b) => b.score - a.score);

      return {
        slotId: slot.id,
        period: slot.period,
        className: slot.class.name,
        subjectName: slot.subject.name,
        roomName: slot.room?.name ?? undefined,
        candidates: candidates.slice(0, 3),
      };
    });

    periods.sort((a, b) => a.period - b.period);
    return { teacherName: absent.full_name, date: dateInput, periods };
  }

  /**
   * Write the decision down as a dated overlay. The master timetable is untouched, so
   * the day after the absence everything returns to normal without anyone undoing it.
   */
  async recordAbsence(params: {
    semesterId: string;
    teacherId: string;
    date: string;
    reason?: string;
    coverage: Array<{ slotId: string; mode: CoverageMode; substituteTeacherId?: string }>;
    createdBy?: string;
  }) {
    const date = new Date(`${params.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Ngày không hợp lệ.');
    if (params.coverage.length === 0) throw new BadRequestException('Chưa chọn phương án cho tiết nào.');

    const teacher = await this.prisma.teacher.findUnique({ where: { id: params.teacherId } });
    if (!teacher) throw new NotFoundException('Không tìm thấy giáo viên.');

    const overlay = await this.prisma.scheduleOverlay.create({
      data: {
        semester_id: params.semesterId,
        type: OverlayType.ABSENCE,
        scope: 'TEACHER',
        scope_ref: params.teacherId,
        date_from: date,
        date_to: date,
        priority: 20,
        reason: params.reason ?? `${teacher.full_name} vắng`,
        created_by: params.createdBy,
        payload: {
          absentTeacherId: params.teacherId,
          coverage: params.coverage,
        } as any,
      },
    });

    const substitutes = params.coverage.filter((c) => c.mode === 'SUBSTITUTE').length;
    return {
      success: true,
      overlayId: overlay.id,
      covered: substitutes,
      total: params.coverage.length,
    };
  }

  /**
   * Substitute periods taught in a month, per teacher. Schools work this out by hand at
   * the end of every month to calculate the allowance.
   */
  async substituteReport(semesterId: string, month: string) {
    const [year, monthIndex] = month.split('-').map(Number);
    if (!year || !monthIndex) throw new BadRequestException('Tháng phải có dạng YYYY-MM.');

    const from = new Date(year, monthIndex - 1, 1);
    const to = new Date(year, monthIndex, 0);

    const overlays = await this.prisma.scheduleOverlay.findMany({
      where: {
        semester_id: semesterId,
        type: OverlayType.ABSENCE,
        date_from: { gte: from, lte: to },
      },
    });

    const teachers = await this.prisma.teacher.findMany();
    const names = new Map(teachers.map((t) => [t.id, { name: t.full_name, code: t.code }]));

    const tally = new Map<string, { periods: number; days: Set<string> }>();
    for (const overlay of overlays) {
      const payload = (overlay.payload ?? {}) as any;
      for (const item of payload.coverage ?? []) {
        if (item.mode !== 'SUBSTITUTE' || !item.substituteTeacherId) continue;

        if (!tally.has(item.substituteTeacherId)) {
          tally.set(item.substituteTeacherId, { periods: 0, days: new Set() });
        }
        const entry = tally.get(item.substituteTeacherId)!;
        entry.periods += 1;
        entry.days.add(overlay.date_from.toISOString().slice(0, 10));
      }
    }

    return {
      month,
      rows: [...tally.entries()]
        .map(([teacherId, entry]) => ({
          teacherId,
          code: names.get(teacherId)?.code ?? '',
          teacherName: names.get(teacherId)?.name ?? '',
          periods: entry.periods,
          days: entry.days.size,
        }))
        .sort((a, b) => b.periods - a.periods),
    };
  }
}
