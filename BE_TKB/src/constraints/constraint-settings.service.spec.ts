import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ConstraintSettingsService } from './constraint-settings.service';

describe('ConstraintSettingsService', () => {
  let service: ConstraintSettingsService;
  let rows: Map<string, { key: string; weight: number; is_active: boolean }>;

  beforeEach(async () => {
    rows = new Map();

    const prisma = {
      constraintSetting: {
        findMany: async () => [...rows.values()],
        findUnique: async ({ where }: any) => rows.get(where.key) ?? null,
        upsert: async ({ where, create, update }: any) => {
          const row = rows.has(where.key)
            ? { ...rows.get(where.key)!, ...update }
            : { ...create };
          rows.set(where.key, row);
          return row;
        },
        deleteMany: async () => {
          const count = rows.size;
          rows.clear();
          return { count };
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ConstraintSettingsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ConstraintSettingsService);
  });

  it('reports the shipped defaults when nothing has been changed', async () => {
    const settings = await service.list();
    const gaps = settings.find((s) => s.key === 'teacherGaps')!;

    expect(gaps.weight).toBe(5);
    expect(gaps.isActive).toBe(true);
    expect(gaps.isOverridden).toBe(false);
  });

  it('hands the solver the admin weight, not the default', async () => {
    await service.update('teacherGaps', { weight: 200 });
    const { weights } = await service.effective();

    expect(weights.teacherGaps).toBe(200);
  });

  it('turns a disabled soft constraint into weight zero', async () => {
    await service.update('mobility', { isActive: false });
    const { weights } = await service.effective();

    expect(weights.mobility).toBe(0);
  });

  it('remembers the weight of a constraint that was switched off', async () => {
    await service.update('mobility', { weight: 40 });
    await service.update('mobility', { isActive: false });
    await service.update('mobility', { isActive: true });

    const { weights } = await service.effective();
    expect(weights.mobility).toBe(40);
  });

  it('names the disabled hard checks for the solver to skip', async () => {
    await service.update('roomTypeCapacity', { isActive: false });
    const { disabledHard } = await service.effective();

    expect([...disabledHard]).toEqual(['roomTypeCapacity']);
  });

  it('refuses to switch off a clash that is physically impossible', async () => {
    await expect(service.update('teacherConflict', { isActive: false })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses a hard-violation penalty of zero', async () => {
    await expect(service.update('hardViolation', { weight: 0 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses a weight on a hard check, which has no weight of its own', async () => {
    await expect(service.update('classGaps', { weight: 50 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses a negative or fractional weight', async () => {
    await expect(service.update('teacherGaps', { weight: -1 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.update('teacherGaps', { weight: 2.5 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses a key no constraint uses', async () => {
    await expect(service.update('khongTonTai', { weight: 5 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('puts everything back on reset', async () => {
    await service.update('teacherGaps', { weight: 200 });
    await service.update('mobility', { isActive: false });

    const { reset } = await service.reset();
    expect(reset).toBe(2);

    const { weights } = await service.effective();
    expect(weights.teacherGaps).toBe(5);
    expect(weights.mobility).toBe(3);
  });
});
