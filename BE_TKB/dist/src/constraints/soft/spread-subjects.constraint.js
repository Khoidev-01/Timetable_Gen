"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpreadSubjectsConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class SpreadSubjectsConstraint {
    name = constraint_interface_1.SoftConstraintType.SC_01_SPREAD_SUBJECTS;
    priority = 'SOFT';
    weight = 10;
    check(schedule) {
        return null;
    }
}
exports.SpreadSubjectsConstraint = SpreadSubjectsConstraint;
//# sourceMappingURL=spread-subjects.constraint.js.map