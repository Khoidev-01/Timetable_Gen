import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubstituteService } from './substitute.service';

export interface LinkedAbsence {
  requestId: string;
  date: string;
  day: number;
  period: number;
  reason: string;
}

export interface LinkResult {
  teacherName: string;
  linked: LinkedAbsence[];
  /** Requests that could not be turned into a date, and why. */
  skipped: Array<{ requestId: string; reason: string }>;
  overlayIds: string[];
}

/**
 * Connects an approved leave request to the timetable people actually read.
 *
 * These were two systems that never spoke. A teacher registered leave for a given week, an
 * admin approved it, and nothing happened: the request lived in `teacher_busy_requests`,
 * which the solver never reads and the effective schedule never merges. Nobody was assigned
 * to cover, and the class turned up to an empty room.
 *
 * Turning it into a recurring `TeacherConstraint` would be wrong - that would block the slot
 * every week of the term for one day off. A dated absence belongs in the overlay layer,
 * which is exactly what it was built for.
 */
@Injectable()
export class AbsenceLinkService {
  private readonly logger = new Logger(AbsenceLinkService.name);

  constructor(
    private prisma: PrismaService,
    private substitutes: SubstituteService,
  ) {}

  /**
   * Which calendar date week N, day D of a semester falls on.
   *
   * `day_of_week` follows the Vietnamese convention where 2 is Monday and 7 is Saturday,
   * matching the timetable grid.
   */
  async dateOf(semesterId: string, weekNumber: number, dayOfWeek: number): Promise<Date> {
    const semester = await this.prisma.semester.findUnique({
      where: { id: semesterId },
      select: { start_date: true, name: true },
    });
    if (!semester) throw new NotFoundException('Không tìm thấy học kỳ.');
    if (!semester.start_date) {
      throw new BadRequestException(
        `Học kỳ "${semester.name}" chưa khai báo ngày bắt đầu, nên không quy được tuần ${weekNumber} ra ngày cụ thể.`,
      );
    }
    if (dayOfWeek < 2 || dayOfWeek > 7) {
      throw new BadRequestException('Thứ phải nằm trong khoảng 2 đến 7.');
    }

    // Anchor on the Monday of the semester's first week, so week 1 day 2 is that Monday
    // whatever weekday the start date happens to be.
    const start = new Date(semester.start_date);
    start.setHours(0, 0, 0, 0);
    const shiftToMonday = (start.getDay() + 6) % 7;
    const firstMonday = new Date(start);
    firstMonday.setDate(start.getDate() - shiftToMonday);

    const date = new Date(firstMonday);
    date.setDate(firstMonday.getDate() + (weekNumber - 1) * 7 + (dayOfWeek - 2));
    return date;
  }

  /** What an approved request would mean in the schedule, without changing anything. */
  async preview(requestId: string) {
    const request = await this.prisma.teacherBusyRequest.findUnique({
      where: { id: requestId },
      include: { teacher: true },
    });
    if (!request) throw new NotFoundException('Không tìm thấy đơn xin nghỉ.');

    const date = await this.dateOf(request.semester_id, request.week_number, request.day_of_week);
    const iso = this.toIsoDate(date);
    const plan = await this.substitutes.planCoverage(request.semester_id, request.teacher_id, iso);

    return {
      teacherName: request.teacher.full_name,
      date: iso,
      week: request.week_number,
      reason: request.reason,
      // Only the period this request is about, not the teacher's whole day
      periods: plan.periods.filter((p) => p.period === request.period),
    };
  }

  /**
   * Turn every approved request for one teacher and date into a single dated absence.
   *
   * Left unassigned on purpose: who covers a class is the deputy head's decision, and the
   * ranked candidates are a suggestion, not an answer. What this guarantees is that the
   * absence is visible in the effective schedule instead of silently doing nothing.
   */
  async linkApproved(params: {
    semesterId: string;
    teacherId: string;
    weekNumber: number;
    createdBy?: string;
  }): Promise<LinkResult> {
    const teacher = await this.prisma.teacher.findUnique({ where: { id: params.teacherId } });
    if (!teacher) throw new NotFoundException('Không tìm thấy giáo viên.');

    const requests = await this.prisma.teacherBusyRequest.findMany({
      where: {
        teacher_id: params.teacherId,
        semester_id: params.semesterId,
        week_number: params.weekNumber,
        status: 'APPROVED',
      },
      orderBy: [{ day_of_week: 'asc' }, { period: 'asc' }],
    });

    const linked: LinkedAbsence[] = [];
    const skipped: LinkResult['skipped'] = [];
    const byDate = new Map<string, typeof requests>();

    for (const request of requests) {
      try {
        const iso = this.toIsoDate(
          await this.dateOf(request.semester_id, request.week_number, request.day_of_week),
        );
        if (!byDate.has(iso)) byDate.set(iso, []);
        byDate.get(iso)!.push(request);
        linked.push({
          requestId: request.id,
          date: iso,
          day: request.day_of_week,
          period: request.period,
          reason: request.reason,
        });
      } catch (error: any) {
        skipped.push({ requestId: request.id, reason: error?.message ?? 'Không quy được ra ngày' });
      }
    }

    const overlayIds: string[] = [];
    for (const [iso, sameDay] of byDate) {
      const plan = await this.substitutes.planCoverage(params.semesterId, params.teacherId, iso);
      const wanted = new Set(sameDay.map((r) => r.period));
      const affected = plan.periods.filter((p) => wanted.has(p.period));

      if (affected.length === 0) {
        // The teacher has no class in that period, so there is nothing to cover
        this.logger.log(`${teacher.code} nghỉ ${iso} nhưng không có tiết nào cần bù.`);
        continue;
      }

      const result = await this.substitutes.recordAbsence({
        semesterId: params.semesterId,
        teacherId: params.teacherId,
        date: iso,
        reason: sameDay.map((r) => r.reason).filter(Boolean).join('; ') || `${teacher.full_name} vắng`,
        coverage: affected.map((p) => ({ slotId: p.slotId, mode: 'CANCELLED' as const })),
        createdBy: params.createdBy,
      });
      overlayIds.push(result.overlayId);
    }

    return { teacherName: teacher.full_name, linked, skipped, overlayIds };
  }

  private toIsoDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}
