import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CatalogueEntry,
  CATALOGUE_BY_KEY,
  CONSTRAINT_CATALOGUE,
} from './constraint-catalogue';

export interface ConstraintSettingView extends CatalogueEntry {
  weight: number;
  isActive: boolean;
  /** True when the admin has changed this away from the shipped default. */
  isOverridden: boolean;
}

export interface EffectiveSettings {
  /** Weight per soft key, plus `hardViolation`. A disabled soft constraint reads 0. */
  weights: Record<string, number>;
  /** Hard checks the admin has switched off. */
  disabledHard: Set<string>;
}

const MAX_WEIGHT = 1000;

/**
 * The bridge between the admin screen and the solver.
 *
 * Before this existed the screen wrote to a module-level array: the numbers survived until
 * the next restart, the solver never read them, and an admin who lowered a weight and ran
 * again got a byte-identical timetable with no indication why.
 */
@Injectable()
export class ConstraintSettingsService {
  private readonly logger = new Logger(ConstraintSettingsService.name);

  constructor(private prisma: PrismaService) {}

  /** The catalogue with any stored overrides applied. */
  async list(): Promise<ConstraintSettingView[]> {
    const stored = await this.prisma.constraintSetting.findMany();
    const byKey = new Map(stored.map((row) => [row.key, row]));

    return CONSTRAINT_CATALOGUE.map((entry) => {
      const override = byKey.get(entry.key);
      return {
        ...entry,
        weight: override?.weight ?? entry.defaultWeight,
        isActive: override?.is_active ?? true,
        isOverridden:
          override !== undefined &&
          (override.weight !== entry.defaultWeight || !override.is_active),
      };
    });
  }

  async update(key: string, changes: { weight?: number; isActive?: boolean }) {
    const entry = CATALOGUE_BY_KEY.get(key);
    if (!entry) throw new BadRequestException(`Không có ràng buộc nào mang mã "${key}".`);

    if (changes.isActive === false && !entry.canDisable) {
      throw new BadRequestException(
        `"${entry.name}" không thể tắt — một thời khóa biểu vi phạm điều này là không thực hiện được, không phải kém tối ưu.`,
      );
    }

    if (changes.weight !== undefined) {
      if (!Number.isInteger(changes.weight) || changes.weight < 0 || changes.weight > MAX_WEIGHT) {
        throw new BadRequestException(`Trọng số phải là số nguyên từ 0 đến ${MAX_WEIGHT}.`);
      }
      // Hard checks are counted, not weighted; only the shared penalty has a number
      if (entry.kind === 'HARD') {
        throw new BadRequestException(
          'Ràng buộc cứng không có trọng số riêng — sửa "Mức phạt mỗi lỗi cứng" để đổi mức phạt chung.',
        );
      }
      if (entry.key === 'hardViolation' && changes.weight === 0) {
        throw new BadRequestException(
          'Mức phạt lỗi cứng bằng 0 khiến thuật toán coi lời giải sai cũng tốt như lời giải đúng.',
        );
      }
    }

    const current = await this.prisma.constraintSetting.findUnique({ where: { key } });
    const weight = changes.weight ?? current?.weight ?? entry.defaultWeight;
    const isActive = changes.isActive ?? current?.is_active ?? true;

    await this.prisma.constraintSetting.upsert({
      where: { key },
      create: { key, weight, is_active: isActive },
      update: { weight, is_active: isActive },
    });

    return (await this.list()).find((item) => item.key === key)!;
  }

  /** Drop every override and go back to the shipped defaults. */
  async reset() {
    const { count } = await this.prisma.constraintSetting.deleteMany({});
    this.logger.log(`Reset ${count} constraint override(s) to defaults`);
    return { reset: count };
  }

  /**
   * What the solver needs: a weight per key and the set of hard checks to skip.
   *
   * A soft constraint switched off becomes weight 0 rather than a branch in the scoring
   * loop - same result, and the fitness function stays a straight sum.
   */
  async effective(): Promise<EffectiveSettings> {
    const settings = await this.list();
    const weights: Record<string, number> = {};
    const disabledHard = new Set<string>();

    for (const setting of settings) {
      if (setting.kind === 'HARD') {
        if (!setting.isActive) disabledHard.add(setting.key);
        continue;
      }
      weights[setting.key] = setting.isActive ? setting.weight : 0;
    }

    return { weights, disabledHard };
  }
}
