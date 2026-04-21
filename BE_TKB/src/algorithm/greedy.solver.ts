
import { Injectable } from '@nestjs/common';
import { ScheduleSlot } from '../constraints/interfaces/constraint.interface';
import { ConstraintService } from './constraint.service';

@Injectable()
export class GreedySolver {
    constructor(private constraintService: ConstraintService) { }

    /**
     * Attempts to build a valid schedule using Greedy Constructive Heuristic.
     */
    public async solveSchedule(
        assignments: any[],
        fixedSlots: ScheduleSlot[],
        maxRetries: number = 3
    ): Promise<ScheduleSlot[]> {

        let bestSchedule: ScheduleSlot[] = [];
        let leastFailures = Infinity;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const currentSchedule = [...fixedSlots];
            let failures = 0;

            // 1. Sort Assignments: Difficult first
            const sortedAssignments = [...assignments].sort((a, b) => {
                const aDur = a.so_tiet_lien_tiep || 1;
                const bDur = b.so_tiet_lien_tiep || 1;
                if (bDur !== aDur) return bDur - aDur;
                return Math.random() - 0.5;
            });

            // 2. Iterate and Fill
            for (const assign of sortedAssignments) {
                const duration = assign.so_tiet_lien_tiep || 1;

                const validSlot = this.findValidSlot(assign, duration, currentSchedule);

                if (validSlot) {
                    currentSchedule.push(...validSlot);
                } else {
                    failures++;
                    const randomSlot = this.placeRandomly(assign, duration);
                    currentSchedule.push(...randomSlot);
                }
            }

            if (failures < leastFailures) {
                leastFailures = failures;
                bestSchedule = currentSchedule;
            }

            if (failures === 0) break;
        }

        return bestSchedule;
    }

    private isTeacherBusy(teacherId: string, day: number, startPeriod: number, duration: number, schedule: ScheduleSlot[]): boolean {
        for (let i = 0; i < duration; i++) {
            const p = startPeriod + i;

            // 1. Check ConstraintService (DB Busy Time)
            if (this.constraintService.isTeacherBusy(teacherId, day, p)) {
                return true;
            }

            // 2. Check Schedule Conflict
            const exists = schedule.some(s =>
                s.teacherId === teacherId &&
                s.day === day &&
                s.period === p
            );
            if (exists) return true;
        }
        return false;
    }

    private isClassBusy(classId: string, day: number, startPeriod: number, duration: number, schedule: ScheduleSlot[]): boolean {
        for (let i = 0; i < duration; i++) {
            const p = startPeriod + i;
            const exists = schedule.some(s =>
                s.classId === classId &&
                s.day === day &&
                s.period === p
            );
            if (exists) return true;
        }
        return false;
    }

    private isHeavySubjectConflict(classId: string, day: number, session: number, subjectId: any, schedule: ScheduleSlot[]): boolean {
        const heavyCodes = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH', 'LY', 'VAT_LY', 'HOA', 'HOA_HOC'];
        const subjCode = this.constraintService.getSubjectCode(Number(subjectId));
        
        if (!heavyCodes.some(h => subjCode.includes(h))) return false;

        const minP = session === 0 ? 1 : 6;
        const maxP = session === 0 ? 5 : 10;

        let sameSubjectCount = 0;
        
        for (const s of schedule) {
            if (s.classId === classId && s.day === day && s.period >= minP && s.period <= maxP) {
                const existingCode = this.constraintService.getSubjectCode(Number(s.subjectId));
                // Check 1: Different heavy subject in same session
                if (existingCode !== subjCode && heavyCodes.some(h => existingCode.includes(h))) {
                    return true;
                }
                // Count same subject periods
                if (existingCode === subjCode) {
                    sameSubjectCount++;
                }
            }
        }
        // Check 2: Same heavy subject already has >=2 periods in this session
        if (sameSubjectCount >= 2) return true;

        return false;
    }

    private findValidSlot(
        assign: any,
        duration: number,
        currentSchedule: ScheduleSlot[]
    ): ScheduleSlot[] | null {
        const isMorning = assign.lop_hoc.buoi_hoc === 'SANG';
        const sessionOffset = isMorning ? 0 : 5;
        const subjCode = this.constraintService.getSubjectCode(assign.mon_hoc_id);
        const isSpecialTime = subjCode.includes('GDTC') || subjCode.includes('GDQP') || subjCode.includes('QUOC_PHONG');

        const days = [2, 3, 4, 5, 6, 7];
        days.sort(() => Math.random() - 0.5);

        for (const d of days) {
            const possibleStarts: number[] = [];
            for (let p = 1; p <= 6 - duration; p++) {
                if (p <= 5) {
                    if (isSpecialTime) {
                        if (isMorning && p > 3) continue;
                        if (!isMorning && p < 3) continue;
                    }
                    possibleStarts.push(p);
                }
            }
            possibleStarts.sort(() => Math.random() - 0.5);

            for (const relP of possibleStarts) {
                const absStartP = relP + sessionOffset;

                // Check conflicts
                if (this.isTeacherBusy(assign.giao_vien_id, d, absStartP, duration, currentSchedule)) continue;
                if (this.isClassBusy(assign.lop_hoc_id, d, absStartP, duration, currentSchedule)) continue;
                
                // Heavy subject conflict
                const sessionNum = isMorning ? 0 : 1;
                if (this.isHeavySubjectConflict(assign.lop_hoc_id, d, sessionNum, assign.mon_hoc_id, currentSchedule)) continue;

                // Check consecutive same-subject constraint (max 2 consecutive)
                const wouldViolateConsecutive = this.wouldCreateConsecutiveViolation(
                    assign.lop_hoc_id, d, absStartP, duration, assign.mon_hoc_id, currentSchedule
                );
                if (wouldViolateConsecutive) continue;

                // Create Slots
                const candidateSlots: ScheduleSlot[] = [];
                for (let i = 0; i < duration; i++) {
                    candidateSlots.push({
                        id: Math.random().toString(36).substr(2, 9),
                        classId: assign.lop_hoc_id,
                        subjectId: assign.mon_hoc_id,
                        teacherId: assign.giao_vien_id,
                        roomId: undefined,
                        day: d,
                        period: absStartP + i,
                        isFixed: false
                    });
                }
                return candidateSlots;
            }
        }
        return null;
    }

    /**
     * Check if placing a subject at a given day/startPeriod with given duration
     * would create more than 2 consecutive same-subject periods.
     */
    private wouldCreateConsecutiveViolation(
        classId: string, day: number, startPeriod: number,
        duration: number, subjectId: any, schedule: ScheduleSlot[]
    ): boolean {
        // Collect existing periods for this class on this day
        const daySlots = schedule
            .filter(s => s.classId === classId && s.day === day)
            .map(s => ({ period: s.period, subjectId: s.subjectId }));

        // Add the new periods we want to place
        for (let i = 0; i < duration; i++) {
            daySlots.push({ period: startPeriod + i, subjectId });
        }

        // Sort by period and check consecutive count
        daySlots.sort((a, b) => a.period - b.period);
        let consecutiveCount = 1;
        for (let i = 1; i < daySlots.length; i++) {
            if (daySlots[i].subjectId === daySlots[i - 1].subjectId &&
                daySlots[i].period === daySlots[i - 1].period + 1) {
                consecutiveCount++;
                if (consecutiveCount > 2) return true;
            } else {
                consecutiveCount = 1;
            }
        }
        return false;
    }

    private placeRandomly(assign: any, duration: number): ScheduleSlot[] {
        const isMorning = assign.lop_hoc.buoi_hoc === 'SANG';
        const sessionOffset = isMorning ? 0 : 5;
        const subjCode = this.constraintService.getSubjectCode(assign.mon_hoc_id);
        const isSpecialTime = subjCode.includes('GDTC') || subjCode.includes('GDQP') || subjCode.includes('QUOC_PHONG');

        const d = Math.floor(Math.random() * 6) + 2;
        
        const possibleStarts: number[] = [];
        for (let p = 1; p <= 6 - duration; p++) {
            if (p <= 5) {
                if (isSpecialTime) {
                    if (isMorning && p > 3) continue;
                    if (!isMorning && p < 3) continue;
                }
                possibleStarts.push(p);
            }
        }
        
        const relP = possibleStarts.length > 0 
            ? possibleStarts[Math.floor(Math.random() * possibleStarts.length)] 
            : Math.floor(Math.random() * (6 - duration)) + 1;

        const slots: ScheduleSlot[] = [];
        for (let i = 0; i < duration; i++) {
            slots.push({
                id: Math.random().toString(36).substr(2, 9),
                classId: assign.lop_hoc_id,
                subjectId: assign.mon_hoc_id,
                teacherId: assign.giao_vien_id,
                roomId: undefined,
                day: d,
                period: relP + sessionOffset + i,
                isFixed: false
            });
        }
        return slots;
    }
}
