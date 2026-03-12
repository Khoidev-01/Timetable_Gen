"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainSubjectMorningConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class MainSubjectMorningConstraint {
    name = constraint_interface_1.SoftConstraintType.SC_07_MAIN_SUBJECT_MORNING;
    priority = 'SOFT';
    weight = 30;
    check(schedule) {
        const MAIN_SUBJECTS = ['TOAN', 'VAN', 'ANH'];
        let penalty = 0;
        for (const slot of schedule) {
            if (MAIN_SUBJECTS.includes(slot.subjectId)) {
                if (slot.period > 5) {
                    penalty += this.weight * 2;
                }
                else if (slot.period > 4) {
                    penalty += this.weight;
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
exports.MainSubjectMorningConstraint = MainSubjectMorningConstraint;
//# sourceMappingURL=main-subject-morning.constraint.js.map