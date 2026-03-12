import { Constraint, HardConstraintType, ScheduleSlot, Violation } from '../interfaces/constraint.interface';

export class NoTeacherConflictConstraint implements Constraint {
    name = HardConstraintType.HC_01_NO_TEACHER_CONFLICT;
    priority = 'HARD' as const;
    weight = 1000;

    check(schedule: ScheduleSlot[]): Violation | null {
        const teacherMap = new Map<string, string>(); // Key: "teacherId_day_period" -> classId

        for (const slot of schedule) {
            if (!slot.teacherId) continue;

            const key = `${slot.teacherId}_${slot.day}_${slot.period}`;

            if (teacherMap.has(key)) {
                return {
                    type: 'HARD',
                    constraintName: this.name,
                    description: `Giáo viên ${slot.teacherId} bị trùng lịch dạy vào Thứ ${slot.day}, Tiết ${slot.period} (Lớp ${teacherMap.get(key)} và Lớp ${slot.classId})`,
                    penaltyScore: this.weight
                };
            }

            teacherMap.set(key, slot.classId);
        }

        return null;
    }
}
