import { PeriodType } from '@prisma/client';

/**
 * Lý thuyết và thực hành của cùng một môn, ở cùng một lớp, trong cùng một học kỳ là phần việc của
 * MỘT giáo viên. Hai dòng phân công chỉ tách ra để tiết thực hành được xếp riêng.
 */
export const PAIRED_PERIOD_TYPES: PeriodType[] = [PeriodType.THEORY, PeriodType.PRACTICE];

export const isPairedPeriodType = (type: PeriodType | string | null | undefined): boolean =>
    type === PeriodType.THEORY || type === PeriodType.PRACTICE;
