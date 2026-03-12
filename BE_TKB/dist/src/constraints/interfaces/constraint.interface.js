"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoftConstraintType = exports.HardConstraintType = void 0;
var HardConstraintType;
(function (HardConstraintType) {
    HardConstraintType["HC_01_NO_TEACHER_CONFLICT"] = "HC_01_NO_TEACHER_CONFLICT";
    HardConstraintType["HC_02_NO_CLASS_CONFLICT"] = "HC_02_NO_CLASS_CONFLICT";
    HardConstraintType["HC_03_NO_ROOM_CONFLICT"] = "HC_03_NO_ROOM_CONFLICT";
    HardConstraintType["HC_04_CORRECT_ASSIGNMENT"] = "HC_04_CORRECT_ASSIGNMENT";
    HardConstraintType["HC_05_PERIOD_LIMIT"] = "HC_05_PERIOD_LIMIT";
    HardConstraintType["HC_06_TIME_SLOT_VALIDITY"] = "HC_06_TIME_SLOT_VALIDITY";
    HardConstraintType["HC_07_ROOM_SUITABILITY"] = "HC_07_ROOM_SUITABILITY";
    HardConstraintType["HC_08_DAILY_LIMIT_CLASS"] = "HC_08_DAILY_LIMIT_CLASS";
    HardConstraintType["HC_09_DAILY_LIMIT_TEACHER"] = "HC_09_DAILY_LIMIT_TEACHER";
})(HardConstraintType || (exports.HardConstraintType = HardConstraintType = {}));
var SoftConstraintType;
(function (SoftConstraintType) {
    SoftConstraintType["SC_01_SPREAD_SUBJECTS"] = "SC_01_SPREAD_SUBJECTS";
    SoftConstraintType["SC_02_AVOID_HEAVY_TOPICS"] = "SC_02_AVOID_HEAVY_TOPICS";
    SoftConstraintType["SC_03_MINIMIZE_IDLE_TEACHER"] = "SC_03_MINIMIZE_IDLE_TEACHER";
    SoftConstraintType["SC_04_MINIMIZE_IDLE_CLASS"] = "SC_04_MINIMIZE_IDLE_CLASS";
    SoftConstraintType["SC_05_TEACHER_PREFERENCE"] = "SC_05_TEACHER_PREFERENCE";
    SoftConstraintType["SC_06_BALANCE_LOAD"] = "SC_06_BALANCE_LOAD";
    SoftConstraintType["SC_07_MAIN_SUBJECT_MORNING"] = "SC_07_MAIN_SUBJECT_MORNING";
    SoftConstraintType["SC_08_STABILITY"] = "SC_08_STABILITY";
})(SoftConstraintType || (exports.SoftConstraintType = SoftConstraintType = {}));
//# sourceMappingURL=constraint.interface.js.map