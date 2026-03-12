"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeeklyLimitTeacherConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class WeeklyLimitTeacherConstraint {
    name = constraint_interface_1.HardConstraintType.HC_05_PERIOD_LIMIT;
    priority = 'HARD';
    weight = 1000;
    check(schedule) {
        const teacherWeeklyCounts = new Map();
        const MAX_PER_WEEK = 20;
        for (const slot of schedule) {
            if (!slot.teacherId)
                continue;
            const key = slot.teacherId;
            const count = (teacherWeeklyCounts.get(key) || 0) + 1;
            if (count > MAX_PER_WEEK) {
                return {
                    type: 'HARD',
                    constraintName: this.name,
                    description: `Giáo viên ${slot.teacherId} dạy quá số tiết quy định trong tuần (Hiện tại: ${count}, Tối đa: ${MAX_PER_WEEK})`,
                    penaltyScore: this.weight
                };
            }
            teacherWeeklyCounts.set(key, count);
        }
        return null;
    }
}
exports.WeeklyLimitTeacherConstraint = WeeklyLimitTeacherConstraint;
//# sourceMappingURL=weekly-limit-teacher.constraint.js.map