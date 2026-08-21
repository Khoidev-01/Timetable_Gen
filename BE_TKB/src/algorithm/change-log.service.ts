import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ChangeAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Just enough of a slot's state to put it back where it was. */
export interface SlotState {
  slotId: string;
  day: number;
  period: number;
  isLocked: boolean;
}

export interface Actor {
  id?: string;
  name: string;
}

/**
 * Records every manual edit and can undo one.
 *
 * Two things depend on this. A head teacher who drags the wrong period needs a way back,
 * and the constraint-mining feature has nothing to learn from unless the edits are kept -
 * a schedule that is hand-adjusted forty times each term is forty pieces of knowledge
 * about the school that would otherwise vanish.
 */
@Injectable()
export class ChangeLogService {
  constructor(private prisma: PrismaService) {}

  async record(params: {
    timetableId: string;
    slotId?: string;
    actor: Actor;
    action: ChangeAction;
    description: string;
    before: SlotState[];
    after: SlotState[];
  }) {
    return this.prisma.timetableChangeLog.create({
      data: {
        timetable_id: params.timetableId,
        slot_id: params.slotId,
        actor_id: params.actor.id,
        actor_name: params.actor.name,
        action: params.action,
        description: params.description,
        before: params.before as any,
        after: params.after as any,
      },
    });
  }

  async history(timetableId: string, take = 50) {
    return this.prisma.timetableChangeLog.findMany({
      where: { timetable_id: timetableId },
      orderBy: { created_at: 'desc' },
      take,
    });
  }

  /**
   * Put the slots back where the entry says they were.
   *
   * Everything moves inside one transaction, and each slot is parked outside the grid
   * first: restoring one at a time would briefly place two periods in the same cell and
   * trip a unique index.
   */
  async revert(logId: string, actor: Actor) {
    const entry = await this.prisma.timetableChangeLog.findUnique({ where: { id: logId } });
    if (!entry) throw new NotFoundException('Không tìm thấy thao tác này trong nhật ký.');
    if (entry.reverted) throw new BadRequestException('Thao tác này đã được hoàn tác rồi.');

    const before = entry.before as unknown as SlotState[];
    if (!Array.isArray(before) || before.length === 0) {
      throw new BadRequestException('Thao tác này không có dữ liệu để hoàn tác.');
    }

    const existing = await this.prisma.timetableSlot.findMany({
      where: { id: { in: before.map((state) => state.slotId) } },
    });
    if (existing.length !== before.length) {
      throw new BadRequestException('Một số tiết đã bị xóa nên không hoàn tác được.');
    }

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < before.length; i++) {
        await tx.timetableSlot.update({
          where: { id: before[i].slotId },
          data: { day: -1, period: -(i + 1) },
        });
      }

      for (const state of before) {
        await tx.timetableSlot.update({
          where: { id: state.slotId },
          data: { day: state.day, period: state.period, is_locked: state.isLocked },
        });
      }

      await tx.timetableChangeLog.update({
        where: { id: logId },
        data: { reverted: true },
      });

      // The undo is itself an edit, so it belongs in the history too
      await tx.timetableChangeLog.create({
        data: {
          timetable_id: entry.timetable_id,
          actor_id: actor.id,
          actor_name: actor.name,
          action: ChangeAction.REVERT,
          description: `Hoàn tác: ${entry.description}`,
          before: entry.after as any,
          after: entry.before as any,
        },
      });
    });

    return { success: true, restored: before.length };
  }

  /** Snapshot the slots a change is about to touch. */
  async snapshot(slotIds: string[]): Promise<SlotState[]> {
    const slots = await this.prisma.timetableSlot.findMany({ where: { id: { in: slotIds } } });
    return slots.map((slot) => ({
      slotId: slot.id,
      day: slot.day,
      period: slot.period,
      isLocked: slot.is_locked,
    }));
  }
}
