import { ConstraintService, TimeSlot } from './constraint.service';

/**
 * A teacher can say three different things about a time slot, and the difference
 * between them is the whole point: "I cannot" must be obeyed, "I would rather not"
 * and "I would like to" are weighed against everyone else's.
 */
const SUBJECTS = [
  { id: 1, code: 'TOAN', name: 'Toán', is_special: false, type: 'LY_THUYET' },
];

const ROOMS = [{ id: 1, name: 'P101', type: 'LY_THUYET', floor: 1 }];

function teacher(id: string, constraints: any[]) {
  return { id, code: id, max_periods_per_week: 17, mobility_weight: 10, constraints };
}

function slot(teacherId: string, day: number, period: number): TimeSlot {
  return { id: `${teacherId}-${day}-${period}`, day, period, classId: '10A1', subjectId: 1, teacherId };
}

function defaultSettings(): any {
  return { effective: async () => ({ weights: {}, disabledHard: new Set<string>() }) };
}

async function serviceWith(teachers: any[]) {
  const prisma: any = {
    room: { findMany: async () => ROOMS },
    subject: { findMany: async () => SUBJECTS },
    teacher: { findMany: async () => teachers },
    teachingAssignment: { findMany: async () => [] },
    fixedPeriodRule: { findMany: async () => [] },
    class: { findMany: async () => [] },
  };
  const service = new ConstraintService(prisma, defaultSettings());
  await service.initialize('sem1');
  return service;
}

describe('nguyện vọng giáo viên ba mức', () => {
  it('BUSY chặn hẳn, còn AVOID thì không', async () => {
    const service = await serviceWith([
      teacher('T1', [
        { day_of_week: 3, period: 2, session: 0, type: 'BUSY' },
        { day_of_week: 4, period: 2, session: 0, type: 'AVOID' },
      ]),
    ]);

    expect(service.isTeacherBusy('T1', 3, 2)).toBe(true);
    expect(service.isTeacherBusy('T1', 4, 2)).toBe(false);
    expect(service.isTeacherAvoiding('T1', 4, 2)).toBe(true);
  });

  it('quy đổi đúng tiết buổi chiều', async () => {
    // session 1, period 2 nghĩa là tiết thứ 2 của buổi chiều = tiết 7 trong ngày
    const service = await serviceWith([
      teacher('T1', [{ day_of_week: 3, period: 2, session: 1, type: 'BUSY' }]),
    ]);

    expect(service.isTeacherBusy('T1', 3, 7)).toBe(true);
    expect(service.isTeacherBusy('T1', 3, 2)).toBe(false);
  });

  it('session 2 áp dụng cho cả sáng lẫn chiều', async () => {
    const service = await serviceWith([
      teacher('T1', [{ day_of_week: 3, period: 1, session: 2, type: 'BUSY' }]),
    ]);

    expect(service.isTeacherBusy('T1', 3, 1)).toBe(true);
    expect(service.isTeacherBusy('T1', 3, 6)).toBe(true);
  });

  it('đếm đúng số nguyện vọng được đáp ứng', async () => {
    const service = await serviceWith([
      teacher('T1', [
        { day_of_week: 2, period: 1, session: 0, type: 'PREFER' },
        { day_of_week: 3, period: 1, session: 0, type: 'PREFER' },
        { day_of_week: 4, period: 1, session: 0, type: 'AVOID' },
      ]),
    ]);

    const report = service.preferenceReport([
      slot('T1', 2, 1), // đúng nguyện vọng
      slot('T1', 4, 1), // rơi vào giờ xin tránh
      slot('T1', 5, 1), // không liên quan
    ]);

    expect(report.preferGranted).toBe(1);
    expect(report.preferAsked).toBe(2);
    expect(report.avoidedUsed).toBe(1);
    expect(report.percentMet).toBe(50);
  });

  it('báo 100% khi không ai đăng ký nguyện vọng nào', async () => {
    const service = await serviceWith([teacher('T1', [])]);
    const report = service.preferenceReport([slot('T1', 2, 1)]);

    expect(report.preferAsked).toBe(0);
    expect(report.percentMet).toBe(100);
  });

  it('xếp vào giờ xin tránh thì bị trừ điểm', async () => {
    const service = await serviceWith([
      teacher('T1', [{ day_of_week: 2, period: 1, session: 0, type: 'AVOID' }]),
    ]);

    const avoided = service.calculatePenalty([slot('T1', 2, 1)]);
    const clear = service.calculatePenalty([slot('T1', 3, 1)]);

    expect(avoided).toBeGreaterThan(clear);
  });

  it('đáp ứng nguyện vọng thì được cộng điểm', async () => {
    const service = await serviceWith([
      teacher('T1', [{ day_of_week: 2, period: 1, session: 0, type: 'PREFER' }]),
    ]);

    const granted = service.calculatePenalty([slot('T1', 2, 1)]);
    const ignored = service.calculatePenalty([slot('T1', 3, 1)]);

    expect(granted).toBeLessThan(ignored);
  });

  it('không nhầm nguyện vọng của giáo viên này sang giáo viên khác', async () => {
    const service = await serviceWith([
      teacher('T1', [{ day_of_week: 2, period: 1, session: 0, type: 'AVOID' }]),
      teacher('T2', []),
    ]);

    expect(service.isTeacherAvoiding('T1', 2, 1)).toBe(true);
    expect(service.isTeacherAvoiding('T2', 2, 1)).toBe(false);
  });

  it('đưa tỉ lệ đáp ứng vào kết quả chấm điểm', async () => {
    const service = await serviceWith([
      teacher('T1', [{ day_of_week: 2, period: 1, session: 0, type: 'PREFER' }]),
    ]);

    const fitness = service.getFitnessDetails([slot('T1', 2, 1)]);
    expect(fitness.preferences.percentMet).toBe(100);
    expect(fitness.details.some((d: string) => d.includes('nguyện vọng'))).toBe(true);
  });
});
