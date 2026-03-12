
import { Constraint, HardConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface'; // Fix import path

export class RoomSuitabilityConstraint implements Constraint {
    name = HardConstraintType.HC_07_ROOM_SUITABILITY;
    priority: 'HARD' | 'SOFT' = 'HARD';
    weight = 1000;

    // subjectId -> required LoaiPhong (e.g. PHONG_THUC_HANH_LY)
    private subjectRequirements: Map<string, string> = new Map();

    // LoaiPhong -> Capacity (count of rooms)
    private roomCapacities: Map<string, number> = new Map();

    setMetadata(subjectRequirements: Map<string, string>, roomCapacities: Map<string, number>) {
        this.subjectRequirements = subjectRequirements;
        this.roomCapacities = roomCapacities;
    }

    check(schedule: ScheduleSlot[]): Violation | null {
        let violations = 0;
        let penalty = 0;

        // Group by Time Slot (Day-Period) -> Map<TimeKey, Map<LoaiPhong, count>>
        const timeUsage = new Map<string, Map<string, number>>();

        for (const slot of schedule) {
            const req = this.subjectRequirements.get(slot.subjectId);
            // Ignore if no special room required (or PHONG_THUONG which implies infinite/home rooms)
            if (!req || req === 'PHONG_THUONG') continue;

            const timeKey = `${slot.day}-${slot.period}`;
            if (!timeUsage.has(timeKey)) timeUsage.set(timeKey, new Map());

            const usage = timeUsage.get(timeKey)!;
            usage.set(req, (usage.get(req) || 0) + 1);
        }

        // Check Caps
        for (const [timeKey, usage] of timeUsage.entries()) {
            for (const [loaiPhong, count] of usage.entries()) {
                const cap = this.roomCapacities.get(loaiPhong) || 0;
                if (count > cap) {
                    violations++;
                    penalty += this.weight * (count - cap); // Penalize each overflow
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
