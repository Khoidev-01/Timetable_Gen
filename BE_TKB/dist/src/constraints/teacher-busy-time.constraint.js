"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeacherBusyTimeConstraint = void 0;
class TeacherBusyTimeConstraint {
    name = 'Teacher Busy Time';
    priority = 'HARD';
    weight = 10000;
    busyMap = new Map();
    setBusyData(map) {
        this.busyMap = map;
    }
    check(schedule) {
        let penalty = 0;
        let violations = 0;
        for (const slot of schedule) {
            if (!slot.teacherId || slot.teacherId === 'SYSTEM')
                continue;
            const teacherBusySlots = this.busyMap.get(slot.teacherId);
            if (!teacherBusySlots || teacherBusySlots.length === 0)
                continue;
            const currentSession = slot.period <= 5 ? 0 : 1;
            const currentRelativePeriod = slot.period > 5 ? slot.period - 5 : slot.period;
            const isBusy = teacherBusySlots.some(bs => bs.day === slot.day &&
                bs.session === currentSession &&
                bs.period === currentRelativePeriod);
            if (isBusy) {
                penalty += this.weight;
                violations++;
            }
        }
        if (violations > 0) {
            return {
                type: 'HARD',
                constraintName: this.name,
                description: `Found ${violations} assignments during teacher busy times`,
                penaltyScore: penalty
            };
        }
        return null;
    }
}
exports.TeacherBusyTimeConstraint = TeacherBusyTimeConstraint;
//# sourceMappingURL=teacher-busy-time.constraint.js.map