import { Constraint, HardConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';
export declare class NoClassConflictConstraint implements Constraint {
    name: HardConstraintType;
    priority: "HARD";
    weight: number;
    check(schedule: ScheduleSlot[]): Violation | null;
}
