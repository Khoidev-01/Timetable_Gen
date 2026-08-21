import { ConstraintService, TimeSlot } from './constraint.service';
import { IncrementalScorer } from './incremental-scorer';

/**
 * The incremental scorer exists to be faster, but it is only useful if it is also exact.
 * A scorer that drifts from the full calculation would have the search optimising one
 * number while the school is shown another, and nothing would report the disagreement.
 *
 * These tests hammer random schedules with random moves and demand the two agree every
 * single time, not on average.
 */
const SUBJECTS = [
  { id: 1, code: 'TOAN', name: 'Toán', is_special: false, type: 'LY_THUYET' },
  { id: 2, code: 'VAN', name: 'Ngữ văn', is_special: false, type: 'LY_THUYET' },
  { id: 3, code: 'GDTC', name: 'Giáo dục thể chất', is_special: false, type: 'THUC_HANH' },
  { id: 4, code: 'LY', name: 'Vật lý', is_special: false, type: 'LY_THUYET' },
];

const ROOMS = [
  { id: 1, name: 'P101', type: 'LY_THUYET', floor: 1 },
  { id: 2, name: 'SAN', type: 'YARD', floor: 0 },
];

const CLASSES = [
  { id: '10A1', name: '10A1', main_session: 0, fixed_room: { floor: 1 } },
  { id: '10A2', name: '10A2', main_session: 0, fixed_room: { floor: 2 } },
];

const TEACHERS = [
  {
    id: 'T1', code: 'T1', max_periods_per_week: 20, mobility_weight: 10,
    constraints: [
      { day_of_week: 4, period: 3, session: 0, type: 'BUSY' },
      { day_of_week: 2, period: 1, session: 0, type: 'PREFER' },
      { day_of_week: 6, period: 4, session: 0, type: 'AVOID' },
    ],
  },
  { id: 'T2', code: 'T2', max_periods_per_week: 20, mobility_weight: 10, constraints: [] },
  { id: 'T3', code: 'T3', max_periods_per_week: 20, mobility_weight: 10, constraints: [] },
];

/** A tiny deterministic generator, so a failure can be reproduced exactly. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

async function buildService() {
  const prisma: any = {
    room: { findMany: async () => ROOMS },
    subject: { findMany: async () => SUBJECTS },
    teacher: { findMany: async () => TEACHERS },
    teachingAssignment: { findMany: async () => [] },
    fixedPeriodRule: { findMany: async () => [] },
    class: { findMany: async () => CLASSES },
  };
  const settings: any = {
    effective: async () => ({ weights: {}, disabledHard: new Set<string>() }),
  };
  const service = new ConstraintService(prisma, settings);
  await service.initialize('sem1');
  return service;
}

function randomSchedule(random: () => number, size: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let i = 0; i < size; i++) {
    slots.push({
      id: `s${i}`,
      day: 2 + Math.floor(random() * 6),
      period: 1 + Math.floor(random() * 10),
      classId: CLASSES[Math.floor(random() * CLASSES.length)].id,
      subjectId: SUBJECTS[Math.floor(random() * SUBJECTS.length)].id,
      teacherId: TEACHERS[Math.floor(random() * TEACHERS.length)].id,
    });
  }
  return slots;
}

describe('chấm điểm tăng dần', () => {
  let constraints: ConstraintService;

  beforeEach(async () => {
    constraints = await buildService();
  });

  const fullFitness = (slots: TimeSlot[]) =>
    1000 -
    constraints.checkHardConstraints(slots) * constraints.weights.hardViolation -
    constraints.calculatePenalty(slots);

  it('khớp bản tính đầy đủ ngay từ đầu', () => {
    const slots = randomSchedule(makeRandom(1), 40);
    const scorer = new IncrementalScorer(constraints, slots);

    expect(scorer.fitness()).toBe(fullFitness(slots));
  });

  it('khớp sau mỗi lần đổi chỗ, qua 300 thao tác ngẫu nhiên', () => {
    const random = makeRandom(7);
    const slots = randomSchedule(random, 40);
    const scorer = new IncrementalScorer(constraints, slots);

    for (let i = 0; i < 300; i++) {
      const a = slots[Math.floor(random() * slots.length)];
      const b = slots[Math.floor(random() * slots.length)];

      [a.day, b.day] = [b.day, a.day];
      [a.period, b.period] = [b.period, a.period];
      scorer.touch(a, b);

      expect(scorer.fitness()).toBe(fullFitness(slots));
    }
  });

  it('khớp sau mỗi lần dời một tiết đi chỗ khác', () => {
    const random = makeRandom(13);
    const slots = randomSchedule(random, 30);
    const scorer = new IncrementalScorer(constraints, slots);

    for (let i = 0; i < 300; i++) {
      const slot = slots[Math.floor(random() * slots.length)];
      slot.day = 2 + Math.floor(random() * 6);
      slot.period = 1 + Math.floor(random() * 10);
      scorer.touch(slot);

      expect(scorer.fitness()).toBe(fullFitness(slots));
    }
  });

  it('đếm lỗi cứng giống hệt bản tính đầy đủ', () => {
    const random = makeRandom(21);
    const slots = randomSchedule(random, 40);
    const scorer = new IncrementalScorer(constraints, slots);

    for (let i = 0; i < 100; i++) {
      const slot = slots[Math.floor(random() * slots.length)];
      slot.period = 1 + Math.floor(random() * 10);
      scorer.touch(slot);

      expect(scorer.hardViolations()).toBe(constraints.checkHardConstraints(slots));
    }
  });

  it('vẫn khớp khi lịch chỉ có một lớp và một giáo viên', () => {
    const slots: TimeSlot[] = [1, 2, 3, 4].map((p) => ({
      id: `s${p}`, day: 2, period: p, classId: '10A1', subjectId: 1, teacherId: 'T1',
    }));
    const scorer = new IncrementalScorer(constraints, slots);

    expect(scorer.fitness()).toBe(fullFitness(slots));
  });

  it('không bỏ sót thay đổi khi hai tiết cùng lớp đổi chỗ cho nhau', () => {
    const slots: TimeSlot[] = [
      { id: 'a', day: 2, period: 1, classId: '10A1', subjectId: 1, teacherId: 'T1' },
      { id: 'b', day: 2, period: 4, classId: '10A1', subjectId: 3, teacherId: 'T2' },
    ];
    const scorer = new IncrementalScorer(constraints, slots);
    const before = scorer.fitness();

    [slots[0].period, slots[1].period] = [slots[1].period, slots[0].period];
    scorer.touch(slots[0], slots[1]);

    expect(scorer.fitness()).toBe(fullFitness(slots));
    // Thể dục chuyển từ tiết 4 lên tiết 1 nên điểm phải đổi
    expect(scorer.fitness()).not.toBe(before);
  });

  it('vẫn khớp khi bật trọng số công bằng', () => {
    // Khoản phạt công bằng đọc độ chênh giữa các giáo viên, nên nó phụ thuộc vào TOÀN BỘ
    // bảng điểm chứ không riêng giáo viên vừa đổi chỗ — đúng chỗ phép tính tăng dần dễ lệch nhất
    constraints.weights.fairness = 3;

    const random = makeRandom(99);
    const slots = randomSchedule(random, 40);
    const scorer = new IncrementalScorer(constraints, slots);

    for (let i = 0; i < 200; i++) {
      const a = slots[Math.floor(random() * slots.length)];
      const b = slots[Math.floor(random() * slots.length)];
      [a.day, b.day] = [b.day, a.day];
      [a.period, b.period] = [b.period, a.period];
      scorer.touch(a, b);

      expect(scorer.fitness()).toBe(fullFitness(slots));
    }
  });

  it('trọng số công bằng khác 0 làm điểm đổi', () => {
    const slots = randomSchedule(makeRandom(5), 30);

    constraints.weights.fairness = 0;
    const neutral = constraints.calculatePenalty(slots);
    constraints.weights.fairness = 10;
    const weighted = constraints.calculatePenalty(slots);

    expect(weighted).toBeGreaterThan(neutral);
  });

  it('gọi initialize lần hai không làm sai lệch gì', async () => {
    // Service là singleton và được khởi tạo lại ở mỗi lần giải, mỗi lần báo cáo và mỗi
    // điểm trên đường Pareto. Trước đây sức chứa phòng và số nguyện vọng cộng dồn mỗi
    // lần gọi, nên thuật toán tin rằng trường có gấp đôi số phòng thực hành thật có.
    const slots = randomSchedule(makeRandom(31), 40);
    const before = constraints.calculatePenalty(slots);
    const beforeHard = constraints.checkHardConstraints(slots);

    await constraints.initialize('sem1');
    await constraints.initialize('sem1');

    expect(constraints.calculatePenalty(slots)).toBe(before);
    expect(constraints.checkHardConstraints(slots)).toBe(beforeHard);
  });

  it('sức chứa phòng chức năng không tăng theo số lần khởi tạo', async () => {
    // Chỉ có một sân bãi trong dữ liệu thử: hai lớp cùng học Thể dục một tiết là quá tải
    const clash: TimeSlot[] = [
      { id: 'a', day: 2, period: 1, classId: '10A1', subjectId: 3, teacherId: 'T1' },
      { id: 'b', day: 2, period: 1, classId: '10A2', subjectId: 3, teacherId: 'T2' },
    ];
    const once = constraints.checkRoomTypeCapacity(clash);

    await constraints.initialize('sem1');
    await constraints.initialize('sem1');
    await constraints.initialize('sem1');

    expect(constraints.checkRoomTypeCapacity(clash)).toBe(once);
    expect(once).toBeGreaterThan(0);
  });

  it('không phạt gì khi mọi giáo viên gánh như nhau', () => {
    constraints.weights.fairness = 10;
    // Ba giáo viên, mỗi người một điểm phạt giống hệt nhau
    expect(constraints.fairnessPenalty([40, 40, 40])).toBe(0);
    // Một người gánh nặng hơn hẳn thì bị phạt
    expect(constraints.fairnessPenalty([0, 0, 90])).toBeGreaterThan(0);
  });

  it('tính đúng cả nguyện vọng và lịch bận của giáo viên', () => {
    // T1 xin tránh Thứ 6 tiết 4, mong muốn Thứ 2 tiết 1, và bận Thứ 5 tiết 3
    const slots: TimeSlot[] = [
      { id: 'a', day: 6, period: 4, classId: '10A1', subjectId: 1, teacherId: 'T1' },
      { id: 'b', day: 2, period: 1, classId: '10A2', subjectId: 2, teacherId: 'T1' },
      { id: 'c', day: 5, period: 3, classId: '10A1', subjectId: 4, teacherId: 'T1' },
    ];
    const scorer = new IncrementalScorer(constraints, slots);

    expect(scorer.fitness()).toBe(fullFitness(slots));
    expect(scorer.hardViolations()).toBe(constraints.checkHardConstraints(slots));
  });
});
