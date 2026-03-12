import { Constraint, SoftConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class MinimizeIdleClassConstraint implements Constraint {
    name = SoftConstraintType.SC_04_MINIMIZE_IDLE_CLASS;
    priority = 'SOFT' as const;
    weight = 50; // High weight, students shouldn't have gaps

    check(schedule: ScheduleSlot[]): Violation | null {
        // Similar to SC_03 but for classes. Gaps for students are very bad.

        let totalPenalty = 0;
        const classDailySlots = new Map<string, number[]>();

        for (const slot of schedule) {
            const key = `${slot.classId}_${slot.day}`;
            if (!classDailySlots.has(key)) classDailySlots.set(key, []);
            classDailySlots.get(key)!.push(slot.period);
        }

        for (const [key, periods] of classDailySlots.entries()) {
            if (periods.length < 2) continue;

            periods.sort((a, b) => a - b);

            for (let i = 0; i < periods.length - 1; i++) {
                const gap = periods[i + 1] - periods[i] - 1;
                if (gap > 0) {
                    totalPenalty += gap * this.weight;
                }
            }
        }

        if (totalPenalty > 0) {
            return {
                type: 'SOFT',
                constraintName: this.name,
                description: `Học sinh có tiết trống (gaps) trong lịch học`,
                penaltyScore: totalPenalty
            };
        }

        return null;
    }
}
