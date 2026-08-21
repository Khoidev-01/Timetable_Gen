import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConstraintService, TimeSlot } from './constraint.service';
import { Actor, ChangeLogService } from './change-log.service';
import { ChangeAction } from '@prisma/client';

export interface SwapStep {
  slotId: string;
  className: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  from: { day: number; period: number };
  to: { day: number; period: number };
}

export interface SwapCycle {
  length: number;
  teachersInvolved: number;
  deltaScore: number;
  steps: SwapStep[];
}

interface Node {
  slot: TimeSlot;
  index: number;
}

const MAX_CYCLE_LENGTH = 4;
const MAX_BRANCHING = 14;
const MAX_RESULTS = 5;

/**
 * Finds chain swaps.
 *
 * When a teacher wants a period moved, checking only direct exchanges usually answers
 * "not possible" - the direct partner is always blocked by something. A solution
 * normally exists as a rotation: A takes B's slot, B takes C's, C takes A's. No one can
 * see that by hand because people only reason one exchange deep.
 *
 * This is the same structure as kidney exchange in market design: donor-recipient pairs
 * that are individually incompatible become transplantable once you look for cycles.
 * The search is therefore cycle enumeration on a directed compatibility graph, bounded
 * to short cycles because every extra participant is another person who has to agree.
 */
@Injectable()
export class SwapGraphService {
  constructor(
    private prisma: PrismaService,
    private constraints: ConstraintService,
    private changeLog: ChangeLogService,
  ) {}

  async findOptions(slotId: string): Promise<{ target: SwapStep | null; cycles: SwapCycle[] }> {
    const slot = await this.prisma.timetableSlot.findUnique({ where: { id: slotId } });
    if (!slot) throw new NotFoundException('Không tìm thấy tiết học.');
    if (slot.is_locked) throw new BadRequestException('Tiết này đang bị khóa, không thể đổi.');

    const timetable = await this.prisma.generatedTimetable.findUnique({
      where: { id: slot.timetable_id },
      include: { slots: true },
    });
    if (!timetable) throw new NotFoundException('Không tìm thấy thời khóa biểu.');

    await this.constraints.initialize(timetable.semester_id);

    const [classes, subjects, teachers] = await Promise.all([
      this.prisma.class.findMany({ select: { id: true, name: true } }),
      this.prisma.subject.findMany({ select: { id: true, name: true } }),
      this.prisma.teacher.findMany({ select: { id: true, full_name: true } }),
    ]);

    const classNames = new Map(classes.map((c) => [c.id, c.name]));
    const subjectNames = new Map(subjects.map((s) => [s.id, s.name]));
    const teacherNames = new Map(teachers.map((t) => [t.id, t.full_name]));

    const slots: TimeSlot[] = timetable.slots.map((s) => ({
      id: s.id,
      day: s.day,
      period: s.period,
      classId: s.class_id,
      subjectId: s.subject_id,
      teacherId: s.teacher_id,
      roomId: s.room_id ?? undefined,
      isLocked: s.is_locked,
    }));

    const nodes: Node[] = slots
      .map((s, index) => ({ slot: s, index }))
      .filter((node) => !node.slot.isLocked);

    const startIndex = nodes.findIndex((node) => node.slot.id === slotId);
    if (startIndex === -1) throw new BadRequestException('Tiết này không thể di chuyển.');

    const adjacency = this.buildAdjacency(nodes, slots);
    const rawCycles = this.enumerateCycles(startIndex, adjacency, nodes);

    const baseScore = this.constraints.getFitnessDetails(slots).score;

    const cycles: SwapCycle[] = [];
    for (const cycle of rawCycles) {
      const applied = this.simulate(cycle, nodes, slots);
      if (!applied.valid) continue;

      cycles.push({
        length: cycle.length,
        teachersInvolved: new Set(cycle.map((i) => nodes[i].slot.teacherId)).size,
        deltaScore: applied.score - baseScore,
        steps: cycle.map((nodeIndex, position) => {
          const from = nodes[nodeIndex].slot;
          const to = nodes[cycle[(position + 1) % cycle.length]].slot;
          return {
            slotId: from.id!,
            className: classNames.get(from.classId) ?? from.classId,
            subjectName: subjectNames.get(from.subjectId) ?? String(from.subjectId),
            teacherId: from.teacherId,
            teacherName: teacherNames.get(from.teacherId) ?? from.teacherId,
            from: { day: from.day, period: from.period },
            to: { day: to.day, period: to.period },
          };
        }),
      });
    }

    // Fewer people to convince first, then the option that hurts the timetable least
    cycles.sort((a, b) =>
      a.teachersInvolved !== b.teachersInvolved
        ? a.teachersInvolved - b.teachersInvolved
        : b.deltaScore - a.deltaScore,
    );

    const target = nodes[startIndex].slot;
    return {
      target: {
        slotId: target.id!,
        className: classNames.get(target.classId) ?? target.classId,
        subjectName: subjectNames.get(target.subjectId) ?? String(target.subjectId),
        teacherId: target.teacherId,
        teacherName: teacherNames.get(target.teacherId) ?? target.teacherId,
        from: { day: target.day, period: target.period },
        to: { day: target.day, period: target.period },
      },
      cycles: cycles.slice(0, MAX_RESULTS),
    };
  }

  /**
   * Score every cell this period could be dragged to, before the user drops it.
   *
   * The grid used to accept any drop and only complain afterwards, with a raw database
   * error. Working the answer out up front lets the UI colour the legal cells and show
   * what the move costs while the slot is still in the air.
   */
  async previewMoves(slotId: string) {
    const slot = await this.prisma.timetableSlot.findUnique({ where: { id: slotId } });
    if (!slot) throw new NotFoundException('Không tìm thấy tiết học.');

    const timetable = await this.prisma.generatedTimetable.findUnique({
      where: { id: slot.timetable_id },
      include: { slots: true },
    });
    if (!timetable) throw new NotFoundException('Không tìm thấy thời khóa biểu.');

    await this.constraints.initialize(timetable.semester_id);

    const slots: TimeSlot[] = timetable.slots.map((s) => ({
      id: s.id,
      day: s.day,
      period: s.period,
      classId: s.class_id,
      subjectId: s.subject_id,
      teacherId: s.teacher_id,
      roomId: s.room_id ?? undefined,
      isLocked: s.is_locked,
    }));

    const baseScore = this.constraints.getFitnessDetails(slots).score;
    const session = slot.period <= 5 ? [1, 5] : [6, 10];
    const targets: Array<{
      day: number;
      period: number;
      valid: boolean;
      reason?: string;
      deltaScore?: number;
      swapsWith?: string;
    }> = [];

    for (let day = 2; day <= 7; day++) {
      for (let period = session[0]; period <= session[1]; period++) {
        if (day === slot.day && period === slot.period) continue;

        const occupant = slots.find(
          (s) => s.classId === slot.class_id && s.day === day && s.period === period,
        );

        if (occupant?.isLocked) {
          targets.push({ day, period, valid: false, reason: 'Tiết ở ô này đang bị khóa' });
          continue;
        }

        if (this.constraints.isTeacherBusy(slot.teacher_id, day, period)) {
          targets.push({ day, period, valid: false, reason: 'Giáo viên đã đăng ký bận ô này' });
          continue;
        }

        // Simulate the move - a swap when the cell is taken, a plain move when it is free
        const copy = slots.map((s) => ({ ...s }));
        const moving = copy.find((s) => s.id === slotId)!;
        const displaced = occupant ? copy.find((s) => s.id === occupant.id)! : null;

        if (displaced) {
          displaced.day = slot.day;
          displaced.period = slot.period;
        }
        moving.day = day;
        moving.period = period;

        const fitness = this.constraints.getFitnessDetails(copy);
        if (!fitness.isValid) {
          targets.push({
            day,
            period,
            valid: false,
            reason: fitness.details[0] ?? 'Vi phạm ràng buộc cứng',
          });
          continue;
        }

        targets.push({
          day,
          period,
          valid: true,
          deltaScore: fitness.score - baseScore,
          swapsWith: occupant?.id,
        });
      }
    }

    return { slotId, baseScore, targets };
  }

  /**
   * Edge u -> v means u could take v's time. Checked pairwise, treating v as if it had
   * already left; a full cycle is verified afterwards because several slots move at once.
   */
  private buildAdjacency(nodes: Node[], slots: TimeSlot[]): number[][] {
    const byCell = new Map<string, TimeSlot[]>();
    for (const s of slots) {
      const key = `${s.day}-${s.period}`;
      if (!byCell.has(key)) byCell.set(key, []);
      byCell.get(key)!.push(s);
    }

    return nodes.map((node) => {
      const edges: number[] = [];

      for (let j = 0; j < nodes.length && edges.length < MAX_BRANCHING; j++) {
        const other = nodes[j];
        if (other.index === node.index) continue;
        if (other.slot.day === node.slot.day && other.slot.period === node.slot.period) continue;

        // A period must stay in its own half of the day, otherwise the class is not there
        if ((node.slot.period <= 5) !== (other.slot.period <= 5)) continue;
        if (this.constraints.isTeacherBusy(node.slot.teacherId, other.slot.day, other.slot.period)) continue;

        const occupants = byCell.get(`${other.slot.day}-${other.slot.period}`) ?? [];
        const blocked = occupants.some(
          (occupant) =>
            occupant.id !== other.slot.id &&
            (occupant.classId === node.slot.classId || occupant.teacherId === node.slot.teacherId),
        );
        if (blocked) continue;

        edges.push(j);
      }

      return edges;
    });
  }

  /** Depth-first walk from the target, collecting every short path that returns to it. */
  private enumerateCycles(start: number, adjacency: number[][], nodes: Node[]): number[][] {
    const cycles: number[][] = [];
    const path: number[] = [start];
    const visited = new Set<number>([start]);

    const walk = (current: number) => {
      if (cycles.length >= 40) return;

      for (const next of adjacency[current]) {
        if (next === start && path.length >= 2) {
          cycles.push([...path]);
          continue;
        }
        if (visited.has(next)) continue;
        if (path.length >= MAX_CYCLE_LENGTH) continue;

        // Two periods of the same class swapping is a plain exchange, still useful
        visited.add(next);
        path.push(next);
        walk(next);
        path.pop();
        visited.delete(next);
      }
    };

    walk(start);
    return cycles;
  }

  /**
   * Apply the rotation on a copy and confirm it really is legal. The pairwise edges only
   * looked at two slots at a time, so a cycle can still break something when every
   * member moves together.
   */
  private simulate(cycle: number[], nodes: Node[], slots: TimeSlot[]) {
    const copy = slots.map((s) => ({ ...s }));
    const byId = new Map(copy.map((s) => [s.id, s]));

    const destinations = cycle.map((nodeIndex, position) => {
      const to = nodes[cycle[(position + 1) % cycle.length]].slot;
      return { id: nodes[nodeIndex].slot.id!, day: to.day, period: to.period };
    });

    for (const destination of destinations) {
      const moved = byId.get(destination.id);
      if (!moved) return { valid: false, score: 0 };
      moved.day = destination.day;
      moved.period = destination.period;
    }

    const fitness = this.constraints.getFitnessDetails(copy);
    return { valid: fitness.isValid, score: fitness.score };
  }

  /**
   * Carry out a rotation. Every slot moves inside one transaction: a chain that applied
   * halfway would leave two classes sharing a period, which is worse than not swapping.
   */
  async applyCycle(slotIds: string[], actor: Actor = { name: 'Hệ thống' }) {
    if (slotIds.length < 2) throw new BadRequestException('Chu trình phải có ít nhất 2 tiết.');

    const slots = await this.prisma.timetableSlot.findMany({ where: { id: { in: slotIds } } });
    if (slots.length !== slotIds.length) throw new NotFoundException('Có tiết học không còn tồn tại.');
    if (slots.some((s) => s.is_locked)) throw new BadRequestException('Chu trình chứa tiết đang bị khóa.');

    const ordered = slotIds.map((id) => slots.find((s) => s.id === id)!);
    const destinations = ordered.map((slot, index) => {
      const next = ordered[(index + 1) % ordered.length];
      return { id: slot.id, day: next.day, period: next.period };
    });

    const before = await this.changeLog.snapshot(slotIds);

    await this.prisma.$transaction(async (tx) => {
      // Park every slot outside the grid first so the rotation cannot trip a unique index
      for (let i = 0; i < ordered.length; i++) {
        await tx.timetableSlot.update({
          where: { id: ordered[i].id },
          data: { day: -1, period: -(i + 1) },
        });
      }

      for (const destination of destinations) {
        await tx.timetableSlot.update({
          where: { id: destination.id },
          data: { day: destination.day, period: destination.period, is_locked: true },
        });
      }
    });

    await this.changeLog.record({
      timetableId: ordered[0].timetable_id,
      actor,
      action: ChangeAction.CASCADE_SWAP,
      description: `Đổi tiết dây chuyền ${ordered.length} bên`,
      before,
      after: await this.changeLog.snapshot(slotIds),
    });

    return { success: true, moved: destinations.length };
  }
}
