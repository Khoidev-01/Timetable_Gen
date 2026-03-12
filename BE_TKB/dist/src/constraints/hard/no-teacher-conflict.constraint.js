"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoTeacherConflictConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class NoTeacherConflictConstraint {
    name = constraint_interface_1.HardConstraintType.HC_01_NO_TEACHER_CONFLICT;
    priority = 'HARD';
    weight = 1000;
    check(schedule) {
        const teacherMap = new Map();
        for (const slot of schedule) {
            if (!slot.teacherId)
                continue;
            const key = `${slot.teacherId}_${slot.day}_${slot.period}`;
            if (teacherMap.has(key)) {
                return {
                    type: 'HARD',
                    constraintName: this.name,
                    description: `Giáo viên ${slot.teacherId} bị trùng lịch dạy vào Thứ ${slot.day}, Tiết ${slot.period} (Lớp ${teacherMap.get(key)} và Lớp ${slot.classId})`,
                    penaltyScore: this.weight
                };
            }
            teacherMap.set(key, slot.classId);
        }
        return null;
    }
}
exports.NoTeacherConflictConstraint = NoTeacherConflictConstraint;
//# sourceMappingURL=no-teacher-conflict.constraint.js.map