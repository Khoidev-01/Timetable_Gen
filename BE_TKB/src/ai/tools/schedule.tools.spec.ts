import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { ConstraintService } from '../../algorithm/constraint.service';
import { SwapGraphService } from '../../algorithm/swap-graph.service';
import { FairnessService } from '../../algorithm/fairness.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ScheduleTools } from './schedule.tools';
import { Actor, ToolContext } from './tool.types';

/**
 * Every tool called directly, with no model anywhere.
 *
 * That is the design being checked as much as the behaviour: if these need an LLM to
 * exercise, the interesting logic has leaked into the prompt, where it cannot be tested.
 */
const TEACHER: Actor = {
  userId: 'u1', username: 'colan', role: 'TEACHER', teacherId: 'T1', teacherName: 'Cô Lan',
};
const ADMIN: Actor = { userId: 'u2', username: 'admin', role: 'ADMIN' };

const SLOTS = [
  { id: 's1', day: 2, period: 1, class_id: 'C1', subject_id: 1, teacher_id: 'T1', room_id: 1, is_locked: false },
  { id: 's2', day: 3, period: 4, class_id: 'C1', subject_id: 2, teacher_id: 'T2', room_id: 1, is_locked: false },
  { id: 's3', day: 2, period: 2, class_id: 'C2', subject_id: 1, teacher_id: 'T1', room_id: 1, is_locked: true },
];

describe('ScheduleTools', () => {
  let tools: ScheduleTools;
  const context = (actor: Actor): ToolContext => ({ actor, semesterId: 'sem1' });
  const call = (name: string, args: Record<string, any>, actor: Actor) =>
    tools.all().find((t) => t.name === name)!.run(args, context(actor));

  beforeEach(async () => {
    const prisma = {
      generatedTimetable: { findFirst: async () => ({ id: 'tt1', slots: SLOTS }) },
      timetableSlot: {
        findUnique: async ({ where, include }: any) => {
          const slot = SLOTS.find((s) => s.id === where.id);
          if (!slot) return null;
          if (!include) return slot;
          return {
            ...slot,
            subject: { name: 'Toán', code: 'TOAN' },
            class: { name: '10A1', grade_level: 10, main_session: 0 },
            teacher: { full_name: 'Cô Lan' },
            room: { name: 'P101' },
          };
        },
      },
      class: {
        findFirst: async ({ where }: any) =>
          String(where.name.equals).toLowerCase() === '10a1'
            ? { id: 'C1', name: '10A1', grade_level: 10, main_session: 0 }
            : null,
        findMany: async () => [
          { id: 'C1', name: '10A1' },
          { id: 'C2', name: '10A2' },
        ],
      },
      teacher: {
        findUnique: async () => ({ id: 'T1', max_periods_per_week: 17 }),
        // `major_subject` is null here on purpose: it is null for every teacher in the real
        // database, and a fixture that fills it in would hide exactly the bug this checks
        findMany: async ({ where }: any) => {
          const all = [
            { id: 'T1', code: 'GV1', full_name: 'Cô Lan', major_subject: null },
            { id: 'T2', code: 'GV2', full_name: 'Thầy Minh', major_subject: null },
            { id: 'T3', code: 'GV3', full_name: 'Cô Hoa', major_subject: null },
          ];
          if (where?.major_subject?.in) return [];
          if (where?.id?.in) return all.filter((t) => where.id.in.includes(t.id));
          return all;
        },
      },
      teachingAssignment: {
        findMany: async ({ where }: any) =>
          where.subject_id === 1
            ? [{ teacher_id: 'T1' }, { teacher_id: 'T3' }]
            : [{ teacher_id: 'T2' }],
      },
      subject: {
        findMany: async () => [{ id: 1, name: 'Toán' }, { id: 2, name: 'Ngữ văn' }],
        findFirst: async ({ where }: any) => {
          const wanted = String(where.OR[0].code.equals).toLowerCase();
          const all = [
            { id: 1, code: 'TOAN', name: 'Toán' },
            { id: 2, code: 'VAN', name: 'Ngữ văn' },
          ];
          return all.find((x) => x.code.toLowerCase() === wanted || x.name.toLowerCase() === wanted) ?? null;
        },
      },
      room: { findMany: async () => [{ id: 1, name: 'P101' }] },
    };

    const constraints = {
      initialize: async () => undefined,
      isTeacherBusy: (id: string, day: number, period: number) => id === 'T3' && day === 2 && period === 1,
      getFixedRulesFor: () => [],
      getFitnessDetails: (slots: any[]) => ({
        hardViolations: slots.some((s) => s.day === 9) ? 1 : 0,
        score: slots.some((s) => s.day === 9) ? -500 : 100,
        // Đúng hình dạng hàm thật trả về: công cụ đọc bậc chất lượng, không đọc điểm
        quality: { gradeLabel: slots.some((s) => s.day === 9) ? 'Tệ' : 'Tốt' },
      }),
    };

    const fairness = {
      report: async () => ({
        teachers: [{ teacherId: 'T1', name: 'Cô Lan', periods: 2, quality: 80, burdens: [] }],
        summary: { best: 90, worst: 60, median: 75, spread: 30 },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleTools,
        { provide: PrismaService, useValue: prisma },
        { provide: ConstraintService, useValue: constraints },
        {
          provide: SwapGraphService,
          useValue: {
            // Giong hinh dang that: da cham diem san tung o, ke ca o dang bi vi pham
            previewMoves: async () => ({
              slotId: 's1',
              baseScore: 100,
              targets: [
                { day: 4, period: 1, valid: true, deltaScore: -2, swapsWith: 's2' },
                { day: 2, period: 2, valid: true, deltaScore: 5, swapsWith: 's3' },
                { day: 5, period: 3, valid: true, deltaScore: -8 },
                { day: 6, period: 1, valid: false, reason: 'Vi phạm ràng buộc cứng' },
              ],
            }),
          },
        },
        {
          provide: KnowledgeService,
          useValue: {
            // Kho tai lieu that duoc do rieng o knowledge.service.spec.ts; o day chi can
            // biet cong cu chuyen tiep dung cau hoi va xu ly dung truong hop khong tim thay
            search: async (query: string) =>
              query.includes('định mức')
                ? [{ source: 'Thông tư 05/2025/TT-BGDĐT', article: null, title: 'Định mức tiết dạy', body: '17 tiết mỗi tuần.', score: 1 }]
                : [],
          },
        },
        { provide: FairnessService, useValue: fairness },
      ],
    }).compile();

    tools = module.get(ScheduleTools);
  });

  it('có đúng 9 công cụ, tên không trùng', () => {
    const names = tools.all().map((t) => t.name);
    expect(names).toHaveLength(9);
    expect(new Set(names).size).toBe(9);
  });

  it('mọi công cụ đều khai báo tham số theo JSON Schema', () => {
    for (const tool of tools.all()) {
      expect(tool.parameters).toHaveProperty('type', 'object');
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('giáo viên lấy được lịch của mình', async () => {
    const result: any = await call('get_my_schedule', {}, TEACHER);
    expect(result.ok).toBe(true);
    expect(result.data.periods).toHaveLength(2);
    expect(result.data.periods[0].day).toBe('Thứ hai');
  });

  it('giáo viên hỏi lịch đồng nghiệp thì bị từ chối', async () => {
    const result = await call('get_my_schedule', { teacherId: 'T2' }, TEACHER);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('chính mình');
  });

  it('quản trị viên hỏi lịch người khác thì được', async () => {
    const result: any = await call('get_my_schedule', { teacherId: 'T2' }, ADMIN);
    expect(result.ok).toBe(true);
    expect(result.data.periods).toHaveLength(1);
  });

  it('lấy được lịch của lớp, và báo rõ khi lớp không tồn tại', async () => {
    const ok: any = await call('get_class_schedule', { className: '10A1' }, TEACHER);
    expect(ok.ok).toBe(true);
    expect(ok.data.className).toBe('10A1');

    const missing = await call('get_class_schedule', { className: '12Z9' }, TEACHER);
    expect(missing.ok).toBe(false);
    expect(missing.message).toContain('12Z9');
  });

  it('giáo viên chỉ thấy tải của mình, không thấy số liệu toàn trường', async () => {
    const mine: any = await call('get_teacher_workload', {}, TEACHER);
    expect(mine.data.periods).toBe(2);
    expect(mine.data.schoolMedian).toBeUndefined();

    const asAdmin: any = await call('get_teacher_workload', { teacherId: 'T1' }, ADMIN);
    expect(asAdmin.data.schoolMedian).toBe(75);
  });

  it('tìm giáo viên rảnh là việc của quản trị viên', async () => {
    const refused = await call('find_free_teachers', { day: 2, period: 1 }, TEACHER);
    expect(refused.ok).toBe(false);

    const allowed: any = await call('find_free_teachers', { day: 2, period: 1 }, ADMIN);
    expect(allowed.ok).toBe(true);
    // T1 đang dạy, T3 đã đăng ký bận -> chỉ còn T2
    expect(allowed.data.free.map((t: any) => t.teacherId)).toEqual(['T2']);
  });

  it('lọc theo môn dựa trên phân công, không dựa vào major_subject đang rỗng', async () => {
    // T1 và T3 đều dạy Toán theo phân công; T1 đang có tiết, T3 đã đăng ký bận
    const toan: any = await call('find_free_teachers', { day: 2, period: 1, subject: 'Toán' }, ADMIN);
    expect(toan.ok).toBe(true);
    expect(toan.data.candidatesConsidered).toBe(2);
    expect(toan.data.free).toEqual([]);

    // Cùng môn đó, giờ khác: T1 và T3 đều rảnh
    const later: any = await call('find_free_teachers', { day: 4, period: 5, subject: 'TOAN' }, ADMIN);
    expect(later.data.free.map((t: any) => t.teacherId)).toEqual(['T1', 'T3']);
  });

  it('nói rõ là không có môn đó, thay vì trả lời "không ai rảnh"', async () => {
    const result = await call('find_free_teachers', { day: 2, period: 1, subject: 'Thiên văn học' }, ADMIN);
    expect(result.ok).toBe(false);
    expect((result as any).reason ?? (result as any).message).toContain('Thiên văn học');
  });

  it('từ chối thứ và tiết nằm ngoài khoảng hợp lệ', async () => {
    expect((await call('find_free_teachers', { day: 9, period: 1 }, ADMIN)).ok).toBe(false);
    expect((await call('find_free_teachers', { day: 2, period: 99 }, ADMIN)).ok).toBe(false);
  });

  it('không chào phương án đổi với tiết của chính mình — đổi xong vẫn phải đứng lớp giờ đó', async () => {
    const result: any = await call('find_swap_candidates', { slotId: 's1' }, TEACHER);
    expect(result.ok).toBe(true);

    // s3 cũng là tiết của T1, nên phương án thứ hai phải bị loại dù điểm cao nhất
    expect(result.data.selfSwapsSkipped).toBe(1);
    expect(result.data.options.map((o: any) => o.period)).toEqual([1, 3]);
    expect(result.data.options.some((o: any) => o.partnerTeacher === 'Cô Lan')).toBe(false);
  });

  it('nói rõ phương án đã được kiểm sẵn, kèm tên người và lớp', async () => {
    const result: any = await call('find_swap_candidates', { slotId: 's1' }, TEACHER);

    expect(result.data.alreadyCheckedByConstraintService).toBe(true);
    expect(result.data.rejectedCount).toBe(1);

    const swap = result.data.options.find((o: any) => o.swapsWithSlotId === 's2');
    expect(swap.partnerTeacher).toBe('Thầy Minh');
    expect(swap.partnerClass).toBe('10A1');

    // Ô trống thì nói là chuyển thẳng, không bịa ra một người để đổi cùng
    const empty = result.data.options.find((o: any) => !o.swapsWithSlotId);
    expect(empty.note).toContain('trống');
  });

  it('tính khả thi của việc đổi tiết bằng ConstraintService, không tự phán', async () => {
    const result: any = await call('check_swap_feasibility', { slotIdA: 's1', slotIdB: 's2' }, ADMIN);
    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty('hardViolationsAfter');
    expect(result.data.feasible).toBe(true);
    expect(result.data.verdict).toContain('Đổi được');
  });

  it('kiểm tra đổi tiết không làm thay đổi dữ liệu thật', async () => {
    const before = JSON.stringify(SLOTS);
    await call('check_swap_feasibility', { slotIdA: 's1', slotIdB: 's2' }, ADMIN);
    expect(JSON.stringify(SLOTS)).toBe(before);
  });

  it('giải thích được vì sao một tiết nằm ở đó', async () => {
    const result: any = await call('explain_slot', { slotId: 's3' }, TEACHER);
    expect(result.ok).toBe(true);
    expect(result.data.lockedByHand).toBe(true);
    expect(result.data.when).toBe('Thứ hai tiết 2');
  });

  it('tra được quy định, kèm nguồn để trích dẫn lại', async () => {
    const found: any = await call('search_regulations', { query: 'định mức' }, TEACHER);

    expect(found.ok).toBe(true);
    expect(found.data.hits[0].source).toContain('05/2025');
    // Mo hinh phai duoc nhac rang moi y rut ra tu day deu can dan nguon
    expect(found.data.citeEveryClaim).toBeTruthy();
  });

  it('không có trong tài liệu thì nói thẳng, không đưa mẩu gần đúng nhất', async () => {
    const missing = await call('search_regulations', { query: 'luật hàng hải' }, TEACHER);

    expect(missing.ok).toBe(false);
    expect(missing.message).toContain('không đoán thêm');
  });

  it('công cụ ghi KHÔNG tự thực hiện, chỉ trả thẻ xác nhận', async () => {
    const result = await call(
      'create_busy_registration',
      { weekNumber: 3, day: 4, period: 2, reason: 'Họp chuyên môn' },
      TEACHER,
    );

    expect(result.ok).toBe(true);
    expect(result.confirmation).toBeDefined();
    expect(result.confirmation!.action).toBe('create_busy_registration');
    expect(result.confirmation!.summary).toContain('Thứ tư tiết 2');
    // Không có data nghĩa là chưa có gì được ghi xuống
    expect(result.data).toBeUndefined();
  });

  it('công cụ ghi kiểm tra tham số trước khi đề xuất', async () => {
    const badDay = await call('create_busy_registration', { weekNumber: 3, day: 99, period: 2, reason: 'x' }, TEACHER);
    expect(badDay.ok).toBe(false);

    const noReason = await call('create_busy_registration', { weekNumber: 3, day: 4, period: 2, reason: '' }, TEACHER);
    expect(noReason.ok).toBe(false);
    expect(noReason.message).toContain('lý do');
  });

  it('chỉ đúng một công cụ được đánh dấu là ghi dữ liệu', () => {
    const writers = tools.all().filter((t) => t.writes);
    expect(writers.map((t) => t.name)).toEqual(['create_busy_registration']);
  });
});
