import { Constraint, HardConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class NoClassConflictConstraint implements Constraint {
    name = HardConstraintType.HC_02_NO_CLASS_CONFLICT;
    priority = 'HARD' as const;
    weight = 1000;

    check(schedule: ScheduleSlot[]): Violation | null {
        // defined as: A class cannot have more than 1 subject in the same (day, period)
        const classMap = new Map<string, string>(); // Key: "classId_day_period" -> subjectId

        for (const slot of schedule) {
            const key = `${slot.classId}_${slot.day}_${slot.period}`;

            if (classMap.has(key)) {
                return {
                    type: 'HARD',
                    constraintName: this.name,
                    description: `Lớp ${slot.classId} bị trùng lịch học vào Thứ ${slot.day}, Tiết ${slot.period}`,
                    penaltyScore: this.weight
                };
            }

            classMap.set(key, slot.subjectId);
        }

        return null;
    }
}
