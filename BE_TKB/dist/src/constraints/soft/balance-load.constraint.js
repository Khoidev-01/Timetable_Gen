"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BalanceLoadConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class BalanceLoadConstraint {
    name = constraint_interface_1.SoftConstraintType.SC_06_BALANCE_LOAD;
    priority = 'SOFT';
    weight = 20;
    check(schedule) {
        return null;
    }
}
exports.BalanceLoadConstraint = BalanceLoadConstraint;
//# sourceMappingURL=balance-load.constraint.js.map