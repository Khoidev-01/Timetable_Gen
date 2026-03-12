"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoRoomConflictConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class NoRoomConflictConstraint {
    name = constraint_interface_1.HardConstraintType.HC_03_NO_ROOM_CONFLICT;
    priority = 'HARD';
    weight = 1000;
    check(schedule) {
        const roomMap = new Map();
        for (const slot of schedule) {
            if (!slot.roomId)
                continue;
            const key = `${slot.roomId}_${slot.day}_${slot.period}`;
            if (roomMap.has(key)) {
                return {
                    type: 'HARD',
                    constraintName: this.name,
                    description: `Phòng ${slot.roomId} bị trùng lịch sử dụng vào Thứ ${slot.day}, Tiết ${slot.period} (Lớp ${roomMap.get(key)} và Lớp ${slot.classId})`,
                    penaltyScore: this.weight
                };
            }
            roomMap.set(key, slot.classId);
        }
        return null;
    }
}
exports.NoRoomConflictConstraint = NoRoomConflictConstraint;
//# sourceMappingURL=no-room-conflict.constraint.js.map