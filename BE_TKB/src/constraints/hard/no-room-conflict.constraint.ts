import { Constraint, HardConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class NoRoomConflictConstraint implements Constraint {
    name = HardConstraintType.HC_03_NO_ROOM_CONFLICT;
    priority = 'HARD' as const;
    weight = 1000;

    check(schedule: ScheduleSlot[]): Violation | null {
        // defined as: A room cannot host more than 1 class in the same (day, period)
        const roomMap = new Map<string, string>(); // Key: "roomId_day_period" -> classId

        for (const slot of schedule) {
            if (!slot.roomId) continue; // Skip if room is not assigned yet

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
