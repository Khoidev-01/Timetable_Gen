import { Constraint, SoftConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class MainSubjectMorningConstraint implements Constraint {
    name = SoftConstraintType.SC_07_MAIN_SUBJECT_MORNING;
    priority = 'SOFT' as const;
    weight = 30;

    check(schedule: ScheduleSlot[]): Violation | null {
        // Math, Literature, English should be in periods 1-3.
        const MAIN_SUBJECTS = ['TOAN', 'VAN', 'ANH'];
        let penalty = 0;

        for (const slot of schedule) {
            if (MAIN_SUBJECTS.includes(slot.subjectId)) {
                // Assume period 1-5 is morning. 4-5 is late morning. 1-3 is early.
                // Penalty if period > 3 ? Or if period > 5 (Afternoon)?

                if (slot.period > 5) {
                    penalty += this.weight * 2; // Very bad to have Math in afternoon if school is morning
                } else if (slot.period > 4) {
                    penalty += this.weight; // Less optimal
                }
            }
        }

        if (penalty > 0) {
            return {
                type: 'SOFT',
                constraintName: this.name,
                description: `Môn chính bị xếp vào khung giờ không tối ưu`,
                penaltyScore: penalty
            };
        }
        return null;
    }
}
