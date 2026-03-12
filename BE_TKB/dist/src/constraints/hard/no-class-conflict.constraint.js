"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoClassConflictConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class NoClassConflictConstraint {
    name = constraint_interface_1.HardConstraintType.HC_02_NO_CLASS_CONFLICT;
    priority = 'HARD';
    weight = 1000;
    check(schedule) {
        const classMap = new Map();
        for (const slot of schedule) {
            const key = `${slot.classId}_${slot.day}_${slot.period}`;
            if (classMap.has(key)) {
                return {
                    type: 'HARD',
                    constraintName: this.name,
                    description: `Lớp ${slot.classId} bị trùng lịch học vào Thứ ${slot.day}, Tiết ${slot.period}`,
                    penaltyScore: this.weight
                };
            }
            classMap.set(key, slot.subjectId);
        }
        return null;
    }
}
exports.NoClassConflictConstraint = NoClassConflictConstraint;
//# sourceMappingURL=no-class-conflict.constraint.js.map