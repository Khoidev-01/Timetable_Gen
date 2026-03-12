import { Constraint, SoftConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';
export declare class StabilityConstraint implements Constraint {
    name: SoftConstraintType;
    priority: "SOFT";
    weight: number;
    check(schedule: ScheduleSlot[]): Violation | null;
}
