import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConstraintService, TimeSlot } from '../../algorithm/constraint.service';
import { SwapGraphService } from '../../algorithm/swap-graph.service';
import { FairnessService } from '../../algorithm/fairness.service';
import { answer, denied, ToolContext, ToolDefinition, ToolResult } from './tool.types';
import { requireAdmin, resolveTeacherScope } from './guardrails';

const DAY_LABEL: Record<number, string> = {
  2: 'Thứ hai', 3: 'Thứ ba', 4: 'Thứ tư', 5: 'Thứ năm', 6: 'Thứ sáu', 7: 'Thứ bảy',
};

/**
 * What the assistant is allowed to do, as ordinary functions.
 *
 * Every one of these is callable with curl and answers the same way whether a model asked
 * or a person did. That is the point: the interesting logic lives in tested services, and
 * the model only chooses which one to call and puts the answer into a sentence.
 *
 * Nothing here asks the model whether something is legal. `check_swap_feasibility` runs the
 * real `ConstraintService`, so the assistant cannot invent a rule or claim a swap is fine
 * when it is not - the worst it can do is describe a real answer badly.
 */
@Injectable()
export class ScheduleTools {
  constructor(
    private prisma: PrismaService,
    private constraints: ConstraintService,
    private swapGraph: SwapGraphService,
    private fairness: FairnessService,
  ) {}

  all(): ToolDefinition[] {
    return [
      this.getMySchedule(),
      this.getClassSchedule(),
      this.getTeacherWorkload(),
      this.findFreeTeachers(),
      this.findSwapCandidates(),
      this.checkSwapFeasibility(),
      this.explainSlot(),
      this.searchRegulations(),
      this.createBusyRegistration(),
    ];
  }

  // ---------------------------------------------------------------- đọc

  private getMySchedule(): ToolDefinition {
    return {
      name: 'get_my_schedule',
      description: 'Lịch dạy trong tuần của người đang hỏi, hoặc của một giáo viên cụ thể nếu người hỏi là quản trị viên.',
      parameters: {
        type: 'object',
        properties: {
          teacherId: { type: 'string', description: 'Chỉ quản trị viên mới dùng được. Bỏ trống để xem lịch của chính mình.' },
        },
      },
      run: async (args, context) => {
        const scope = resolveTeacherScope(context.actor, args.teacherId);
        if (!scope.allowed) return denied(scope.reason);

        const slots = await this.slotsOf(context.semesterId);
        const own = slots.filter((s) => s.teacherId === scope.teacherId);
        if (own.length === 0) return denied('Chưa có tiết nào được xếp cho giáo viên này.');

        return answer({ teacherId: scope.teacherId, periods: await this.describe(own) });
      },
    };
  }

  private getClassSchedule(): ToolDefinition {
    return {
      name: 'get_class_schedule',
      description: 'Thời khóa biểu trong tuần của một lớp.',
      parameters: {
        type: 'object',
        properties: { className: { type: 'string', description: 'Tên lớp, ví dụ 10A1' } },
        required: ['className'],
      },
      run: async (args, context) => {
        const cls = await this.prisma.class.findFirst({
          where: { name: { equals: String(args.className ?? ''), mode: 'insensitive' } },
        });
        if (!cls) return denied(`Không tìm thấy lớp "${args.className}".`);

        const slots = (await this.slotsOf(context.semesterId)).filter((s) => s.classId === cls.id);
        if (slots.length === 0) return denied(`Lớp ${cls.name} chưa có tiết nào được xếp.`);

        return answer({ className: cls.name, periods: await this.describe(slots) });
      },
    };
  }

  private getTeacherWorkload(): ToolDefinition {
    return {
      name: 'get_teacher_workload',
      description: 'Số tiết dạy trong tuần so với định mức, và chất lượng lịch của giáo viên.',
      parameters: {
        type: 'object',
        properties: { teacherId: { type: 'string', description: 'Chỉ quản trị viên mới dùng được.' } },
      },
      run: async (args, context) => {
        const scope = resolveTeacherScope(context.actor, args.teacherId);
        if (!scope.allowed) return denied(scope.reason);

        const report = await this.fairness.report(context.semesterId);
        const mine = report.teachers.find((t) => t.teacherId === scope.teacherId);
        if (!mine) return denied('Chưa có dữ liệu tải giảng dạy cho giáo viên này.');

        const teacher = await this.prisma.teacher.findUnique({ where: { id: scope.teacherId } });
        return answer({
          name: mine.name,
          periods: mine.periods,
          quota: teacher?.max_periods_per_week ?? 17,
          scheduleQuality: mine.quality,
          burdens: mine.burdens,
          // Only an admin has any business seeing how one teacher compares with the rest
          ...(context.actor.role === 'ADMIN'
            ? { schoolMedian: report.summary.median, schoolWorst: report.summary.worst }
            : {}),
        });
      },
    };
  }

  // ------------------------------------------------------------- tìm kiếm

  private findFreeTeachers(): ToolDefinition {
    return {
      name: 'find_free_teachers',
      description: 'Những giáo viên không có tiết vào một khung giờ cụ thể.',
      parameters: {
        type: 'object',
        properties: {
          day: { type: 'number', description: 'Thứ, từ 2 đến 7' },
          period: { type: 'number', description: 'Tiết, từ 1 đến 10' },
          subjectCode: { type: 'string', description: 'Lọc theo môn chuyên môn, ví dụ TOAN' },
        },
        required: ['day', 'period'],
      },
      run: async (args, context) => {
        const refusal = requireAdmin(context.actor);
        if (refusal) return denied(refusal);

        const day = Number(args.day);
        const period = Number(args.period);
        if (!(day >= 2 && day <= 7) || !(period >= 1 && period <= 10)) {
          return denied('Thứ phải từ 2 đến 7 và tiết phải từ 1 đến 10.');
        }

        const slots = await this.slotsOf(context.semesterId);
        const busy = new Set(slots.filter((s) => s.day === day && s.period === period).map((s) => s.teacherId));

        const teachers = await this.prisma.teacher.findMany({
          where: args.subjectCode ? { major_subject: String(args.subjectCode) } : {},
          select: { id: true, code: true, full_name: true, major_subject: true },
        });

        const free = teachers
          .filter((t) => !busy.has(t.id))
          .filter((t) => !this.constraints.isTeacherBusy(t.id, day, period))
          .map((t) => ({ teacherId: t.id, code: t.code, name: t.full_name, subject: t.major_subject }));

        return answer({ when: `${DAY_LABEL[day]} tiết ${period}`, free });
      },
    };
  }

  private findSwapCandidates(): ToolDefinition {
    return {
      name: 'find_swap_candidates',
      description: 'Những tiết có thể đổi chỗ với một tiết cho trước, kèm chi phí từng phương án.',
      parameters: {
        type: 'object',
        properties: { slotId: { type: 'string', description: 'Mã tiết cần đổi' } },
        required: ['slotId'],
      },
      run: async (args, context) => {
        const slot = await this.prisma.timetableSlot.findUnique({ where: { id: String(args.slotId ?? '') } });
        if (!slot) return denied('Không tìm thấy tiết này.');

        const scope = resolveTeacherScope(context.actor, slot.teacher_id);
        if (!scope.allowed) return denied('Bạn chỉ đổi được tiết của chính mình.');

        const options = await this.swapGraph.previewMoves(slot.id);
        return answer(options);
      },
    };
  }

  // ------------------------------------------------------------ kiểm tra

  private checkSwapFeasibility(): ToolDefinition {
    return {
      name: 'check_swap_feasibility',
      description:
        'Kiểm tra đổi chỗ hai tiết có vi phạm ràng buộc nào không. Luôn dùng công cụ này thay vì tự suy luận.',
      parameters: {
        type: 'object',
        properties: {
          slotIdA: { type: 'string' },
          slotIdB: { type: 'string' },
        },
        required: ['slotIdA', 'slotIdB'],
      },
      run: async (args, context) => {
        const [a, b] = await Promise.all([
          this.prisma.timetableSlot.findUnique({ where: { id: String(args.slotIdA ?? '') } }),
          this.prisma.timetableSlot.findUnique({ where: { id: String(args.slotIdB ?? '') } }),
        ]);
        if (!a || !b) return denied('Không tìm thấy một trong hai tiết.');
        if (a.timetable_id !== b.timetable_id) return denied('Hai tiết không thuộc cùng một thời khóa biểu.');

        const slots = await this.slotsOf(context.semesterId);
        await this.constraints.initialize(context.semesterId);

        const before = this.constraints.getFitnessDetails(slots);

        // Swap on a copy so nothing is changed by a question
        const swapped = slots.map((s) =>
          s.id === a.id
            ? { ...s, day: b.day, period: b.period }
            : s.id === b.id
              ? { ...s, day: a.day, period: a.period }
              : s,
        );
        const after = this.constraints.getFitnessDetails(swapped);

        return answer({
          feasible: after.hardViolations === 0,
          hardViolationsBefore: before.hardViolations,
          hardViolationsAfter: after.hardViolations,
          scoreBefore: before.score,
          scoreAfter: after.score,
          // The model reports this; it never decides it
          verdict:
            after.hardViolations > 0
              ? 'Không đổi được: sẽ sinh lỗi cứng.'
              : after.score >= before.score
                ? 'Đổi được, và thời khóa biểu còn tốt hơn.'
                : 'Đổi được, nhưng thời khóa biểu kém đi một chút.',
        });
      },
    };
  }

  private explainSlot(): ToolDefinition {
    return {
      name: 'explain_slot',
      description: 'Vì sao một tiết lại nằm ở vị trí đó: ràng buộc nào đã giữ nó ở đây.',
      parameters: {
        type: 'object',
        properties: { slotId: { type: 'string' } },
        required: ['slotId'],
      },
      run: async (args, context) => {
        const slot = await this.prisma.timetableSlot.findUnique({
          where: { id: String(args.slotId ?? '') },
          include: { subject: true, class: true, teacher: true, room: true },
        });
        if (!slot) return denied('Không tìm thấy tiết này.');

        await this.constraints.initialize(context.semesterId);

        // Fixed-period rules are declared per grade and session, so ask with the class's
        // own values rather than the subject's
        const rules = this.constraints.getFixedRulesFor(
          slot.class?.grade_level ?? 0,
          slot.class?.main_session ?? 0,
        );
        const pinnedHere = rules.find(
          (rule: any) =>
            rule.subject_code === slot.subject?.code &&
            rule.day_of_week === slot.day &&
            rule.period === slot.period,
        );

        return answer({
          when: `${DAY_LABEL[slot.day]} tiết ${slot.period}`,
          subject: slot.subject?.name,
          className: slot.class?.name,
          teacher: slot.teacher?.full_name,
          room: slot.room?.name,
          isLocked: slot.is_locked,
          // The three reasons a period sits where it does, in the order a person would ask
          pinnedByRule: pinnedHere ? pinnedHere.label ?? 'Tiết cố định theo quy định của trường' : null,
          lockedByHand: slot.is_locked,
          teacherRequestedFreeHere: this.constraints.isTeacherBusy(slot.teacher_id, slot.day, slot.period),
        });
      },
    };
  }

  // ------------------------------------------------------------- văn bản

  private searchRegulations(): ToolDefinition {
    return {
      name: 'search_regulations',
      description: 'Tra quy định về định mức tiết dạy và cách xếp thời khóa biểu THPT.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Từ khoá cần tra' } },
        required: ['query'],
      },
      run: async (args) => {
        const query = String(args.query ?? '').toLowerCase().trim();
        if (!query) return denied('Cần từ khoá để tra.');

        const hits = REGULATIONS.filter(
          (item) =>
            item.title.toLowerCase().includes(query) ||
            item.body.toLowerCase().includes(query) ||
            item.keywords.some((k) => query.includes(k)),
        );

        if (hits.length === 0) {
          return denied(
            'Không tìm thấy quy định nào khớp. Hệ thống chỉ tra được các văn bản đã nạp sẵn, chưa tra toàn văn.',
          );
        }
        return answer(hits.slice(0, 3));
      },
    };
  }

  // ----------------------------------------------------------------- ghi

  private createBusyRegistration(): ToolDefinition {
    return {
      name: 'create_busy_registration',
      description:
        'Chuẩn bị một đơn xin nghỉ. KHÔNG gửi ngay — trả về thẻ xác nhận để người dùng bấm duyệt.',
      parameters: {
        type: 'object',
        properties: {
          weekNumber: { type: 'number' },
          day: { type: 'number', description: 'Thứ, từ 2 đến 7' },
          period: { type: 'number', description: 'Tiết, từ 1 đến 10' },
          reason: { type: 'string' },
        },
        required: ['weekNumber', 'day', 'period', 'reason'],
      },
      writes: true,
      run: async (args, context): Promise<ToolResult> => {
        const scope = resolveTeacherScope(context.actor);
        if (!scope.allowed) return denied(scope.reason);

        const day = Number(args.day);
        const period = Number(args.period);
        const week = Number(args.weekNumber);
        const reason = String(args.reason ?? '').trim();

        if (!(day >= 2 && day <= 7)) return denied('Thứ phải từ 2 đến 7.');
        if (!(period >= 1 && period <= 10)) return denied('Tiết phải từ 1 đến 10.');
        if (!(week >= 1 && week <= 52)) return denied('Tuần phải từ 1 đến 52.');
        if (reason.length < 3) return denied('Cần ghi lý do xin nghỉ.');

        // Never written here. The assistant proposes; the person presses the button.
        return {
          ok: true,
          confirmation: {
            action: 'create_busy_registration',
            summary: `Xin nghỉ tuần ${week}, ${DAY_LABEL[day]} tiết ${period} — lý do: ${reason}`,
            payload: {
              teacherId: scope.teacherId,
              semesterId: context.semesterId,
              weekNumber: week,
              dayOfWeek: day,
              period,
              reason,
            },
          },
        };
      },
    };
  }

  // ------------------------------------------------------------- nội bộ

  private async slotsOf(semesterId: string): Promise<TimeSlot[]> {
    const timetable =
      (await this.prisma.generatedTimetable.findFirst({
        where: { semester_id: semesterId, is_official: true },
        orderBy: { created_at: 'desc' },
        include: { slots: true },
      })) ??
      (await this.prisma.generatedTimetable.findFirst({
        where: { semester_id: semesterId },
        orderBy: { created_at: 'desc' },
        include: { slots: true },
      }));

    return (timetable?.slots ?? []).map((s) => ({
      id: s.id,
      day: s.day,
      period: s.period,
      classId: s.class_id,
      subjectId: s.subject_id,
      teacherId: s.teacher_id,
      roomId: s.room_id ?? undefined,
    }));
  }

  private async describe(slots: TimeSlot[]) {
    const [subjects, classes, rooms] = await Promise.all([
      this.prisma.subject.findMany({ select: { id: true, name: true } }),
      this.prisma.class.findMany({ select: { id: true, name: true } }),
      this.prisma.room.findMany({ select: { id: true, name: true } }),
    ]);
    const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
    const className = new Map(classes.map((c) => [c.id, c.name]));
    const roomName = new Map(rooms.map((r) => [r.id, r.name]));

    return [...slots]
      .sort((a, b) => a.day - b.day || a.period - b.period)
      .map((s) => ({
        slotId: s.id,
        day: DAY_LABEL[s.day],
        period: s.period,
        subject: subjectName.get(s.subjectId),
        className: className.get(s.classId),
        room: s.roomId ? roomName.get(s.roomId) : undefined,
      }));
  }
}

/**
 * The regulations the assistant may cite.
 *
 * Held here rather than fetched from the open web on purpose: an assistant that answers
 * "what is my quota" by summarising a random search result is worse than one that says it
 * does not know. Every entry names its source so the answer can be checked.
 */
const REGULATIONS = [
  {
    title: 'Định mức tiết dạy giáo viên THPT',
    source: 'Thông tư 05/2025/TT-BGDĐT',
    body: 'Giáo viên trung học phổ thông dạy 17 tiết mỗi tuần. Giáo viên chủ nhiệm được giảm 4 tiết mỗi tuần.',
    keywords: ['định mức', 'dinh muc', '17 tiết', 'số tiết', 'quota', 'chủ nhiệm'],
  },
  {
    title: 'Chào cờ và sinh hoạt lớp',
    source: 'Thông tư 05/2025/TT-BGDĐT',
    body: 'Chào cờ và sinh hoạt lớp là nhiệm vụ của giáo viên chủ nhiệm, đã được tính trong phần giảm trừ định mức, nên không cộng thêm vào số tiết dạy.',
    keywords: ['chào cờ', 'chao co', 'sinh hoạt', 'gvcn', 'chủ nhiệm'],
  },
  {
    title: 'Chương trình giáo dục phổ thông 2018',
    source: 'Thông tư 32/2018/TT-BGDĐT',
    body: 'Quy định khung chương trình tổng thể cho cấp trung học phổ thông, gồm môn bắt buộc và môn lựa chọn theo tổ hợp.',
    keywords: ['gdpt', 'chương trình', 'chuong trinh', 'tổ hợp', '2018'],
  },
  {
    title: 'Lịch sử là môn bắt buộc ở THPT',
    source: 'Thông tư 13/2022/TT-BGDĐT',
    body: 'Điều chỉnh chương trình GDPT 2018: Lịch sử trở thành nội dung bắt buộc ở cấp trung học phổ thông với 2 tiết mỗi tuần.',
    keywords: ['lịch sử', 'lich su', 'bắt buộc', '13/2022'],
  },
  {
    title: 'Số tiết tối đa trong một buổi',
    source: 'Điều lệ trường trung học',
    body: 'Mỗi buổi học chính khoá không quá 5 tiết. Buổi học thứ hai trong ngày không quá 3 tiết.',
    keywords: ['bao nhiêu tiết', 'một buổi', 'tối đa', 'buổi chiều', '5 tiết'],
  },
];
