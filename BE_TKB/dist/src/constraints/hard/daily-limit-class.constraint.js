"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyLimitClassConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class DailyLimitClassConstraint {
    name = constraint_interface_1.HardConstraintType.HC_08_DAILY_LIMIT_CLASS;
    priority = 'HARD';
    weight = 1000;
    check(schedule) {
        const classDailyCounts = new Map();
        const MAX_PER_DAY = 5;
        for (const slot of schedule) {
            const key = `${slot.classId}_${slot.day}`;
            const count = (classDailyCounts.get(key) || 0) + 1;
            if (count > MAX_PER_DAY) {
                return {
                    type: 'HARD',
                    constraintName: this.name,
                    description: `Lớp ${slot.classId} học quá số tiết quy định trong Thứ ${slot.day} (Hiện tại: ${count}, Tối đa: ${MAX_PER_DAY})`,
                    penaltyScore: this.weight
                };
            }
            classDailyCounts.set(key, count);
        }
        return null;
    }
}
exports.DailyLimitClassConstraint = DailyLimitClassConstraint;
//# sourceMappingURL=daily-limit-class.constraint.js.map