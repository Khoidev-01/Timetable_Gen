import { Constraint, HardConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class DailyLimitTeacherConstraint implements Constraint {
    name = HardConstraintType.HC_09_DAILY_LIMIT_TEACHER;
    priority = 'HARD' as const;
    weight = 1000;

    check(schedule: ScheduleSlot[]): Violation | null {
        const teacherDailyCounts = new Map<string, number>();
        const MAX_PER_DAY = 5; // Configurable later

        for (const slot of schedule) {
            if (!slot.teacherId) continue;

            const key = `${slot.teacherId}_${slot.day}`;
            const count = (teacherDailyCounts.get(key) || 0) + 1;

            if (count > MAX_PER_DAY) {
                return {
                    type: 'HARD',
                    constraintName: this.name,
                    description: `Giáo viên ${slot.teacherId} dạy quá số tiết quy định trong Thứ ${slot.day} (Hiện tại: ${count}, Tối đa: ${MAX_PER_DAY})`,
                    penaltyScore: this.weight
                };
            }

            teacherDailyCounts.set(key, count);
        }
        return null;
    }
}
