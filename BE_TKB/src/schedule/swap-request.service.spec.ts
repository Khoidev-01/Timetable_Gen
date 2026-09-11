import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ConstraintService } from '../algorithm/constraint.service';
import { SwapGraphService } from '../algorithm/swap-graph.service';
import { NotificationService } from '../notifications/notification.service';
import { SwapActor, SwapRequestService } from './swap-request.service';

/**
 * Three people have to agree, and each of them can only do their own part.
 *
 * The case that matters most is the last one: two teachers agreeing on Monday does not make
 * a swap legal on Friday, so approval re-checks the constraints against the schedule as it
 * stands at that moment.
 */
const ANNA: SwapActor = { userId: 'u-anna', role: 'TEACHER', teacherId: 'T1', teacherName: 'Cô Anna' };
const BINH: SwapActor = { userId: 'u-binh', role: 'TEACHER', teacherId: 'T2', teacherName: 'Thầy Bình' };
const CUONG: SwapActor = { userId: 'u-cuong', role: 'TEACHER', teacherId: 'T3', teacherName: 'Cô Cường' };
const ADMIN: SwapActor = { userId: 'u-admin', role: 'ADMIN' };

describe('SwapRequestService', () => {
  let service: SwapRequestService;
  let slots: any[];
  let requests: any[];
  let overlays: any[];
  let sent: any[];
  let hardViolationsAfterSwap: number;

  beforeEach(async () => {
    slots = [
      { id: 's1', timetable_id: 'tt1', teacher_id: 'T1', class_id: 'C1', subject_id: 1, day: 2, period: 1, room_id: null, is_locked: false },
      { id: 's2', timetable_id: 'tt1', teacher_id: 'T2', class_id: 'C2', subject_id: 2, day: 3, period: 4, room_id: null, is_locked: false },
      { id: 's3', timetable_id: 'tt1', teacher_id: 'T1', class_id: 'C1', subject_id: 1, day: 4, period: 2, room_id: null, is_locked: false },
      { id: 'locked', timetable_id: 'tt1', teacher_id: 'T3', class_id: 'C3', subject_id: 3, day: 5, period: 5, room_id: null, is_locked: true },
    ];
    requests = [];
    overlays = [];
    sent = [];
    hardViolationsAfterSwap = 0;

    const prisma: any = {
      timetableSlot: {
        findUnique: async ({ where }: any) => slots.find((s) => s.id === where.id) ?? null,
        // Honours `where` on purpose: a mock that ignores the filter answers a different
        // question from production and hides whatever the filter was there to do
        findMany: async ({ where }: any = {}) =>
          slots.filter((s) => {
            if (where?.timetable_id && s.timetable_id !== where.timetable_id) return false;
            if (where?.is_locked !== undefined && s.is_locked !== where.is_locked) return false;
            if (where?.id?.in && !where.id.in.includes(s.id)) return false;
            return true;
          }),
        update: async ({ where, data }: any) => {
          const slot = slots.find((s) => s.id === where.id)!;
          Object.assign(slot, data);
          return slot;
        },
      },
      generatedTimetable: { findUnique: async () => ({ semester_id: 'sem1' }) },
      teacher: {
        findMany: async () => [
          { id: 'T1', full_name: 'Cô Anna' },
          { id: 'T2', full_name: 'Thầy Bình' },
          { id: 'T3', full_name: 'Cô Cường' },
        ],
        findUnique: async ({ where }: any) => ({ id: where.id, user: { id: `u-${where.id}` } }),
      },
      subject: { findMany: async () => [{ id: 1, name: 'Toán' }, { id: 2, name: 'Ngữ văn' }, { id: 3, name: 'Lý' }] },
      class: { findMany: async () => [{ id: 'C1', name: '10A1' }, { id: 'C2', name: '10A2' }, { id: 'C3', name: '10A3' }] },
      swapRequest: {
        create: async ({ data }: any) => {
          const row = {
            id: `r${requests.length + 1}`,
            ...data,
            requester_teacher: { full_name: 'Cô Anna' },
            partner_teacher: { full_name: 'Thầy Bình' },
          };
          if (!row.semester_id) row.semester_id = 'sem1';
          requests.push(row);
          return row;
        },
        findFirst: async ({ where }: any) =>
          requests.find(
            (r) =>
              r.requester_slot_id === where.requester_slot_id &&
              r.partner_slot_id === where.partner_slot_id &&
              where.status.in.includes(r.status),
          ) ?? null,
        findUnique: async ({ where }: any) => requests.find((r) => r.id === where.id) ?? null,
        // Honours `where` too: the visibility rule below IS the filter, so a mock that
        // returned everything would let a teacher read other people's requests and still
        // report a green test
        findMany: async ({ where }: any = {}) =>
          requests.filter((r) => {
            if (where?.semester_id && r.semester_id !== where.semester_id) return false;
            if (where?.status && r.status !== where.status) return false;
            if (where?.OR) {
              const matches = where.OR.some((clause: any) =>
                Object.entries(clause).every(([key, value]) => r[key] === value),
              );
              if (!matches) return false;
            }
            return true;
          }),
        update: async ({ where, data }: any) => {
          const row = requests.find((r) => r.id === where.id)!;
          Object.assign(row, data);
          return row;
        },
      },
      scheduleOverlay: {
        create: async ({ data }: any) => {
          const row = { id: `ov${overlays.length + 1}`, ...data };
          overlays.push(row);
          return row;
        },
      },
      $transaction: async (fn: any) => fn(prisma),
    };

    const constraints = {
      initialize: async () => undefined,
      // Baseline is always clean; the swapped schedule reports whatever the test sets
      getFitnessDetails: (given: any[]) => {
        const moved = given.some(
          (s) => s.id === 's1' && (s.day !== 2 || s.period !== 1),
        );
        return moved
          ? { hardViolations: hardViolationsAfterSwap, score: 100 - hardViolationsAfterSwap * 100 }
          : { hardViolations: 0, score: 100 };
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwapRequestService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConstraintService, useValue: constraints },
        { provide: SwapGraphService, useValue: {} },
        { provide: NotificationService, useValue: { create: async (n: any) => sent.push(n) } },
      ],
    }).compile();

    service = module.get(SwapRequestService);
  });

  const ask = () =>
    service.create({ requesterSlotId: 's1', partnerSlotId: 's2', reason: 'Con tôi ốm' }, ANNA);

  describe('gửi yêu cầu', () => {
    it('tạo được và báo cho đồng nghiệp', async () => {
      const request = await ask();

      expect(request.status).toBe('PENDING_PARTNER');
      expect(sent).toHaveLength(1);
      expect(sent[0].userId).toBe('u-T2');
      expect(sent[0].message).toContain('Con tôi ốm');
    });

    it('giáo viên không xin đổi tiết của người khác', async () => {
      await expect(
        service.create({ requesterSlotId: 's1', partnerSlotId: 's2', reason: 'Bận' }, BINH),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('bắt buộc ghi lý do', async () => {
      await expect(
        service.create({ requesterSlotId: 's1', partnerSlotId: 's2', reason: '  ' }, ANNA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('không đổi được tiết đang bị khóa', async () => {
      await expect(
        service.create({ requesterSlotId: 's1', partnerSlotId: 'locked', reason: 'Bận' }, ANNA),
      ).rejects.toThrow(/khóa/);
    });

    it('không đổi với chính mình', async () => {
      await expect(
        service.create({ requesterSlotId: 's1', partnerSlotId: 's3', reason: 'Bận' }, ANNA),
      ).rejects.toThrow(/cùng một giáo viên/);
    });

    it('không cho hai yêu cầu cùng lúc cho đúng hai tiết đó', async () => {
      await ask();
      await expect(ask()).rejects.toThrow(/đang chờ/);
    });
  });

  describe('đồng nghiệp trả lời', () => {
    it('người được hỏi đồng ý thì chuyển sang chờ quản trị viên', async () => {
      const request = await ask();
      sent.length = 0;

      const updated = await service.respond(request.id, true, 'Được thôi', BINH);

      expect(updated.status).toBe('PENDING_ADMIN');
      // Người gửi được báo, và admin cũng được báo
      expect(sent.map((n) => n.userId)).toEqual(['u-T1', null]);
    });

    it('từ chối thì dừng hẳn, kèm lý do', async () => {
      const request = await ask();
      sent.length = 0;

      const updated = await service.respond(request.id, false, 'Hôm đó tôi cũng bận', BINH);

      expect(updated.status).toBe('PARTNER_REJECTED');
      expect(updated.partner_note).toBe('Hôm đó tôi cũng bận');
      expect(sent[0].message).toContain('Hôm đó tôi cũng bận');
    });

    it('người ngoài cuộc không trả lời thay được', async () => {
      const request = await ask();
      await expect(service.respond(request.id, true, '', CUONG)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('không trả lời hai lần', async () => {
      const request = await ask();
      await service.respond(request.id, true, '', BINH);
      await expect(service.respond(request.id, true, '', BINH)).rejects.toThrow(/không còn chờ/);
    });
  });

  describe('quản trị viên duyệt', () => {
    const agreed = async () => {
      const request = await ask();
      await service.respond(request.id, true, '', BINH);
      sent.length = 0;
      return request;
    };

    it('giáo viên không tự duyệt được', async () => {
      const request = await agreed();
      await expect(service.decide(request.id, true, '', ANNA)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('không duyệt được yêu cầu đồng nghiệp chưa đồng ý', async () => {
      const request = await ask();
      await expect(service.decide(request.id, true, '', ADMIN)).rejects.toThrow(/chưa được đồng nghiệp/);
    });

    it('duyệt thì đổi chỗ thật hai tiết và sinh overlay SWAP', async () => {
      const request = await agreed();
      const result = await service.decide(request.id, true, 'Đồng ý', ADMIN);

      expect(result.applied).toBe(true);
      expect(slots.find((s) => s.id === 's1')).toMatchObject({ day: 3, period: 4 });
      expect(slots.find((s) => s.id === 's2')).toMatchObject({ day: 2, period: 1 });

      expect(overlays).toHaveLength(1);
      expect(overlays[0].type).toBe('SWAP');
      expect(overlays[0].payload.swapRequestId).toBe(request.id);
      // Cả hai giáo viên đều được báo
      expect(sent.map((n) => n.userId).sort()).toEqual(['u-T1', 'u-T2']);
    });

    it('TỪ CHỐI khi ràng buộc đã đổi kể từ lúc gửi — không đụng vào lịch', async () => {
      const request = await agreed();
      // Thời khóa biểu đã thay đổi: đổi bây giờ sẽ sinh lỗi cứng
      hardViolationsAfterSwap = 2;

      await expect(service.decide(request.id, true, '', ADMIN)).rejects.toThrow(/lỗi cứng/);

      // Tiết vẫn nằm nguyên chỗ cũ, không có overlay nào được tạo
      expect(slots.find((s) => s.id === 's1')).toMatchObject({ day: 2, period: 1 });
      expect(overlays).toHaveLength(0);
      expect(requests[0].status).toBe('PENDING_ADMIN');
    });

    it('từ chối thì báo cho cả hai và không đụng vào lịch', async () => {
      const request = await agreed();
      const result = await service.decide(request.id, false, 'Tuần này thi', ADMIN);

      expect(result.applied).toBe(false);
      expect(slots.find((s) => s.id === 's1')).toMatchObject({ day: 2, period: 1 });
      expect(overlays).toHaveLength(0);
      expect(sent[0].message).toContain('Tuần này thi');
    });

    it('từ chối khi giáo viên của tiết đã đổi kể từ lúc gửi', async () => {
      const request = await agreed();
      slots.find((s) => s.id === 's2')!.teacher_id = 'T3';

      await expect(service.decide(request.id, true, '', ADMIN)).rejects.toThrow(/đã thay đổi/);
      expect(overlays).toHaveLength(0);
    });
  });

  describe('danh sách yêu cầu', () => {
    it('giáo viên chỉ thấy yêu cầu mình có phần, quản trị viên thấy hết', async () => {
      await ask();

      const anna = await service.list('sem1', ANNA);
      const binh = await service.list('sem1', BINH);
      const cuong = await service.list('sem1', CUONG);
      const admin = await service.list('sem1', ADMIN);

      expect(anna).toHaveLength(1);
      expect(binh).toHaveLength(1);
      expect(cuong).toHaveLength(0);
      expect(admin).toHaveLength(1);
    });

    it('kèm luôn hai tiết đang đổi, để người duyệt không phải duyệt mù', async () => {
      await ask();

      const [row] = (await service.list('sem1', ADMIN)) as any[];

      expect(row.requester_slot).toEqual({
        day: 2,
        period: 1,
        when: 'Thứ hai tiết 1',
        subjectName: 'Toán',
        className: '10A1',
      });
      expect(row.partner_slot.when).toBe('Thứ ba tiết 4');
      expect(row.partner_slot.className).toBe('10A2');
    });
  });

  describe('rút lại', () => {
    it('người gửi rút được khi chưa ai xử lý', async () => {
      const request = await ask();
      const cancelled = await service.cancel(request.id, ANNA);
      expect(cancelled.status).toBe('CANCELLED');
    });

    it('người khác không rút hộ được', async () => {
      const request = await ask();
      await expect(service.cancel(request.id, BINH)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('không rút được sau khi đã duyệt', async () => {
      const request = await ask();
      await service.respond(request.id, true, '', BINH);
      await service.decide(request.id, true, '', ADMIN);
      await expect(service.cancel(request.id, ANNA)).rejects.toThrow(/đã được xử lý/);
    });
  });

  it('báo không tìm thấy thay vì im lặng', async () => {
    await expect(service.respond('khong-ton-tai', true, '', BINH)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.suggest('khong-ton-tai', ANNA)).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('gợi ý tiết đổi được', () => {
    it('chỉ gợi ý tiết của người khác, không gợi ý tiết của chính mình', async () => {
      const found = await service.suggest('s1', ANNA);

      expect(found.map((s) => s.slotId)).toEqual(['s2']);
      expect(found[0].teacherName).toBe('Thầy Bình');
      expect(found[0].feasible).toBe(true);
    });

    it('bỏ qua phương án sinh thêm lỗi cứng', async () => {
      hardViolationsAfterSwap = 3;
      const found = await service.suggest('s1', ANNA);
      expect(found).toHaveLength(0);
    });

    it('giáo viên không xem được gợi ý cho tiết người khác', async () => {
      await expect(service.suggest('s2', ANNA)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
