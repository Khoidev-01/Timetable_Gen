
import { Constraint, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class OppositeSessionConstraint implements Constraint {
    name = 'Opposite Session (PE/QP)';
    priority: 'HARD' | 'SOFT' = 'HARD';
    weight = 5000; // High penalty

    // classId -> 'SANG' | 'CHIEU' | 'CA_HAI'
    private classSessions: Map<string, string> = new Map();
    private subjectTypes: Map<string, string> = new Map(); // subjectId -> code/name to identify PE/QP

    setMetadata(classSessions: Map<string, string>, subjectTypes: Map<string, string>) {
        this.classSessions = classSessions;
        this.subjectTypes = subjectTypes;
    }

    check(schedule: ScheduleSlot[]): Violation | null {
        let violations = 0;
        let penalty = 0;

        for (const slot of schedule) {
            const subjectCode = this.subjectTypes.get(slot.subjectId);
            // Check if PE or GDQP
            if (subjectCode === 'THE_CHAT' || subjectCode === 'GDQP') {
                const classSession = this.classSessions.get(slot.classId);

                // Rule 1: No Mon Morning P1 (Flag Raising)
                // Mon is Day 2. P1 is Period 1.
                if (slot.day === 2 && slot.period === 1) {
                    violations++;
                    penalty += this.weight;
                    continue;
                }

                // Rule 2: Opposite Session
                // If Class Morning (SANG) -> Slot must be Afternoon (6-10)
                // If Class Afternoon (CHIEU) -> Slot must be Morning (1-5)

                if (classSession === 'SANG') {
                    if (slot.period <= 5) {
                        violations++;
                        penalty += this.weight;
                    }
                } else if (classSession === 'CHIEU') {
                    if (slot.period > 5) {
                        violations++;
                        penalty += this.weight;
                    }
                }
            }
        }

        if (violations > 0) {
            return {
                type: 'HARD',
                constraintName: this.name,
                description: `Found ${violations} assignments violating Opposite Session rules for PE/QP`,
                penaltyScore: penalty
            };
        }

        return null;
    }
}
