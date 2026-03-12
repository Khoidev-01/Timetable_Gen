import { Constraint, SoftConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class TeacherPreferenceConstraint implements Constraint {
    name = SoftConstraintType.SC_05_TEACHER_PREFERENCE;
    priority = 'SOFT' as const;
    weight = 10;

    check(schedule: ScheduleSlot[]): Violation | null {
        // Requires "Preference" data (e.g., Teacher A wants Day Off on Monday).
        // Placeholder logic.

        return null;
    }
}
