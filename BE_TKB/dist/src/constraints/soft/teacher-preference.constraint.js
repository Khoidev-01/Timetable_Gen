"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeacherPreferenceConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class TeacherPreferenceConstraint {
    name = constraint_interface_1.SoftConstraintType.SC_05_TEACHER_PREFERENCE;
    priority = 'SOFT';
    weight = 10;
    check(schedule) {
        return null;
    }
}
exports.TeacherPreferenceConstraint = TeacherPreferenceConstraint;
//# sourceMappingURL=teacher-preference.constraint.js.map