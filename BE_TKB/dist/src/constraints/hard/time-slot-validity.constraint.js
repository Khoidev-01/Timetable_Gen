"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeSlotValidityConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class TimeSlotValidityConstraint {
    name = constraint_interface_1.HardConstraintType.HC_06_TIME_SLOT_VALIDITY;
    priority = 'HARD';
    weight = 1000;
    check(schedule) {
        for (const slot of schedule) {
            if (slot.day === 8) {
                return {
                    type: 'HARD',
                    constraintName: this.name,
                    description: `Lịch xếp vào Chủ Nhật không hợp lệ`,
                    penaltyScore: this.weight
                };
            }
        }
        return null;
    }
}
exports.TimeSlotValidityConstraint = TimeSlotValidityConstraint;
//# sourceMappingURL=time-slot-validity.constraint.js.map