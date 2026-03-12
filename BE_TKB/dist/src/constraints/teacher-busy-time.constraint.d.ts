import { Constraint, ScheduleSlot, Violation } from './interfaces/constraint.interface';
export declare class TeacherBusyTimeConstraint implements Constraint {
    name: string;
    priority: 'HARD' | 'SOFT';
    weight: number;
    private busyMap;
    setBusyData(map: Map<string, any[]>): void;
    check(schedule: ScheduleSlot[]): Violation | null;
}
