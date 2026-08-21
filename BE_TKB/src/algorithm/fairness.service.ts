import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConstraintService, TimeSlot } from './constraint.service';

export interface TeacherQuality {
  teacherId: string;
  code: string;
  name: string;
  /** 0-100, where 100 is the best schedule this teacher's load could give them. */
  quality: number;
  periods: number;
  /** Null when this teacher registered no wishes at all. */
  preferencesMet: number | null;
  /** The things that cost this teacher points, worst first. */
  burdens: Array<{ label: string; count: number; cost: number }>;
}

export interface FairnessReport {
  gini: number;
  /** Points on the Lorenz curve, from (0,0) to (1,1). */
  lorenz: Array<{ population: number; quality: number }>;
  teachers: TeacherQuality[];
  worstOff: Array<{
    teacherId: string;
    name: string;
    quality: number;
    biggestBurden: string;
    suggestion: string;
  }>;
  summary: {
    best: number;
    worst: number;
    median: number;
    spread: number;
  };
}

/** What each burden costs a teacher, in quality points per occurrence. */
const BURDEN_COST = {
  gap: 6,
  extraSession: 5,
  sixDayWeek: 12,
  lastPeriod: 3,
  floorChange: 2,
  longRun: 4,
  /** Per wish the timetable did not grant. */
  wishIgnored: 4,
};

/**
 * Is the timetable fair, and to whom is it unfair?
 *
 * A schedule can score well overall while one teacher carries most of the inconvenience -
 * the total penalty says nothing about how it is distributed. Gini is the standard measure
 * for exactly that question in economics, and it transfers directly: 0 means every teacher
 * has an equally good schedule, 1 means one teacher has everything.
 *
 * The point is not the number. It is being able to name the teacher who is worst off and
 * say why, which is the conversation a head teacher actually has to have.
 */
@Injectable()
export class FairnessService {
  constructor(
    private prisma: PrismaService,
    private constraints: ConstraintService,
  ) {}

  async report(semesterId: string): Promise<FairnessReport> {
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

    if (!timetable) {
      return {
        gini: 0,
        lorenz: [],
        teachers: [],
        worstOff: [],
        summary: { best: 0, worst: 0, median: 0, spread: 0 },
      };
    }

    await this.constraints.initialize(semesterId);
    const teachers = await this.prisma.teacher.findMany({
      select: { id: true, code: true, full_name: true },
    });
    const byId = new Map(teachers.map((t) => [t.id, t]));

    const slots: TimeSlot[] = timetable.slots.map((s) => ({
      id: s.id,
      day: s.day,
      period: s.period,
      classId: s.class_id,
      subjectId: s.subject_id,
      teacherId: s.teacher_id,
      roomId: s.room_id ?? undefined,
    }));

    const perTeacher = new Map<string, TimeSlot[]>();
    for (const slot of slots) {
      if (!perTeacher.has(slot.teacherId)) perTeacher.set(slot.teacherId, []);
      perTeacher.get(slot.teacherId)!.push(slot);
    }

    const scored: TeacherQuality[] = [];
    for (const [teacherId, own] of perTeacher) {
      const teacher = byId.get(teacherId);
      if (!teacher) continue;
      scored.push(this.scoreTeacher(teacherId, teacher.code, teacher.full_name, own));
    }
    scored.sort((a, b) => a.quality - b.quality);

    const values = scored.map((t) => t.quality);
    return {
      gini: this.gini(values),
      lorenz: this.lorenz(values),
      teachers: scored,
      worstOff: scored.slice(0, 5).map((t) => this.explain(t)),
      summary: {
        best: values.length ? Math.max(...values) : 0,
        worst: values.length ? Math.min(...values) : 0,
        median: this.median(values),
        spread: values.length ? Math.max(...values) - Math.min(...values) : 0,
      },
    };
  }

  /**
   * One teacher's schedule quality.
   *
   * Everything is measured against what this teacher's own load makes possible, not
   * against the school average - a teacher with 20 periods cannot have the same week as
   * one with 8, and marking them down for it would call an unavoidable difference unfair.
   */
  private scoreTeacher(
    teacherId: string,
    code: string,
    name: string,
    own: TimeSlot[],
  ): TeacherQuality {
    const byDay = new Map<number, number[]>();
    const sessions = new Set<string>();

    for (const slot of own) {
      if (!byDay.has(slot.day)) byDay.set(slot.day, []);
      byDay.get(slot.day)!.push(slot.period);
      sessions.add(`${slot.day}-${slot.period <= 5 ? 0 : 1}`);
    }

    let gaps = 0;
    let lastPeriods = 0;
    let longRuns = 0;

    for (const periods of byDay.values()) {
      const sorted = [...periods].sort((a, b) => a - b);

      for (const session of [0, 1]) {
        const inSession = sorted.filter((p) => (p <= 5 ? 0 : 1) === session);
        if (inSession.length < 2) continue;
        // Free periods a teacher has to wait through, not free periods they go home for
        gaps += inSession[inSession.length - 1] - inSession[0] + 1 - inSession.length;
      }

      lastPeriods += sorted.filter((p) => p === 5 || p === 10).length;

      let run = 1;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) {
          run++;
          if (run === 5) longRuns++;
        } else {
          run = 1;
        }
      }
    }

    // A teacher's own load sets the floor: this many half-days is the fewest they could
    // work, so only the sessions beyond that are a cost the timetable imposed
    const minimumSessions = Math.ceil(own.length / 5);
    const extraSessions = Math.max(0, sessions.size - minimumSessions);
    const sixDayWeek = byDay.size >= 6 ? 1 : 0;
    const floorChanges = this.countFloorChanges(own);

    // Wishes this teacher registered and the timetable did not honour. A teacher who
    // asked for nothing is not marked down - they simply have nothing to measure.
    const wishes = this.constraints.preferenceReportFor(teacherId, own);
    const wishesIgnored = wishes.asked - wishes.granted;

    const burdens = [
      { label: 'Tiết trống phải chờ', count: gaps, cost: gaps * BURDEN_COST.gap },
      { label: 'Buổi đến trường dư', count: extraSessions, cost: extraSessions * BURDEN_COST.extraSession },
      { label: 'Không có ngày nghỉ', count: sixDayWeek, cost: sixDayWeek * BURDEN_COST.sixDayWeek },
      { label: 'Tiết cuối buổi', count: lastPeriods, cost: lastPeriods * BURDEN_COST.lastPeriod },
      { label: 'Phải đổi tầng', count: floorChanges, cost: floorChanges * BURDEN_COST.floorChange },
      { label: 'Dạy 5 tiết liền', count: longRuns, cost: longRuns * BURDEN_COST.longRun },
      { label: 'Nguyện vọng không được đáp ứng', count: wishesIgnored, cost: wishesIgnored * BURDEN_COST.wishIgnored },
    ]
      .filter((b) => b.count > 0)
      .sort((a, b) => b.cost - a.cost);

    const total = burdens.reduce((sum, b) => sum + b.cost, 0);

    return {
      teacherId,
      code,
      name,
      quality: Math.max(0, 100 - total),
      periods: own.length,
      preferencesMet: wishes.asked === 0 ? null : Math.round((wishes.granted / wishes.asked) * 100),
      burdens,
    };
  }

  /** How often this teacher has to change floor between two back-to-back periods. */
  private countFloorChanges(own: TimeSlot[]): number {
    const byDay = new Map<number, TimeSlot[]>();
    for (const slot of own) {
      if (!byDay.has(slot.day)) byDay.set(slot.day, []);
      byDay.get(slot.day)!.push(slot);
    }

    let changes = 0;
    for (const daySlots of byDay.values()) {
      const sorted = [...daySlots].sort((a, b) => a.period - b.period);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].period !== sorted[i - 1].period + 1) continue;
        const from = this.constraints.estimatedFloor(sorted[i - 1]);
        const to = this.constraints.estimatedFloor(sorted[i]);
        if (from !== null && to !== null && from !== to) changes++;
      }
    }
    return changes;
  }

  /**
   * Gini coefficient over schedule quality.
   *
   * 0 = every teacher's schedule is equally good. Schools will not reach that, and should
   * not chase it - the useful reading is the trend between two candidate timetables.
   */
  private gini(values: number[]): number {
    if (values.length < 2) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const total = sorted.reduce((sum, v) => sum + v, 0);
    if (total === 0) return 0;

    let weighted = 0;
    sorted.forEach((value, index) => {
      weighted += (index + 1) * value;
    });

    const n = sorted.length;
    return Math.round(((2 * weighted) / (n * total) - (n + 1) / n) * 1000) / 1000;
  }

  private lorenz(values: number[]): Array<{ population: number; quality: number }> {
    if (values.length === 0) return [];
    const sorted = [...values].sort((a, b) => a - b);
    const total = sorted.reduce((sum, v) => sum + v, 0);
    if (total === 0) return [{ population: 0, quality: 0 }, { population: 1, quality: 1 }];

    const points = [{ population: 0, quality: 0 }];
    let running = 0;
    sorted.forEach((value, index) => {
      running += value;
      points.push({
        population: Math.round(((index + 1) / sorted.length) * 1000) / 1000,
        quality: Math.round((running / total) * 1000) / 1000,
      });
    });
    return points;
  }

  private median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }

  /** Name the one thing that would most improve this teacher's week. */
  private explain(teacher: TeacherQuality) {
    const worst = teacher.burdens[0];
    const suggestions: Record<string, string> = {
      'Tiết trống phải chờ': 'Dồn các tiết trong buổi lại liền nhau để giáo viên không phải chờ.',
      'Buổi đến trường dư': 'Gom tiết vào ít buổi hơn — mỗi buổi bớt được là một lần đi lại.',
      'Không có ngày nghỉ': 'Dồn tiết của một ngày sang ngày khác để giáo viên có trọn một ngày nghỉ.',
      'Tiết cuối buổi': 'Chuyển bớt tiết cuối buổi sang khung giờ sớm hơn.',
      'Phải đổi tầng': 'Xếp các tiết liền nhau vào cùng tầng, hoặc chèn một tiết trống giữa hai tầng.',
      'Dạy 5 tiết liền': 'Chèn một tiết nghỉ vào giữa chuỗi dạy liên tục.',
      'Nguyện vọng không được đáp ứng': 'Xem lại các khung giờ giáo viên đã đăng ký mong muốn — có thể đổi được với đồng nghiệp.',
    };

    return {
      teacherId: teacher.teacherId,
      name: teacher.name,
      quality: teacher.quality,
      biggestBurden: worst ? `${worst.label} (${worst.count} lần, −${worst.cost} điểm)` : 'Không có',
      suggestion: worst ? suggestions[worst.label] ?? '' : 'Lịch của giáo viên này đã tốt.',
    };
  }
}
