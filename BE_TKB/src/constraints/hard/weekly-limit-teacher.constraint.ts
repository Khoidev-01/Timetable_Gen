import { Constraint, HardConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class WeeklyLimitTeacherConstraint implements Constraint {
    name = HardConstraintType.HC_05_PERIOD_LIMIT; // Using general name mapping
    priority = 'HARD' as const;
    weight = 1000;

    check(schedule: ScheduleSlot[]): Violation | null {
        const teacherWeeklyCounts = new Map<string, number>();
        const MAX_PER_WEEK = 20; // Example, should fetch from Teacher Config

        for (const slot of schedule) {
            if (!slot.teacherId) continue;

            const key = slot.teacherId;
            const count = (teacherWeeklyCounts.get(key) || 0) + 1;

            if (count > MAX_PER_WEEK) {
                return {
                    type: 'HARD',
                    constraintName: this.name,
                    description: `Giáo viên ${slot.teacherId} dạy quá số tiết quy định trong tuần (Hiện tại: ${count}, Tối đa: ${MAX_PER_WEEK})`,
                    penaltyScore: this.weight
                };
            }

            teacherWeeklyCounts.set(key, count);
        }
        return null;
    }
}
