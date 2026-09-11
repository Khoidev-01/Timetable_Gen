import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { FeasibilityService } from './feasibility.service';

/**
 * Chào cờ và sinh hoạt cuối tuần không phải tiết dạy.
 *
 * Nhiệm vụ chủ nhiệm đã được bù bằng `workload_reduction`, nên đếm chúng vào định mức là
 * đếm hai lần. Bộ giải loại chúng ra từ lâu; phép kiểm này thì chưa, nên nó chặn một phân
 * công mà bộ giải sẵn sàng xếp — và người dùng không có cách nào biết vì sao.
 */
const SUBJECTS = [
  { id: 1, code: 'TOAN', name: 'Toán', is_special: false },
  { id: 2, code: 'CHAO_CO', name: 'Chào cờ', is_special: true },
  { id: 3, code: 'SH_CUOI_TUAN', name: 'Sinh hoạt cuối tuần', is_special: true },
];

describe('FeasibilityService', () => {
  let service: FeasibilityService;
  let assignments: any[];

  const buildAssignment = (subjectId: number, periods: number) => ({
    teacher_id: 'T1',
    class_id: 'C1',
    subject_id: subjectId,
    total_periods: periods,
    subject: SUBJECTS.find((s) => s.id === subjectId),
    teacher: { id: 'T1', full_name: 'Cô Lan' },
    class: { id: 'C1', name: '10A1' },
  });

  beforeEach(async () => {
    assignments = [];

    const prisma: any = {
      semester: { findUnique: async () => ({ id: 'sem1', name: 'HK1' }) },
      class: { findMany: async () => [{ id: 'C1', name: '10A1', grade_level: 10, main_session: 0, homeroom_teacher: null }] },
      teacher: {
        findMany: async () => [
          { id: 'T1', code: 'GV1', full_name: 'Cô Lan', max_periods_per_week: 17, workload_reduction: 4, constraints: [] },
        ],
      },
      subject: { findMany: async () => SUBJECTS },
      room: { findMany: async () => [] },
      teachingAssignment: { findMany: async () => assignments },
      fixedPeriodRule: { findMany: async () => [] },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FeasibilityService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(FeasibilityService);
  });

  const overQuotaIssues = async () =>
    (await service.analyse('sem1')).issues.filter((i) => i.code === 'TEACHER_OVER_QUOTA');

  it('không tính tiết nghi lễ vào định mức giảng dạy', async () => {
    // 17 tiết dạy đúng định mức, cộng thêm chào cờ và sinh hoạt cuối tuần
    assignments = [buildAssignment(1, 17), buildAssignment(2, 1), buildAssignment(3, 1)];

    expect(await overQuotaIssues()).toHaveLength(0);
  });

  it('vẫn báo khi số tiết DẠY thật sự vượt định mức', async () => {
    assignments = [buildAssignment(1, 18), buildAssignment(2, 1)];

    const issues = await overQuotaIssues();
    expect(issues).toHaveLength(1);
    // Báo đúng 18, không phải 19: con số phải là số tiết dạy, không kèm tiết nghi lễ
    expect(issues[0].detail).toContain('18 tiết/tuần');
  });
});
