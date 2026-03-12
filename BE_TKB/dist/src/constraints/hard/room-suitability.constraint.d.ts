import { Constraint, HardConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';
export declare class RoomSuitabilityConstraint implements Constraint {
    name: HardConstraintType;
    priority: 'HARD' | 'SOFT';
    weight: number;
    private subjectRequirements;
    private roomCapacities;
    setMetadata(subjectRequirements: Map<string, string>, roomCapacities: Map<string, number>): void;
    check(schedule: ScheduleSlot[]): Violation | null;
}
