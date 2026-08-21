import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ConstraintService } from './constraint.service';
import { FairnessService } from './fairness.service';

/** Two teachers, one given a tidy week and one given a scattered one. */
const TEACHERS = [
  { id: 't-tidy', code: 'GV_A', full_name: 'Cô A' },
  { id: 't-scattered', code: 'GV_B', full_name: 'Cô B' },
];

function slot(id: string, teacher: string, day: number, period: number) {
  return {
    id,
    day,
    period,
    class_id: '10A1',
    subject_id: 1,
    teacher_id: teacher,
    room_id: null,
    is_locked: false,
  };
}

describe('FairnessService', () => {
  let service: FairnessService;
  let slots: any[];

  beforeEach(async () => {
    slots = [];

    const prisma = {
      generatedTimetable: {
        findFirst: async ({ where }: any) =>
          where.is_official ? null : { id: 'tt1', slots },
      },
      teacher: { findMany: async () => TEACHERS },
    };

    const constraints = {
      initialize: async () => undefined,
      estimatedFloor: () => null,
      // No teacher registered a wish in these fixtures
      preferenceReportFor: () => ({ granted: 0, asked: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FairnessService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConstraintService, useValue: constraints },
      ],
    }).compile();

    service = module.get(FairnessService);
  });

  it('reports nothing rather than crashing when no timetable exists', async () => {
    const prisma = { generatedTimetable: { findFirst: async () => null }, teacher: { findMany: async () => [] } };
    const module = await Test.createTestingModule({
      providers: [
        FairnessService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConstraintService,
          useValue: {
            initialize: async () => undefined,
            estimatedFloor: () => null,
            preferenceReportFor: () => ({ granted: 0, asked: 0 }),
          },
        },
      ],
    }).compile();

    const report = await module.get(FairnessService).report('sem1');
    expect(report.gini).toBe(0);
    expect(report.teachers).toEqual([]);
  });

  it('gives a full score to a week with no gaps and no waste', async () => {
    // Four periods back to back in one morning: nothing to complain about
    slots = [1, 2, 3, 4].map((p) => slot(`a${p}`, 't-tidy', 2, p));

    const report = await service.report('sem1');
    const tidy = report.teachers.find((t) => t.teacherId === 't-tidy')!;

    expect(tidy.quality).toBe(100);
    expect(tidy.burdens).toEqual([]);
  });

  it('charges a teacher for the periods they have to wait through', async () => {
    // Periods 1 and 5 the same morning: three free periods stuck at school
    slots = [slot('a1', 't-tidy', 2, 1), slot('a2', 't-tidy', 2, 5)];

    const report = await service.report('sem1');
    const gaps = report.teachers[0].burdens.find((b) => b.label === 'Tiết trống phải chờ');

    expect(gaps?.count).toBe(3);
  });

  it('does not count going home between morning and afternoon as waiting', async () => {
    // One period in the morning, one in the afternoon - not a gap, two half-days
    slots = [slot('a1', 't-tidy', 2, 1), slot('a2', 't-tidy', 2, 10)];

    const report = await service.report('sem1');
    const gaps = report.teachers[0].burdens.find((b) => b.label === 'Tiết trống phải chờ');

    expect(gaps).toBeUndefined();
  });

  it('judges each teacher against their own load, not the school average', async () => {
    // Eight periods cannot fit in fewer than two half-days, so two is not a penalty
    slots = [
      ...[1, 2, 3, 4, 5].map((p) => slot(`a${p}`, 't-tidy', 2, p)),
      ...[1, 2, 3].map((p) => slot(`b${p}`, 't-tidy', 3, p)),
    ];

    const report = await service.report('sem1');
    const extra = report.teachers[0].burdens.find((b) => b.label === 'Buổi đến trường dư');

    expect(extra).toBeUndefined();
  });

  it('scores the scattered week below the tidy one', async () => {
    slots = [
      ...[1, 2, 3, 4].map((p) => slot(`a${p}`, 't-tidy', 2, p)),
      slot('b1', 't-scattered', 2, 1),
      slot('b2', 't-scattered', 3, 5),
      slot('b3', 't-scattered', 4, 10),
      slot('b4', 't-scattered', 5, 1),
    ];

    const report = await service.report('sem1');
    const tidy = report.teachers.find((t) => t.teacherId === 't-tidy')!;
    const scattered = report.teachers.find((t) => t.teacherId === 't-scattered')!;

    expect(scattered.quality).toBeLessThan(tidy.quality);
    expect(report.gini).toBeGreaterThan(0);
    expect(report.worstOff[0].teacherId).toBe('t-scattered');
  });

  it('reads zero when both teachers have equally good weeks', async () => {
    slots = [
      ...[1, 2, 3, 4].map((p) => slot(`a${p}`, 't-tidy', 2, p)),
      ...[1, 2, 3, 4].map((p) => slot(`b${p}`, 't-scattered', 3, p)),
    ];

    const report = await service.report('sem1');
    expect(report.gini).toBe(0);
    expect(report.summary.spread).toBe(0);
  });

  it('draws a Lorenz curve that starts at nothing and ends at everything', async () => {
    slots = [
      ...[1, 2, 3, 4].map((p) => slot(`a${p}`, 't-tidy', 2, p)),
      slot('b1', 't-scattered', 2, 1),
      slot('b2', 't-scattered', 3, 5),
    ];

    const report = await service.report('sem1');
    expect(report.lorenz[0]).toEqual({ population: 0, quality: 0 });
    expect(report.lorenz.at(-1)).toEqual({ population: 1, quality: 1 });
  });

  it('names the biggest burden and what to do about it', async () => {
    slots = [slot('a1', 't-tidy', 2, 1), slot('a2', 't-tidy', 2, 5)];

    const report = await service.report('sem1');
    expect(report.worstOff[0].biggestBurden).toContain('Tiết trống phải chờ');
    expect(report.worstOff[0].suggestion).toContain('liền nhau');
  });
});
