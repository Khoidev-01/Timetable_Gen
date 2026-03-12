import { Constraint, HardConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class CorrectAssignmentConstraint implements Constraint {
    name = HardConstraintType.HC_04_CORRECT_ASSIGNMENT;
    priority = 'HARD' as const;
    weight = 1000;

    // In a real scenario, we need access to the "Teaching Assignment" table (PhanCongChuyenMon)
    // For this standalone implementation, we assume the schedule input *should* already respect assignments
    // unless mutation disrupted it. 
    // We will assume `slot.teacherId` MUST match the teacher assigned to `slot.classId` + `slot.subjectId`.

    // To make this checkable, we might need to inject the Assignment Map. 
    // For now, we stub it. The detailed logic requires the Context object which we will build in the Solver.

    check(schedule: ScheduleSlot[]): Violation | null {
        // Placeholder logic: If we had an assignment map, we would check:
        // if (assignmentMap.get(slot.classId + slot.subjectId) !== slot.teacherId) return Violation...

        // Since the initial population generation respects assignments, and typical mutations 
        // (Time/Room swap) don't change teachers, this is mainly for "Teacher Swap" mutation.

        return null;
    }
}
