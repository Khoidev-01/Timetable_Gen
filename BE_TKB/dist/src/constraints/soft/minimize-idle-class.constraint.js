"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinimizeIdleClassConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class MinimizeIdleClassConstraint {
    name = constraint_interface_1.SoftConstraintType.SC_04_MINIMIZE_IDLE_CLASS;
    priority = 'SOFT';
    weight = 50;
    check(schedule) {
        let totalPenalty = 0;
        const classDailySlots = new Map();
        for (const slot of schedule) {
            const key = `${slot.classId}_${slot.day}`;
            if (!classDailySlots.has(key))
                classDailySlots.set(key, []);
            classDailySlots.get(key).push(slot.period);
        }
        for (const [key, periods] of classDailySlots.entries()) {
            if (periods.length < 2)
                continue;
            periods.sort((a, b) => a - b);
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
                description: `Học sinh có tiết trống (gaps) trong lịch học`,
                penaltyScore: totalPenalty
            };
        }
        return null;
    }
}
exports.MinimizeIdleClassConstraint = MinimizeIdleClassConstraint;
//# sourceMappingURL=minimize-idle-class.constraint.js.map