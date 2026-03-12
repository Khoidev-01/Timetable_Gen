"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StabilityConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class StabilityConstraint {
    name = constraint_interface_1.SoftConstraintType.SC_08_STABILITY;
    priority = 'SOFT';
    weight = 50;
    check(schedule) {
        return null;
    }
}
exports.StabilityConstraint = StabilityConstraint;
//# sourceMappingURL=stability.constraint.js.map