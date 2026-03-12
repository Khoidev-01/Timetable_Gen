"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OppositeSessionConstraint = void 0;
class OppositeSessionConstraint {
    name = 'Opposite Session (PE/QP)';
    priority = 'HARD';
    weight = 5000;
    classSessions = new Map();
    subjectTypes = new Map();
    setMetadata(classSessions, subjectTypes) {
        this.classSessions = classSessions;
        this.subjectTypes = subjectTypes;
    }
    check(schedule) {
        let violations = 0;
        let penalty = 0;
        for (const slot of schedule) {
            const subjectCode = this.subjectTypes.get(slot.subjectId);
            if (subjectCode === 'THE_CHAT' || subjectCode === 'GDQP') {
                const classSession = this.classSessions.get(slot.classId);
                if (slot.day === 2 && slot.period === 1) {
                    violations++;
                    penalty += this.weight;
                    continue;
                }
                if (classSession === 'SANG') {
                    if (slot.period <= 5) {
                        violations++;
                        penalty += this.weight;
                    }
                }
                else if (classSession === 'CHIEU') {
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
exports.OppositeSessionConstraint = OppositeSessionConstraint;
//# sourceMappingURL=opposite-session.constraint.js.map