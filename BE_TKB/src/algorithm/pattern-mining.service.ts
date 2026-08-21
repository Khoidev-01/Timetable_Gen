import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ChangeAction, ConstraintType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface MinedPattern {
  kind: 'TEACHER_AVOIDS_CELL' | 'SUBJECT_AVOIDS_CELL' | 'CLASS_AVOIDS_CELL';
  title: string;
  detail: string;
  suggestion: string;
  observations: number;
  confidence: number;
  /** Ready to POST to the teacher-constraint endpoint when the user accepts. */
  proposal?: {
    teacherId?: string;
    teacherCode?: string;
    day: number;
    period: number;
    session: number;
  };
}

interface MovementFact {
  teacherId: string;
  subjectId: number;
  classId: string;
  fromDay: number;
  fromPeriod: number;
  toDay: number;
  toPeriod: number;
}

const MIN_OBSERVATIONS = 3;

/**
 * Learns the school's unwritten rules from what the head teacher keeps correcting.
 *
 * A generated timetable is typically hand-adjusted dozens of times each term, and every
 * one of those drags encodes something nobody wrote down - a teacher who cannot make
 * Friday afternoons, a class that must not have PE last thing. None of it is captured
 * today, so the next term starts from scratch and the same drags happen again.
 *
 * Frequency is enough here; there is no need for anything cleverer. What matters is that
 * the finding is shown as a question, because the same edit can have several causes.
 */
@Injectable()
export class PatternMiningService {
  constructor(private prisma: PrismaService) {}

  async mine(semesterId: string): Promise<{ facts: number; patterns: MinedPattern[] }> {
    const timetables = await this.prisma.generatedTimetable.findMany({
      where: { semester_id: semesterId },
      select: { id: true },
    });

    const logs = await this.prisma.timetableChangeLog.findMany({
      where: {
        timetable_id: { in: timetables.map((t) => t.id) },
        action: { in: [ChangeAction.MOVE, ChangeAction.SWAP, ChangeAction.CASCADE_SWAP] },
        reverted: false,
      },
      orderBy: { created_at: 'desc' },
      take: 500,
    });

    const facts = await this.extractMovements(logs);
    if (facts.length === 0) return { facts: 0, patterns: [] };

    const patterns = [
      ...(await this.teacherAvoidsCell(facts)),
      ...(await this.subjectAvoidsCell(facts)),
      ...(await this.classAvoidsCell(facts)),
    ];

    patterns.sort((a, b) => b.confidence - a.confidence);
    return { facts: facts.length, patterns };
  }

  /**
   * Turn one accepted suggestion into a busy time.
   *
   * Deliberately not the existing `PUT /resources/teachers/:id/constraints`, which clears
   * every constraint the teacher has before writing the new list - accepting a suggestion
   * would silently drop the busy times somebody entered by hand.
   */
  async acceptTeacherBusy(params: {
    teacherId: string;
    day: number;
    period: number;
    session: number;
  }) {
    const teacher = await this.prisma.teacher.findUnique({ where: { id: params.teacherId } });
    if (!teacher) throw new NotFoundException('Không tìm thấy giáo viên.');

    if (params.day < 2 || params.day > 7) {
      throw new BadRequestException('Thứ phải nằm trong khoảng 2 đến 7.');
    }
    if (params.period < 1 || params.period > 5) {
      throw new BadRequestException('Tiết phải nằm trong khoảng 1 đến 5 của mỗi buổi.');
    }
    if (params.session !== 0 && params.session !== 1) {
      throw new BadRequestException('Buổi phải là 0 (sáng) hoặc 1 (chiều).');
    }

    const existing = await this.prisma.teacherConstraint.findFirst({
      where: {
        teacher_id: params.teacherId,
        day_of_week: params.day,
        period: params.period,
        session: params.session,
      },
    });
    if (existing) return { created: false, constraint: existing };

    const constraint = await this.prisma.teacherConstraint.create({
      data: {
        teacher_id: params.teacherId,
        day_of_week: params.day,
        period: params.period,
        session: params.session,
        type: ConstraintType.BUSY,
      },
    });
    return { created: true, constraint };
  }

  /**
   * Reconstruct what physically moved. The log stores the slot positions before and
   * after, so the cell a period was dragged *out of* is the interesting part - that is
   * the one the user kept rejecting.
   */
  private async extractMovements(logs: any[]): Promise<MovementFact[]> {
    const slotIds = new Set<string>();
    for (const log of logs) {
      for (const state of (log.before ?? []) as any[]) slotIds.add(state.slotId);
    }
    if (slotIds.size === 0) return [];

    const slots = await this.prisma.timetableSlot.findMany({
      where: { id: { in: [...slotIds] } },
      select: { id: true, teacher_id: true, subject_id: true, class_id: true },
    });
    const byId = new Map(slots.map((s) => [s.id, s]));

    const facts: MovementFact[] = [];
    for (const log of logs) {
      const before = (log.before ?? []) as any[];
      const after = (log.after ?? []) as any[];
      const afterById = new Map(after.map((state: any) => [state.slotId, state]));

      for (const start of before) {
        const end = afterById.get(start.slotId);
        if (!end) continue;
        if (start.day === end.day && start.period === end.period) continue;

        const slot = byId.get(start.slotId);
        if (!slot) continue;

        facts.push({
          teacherId: slot.teacher_id,
          subjectId: slot.subject_id,
          classId: slot.class_id,
          fromDay: start.day,
          fromPeriod: start.period,
          toDay: end.day,
          toPeriod: end.period,
        });
      }
    }
    return facts;
  }

  /** The same teacher repeatedly moved out of the same slot looks like a busy time. */
  private async teacherAvoidsCell(facts: MovementFact[]): Promise<MinedPattern[]> {
    const tally = new Map<string, { count: number; teacherId: string; day: number; period: number }>();

    for (const fact of facts) {
      const key = `${fact.teacherId}|${fact.fromDay}|${fact.fromPeriod}`;
      const entry = tally.get(key) ?? {
        count: 0,
        teacherId: fact.teacherId,
        day: fact.fromDay,
        period: fact.fromPeriod,
      };
      entry.count += 1;
      tally.set(key, entry);
    }

    const strong = [...tally.values()].filter((entry) => entry.count >= MIN_OBSERVATIONS);
    if (strong.length === 0) return [];

    const teachers = await this.prisma.teacher.findMany({
      where: { id: { in: strong.map((entry) => entry.teacherId) } },
      select: { id: true, code: true, full_name: true },
    });
    const byId = new Map(teachers.map((t) => [t.id, t]));

    return strong.map((entry) => {
      const teacher = byId.get(entry.teacherId);
      // Each repeat past the threshold makes the reading firmer, but never certain -
      // the moves could equally have been about the class or the room
      const confidence = Math.min(95, 55 + (entry.count - MIN_OBSERVATIONS) * 12);

      return {
        kind: 'TEACHER_AVOIDS_CELL' as const,
        title: `${teacher?.full_name ?? entry.teacherId} thường bị chuyển khỏi Thứ ${entry.day} tiết ${entry.period}`,
        detail: `Đã ${entry.count} lần tiết của giáo viên này bị chuyển ra khỏi ô Thứ ${entry.day} tiết ${entry.period}.`,
        suggestion: 'Có phải giáo viên bận khung giờ này? Nếu đúng, thêm vào lịch bận để thuật toán tự tránh.',
        observations: entry.count,
        confidence,
        proposal: {
          teacherId: entry.teacherId,
          teacherCode: teacher?.code,
          day: entry.day,
          period: entry.period <= 5 ? entry.period : entry.period - 5,
          session: entry.period <= 5 ? 0 : 1,
        },
      };
    });
  }

  /**
   * A class emptied out of the same cell whoever is teaching points at the cell itself -
   * a weekly assembly, a shared lab period, something the timetable does not know about.
   */
  private async classAvoidsCell(facts: MovementFact[]): Promise<MinedPattern[]> {
    const tally = new Map<
      string,
      { count: number; classId: string; day: number; period: number; teachers: Set<string> }
    >();

    for (const fact of facts) {
      const key = `${fact.classId}|${fact.fromDay}|${fact.fromPeriod}`;
      const entry = tally.get(key) ?? {
        count: 0,
        classId: fact.classId,
        day: fact.fromDay,
        period: fact.fromPeriod,
        teachers: new Set<string>(),
      };
      entry.count += 1;
      entry.teachers.add(fact.teacherId);
      tally.set(key, entry);
    }

    const strong = [...tally.values()].filter(
      (entry) => entry.count >= MIN_OBSERVATIONS && entry.teachers.size >= 2,
    );
    if (strong.length === 0) return [];

    const classes = await this.prisma.class.findMany({
      where: { id: { in: strong.map((entry) => entry.classId) } },
      select: { id: true, name: true },
    });
    const byId = new Map(classes.map((c) => [c.id, c]));

    return strong.map((entry) => ({
      kind: 'CLASS_AVOIDS_CELL' as const,
      title: `Lớp ${byId.get(entry.classId)?.name ?? entry.classId} hay bị bỏ trống Thứ ${entry.day} tiết ${entry.period}`,
      detail: `Đã ${entry.count} lần tiết của lớp này bị chuyển ra khỏi ô Thứ ${entry.day} tiết ${entry.period}, với ${entry.teachers.size} giáo viên khác nhau.`,
      suggestion: 'Lớp có hoạt động cố định vào khung giờ này? Nếu có, khai báo tiết cố định để thuật toán chừa chỗ.',
      observations: entry.count,
      confidence: Math.min(90, 50 + (entry.count - MIN_OBSERVATIONS) * 12),
    }));
  }

  /**
   * A subject repeatedly dragged out of the same slot suggests a school-wide convention.
   *
   * Only worth reporting when more than one teacher is involved. One teacher moved off
   * Thursday period 5 six times is a fact about that teacher, and reporting it a second
   * time under their subject would put the same evidence in front of the user twice
   * wearing a different label.
   */
  private async subjectAvoidsCell(facts: MovementFact[]): Promise<MinedPattern[]> {
    const tally = new Map<
      string,
      { count: number; subjectId: number; day: number; period: number; teachers: Set<string>; classes: Set<string> }
    >();

    for (const fact of facts) {
      const key = `${fact.subjectId}|${fact.fromDay}|${fact.fromPeriod}`;
      const entry = tally.get(key) ?? {
        count: 0,
        subjectId: fact.subjectId,
        day: fact.fromDay,
        period: fact.fromPeriod,
        teachers: new Set<string>(),
        classes: new Set<string>(),
      };
      entry.count += 1;
      entry.teachers.add(fact.teacherId);
      entry.classes.add(fact.classId);
      tally.set(key, entry);
    }

    const strong = [...tally.values()].filter(
      (entry) => entry.count >= MIN_OBSERVATIONS && entry.teachers.size >= 2,
    );
    if (strong.length === 0) return [];

    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: strong.map((entry) => entry.subjectId) } },
      select: { id: true, name: true },
    });
    const byId = new Map(subjects.map((s) => [s.id, s]));

    return strong.map((entry) => ({
      kind: 'SUBJECT_AVOIDS_CELL' as const,
      title: `Môn ${byId.get(entry.subjectId)?.name ?? entry.subjectId} hay bị chuyển khỏi Thứ ${entry.day} tiết ${entry.period}`,
      detail: `Đã ${entry.count} lần môn này bị chuyển ra khỏi ô Thứ ${entry.day} tiết ${entry.period}, với ${entry.teachers.size} giáo viên và ${entry.classes.size} lớp khác nhau.`,
      suggestion: 'Có thể trường có quy ước không xếp môn này vào khung giờ đó — cân nhắc thêm một quy tắc.',
      observations: entry.count,
      confidence: Math.min(90, 50 + (entry.count - MIN_OBSERVATIONS) * 12),
    }));
  }
}
