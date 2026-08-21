import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConstraintService, TimeSlot } from './constraint.service';

export interface DashboardStats {
  counts: { teachers: number; classes: number; subjects: number; rooms: number };
  timetable: {
    exists: boolean;
    isOfficial: boolean;
    score: number | null;
    hardViolations: number;
    slotCount: number;
    generatedAt: Date | null;
  };
  /** Periods taught per (day, period) across the whole school - the busy hours. */
  heatmap: Array<{ day: number; period: number; count: number }>;
  workload: Array<{
    code: string;
    name: string;
    /** Teaching periods only - ceremonies are excluded, as in the solver's quota rule. */
    assigned: number;
    ceremonies: number;
    quota: number;
    daysAtSchool: number;
    overQuota: boolean;
  }>;
  rooms: Array<{ name: string; type: string; used: number; capacityPeriods: number; rate: number }>;
  warnings: string[];
}

const DAYS = [2, 3, 4, 5, 6, 7];
const PERIODS_PER_DAY = 10;

/**
 * Real numbers for the dashboard.
 *
 * The overview screen showed four hardcoded figures - 45 teachers, 24 classes - which are
 * worse than no dashboard at all: they look authoritative and are never right.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private constraints: ConstraintService,
  ) {}

  async dashboard(semesterId: string): Promise<DashboardStats> {
    const [teachers, classes, subjects, rooms, ceremonies] = await Promise.all([
      this.prisma.teacher.findMany(),
      this.prisma.class.count(),
      this.prisma.subject.count(),
      this.prisma.room.findMany(),
      this.prisma.subject.findMany({ where: { is_special: true }, select: { id: true } }),
    ]);

    // Chào cờ and sinh hoạt are homeroom duties paid through workload_reduction, so the
    // solver leaves them out of the weekly quota. Counting them here would contradict it
    // and flag teachers as over quota on a timetable the solver calls valid.
    const ceremonySubjects = new Set(ceremonies.map((subject) => subject.id));

    const timetable =
      (await this.prisma.generatedTimetable.findFirst({
        // publish() clears the flag on the others in one transaction, but nothing at the
        // database level enforces that only one row carries it. Without an ordering,
        // findFirst returns an arbitrary row, so a stray write leaves the whole app
        // reading a different timetable from the one the school published.
        where: { semester_id: semesterId, is_official: true },
        orderBy: { created_at: 'desc' },
        include: { slots: true },
      })) ??
      (await this.prisma.generatedTimetable.findFirst({
        where: { semester_id: semesterId },
        orderBy: { created_at: 'desc' },
        include: { slots: true },
      }));

    const counts = { teachers: teachers.length, classes, subjects, rooms: rooms.length };
    const warnings: string[] = [];

    if (!timetable) {
      return {
        counts,
        timetable: {
          exists: false,
          isOfficial: false,
          score: null,
          hardViolations: 0,
          slotCount: 0,
          generatedAt: null,
        },
        heatmap: [],
        workload: [],
        rooms: [],
        warnings: ['Chưa có thời khóa biểu nào cho học kỳ này'],
      };
    }

    await this.constraints.initialize(semesterId);
    const slots: TimeSlot[] = timetable.slots.map((s) => ({
      id: s.id,
      day: s.day,
      period: s.period,
      classId: s.class_id,
      subjectId: s.subject_id,
      teacherId: s.teacher_id,
      roomId: s.room_id ?? undefined,
    }));

    const fitness = this.constraints.getFitnessDetails(slots);
    if (!fitness.isValid) warnings.push(`Thời khóa biểu còn ${fitness.hardViolations} lỗi cứng`);
    if (!timetable.is_official) {
      warnings.push('Thời khóa biểu chưa được công bố — giáo viên chưa nhìn thấy');
    }

    const cellCounts = new Map<string, number>();
    for (const slot of slots) {
      const key = `${slot.day}-${slot.period}`;
      cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
    }

    const heatmap = DAYS.flatMap((day) =>
      Array.from({ length: PERIODS_PER_DAY }, (_, index) => ({
        day,
        period: index + 1,
        count: cellCounts.get(`${day}-${index + 1}`) ?? 0,
      })),
    );

    const byTeacher = new Map<string, TimeSlot[]>();
    for (const slot of slots) {
      if (!byTeacher.has(slot.teacherId)) byTeacher.set(slot.teacherId, []);
      byTeacher.get(slot.teacherId)!.push(slot);
    }

    const workload = teachers
      .map((teacher) => {
        const own = byTeacher.get(teacher.id) ?? [];
        const teaching = own.filter((slot) => !ceremonySubjects.has(slot.subjectId));
        const quota = teacher.max_periods_per_week || 17;
        const overQuota = teaching.length > quota;

        if (overQuota) {
          warnings.push(
            `${teacher.code} — ${teacher.full_name}: ${teaching.length}/${quota} tiết, vượt định mức`,
          );
        }

        return {
          code: teacher.code,
          name: teacher.full_name,
          assigned: teaching.length,
          ceremonies: own.length - teaching.length,
          quota,
          daysAtSchool: new Set(own.map((s) => s.day)).size,
          overQuota,
        };
      })
      .sort((a, b) => b.assigned - a.assigned);

    // A room could host one class in every period of the teaching week
    const usable = DAYS.length * PERIODS_PER_DAY;
    const roomUse = new Map<number, number>();
    for (const slot of timetable.slots) {
      if (!slot.room_id) continue;
      roomUse.set(slot.room_id, (roomUse.get(slot.room_id) ?? 0) + 1);
    }

    const roomStats = rooms
      .map((room) => {
        const used = roomUse.get(room.id) ?? 0;
        return {
          name: room.name,
          type: room.type,
          used,
          capacityPeriods: usable,
          rate: Math.round((used / usable) * 100),
        };
      })
      .filter((room) => room.used > 0)
      .sort((a, b) => b.rate - a.rate);

    return {
      counts,
      timetable: {
        exists: true,
        isOfficial: timetable.is_official,
        score: fitness.score,
        hardViolations: fitness.hardViolations,
        slotCount: slots.length,
        generatedAt: timetable.created_at,
      },
      heatmap,
      workload,
      rooms: roomStats,
      warnings,
    };
  }
}
