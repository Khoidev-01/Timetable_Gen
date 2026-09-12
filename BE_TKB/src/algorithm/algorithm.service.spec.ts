import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AlgorithmService } from './algorithm.service';
import { AlgorithmGateway } from './algorithm.gateway';
import { ChangeLogService } from './change-log.service';
import { ConstraintService, TimeSlot } from './constraint.service';
import { ConstraintSettingsService } from '../constraints/constraint-settings.service';

function slot(partial: Partial<TimeSlot>): TimeSlot {
  return {
    classId: 'C1',
    subjectId: 1,
    teacherId: 'T1',
    day: 2,
    period: 1,
    ...partial,
  };
}

describe('AlgorithmService', () => {
  let service: AlgorithmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlgorithmService,
        ConstraintService,
        // No admin overrides: the solver scores with the weights it ships with
        {
          provide: ConstraintSettingsService,
          useValue: { effective: async () => ({ weights: {}, disabledHard: new Set<string>() }) },
        },
        { provide: PrismaService, useValue: {} },
        { provide: AlgorithmGateway, useValue: { publish: jest.fn(), publishDone: jest.fn() } },
        { provide: ChangeLogService, useValue: {} },
      ],
    }).compile();

    service = module.get<AlgorithmService>(AlgorithmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('vòng tìm kiếm', () => {
    /**
     * Luyện kim mô phỏng nhận cả nước đi làm điểm tệ đi, nên lúc vòng lặp dừng, lịch đang
     * nằm ở đâu là chuyện của may rủi. Bản tốt nhất từng gặp được chụp lại và khôi phục ở
     * cuối — nếu phần khôi phục lệch khỏi điểm được báo ra thì người dùng nhận một thời
     * khóa biểu khác với con số họ nhìn thấy, và không có gì báo cho họ biết.
     */
    const buildSchedule = (): TimeSlot[] => {
      const slots: TimeSlot[] = [];
      for (let i = 0; i < 40; i++) {
        slots.push(
          slot({
            id: `s${i}`,
            classId: `C${i % 4}`,
            teacherId: `T${i % 6}`,
            subjectId: (i % 3) + 1,
            day: 2 + (i % 6),
            period: 1 + (i % 5),
          }),
        );
      }
      return slots;
    };

    it('chụp lại rồi khôi phục đưa lịch về đúng từng ô như cũ', () => {
      const slots = buildSchedule();
      const snapshot = service['snapshotPlacement'](slots);
      const original = slots.map((s) => `${s.id}@${s.day}-${s.period}`);

      // Xáo tung, giống lúc phép luyện kim nhận một chuỗi nước đi xấu
      for (const s of slots) {
        s.day = 2 + ((s.period * 7) % 6);
        s.period = 1 + ((s.day * 3) % 10);
      }
      expect(slots.map((s) => `${s.id}@${s.day}-${s.period}`)).not.toEqual(original);

      service['restorePlacement'](slots, snapshot);
      expect(slots.map((s) => `${s.id}@${s.day}-${s.period}`)).toEqual(original);
    });

    it('điểm báo ra khớp với lịch thật khi vòng lặp kết thúc', async () => {
      const constraints = service['constraintService'];
      const slots = buildSchedule();
      const solution: any = { slots };

      await service['phase3_LocalSearch'](solution, {}, () => undefined, 3000);

      expect(solution.fitness_score).toBe(constraints.getFitnessDetails(slots).score);
    });

    it('không bao giờ trả về lời giải tệ hơn lúc bắt đầu', async () => {
      const constraints = service['constraintService'];
      const slots = buildSchedule();
      const before = constraints.getFitnessDetails(slots);

      const solution: any = { slots };
      await service['phase3_LocalSearch'](solution, {}, () => undefined, 3000);

      const after = constraints.getFitnessDetails(slots);
      expect(after.score).toBeGreaterThanOrEqual(before.score);
      expect(after.hardViolations).toBeLessThanOrEqual(before.hardViolations);
    });

    it('ngân sách tìm kiếm đi theo số tiết phải xếp', () => {
      const small = service['searchBudget'](200);
      const large = service['searchBudget'](960);

      expect(large).toBeGreaterThan(small);
      // Trường bé không phải chờ như trường lớn, trường lớn không bị cắt ngắn quá tay
      expect(small).toBeGreaterThanOrEqual(30_000);
      expect(large).toBeLessThanOrEqual(1_200_000);
    });
  });

  describe('gán phòng', () => {
    /**
     * Hai lớp dùng chung một phòng theo buổi: 12A5 học sáng, 11B5 học chiều.
     *
     * Tiết Quốc phòng của 11B5 nằm trái buổi, tức là buổi sáng — đúng lúc 12A5 đang ngồi
     * trong phòng đó. Trước đây khi hết sân, bộ giải cấp bừa phòng của lớp "để tiết vẫn
     * được dạy còn hơn bị bỏ". Kết quả ngược lại: cơ sở dữ liệu có ràng buộc duy nhất trên
     * (phòng, giờ) nên chính tiết đó bị chặn lúc lưu và biến mất khỏi thời khóa biểu.
     */
    const setUpRooms = (rooms: Record<string, number[]>, subjectRoomType: Record<number, string>) => {
      const constraints = service['constraintService'];
      constraints['roomsByType'] = new Map(Object.entries(rooms));
      constraints['subjectRoomType'] = new Map(
        Object.entries(subjectRoomType).map(([id, type]) => [Number(id), type]),
      );
    };

    const data = {
      classes: [
        { id: 'C_SANG', fixed_room_id: 105 },
        { id: 'C_CHIEU', fixed_room_id: 105 },
      ],
      subjects: [
        { id: 1, code: 'TOAN' },
        { id: 9, code: 'GDQP' },
        { id: 99, code: 'CHAO_CO' },
      ],
    };

    it('không cấp một phòng cho hai lớp cùng một giờ', () => {
      setUpRooms({ CLASSROOM: [105], YARD: [900] }, { 9: 'YARD' });

      const slots = [
        slot({ classId: 'C_SANG', subjectId: 1, teacherId: 'T1', day: 3, period: 2 }),
        // Sân đã có lớp khác dùng đúng giờ này
        slot({ classId: 'C_KHAC', subjectId: 9, teacherId: 'T9', day: 3, period: 2 }),
        slot({ classId: 'C_CHIEU', subjectId: 9, teacherId: 'T2', day: 3, period: 2 }),
      ];

      service['assignRooms']({ slots }, data, () => undefined);

      const atThatTime = slots.filter((s) => s.day === 3 && s.period === 2 && s.roomId !== undefined);
      const rooms = atThatTime.map((s) => s.roomId);
      expect(new Set(rooms).size).toBe(rooms.length);

      // Tiết trái buổi không được lấy phòng mà lớp kia đang ngồi
      expect(slots[2].roomId).not.toBe(105);
    });

    it('hai lớp chung phòng, cùng một giờ, chỉ một lớp được phòng đó', () => {
      // Cả hai đều là tiết thường nên cả hai đều muốn về phòng 105 của mình
      setUpRooms({ CLASSROOM: [105, 106] }, {});

      const slots = [
        slot({ classId: 'C_SANG', subjectId: 1, teacherId: 'T1', day: 3, period: 2 }),
        slot({ classId: 'C_CHIEU', subjectId: 1, teacherId: 'T2', day: 3, period: 2 }),
      ];

      service['assignRooms']({ slots }, data, () => undefined);

      expect(slots[0].roomId).toBe(105);
      expect(slots[1].roomId).not.toBe(105);
      expect(slots[1].roomId).toBe(106);
    });

    it('vẫn ưu tiên phòng chức năng khi còn trống', () => {
      setUpRooms({ CLASSROOM: [105], YARD: [900, 901] }, { 9: 'YARD' });

      const slots = [slot({ classId: 'C_CHIEU', subjectId: 9, teacherId: 'T2', day: 3, period: 2 })];
      service['assignRooms']({ slots }, data, () => undefined);

      expect([900, 901]).toContain(slots[0].roomId);
    });

    it('chào cờ không chiếm phòng nào', () => {
      setUpRooms({ CLASSROOM: [105] }, {});

      const slots = [slot({ classId: 'C_SANG', subjectId: 99, teacherId: 'T1', day: 2, period: 1 })];
      service['assignRooms']({ slots }, data, () => undefined);

      expect(slots[0].roomId).toBeUndefined();
    });
  });

  describe('tiết khoá kế thừa từ lần xếp trước', () => {
    const SUBJECTS = [
      { id: 1, code: 'TOAN' },
      { id: 9, code: 'CHAO_CO' },
      { id: 10, code: 'SH_CUOI_TUAN' },
    ];

    /** Chỉ cần một thứ từ ConstraintService, nên dựng đúng thứ ấy. */
    function withRuleSubjects(service: AlgorithmService, codes: string[]) {
      (service as any).constraintService.fixedRuleSubjectCodes = () => new Set(codes);
    }

    /**
     * Phase 1 dựng lại chào cờ và sinh hoạt từ quy tắc cố định ở MỖI lần xếp. Kế thừa thêm
     * một bản nữa từ lần trước là thêm hẳn một tiết lễ cho lớp đó — và vì bản mới cũng lưu
     * nó với cờ "đã khoá" nên lần sau lại kế thừa tiếp.
     *
     * Đã xảy ra thật trên dữ liệu mẫu: 11 lớp có tiết lễ lặp, lớp 11B2 có ba tiết sinh hoạt
     * cuối tuần trong một tuần, và 26 tiết thừa ấy làm điểm tệ đi 409 điểm mỗi lần xếp.
     */
    it('bỏ tiết lễ, vì phase 1 dựng lại chúng từ quy tắc', () => {
      withRuleSubjects(service, ['CHAO_CO', 'SH_CUOI_TUAN']);

      const kept = service.carriedOverPins(
        [{ subject_id: 9 }, { subject_id: 10 }, { subject_id: 1 }],
        SUBJECTS,
      );

      expect(kept).toEqual([{ subject_id: 1 }]);
    });

    it('giữ tiết quản trị viên đã ghim — đó mới là việc của cơ chế này', () => {
      withRuleSubjects(service, ['CHAO_CO', 'SH_CUOI_TUAN']);

      const pinned = [{ subject_id: 1 }, { subject_id: 1 }];

      expect(service.carriedOverPins(pinned, SUBJECTS)).toEqual(pinned);
    });

    it('trường không dùng quy tắc cố định nào thì giữ nguyên tất cả', () => {
      withRuleSubjects(service, []);

      const locked = [{ subject_id: 9 }, { subject_id: 1 }];

      expect(service.carriedOverPins(locked, SUBJECTS)).toEqual(locked);
    });
  });

  describe('partitionSlots', () => {
    const partition = (slots: TimeSlot[]) => service['partitionSlots'](slots);

    it('accepts a schedule with no clash', () => {
      const { accepted, rejected } = partition([
        slot({ period: 1 }),
        slot({ period: 2 }),
      ]);

      expect(accepted).toHaveLength(2);
      expect(rejected).toHaveLength(0);
    });

    it('rejects a second period for the same class at the same time', () => {
      const { accepted, rejected } = partition([
        slot({ subjectId: 1 }),
        slot({ subjectId: 2 }),
      ]);

      expect(accepted).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toContain('lớp');
    });

    it('rejects one teacher being in two classes at once', () => {
      const { accepted, rejected } = partition([
        slot({ classId: 'C1', teacherId: 'T1' }),
        slot({ classId: 'C2', teacherId: 'T1' }),
      ]);

      expect(accepted).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toContain('giáo viên');
    });

    it('rejects two classes sharing one room at once', () => {
      const { accepted, rejected } = partition([
        slot({ classId: 'C1', teacherId: 'T1', roomId: 7 }),
        slot({ classId: 'C2', teacherId: 'T2', roomId: 7 }),
      ]);

      expect(accepted).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toContain('phòng');
    });

    it('lets slots without a room coexist, mirroring NULL in a unique index', () => {
      const { accepted, rejected } = partition([
        slot({ classId: 'C1', teacherId: 'T1', roomId: undefined }),
        slot({ classId: 'C2', teacherId: 'T2', roomId: undefined }),
      ]);

      expect(accepted).toHaveLength(2);
      expect(rejected).toHaveLength(0);
    });

    it('keeps the first occurrence and rejects only the later one', () => {
      const first = slot({ subjectId: 1 });
      const second = slot({ subjectId: 2 });
      const { accepted, rejected } = partition([first, second]);

      expect(accepted[0]).toBe(first);
      expect(rejected[0].slot).toBe(second);
    });
  });
});
