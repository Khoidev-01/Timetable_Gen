import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PatternMiningService } from './pattern-mining.service';

/** A move logged as the head teacher dragging one period from one cell to another. */
function moveLog(slotId: string, from: [number, number], to: [number, number]) {
  return {
    action: 'MOVE',
    before: [{ slotId, day: from[0], period: from[1], isLocked: false }],
    after: [{ slotId, day: to[0], period: to[1], isLocked: true }],
  };
}

describe('PatternMiningService', () => {
  let service: PatternMiningService;
  let logs: any[];
  let slots: any[];

  beforeEach(async () => {
    logs = [];
    slots = [];

    const prisma = {
      generatedTimetable: { findMany: async () => [{ id: 'tt1' }] },
      timetableChangeLog: { findMany: async () => logs },
      timetableSlot: {
        findMany: async ({ where }: any) => slots.filter((s) => where.id.in.includes(s.id)),
      },
      teacher: {
        findMany: async ({ where }: any) =>
          where.id.in.map((id: string) => ({ id, code: `GV_${id}`, full_name: `Cô ${id}` })),
      },
      subject: {
        findMany: async ({ where }: any) =>
          where.id.in.map((id: number) => ({ id, name: `Môn ${id}` })),
      },
      class: {
        findMany: async ({ where }: any) =>
          where.id.in.map((id: string) => ({ id, name: id })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PatternMiningService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(PatternMiningService);
  });

  it('says nothing when there is no history to learn from', async () => {
    const result = await service.mine('sem1');
    expect(result.facts).toBe(0);
    expect(result.patterns).toEqual([]);
  });

  it('ignores a cell the same teacher was moved out of only twice', async () => {
    slots = [
      { id: 's1', teacher_id: 't1', subject_id: 1, class_id: '10A1' },
      { id: 's2', teacher_id: 't1', subject_id: 1, class_id: '10A1' },
    ];
    logs = [moveLog('s1', [5, 5], [3, 2]), moveLog('s2', [5, 5], [4, 1])];

    const result = await service.mine('sem1');
    expect(result.facts).toBe(2);
    expect(result.patterns).toHaveLength(0);
  });

  it('reads a busy time out of a teacher repeatedly moved off the same cell', async () => {
    slots = ['s1', 's2', 's3'].map((id) => ({
      id,
      teacher_id: 't1',
      subject_id: 1,
      class_id: '10A1',
    }));
    logs = [
      moveLog('s1', [5, 5], [3, 2]),
      moveLog('s2', [5, 5], [4, 1]),
      moveLog('s3', [5, 5], [2, 3]),
    ];

    const result = await service.mine('sem1');
    const teacherPattern = result.patterns.find((p) => p.kind === 'TEACHER_AVOIDS_CELL');

    expect(teacherPattern).toBeDefined();
    expect(teacherPattern!.observations).toBe(3);
    expect(teacherPattern!.proposal).toEqual({
      teacherId: 't1',
      teacherCode: 'GV_t1',
      day: 5,
      period: 5,
      session: 0,
    });
  });

  it('puts an afternoon period in the afternoon session of the proposal', async () => {
    slots = ['s1', 's2', 's3'].map((id) => ({
      id,
      teacher_id: 't1',
      subject_id: 1,
      class_id: '10A1',
    }));
    logs = ['s1', 's2', 's3'].map((id) => moveLog(id, [6, 8], [2, 2]));

    const result = await service.mine('sem1');
    const proposal = result.patterns.find((p) => p.kind === 'TEACHER_AVOIDS_CELL')!.proposal!;

    expect(proposal.session).toBe(1);
    expect(proposal.period).toBe(3);
  });

  it('does not restate one teacher pattern as a subject pattern', async () => {
    slots = ['s1', 's2', 's3'].map((id) => ({
      id,
      teacher_id: 't1',
      subject_id: 7,
      class_id: '10A1',
    }));
    logs = ['s1', 's2', 's3'].map((id) => moveLog(id, [5, 5], [3, 2]));

    const result = await service.mine('sem1');
    expect(result.patterns.filter((p) => p.kind === 'SUBJECT_AVOIDS_CELL')).toHaveLength(0);
  });

  it('reports a subject pattern once several teachers show it', async () => {
    slots = [
      { id: 's1', teacher_id: 't1', subject_id: 7, class_id: '10A1' },
      { id: 's2', teacher_id: 't2', subject_id: 7, class_id: '10A2' },
      { id: 's3', teacher_id: 't3', subject_id: 7, class_id: '10A3' },
    ];
    logs = ['s1', 's2', 's3'].map((id) => moveLog(id, [5, 5], [3, 2]));

    const result = await service.mine('sem1');
    const subjectPattern = result.patterns.find((p) => p.kind === 'SUBJECT_AVOIDS_CELL');

    expect(subjectPattern).toBeDefined();
    expect(subjectPattern!.detail).toContain('3 giáo viên');
  });

  it('ignores an edit that changed something other than the time', async () => {
    slots = [{ id: 's1', teacher_id: 't1', subject_id: 1, class_id: '10A1' }];
    logs = [
      {
        action: 'MOVE',
        before: [{ slotId: 's1', day: 5, period: 5, isLocked: false }],
        after: [{ slotId: 's1', day: 5, period: 5, isLocked: true }],
      },
    ];

    const result = await service.mine('sem1');
    expect(result.facts).toBe(0);
  });
});
