import { Constraint, SoftConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class StabilityConstraint implements Constraint {
    name = SoftConstraintType.SC_08_STABILITY;
    priority = 'SOFT' as const;
    weight = 50;

    check(schedule: ScheduleSlot[]): Violation | null {
        // Compare with "Previous Version" of schedule to minimize changes.
        // Requires access to old schedule.

        return null;
    }
}
