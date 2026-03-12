import { Constraint, ScheduleSlot, Violation } from '../interfaces/constraint.interface';
export declare class OppositeSessionConstraint implements Constraint {
    name: string;
    priority: 'HARD' | 'SOFT';
    weight: number;
    private classSessions;
    private subjectTypes;
    setMetadata(classSessions: Map<string, string>, subjectTypes: Map<string, string>): void;
    check(schedule: ScheduleSlot[]): Violation | null;
}
