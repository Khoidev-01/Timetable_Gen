import { Constraint, HardConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class TimeSlotValidityConstraint implements Constraint {
    name = HardConstraintType.HC_06_TIME_SLOT_VALIDITY;
    priority = 'HARD' as const;
    weight = 1000;

    check(schedule: ScheduleSlot[]): Violation | null {
        // Check if subject is allowed in this slot (e.g. PE no noon)
        // Placeholder logic. Requires "Subject Configuration" context.

        // Example: Day 7 (Sunday) is usually invalid unless configured
        for (const slot of schedule) {
            if (slot.day === 8) { // Assuming 2-7 are valid Mon-Sat
                return {
                    type: 'HARD',
                    constraintName: this.name,
                    description: `Lịch xếp vào Chủ Nhật không hợp lệ`,
                    penaltyScore: this.weight
                };
            }
        }
        return null;
    }
}
