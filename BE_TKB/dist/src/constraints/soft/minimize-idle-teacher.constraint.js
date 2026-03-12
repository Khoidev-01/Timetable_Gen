"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinimizeIdleTeacherConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class MinimizeIdleTeacherConstraint {
    name = constraint_interface_1.SoftConstraintType.SC_03_MINIMIZE_IDLE_TEACHER;
    priority = 'SOFT';
    weight = 15;
    check(schedule) {
        let totalPenalty = 0;
        const teacherDailySlots = new Map();
        for (const slot of schedule) {
            if (!slot.teacherId)
                continue;
            const key = `${slot.teacherId}_${slot.day}`;
            if (!teacherDailySlots.has(key))
                teacherDailySlots.set(key, []);
            teacherDailySlots.get(key).push(slot.period);
        }
        for (const [key, periods] of teacherDailySlots.entries()) {
            if (periods.length < 2)
                continue;
            periods.sort((a, b) => a - b);
            const teacherId = key.split('_')[0];
            const day = key.split('_')[1];
            for (let i = 0; i < periods.length - 1; i++) {
                const gap = periods[i + 1] - periods[i] - 1;
                if (gap > 0) {
                    totalPenalty += gap * this.weight;
                }
            }
        }
        if (totalPenalty > 0) {
            return {
                type: 'SOFT',
                constraintName: this.name,
                description: `Tổng số tiết trống của giáo viên trong lịch là quá cao`,
                penaltyScore: totalPenalty
            };
        }
        return null;
    }
}
exports.MinimizeIdleTeacherConstraint = MinimizeIdleTeacherConstraint;
//# sourceMappingURL=minimize-idle-teacher.constraint.js.map