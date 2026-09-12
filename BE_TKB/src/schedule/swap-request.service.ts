import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OverlayType, SwapStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConstraintService, TimeSlot } from '../algorithm/constraint.service';
import { IncrementalScorer } from '../algorithm/incremental-scorer';
import { SwapGraphService } from '../algorithm/swap-graph.service';
import { NotificationService } from '../notifications/notification.service';

export interface SwapActor {
  userId: string;
  role: 'ADMIN' | 'TEACHER';
  teacherId?: string;
  teacherName?: string;
}

export interface SwapSuggestion {
  slotId: string;
  teacherId: string;
  teacherName: string;
  subjectName: string;
  className: string;
  day: number;
  period: number;
  /** Change in total score if the two periods traded places. Positive is an improvement. */
  scoreDelta: number;
  feasible: boolean;
}

export interface SlotSummary {
  day: number;
  period: number;
  /** Ready to read, e.g. "Thu hai tiet 3" */
  when: string;
  subjectName: string;
  className: string;
}

const DAY_LABEL: Record<number, string> = {
  2: 'Thứ hai', 3: 'Thứ ba', 4: 'Thứ tư', 5: 'Thứ năm', 6: 'Thứ sáu', 7: 'Thứ bảy',
};

/**
 * Two teachers agreeing to trade a period, and an admin signing it off.
 *
 * The three sides exist because two of them are not enough. A trade both teachers are happy
 * with can still be impossible: the partner may have picked up a class since they agreed,
 * a lab may now be double-booked, or one of them may have hit their weekly limit. So the
 * constraints are checked twice - once to suggest, and again at the moment of approval
 * against the schedule as it stands then, not as it stood when the request was written.
 */
@Injectable()
export class SwapRequestService {
  private readonly logger = new Logger(SwapRequestService.name);

  constructor(
    private prisma: PrismaService,
    private constraints: ConstraintService,
    private swapGraph: SwapGraphService,
    private notifications: NotificationService,
  ) {}

  /**
   * Periods this one could trade with, cheapest first.
   *
   * Built on the same swap graph the admin's drag-and-drop uses, so a teacher and an admin
   * are never shown two different answers to the same question.
   */
  async suggest(slotId: string, actor: SwapActor): Promise<SwapSuggestion[]> {
    const slot = await this.prisma.timetableSlot.findUnique({ where: { id: slotId } });
    if (!slot) throw new NotFoundException('Không tìm thấy tiết này.');
    this.assertOwnsSlot(actor, slot.teacher_id);

    const timetable = await this.prisma.generatedTimetable.findUnique({
      where: { id: slot.timetable_id },
      select: { semester_id: true },
    });
    if (!timetable) throw new NotFoundException('Không tìm thấy thời khóa biểu.');

    const slots = await this.loadSlots(slot.timetable_id);
    await this.constraints.initialize(timetable.semester_id);

    // Cham diem tang dan thay vi cham lai ca thoi khoa bieu cho tung phuong an.
    //
    // Ban dau moi ung vien deu sao chep ca gan mot nghin tiet roi cham lai tu dau: mot cau
    // hoi tra ve sau sau giay, trong khi nguoi dung dang doi truoc man hinh. Bo cham diem
    // tang dan chi tinh lai nhung lop va giao vien ma phep doi cho dung toi.
    const scorer = new IncrementalScorer(this.constraints, slots);
    const baseline = { score: scorer.fitness(), hardViolations: scorer.hardViolations() };

    const [teachers, subjects, classes] = await Promise.all([
      this.prisma.teacher.findMany({ select: { id: true, full_name: true } }),
      this.prisma.subject.findMany({ select: { id: true, name: true } }),
      this.prisma.class.findMany({ select: { id: true, name: true } }),
    ]);
    const teacherName = new Map(teachers.map((t) => [t.id, t.full_name]));
    const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
    const className = new Map(classes.map((c) => [c.id, c.name]));

    // A locked period cannot be traded, so offering it would send the teacher down a path
    // that `create()` refuses at the end
    const locked = new Set(
      (
        await this.prisma.timetableSlot.findMany({
          where: { timetable_id: slot.timetable_id, is_locked: true },
          select: { id: true },
        })
      ).map((row) => row.id),
    );

    const suggestions: SwapSuggestion[] = [];
    for (const candidate of slots) {
      if (candidate.id === slot.id) continue;
      if (locked.has(candidate.id!)) continue;
      if (candidate.teacherId === slot.teacher_id) continue;
      if (candidate.day === slot.day && candidate.period === slot.period) continue;

      const after = this.scoreWithSwap(scorer, slots, slot.id, candidate.id!);
      if (after.hardViolations > baseline.hardViolations) continue;

      suggestions.push({
        slotId: candidate.id!,
        teacherId: candidate.teacherId,
        teacherName: teacherName.get(candidate.teacherId) ?? candidate.teacherId,
        subjectName: subjectName.get(candidate.subjectId) ?? '',
        className: className.get(candidate.classId) ?? '',
        day: candidate.day,
        period: candidate.period,
        scoreDelta: after.score - baseline.score,
        feasible: after.hardViolations === 0,
      });
    }

    // Best trades first; a teacher scanning a list should not have to hunt for them
    return suggestions.sort((a, b) => b.scoreDelta - a.scoreDelta).slice(0, 20);
  }

  /** Ask a colleague to trade. Nothing changes in the timetable yet. */
  async create(
    params: { requesterSlotId: string; partnerSlotId: string; reason: string },
    actor: SwapActor,
  ) {
    const reason = params.reason?.trim() ?? '';
    if (reason.length < 3) throw new BadRequestException('Cần ghi lý do xin đổi tiết.');

    const [mine, theirs] = await Promise.all([
      this.prisma.timetableSlot.findUnique({ where: { id: params.requesterSlotId } }),
      this.prisma.timetableSlot.findUnique({ where: { id: params.partnerSlotId } }),
    ]);
    if (!mine || !theirs) throw new NotFoundException('Không tìm thấy một trong hai tiết.');
    this.assertOwnsSlot(actor, mine.teacher_id);

    if (mine.teacher_id === theirs.teacher_id) {
      throw new BadRequestException('Hai tiết cùng một giáo viên thì không phải đổi với ai.');
    }
    if (mine.timetable_id !== theirs.timetable_id) {
      throw new BadRequestException('Hai tiết không thuộc cùng một thời khóa biểu.');
    }
    if (mine.is_locked || theirs.is_locked) {
      throw new BadRequestException('Một trong hai tiết đang bị khóa nên không đổi được.');
    }

    const timetable = await this.prisma.generatedTimetable.findUnique({
      where: { id: mine.timetable_id },
      select: { semester_id: true },
    });

    // One live request per pair of periods: a second one would race the first at approval
    const existing = await this.prisma.swapRequest.findFirst({
      where: {
        requester_slot_id: params.requesterSlotId,
        partner_slot_id: params.partnerSlotId,
        status: { in: [SwapStatus.PENDING_PARTNER, SwapStatus.PENDING_ADMIN] },
      },
    });
    if (existing) throw new BadRequestException('Đã có một yêu cầu đang chờ cho đúng hai tiết này.');

    const request = await this.prisma.swapRequest.create({
      data: {
        semester_id: timetable!.semester_id,
        requester_teacher_id: mine.teacher_id,
        requester_slot_id: mine.id,
        partner_teacher_id: theirs.teacher_id,
        partner_slot_id: theirs.id,
        reason,
        status: SwapStatus.PENDING_PARTNER,
      },
    });

    await this.notifyTeacher(theirs.teacher_id, {
      title: '🔄 Có đồng nghiệp xin đổi tiết',
      message:
        `${actor.teacherName ?? 'Một giáo viên'} muốn đổi tiết ${this.when(mine)} của mình ` +
        `lấy tiết ${this.when(theirs)} của bạn. Lý do: ${reason}`,
      metadata: { swapRequestId: request.id },
    });

    return request;
  }

  /** The colleague's answer. Agreement moves it to the admin, not into the timetable. */
  async respond(requestId: string, accept: boolean, note: string, actor: SwapActor) {
    const request = await this.prisma.swapRequest.findUnique({
      where: { id: requestId },
      include: { requester_teacher: true, partner_teacher: true },
    });
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu đổi tiết.');

    if (actor.role !== 'ADMIN' && actor.teacherId !== request.partner_teacher_id) {
      throw new ForbiddenException('Chỉ giáo viên được hỏi mới trả lời được yêu cầu này.');
    }
    if (request.status !== SwapStatus.PENDING_PARTNER) {
      throw new BadRequestException('Yêu cầu này không còn chờ bạn trả lời.');
    }

    const updated = await this.prisma.swapRequest.update({
      where: { id: requestId },
      data: {
        status: accept ? SwapStatus.PENDING_ADMIN : SwapStatus.PARTNER_REJECTED,
        partner_note: note?.trim() || null,
      },
    });

    await this.notifyTeacher(request.requester_teacher_id, {
      title: accept ? '✅ Đồng nghiệp đồng ý đổi tiết' : '❌ Đồng nghiệp từ chối đổi tiết',
      message: accept
        ? `${request.partner_teacher.full_name} đã đồng ý. Yêu cầu đang chờ quản trị viên duyệt.`
        : `${request.partner_teacher.full_name} từ chối.${note ? ` Lý do: ${note}` : ''}`,
      metadata: { swapRequestId: requestId },
    });

    if (accept) {
      // Broadcast to admins - user_id null means every admin sees it
      await this.notifications.create({
        userId: null,
        category: 'SWAP_REQUEST',
        title: '🔄 Yêu cầu đổi tiết chờ duyệt',
        message:
          `${request.requester_teacher.full_name} và ${request.partner_teacher.full_name} ` +
          `đã thống nhất đổi tiết, chờ quản trị viên duyệt.`,
        metadata: { swapRequestId: requestId },
      });
    }

    return updated;
  }

  /**
   * The admin's decision, and the only place the timetable actually changes.
   *
   * Constraints are re-checked here rather than trusting the check made when the request
   * was created. Days may have passed; the partner may have picked up a class since. A
   * swap that was fine on Monday is not automatically fine on Friday.
   */
  async decide(requestId: string, approve: boolean, note: string, actor: SwapActor) {
    if (actor.role !== 'ADMIN') throw new ForbiddenException('Chỉ quản trị viên duyệt được.');

    const request = await this.prisma.swapRequest.findUnique({
      where: { id: requestId },
      include: { requester_teacher: true, partner_teacher: true },
    });
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu đổi tiết.');
    if (request.status !== SwapStatus.PENDING_ADMIN) {
      throw new BadRequestException('Yêu cầu này chưa được đồng nghiệp đồng ý, hoặc đã xử lý rồi.');
    }

    if (!approve) {
      const rejected = await this.prisma.swapRequest.update({
        where: { id: requestId },
        data: {
          status: SwapStatus.REJECTED,
          admin_note: note?.trim() || null,
          reviewed_by: actor.userId,
          reviewed_at: new Date(),
        },
      });
      await this.notifyBoth(request, {
        title: '❌ Quản trị viên không duyệt đổi tiết',
        message: `Yêu cầu đổi tiết đã bị từ chối.${note ? ` Lý do: ${note}` : ''}`,
      });
      return { request: rejected, applied: false };
    }

    const [mine, theirs] = await Promise.all([
      this.prisma.timetableSlot.findUnique({ where: { id: request.requester_slot_id } }),
      this.prisma.timetableSlot.findUnique({ where: { id: request.partner_slot_id } }),
    ]);
    if (!mine || !theirs) {
      throw new BadRequestException('Một trong hai tiết không còn tồn tại, yêu cầu này đã lỗi thời.');
    }

    // The people may have changed since the request was written
    if (mine.teacher_id !== request.requester_teacher_id || theirs.teacher_id !== request.partner_teacher_id) {
      throw new BadRequestException(
        'Giáo viên của một trong hai tiết đã thay đổi kể từ lúc gửi yêu cầu. Hãy tạo yêu cầu mới.',
      );
    }

    const slots = await this.loadSlots(mine.timetable_id);
    await this.constraints.initialize(request.semester_id);

    const scorer = new IncrementalScorer(this.constraints, slots);
    const before = { score: scorer.fitness(), hardViolations: scorer.hardViolations() };
    const after = this.scoreWithSwap(scorer, slots, mine.id, theirs.id);

    if (after.hardViolations > before.hardViolations) {
      throw new BadRequestException(
        `Không duyệt được: đổi hai tiết này bây giờ sẽ sinh ${after.hardViolations - before.hardViolations} lỗi cứng. ` +
          'Thời khóa biểu đã thay đổi kể từ lúc gửi yêu cầu.',
      );
    }

    // A swap is a dated correction, not a rewrite of the master timetable. Recording it as
    // an overlay keeps the published schedule intact and leaves an auditable trail.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overlay = await this.prisma.scheduleOverlay.create({
      data: {
        semester_id: request.semester_id,
        type: OverlayType.SWAP,
        scope: 'SCHOOL',
        date_from: today,
        date_to: today,
        priority: 30,
        reason:
          `Đổi tiết: ${request.requester_teacher.full_name} (${this.when(mine)}) ` +
          `↔ ${request.partner_teacher.full_name} (${this.when(theirs)})`,
        created_by: actor.userId,
        payload: {
          swapRequestId: requestId,
          slots: [
            { slotId: mine.id, from: { day: mine.day, period: mine.period }, to: { day: theirs.day, period: theirs.period } },
            { slotId: theirs.id, from: { day: theirs.day, period: theirs.period }, to: { day: mine.day, period: mine.period } },
          ],
        } as any,
      },
    });

    // Read both destinations before touching anything. The three updates below mutate the
    // same rows these came from, so reading `mine.day` mid-sequence would read a value the
    // sequence itself had just overwritten - including the parking coordinates.
    const mineGoesTo = { day: theirs.day, period: theirs.period };
    const theirsGoesTo = { day: mine.day, period: mine.period };

    // Park one period out of the way first: the table has unique indexes on
    // (class, time), (teacher, time) and (room, time), so a direct swap trips one of them
    await this.prisma.$transaction(async (tx) => {
      await tx.timetableSlot.update({ where: { id: mine.id }, data: { day: -1, period: -1 } });
      await tx.timetableSlot.update({ where: { id: theirs.id }, data: theirsGoesTo });
      await tx.timetableSlot.update({ where: { id: mine.id }, data: mineGoesTo });
    });

    const approved = await this.prisma.swapRequest.update({
      where: { id: requestId },
      data: {
        status: SwapStatus.APPROVED,
        admin_note: note?.trim() || null,
        reviewed_by: actor.userId,
        reviewed_at: new Date(),
        overlay_id: overlay.id,
      },
    });

    await this.notifyBoth(request, {
      title: '✅ Đổi tiết đã được duyệt',
      message:
        `Đã đổi: ${request.requester_teacher.full_name} ${this.when(theirs)} · ` +
        `${request.partner_teacher.full_name} ${this.when(mine)}.`,
    });

    this.logger.log(`Đã áp dụng đổi tiết ${requestId}, overlay ${overlay.id}`);
    return { request: approved, applied: true, overlayId: overlay.id, scoreDelta: after.score - before.score };
  }

  /** The requester changing their mind, before anyone has acted on it. */
  async cancel(requestId: string, actor: SwapActor) {
    const request = await this.prisma.swapRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu đổi tiết.');

    if (actor.role !== 'ADMIN' && actor.teacherId !== request.requester_teacher_id) {
      throw new ForbiddenException('Chỉ người gửi mới rút lại được yêu cầu.');
    }
    if (![SwapStatus.PENDING_PARTNER, SwapStatus.PENDING_ADMIN].includes(request.status as any)) {
      throw new BadRequestException('Yêu cầu này đã được xử lý nên không rút lại được.');
    }

    return this.prisma.swapRequest.update({
      where: { id: requestId },
      data: { status: SwapStatus.CANCELLED },
    });
  }

  /** Requests this person can see: their own, plus everything if they are an admin. */
  async list(semesterId: string, actor: SwapActor, status?: SwapStatus) {
    const requests = await this.prisma.swapRequest.findMany({
      where: {
        semester_id: semesterId,
        ...(status ? { status } : {}),
        ...(actor.role === 'ADMIN'
          ? {}
          : {
              OR: [
                { requester_teacher_id: actor.teacherId ?? '' },
                { partner_teacher_id: actor.teacherId ?? '' },
              ],
            }),
      },
      include: {
        requester_teacher: { select: { code: true, full_name: true } },
        partner_teacher: { select: { code: true, full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    // An admin deciding on a trade needs to see which periods move, not two names and a
    // reason. The periods are not a Prisma relation, so they are read here in one query
    // for the whole page rather than one query per request.
    const slots = await this.describeSlots(
      requests.flatMap((request) => [request.requester_slot_id, request.partner_slot_id]),
    );

    return requests.map((request) => ({
      ...request,
      requester_slot: slots.get(request.requester_slot_id) ?? null,
      partner_slot: slots.get(request.partner_slot_id) ?? null,
    }));
  }

  /** Where and what each period is, in the words a teacher would use for it. */
  private async describeSlots(slotIds: string[]) {
    const unique = [...new Set(slotIds)];
    if (unique.length === 0) return new Map<string, SlotSummary>();

    const rows = await this.prisma.timetableSlot.findMany({
      where: { id: { in: unique } },
      select: { id: true, day: true, period: true, class_id: true, subject_id: true },
    });

    const [subjects, classes] = await Promise.all([
      this.prisma.subject.findMany({
        where: { id: { in: [...new Set(rows.map((row) => row.subject_id))] } },
        select: { id: true, name: true },
      }),
      this.prisma.class.findMany({
        where: { id: { in: [...new Set(rows.map((row) => row.class_id))] } },
        select: { id: true, name: true },
      }),
    ]);
    const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
    const className = new Map(classes.map((c) => [c.id, c.name]));

    return new Map<string, SlotSummary>(
      rows.map((row) => [
        row.id,
        {
          day: row.day,
          period: row.period,
          when: this.when(row),
          subjectName: subjectName.get(row.subject_id) ?? '',
          className: className.get(row.class_id) ?? '',
        },
      ]),
    );
  }

  // ---------------------------------------------------------------- nội bộ

  /** Score the schedule as it would be if these two periods traded places. */
  /**
   * Cham diem thoi khoa bieu neu hai tiet nay doi cho cho nhau.
   *
   * Doi that hai tiet roi doi lai, thay vi sao chep ca mang. Bo cham diem tang dan nhan ra
   * cai gi vua doi cho bang cach so vi tri, nen no phai nhin thay mang that; ma sao chep
   * gan mot nghin tiet cho moi phuong an cung chinh la phan ton kem nhat.
   *
   * Doi lai o cuoi la bat buoc, ke ca khi cham diem nem loi: mot cau hoi khong duoc phep
   * lam thay doi thoi khoa bieu.
   */
  private scoreWithSwap(scorer: IncrementalScorer, slots: TimeSlot[], slotA: string, slotB: string) {
    const a = slots.find((s) => s.id === slotA)!;
    const b = slots.find((s) => s.id === slotB)!;

    const before = { aDay: a.day, aPeriod: a.period, bDay: b.day, bPeriod: b.period };
    a.day = before.bDay;
    a.period = before.bPeriod;
    b.day = before.aDay;
    b.period = before.aPeriod;

    try {
      return { score: scorer.fitness(), hardViolations: scorer.hardViolations() };
    } finally {
      a.day = before.aDay;
      a.period = before.aPeriod;
      b.day = before.bDay;
      b.period = before.bPeriod;
      // Cham lai mot lan de bo nho trong cua bo cham diem tro ve dung trang thai goc
      scorer.fitness();
    }
  }

  private async loadSlots(timetableId: string): Promise<TimeSlot[]> {
    const rows = await this.prisma.timetableSlot.findMany({ where: { timetable_id: timetableId } });
    return rows.map((s) => ({
      id: s.id,
      day: s.day,
      period: s.period,
      classId: s.class_id,
      subjectId: s.subject_id,
      teacherId: s.teacher_id,
      roomId: s.room_id ?? undefined,
    }));
  }

  private assertOwnsSlot(actor: SwapActor, teacherId: string) {
    if (actor.role === 'ADMIN') return;
    if (!actor.teacherId) {
      throw new ForbiddenException('Tài khoản của bạn chưa liên kết với hồ sơ giáo viên.');
    }
    if (actor.teacherId !== teacherId) {
      throw new ForbiddenException('Bạn chỉ xin đổi được tiết của chính mình.');
    }
  }

  private when(slot: { day: number; period: number }): string {
    return `${DAY_LABEL[slot.day] ?? `Thứ ${slot.day}`} tiết ${slot.period}`;
  }

  /** Notify a teacher through their user account, when they have one. */
  private async notifyTeacher(
    teacherId: string,
    payload: { title: string; message: string; metadata?: any },
  ) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { user: { select: { id: true } } },
    });
    if (!teacher?.user?.id) return;

    await this.notifications.create({
      userId: teacher.user.id,
      category: 'SWAP_REQUEST',
      ...payload,
    });
  }

  private async notifyBoth(
    request: { requester_teacher_id: string; partner_teacher_id: string; id: string },
    payload: { title: string; message: string },
  ) {
    await Promise.all([
      this.notifyTeacher(request.requester_teacher_id, { ...payload, metadata: { swapRequestId: request.id } }),
      this.notifyTeacher(request.partner_teacher_id, { ...payload, metadata: { swapRequestId: request.id } }),
    ]);
  }
}
