import { Constraint, SoftConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class AvoidHeavyTopicsConstraint implements Constraint {
    name = SoftConstraintType.SC_02_AVOID_HEAVY_TOPICS;
    priority = 'SOFT' as const;
    weight = 20;

    check(schedule: ScheduleSlot[]): Violation | null {
        // Heavy subjects: Math, Physics, Chemistry, Literature, English (Example)
        // Avoid > 3 heavy subjects in a day.

        const HEAVY_SUBJECT_IDS = ['TOAN', 'LY', 'HOA', 'VAN', 'ANH']; // Should come from Config/DB

        const classDailyHeavyCount = new Map<string, number>();

        for (const slot of schedule) {
            if (HEAVY_SUBJECT_IDS.includes(slot.subjectId)) { // Simplified check
                const key = `${slot.classId}_${slot.day}`;
                const count = (classDailyHeavyCount.get(key) || 0) + 1;

                if (count > 3) {
                    return {
                        type: 'SOFT',
                        constraintName: this.name,
                        description: `Lớp ${slot.classId} học quá nhiều môn nặng vào Thứ ${slot.day}`,
                        penaltyScore: this.weight * (count - 3)
                    };
                }
                classDailyHeavyCount.set(key, count);
            }
        }

        return null;
    }
}
