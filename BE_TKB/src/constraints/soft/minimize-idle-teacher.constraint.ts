import { Constraint, SoftConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class MinimizeIdleTeacherConstraint implements Constraint {
    name = SoftConstraintType.SC_03_MINIMIZE_IDLE_TEACHER;
    priority = 'SOFT' as const;
    weight = 15;

    check(schedule: ScheduleSlot[]): Violation | null {
        // "Idle period" (Tiết trống) means a gap between teaching periods in the same day.
        // E.g., Teach P1, Empty P2, Teach P3 -> 1 Idle period.

        let totalPenalty = 0;
        const teacherDailySlots = new Map<string, number[]>(); // Key: "teacherId_day" -> [periods]

        // Group slots
        for (const slot of schedule) {
            if (!slot.teacherId) continue;
            const key = `${slot.teacherId}_${slot.day}`;
            if (!teacherDailySlots.has(key)) teacherDailySlots.set(key, []);
            teacherDailySlots.get(key)!.push(slot.period);
        }

        // Calculate gaps
        for (const [key, periods] of teacherDailySlots.entries()) {
            if (periods.length < 2) continue; // No gaps possible with 0 or 1 slot

            periods.sort((a, b) => a - b);

            const teacherId = key.split('_')[0];
            const day = key.split('_')[1];

            for (let i = 0; i < periods.length - 1; i++) {
                const gap = periods[i + 1] - periods[i] - 1;
                if (gap > 0) {
                    // Penalty proportional to gap size
                    totalPenalty += gap * this.weight;
                }
            }
        }

        if (totalPenalty > 0) {
            return {
                type: 'SOFT',
                constraintName: this.name,
                description: `Tổng số tiết trống của giáo viên trong lịch là quá cao`,
                penaltyScore: totalPenalty
            };
        }

        return null;
    }
}
