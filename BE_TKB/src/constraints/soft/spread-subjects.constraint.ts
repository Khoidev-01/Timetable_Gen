import { Constraint, SoftConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class SpreadSubjectsConstraint implements Constraint {
    name = SoftConstraintType.SC_01_SPREAD_SUBJECTS;
    priority = 'SOFT' as const;
    weight = 10; // Default weight

    check(schedule: ScheduleSlot[]): Violation | null {
        // Idea: Calculate variance of days for each subject?
        // Simplified: If a class has >1 period of same subject in one day, good or bad? 
        // Usually "Block teaching" (2 periods) is VALID, but 3 might be too much.
        // Or "Spread" means don't have Math on Monday Period 1 and Monday Period 5 (gap).

        // Let's implement: "Avoid gaps for students". 
        // Wait, SC_04 is Minimize Idle Class. 
        // SC_01 Spread Subjects usually means: Don't put all Math lessons in first 2 days. 
        // Ideally Math should be Mon, Wed, Fri.

        // Logic: For each Subject of a Class, check Day distribution.

        return null; // Placeholder for now, requires complex logic
    }
}
