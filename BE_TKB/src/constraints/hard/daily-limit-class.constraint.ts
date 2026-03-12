import { Constraint, HardConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class DailyLimitClassConstraint implements Constraint {
    name = HardConstraintType.HC_08_DAILY_LIMIT_CLASS;
    priority = 'HARD' as const;
    weight = 1000;

    check(schedule: ScheduleSlot[]): Violation | null {
        const classDailyCounts = new Map<string, number>();
        const MAX_PER_DAY = 5; // Configurable later

        for (const slot of schedule) {
            const key = `${slot.classId}_${slot.day}`;
            const count = (classDailyCounts.get(key) || 0) + 1;

            if (count > MAX_PER_DAY) {
                return {
                    type: 'HARD',
                    constraintName: this.name,
                    description: `Lớp ${slot.classId} học quá số tiết quy định trong Thứ ${slot.day} (Hiện tại: ${count}, Tối đa: ${MAX_PER_DAY})`,
                    penaltyScore: this.weight
                };
            }

            classDailyCounts.set(key, count);
        }
        return null;
    }
}
