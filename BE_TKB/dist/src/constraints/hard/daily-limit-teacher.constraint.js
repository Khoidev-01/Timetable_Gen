"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyLimitTeacherConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class DailyLimitTeacherConstraint {
    name = constraint_interface_1.HardConstraintType.HC_09_DAILY_LIMIT_TEACHER;
    priority = 'HARD';
    weight = 1000;
    check(schedule) {
        const teacherDailyCounts = new Map();
        const MAX_PER_DAY = 5;
        for (const slot of schedule) {
            if (!slot.teacherId)
                continue;
            const key = `${slot.teacherId}_${slot.day}`;
            const count = (teacherDailyCounts.get(key) || 0) + 1;
            if (count > MAX_PER_DAY) {
                return {
                    type: 'HARD',
                    constraintName: this.name,
                    description: `Giáo viên ${slot.teacherId} dạy quá số tiết quy định trong Thứ ${slot.day} (Hiện tại: ${count}, Tối đa: ${MAX_PER_DAY})`,
                    penaltyScore: this.weight
                };
            }
            teacherDailyCounts.set(key, count);
        }
        return null;
    }
}
exports.DailyLimitTeacherConstraint = DailyLimitTeacherConstraint;
//# sourceMappingURL=daily-limit-teacher.constraint.js.map