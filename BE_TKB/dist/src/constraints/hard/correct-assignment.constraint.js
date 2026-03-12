"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorrectAssignmentConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class CorrectAssignmentConstraint {
    name = constraint_interface_1.HardConstraintType.HC_04_CORRECT_ASSIGNMENT;
    priority = 'HARD';
    weight = 1000;
    check(schedule) {
        return null;
    }
}
exports.CorrectAssignmentConstraint = CorrectAssignmentConstraint;
//# sourceMappingURL=correct-assignment.constraint.js.map