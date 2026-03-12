
import { Constraint, ScheduleSlot, Violation } from './interfaces/constraint.interface';

export class TeacherBusyTimeConstraint implements Constraint {
    name = 'Teacher Busy Time';
    priority: 'HARD' | 'SOFT' = 'HARD';
    weight = 10000;

    // Map<teacherId, Array<{day, period, session}>>
    private busyMap: Map<string, any[]> = new Map();

    setBusyData(map: Map<string, any[]>) {
        this.busyMap = map;
    }

    check(schedule: ScheduleSlot[]): Violation | null {
        let penalty = 0;
        let violations = 0;

        for (const slot of schedule) {
            if (!slot.teacherId || slot.teacherId === 'SYSTEM') continue;

            const teacherBusySlots = this.busyMap.get(slot.teacherId);
            if (!teacherBusySlots || teacherBusySlots.length === 0) continue;

            // Check conflict
            // Note: DB stores 'session' (0: Morning, 1: Afternoon). 
            // Slot 'period' 1-5 is Morning, 6-10 is Afternoon.
            // But 'period' in busy slot implies relavtive period within session usually?
            // Let's check format from Feedback Page: { day, period, session }
            // Feedback Page: period 1-5. Session 0 or 1.
            // ScheduleSlot: period 1-10 (absolute).
            // Need conversion.

            const currentSession = slot.period <= 5 ? 0 : 1;
            const currentRelativePeriod = slot.period > 5 ? slot.period - 5 : slot.period;

            const isBusy = teacherBusySlots.some(bs =>
                bs.day === slot.day &&
                bs.session === currentSession &&
                bs.period === currentRelativePeriod
            );

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
