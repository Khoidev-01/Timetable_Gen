import { ScheduleSlot } from '../constraints/interfaces/constraint.interface';
import { ConstraintService } from './constraint.service';
export declare class GreedySolver {
    private constraintService;
    constructor(constraintService: ConstraintService);
    solveSchedule(assignments: any[], fixedSlots: ScheduleSlot[], maxRetries?: number): Promise<ScheduleSlot[]>;
    private isTeacherBusy;
    private isClassBusy;
    private findValidSlot;
    private placeRandomly;
}
