"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvoidHeavyTopicsConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class AvoidHeavyTopicsConstraint {
    name = constraint_interface_1.SoftConstraintType.SC_02_AVOID_HEAVY_TOPICS;
    priority = 'SOFT';
    weight = 20;
    check(schedule) {
        const HEAVY_SUBJECT_IDS = ['TOAN', 'LY', 'HOA', 'VAN', 'ANH'];
        const classDailyHeavyCount = new Map();
        for (const slot of schedule) {
            if (HEAVY_SUBJECT_IDS.includes(slot.subjectId)) {
                const key = `${slot.classId}_${slot.day}`;
                const count = (classDailyHeavyCount.get(key) || 0) + 1;
                if (count > 3) {
                    return {
                        type: 'SOFT',
                        constraintName: this.name,
                        description: `Lớp ${slot.classId} học quá nhiều môn nặng vào Thứ ${slot.day}`,
                        penaltyScore: this.weight * (count - 3)
                    };
                }
                classDailyHeavyCount.set(key, count);
            }
        }
        return null;
    }
}
exports.AvoidHeavyTopicsConstraint = AvoidHeavyTopicsConstraint;
//# sourceMappingURL=avoid-heavy-topics.constraint.js.map