"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomSuitabilityConstraint = void 0;
const constraint_interface_1 = require("../interfaces/constraint.interface");
class RoomSuitabilityConstraint {
    name = constraint_interface_1.HardConstraintType.HC_07_ROOM_SUITABILITY;
    priority = 'HARD';
    weight = 1000;
    subjectRequirements = new Map();
    roomCapacities = new Map();
    setMetadata(subjectRequirements, roomCapacities) {
        this.subjectRequirements = subjectRequirements;
        this.roomCapacities = roomCapacities;
    }
    check(schedule) {
        let violations = 0;
        let penalty = 0;
        const timeUsage = new Map();
        for (const slot of schedule) {
            const req = this.subjectRequirements.get(slot.subjectId);
            if (!req || req === 'PHONG_THUONG')
                continue;
            const timeKey = `${slot.day}-${slot.period}`;
            if (!timeUsage.has(timeKey))
                timeUsage.set(timeKey, new Map());
            const usage = timeUsage.get(timeKey);
            usage.set(req, (usage.get(req) || 0) + 1);
        }
        for (const [timeKey, usage] of timeUsage.entries()) {
            for (const [loaiPhong, count] of usage.entries()) {
                const cap = this.roomCapacities.get(loaiPhong) || 0;
                if (count > cap) {
                    violations++;
                    penalty += this.weight * (count - cap);
                }
            }
        }
        if (violations > 0) {
            return {
                type: 'HARD',
                constraintName: this.name,
                description: `Found ${violations} timeslots exceeding special room capacity`,
                penaltyScore: penalty
            };
        }
        return null;
    }
}
exports.RoomSuitabilityConstraint = RoomSuitabilityConstraint;
//# sourceMappingURL=room-suitability.constraint.js.map