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
