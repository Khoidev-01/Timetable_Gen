
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TimeSlot {
    id?: string;
    day: number;   // 2-7 (Mon-Sat)
    period: number; // 1-10 (1-5 Sang, 6-10 Chieu)
    classId: string;
    subjectId: number;
    teacherId: string;
    roomId?: number;
    isLocked?: boolean;
}

@Injectable()
export class ConstraintService {
    private readonly logger = new Logger(ConstraintService.name);

    constructor(private prisma: PrismaService) { }

    // --- CACHE ---
    public roomMap: Map<string, number> = new Map();
    public subjectMap: Map<string, number> = new Map();
    public subjects: any[] = [];
    public teacherMap: Map<string, any> = new Map();
    public teacherMapByName: Map<string, any> = new Map();
    // Teacher constraints cache: Map<teacherId, Array<{day, period, session, type}>>
    private teacherConstraints: Map<string, any[]> = new Map();

    async initialize(semesterId: string) {
        this.logger.log('Initializing Constraint Service...');

        const rooms = await this.prisma.room.findMany();
        rooms.forEach(r => this.roomMap.set(r.name, r.id));

        const subjects = await this.prisma.subject.findMany();
        this.subjects = subjects;
        subjects.forEach(s => this.subjectMap.set(s.code, s.id));

        const teachers = await this.prisma.teacher.findMany({
            include: { constraints: true }
        });
        teachers.forEach(t => {
            this.teacherMap.set(t.id, t);
            this.teacherMapByName.set(t.code, t);
            // Cache constraints from TeacherConstraint table
            this.teacherConstraints.set(t.id, t.constraints || []);
        });

        this.logger.log(`Loaded ${rooms.length} rooms, ${subjects.length} subjects, ${teachers.length} teachers.`);
    }

    // --- HARD CONSTRAINTS (HC) ---

    checkTeacherConflict(slot: TimeSlot, others: TimeSlot[]): boolean {
        return others.some(o =>
            o.day === slot.day &&
            o.period === slot.period &&
            o.teacherId === slot.teacherId &&
            o.classId !== slot.classId
        );
    }

    checkClassConflict(slot: TimeSlot, others: TimeSlot[]): boolean {
        return others.some(o =>
            o.day === slot.day &&
            o.period === slot.period &&
            o.classId === slot.classId &&
            o.subjectId !== slot.subjectId
        );
    }

    checkRoomConflict(slot: TimeSlot, others: TimeSlot[]): boolean {
        if (!slot.roomId) return false;
        return others.some(o =>
            o.day === slot.day &&
            o.period === slot.period &&
            o.roomId === slot.roomId &&
            o.classId !== slot.classId
        );
    }

    getValidRooms(grade: number, session: 'SANG' | 'CHIEU', period: number, subjectType: 'LY_THUYET' | 'THUC_HANH', subjectCode?: string): number[] {
        // GDTC, GDQP → Sân bãi (YARD)
        if (subjectCode && ['GDTC', 'GDQP'].includes(subjectCode.toUpperCase())) {
            return [this.getRoomId('SAN_BANH'), this.getRoomId('SAN_TDTT')]
                .filter((id): id is number => id !== undefined);
        }

        if (subjectType === 'THUC_HANH' && subjectCode) {
            const code = subjectCode.toUpperCase();
            if (code.includes('TIN')) return [this.getRoomId('314'), this.getRoomId('315')].filter((id): id is number => id !== undefined);
            if (code.includes('LY') || code.includes('VAT_LY')) return [this.getRoomId('301')].filter((id): id is number => id !== undefined);
            if (code.includes('HOA')) return [this.getRoomId('302')].filter((id): id is number => id !== undefined);
            if (code.includes('SINH')) return [this.getRoomId('303')].filter((id): id is number => id !== undefined);
        }

        const isMorningPeriod = period <= 5;

        if (grade === 12 && isMorningPeriod) return this.getRangeRoomIds(101, 114);
        if (grade === 11 && !isMorningPeriod) return this.getRangeRoomIds(101, 114);
        if (grade === 10 && isMorningPeriod) return this.getRangeRoomIds(201, 214);
        // Khối 10 chiều (khác buổi GDTC/GDQP) hoặc khối 11 sáng → dùng phòng trống tầng 2
        if (grade === 10 && !isMorningPeriod) return this.getRangeRoomIds(201, 214);
        if (grade === 11 && isMorningPeriod) return this.getRangeRoomIds(101, 114);

        return [...this.getRangeRoomIds(101, 114), ...this.getRangeRoomIds(201, 214)];
    }

    /**
     * Check if teacher is busy at given day/period using TeacherConstraint table data.
     * Uses cached constraints from initialize().
     */
    public isTeacherBusy(teacherId: string, day: number, period: number): boolean {
        const constraints = this.teacherConstraints.get(teacherId);
        if (!constraints || constraints.length === 0) return false;

        // Period 1-5 = Session 0 (Sang), 6-10 = Session 1 (Chieu)
        const session = period <= 5 ? 0 : 1;
        // Relative period within session (1-5)
        const relativePeriod = period <= 5 ? period : period - 5;

        return constraints.some(c =>
            c.day_of_week === day &&
            c.period === relativePeriod &&
            (c.session === session || c.session === 2) && // 2 = All Day
            c.type === 'BUSY'
        );
    }

    public getRoomIds(): number[] {
        return Array.from(this.roomMap.values());
    }

    public getRoomId(name: string): number | undefined {
        return this.roomMap.get(name);
    }

    private getRangeRoomIds(start: number, end: number): number[] {
        const ids: number[] = [];
        for (let i = start; i <= end; i++) {
            const id = this.roomMap.get(String(i));
            if (id) ids.push(id);
        }
        return ids;
    }

    checkFixedSlot(day: number, period: number, grade: number, session: 'SANG' | 'CHIEU'): { isFixed: boolean, subjectCode?: string } {
        // CHAO CO: Mon P1 (Morning Only)
        if (day === 2 && period === 1 && session === 'SANG') {
            return { isFixed: true, subjectCode: 'CHAO_CO' };
        }

        // GVCN Teaching Period - Mon P2 (Sang) / P6 (Chieu)
        if (day === 2) {
            if (session === 'SANG' && period === 2) return { isFixed: true, subjectCode: 'GVCN_TEACHING' };
            if (session === 'CHIEU' && period === 6) return { isFixed: true, subjectCode: 'GVCN_TEACHING' };
        }

        // SH Cuoi Tuan - Saturday
        if (day === 7) {
            if ((session === 'SANG' && period === 4) || (session === 'CHIEU' && period === 9)) {
                return { isFixed: true, subjectCode: 'GVCN_TEACHING' };
            }
            if ((session === 'SANG' && period === 5) || (session === 'CHIEU' && period === 10)) {
                return { isFixed: true, subjectCode: 'SH_CUOI_TUAN' };
            }
        }

        return { isFixed: false };
    }

    // --- HARD CONSTRAINTS BATCH CHECK ---
    checkHardConstraints(schedule: TimeSlot[]): number {
        let violations = 0;

        // Teacher Conflicts
        const teacherGroups = this.groupBy(schedule, 'teacherId');
        for (const [_, slots] of teacherGroups) {
            violations += this.countTimeOverlaps(slots);
        }

        // Class Conflicts
        const classGroups = this.groupBy(schedule, 'classId');
        for (const [_, slots] of classGroups) {
            violations += this.countTimeOverlaps(slots);
        }

        // Room Conflicts
        const roomGroups = this.groupBy(schedule, 'roomId');
        for (const [roomId, slots] of roomGroups) {
            if (roomId === 'undefined' || roomId === 'null') continue;
            violations += this.countTimeOverlaps(slots);
        }

        // Teacher Busy Time violations
        for (const slot of schedule) {
            if (this.isTeacherBusy(slot.teacherId, slot.day, slot.period)) {
                violations++;
            }
        }

        // GDTC / GDQP period restrictions (Must be P1,2,3 or P8,9,10)
        violations += this.checkSpecialSubjectTime(schedule);

        // Heavy Subject restrictions (Max 1 distinct heavy subject per session)
        const classSchedule = this.groupBy(schedule, 'classId');
        violations += this.checkHeavySubjects(classSchedule);

        // Thursday Restriction
        violations += this.checkThursdayRestriction(schedule);

        return violations;
    }

    private countTimeOverlaps(slots: TimeSlot[]): number {
        let overlaps = 0;
        const timeMap = new Map<string, number>();
        for (const s of slots) {
            const key = `${s.day}-${s.period}`;
            timeMap.set(key, (timeMap.get(key) || 0) + 1);
        }
        for (const count of timeMap.values()) {
            if (count > 1) overlaps += (count - 1);
        }
        return overlaps;
    }

    // --- SOFT CONSTRAINTS ---
    calculatePenalty(schedule: TimeSlot[]): number {
        let score = 0;
        const classSchedule = this.groupBy(schedule, 'classId');
        const teacherSchedule = this.groupBy(schedule, 'teacherId');

        score += this.checkSpreadSubjects(classSchedule) * 10;
        score += this.checkMorningPriority(classSchedule) * 15;
        score += this.checkBlock2(classSchedule) * 10;
        score += this.checkNoHoles(teacherSchedule) * 5;
        score += this.checkMaxLoad(teacherSchedule) * 10;

        return score;
    }

    private groupBy(schedule: TimeSlot[], key: keyof TimeSlot): Map<string, TimeSlot[]> {
        const map = new Map<string, TimeSlot[]>();
        for (const s of schedule) {
            const k = String(s[key] ?? 'none');
            if (!map.has(k)) map.set(k, []);
            map.get(k)!.push(s);
        }
        return map;
    }

    // SC01: Spread Subjects
    private checkSpreadSubjects(classSchedule: Map<string, TimeSlot[]>): number {
        let penalty = 0;
        for (const [_, slots] of classSchedule) {
            const subjectMap = new Map<number, number[]>();
            for (const s of slots) {
                if (!subjectMap.has(s.subjectId)) subjectMap.set(s.subjectId, []);
                subjectMap.get(s.subjectId)!.push(s.day);
            }
            for (const [, days] of subjectMap) {
                if (days.length > 2) {
                    const uniqueDays = new Set(days).size;
                    if (uniqueDays < Math.min(days.length, 3)) {
                        penalty++;
                    }
                }
            }
        }
        return penalty;
    }

    // SC02 -> HC: Avoid multiple Heavy Subjects in the same session
    public checkHeavySubjects(classSchedule: Map<string, TimeSlot[]>): number {
        let penalty = 0;
        const heavyCodes = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH', 'LY', 'VAT_LY', 'HOA', 'HOA_HOC'];

        for (const [_, slots] of classSchedule) {
            const daySessionMap = new Map<string, Set<string>>(); // "day-session" -> Set of subject codes

            for (const s of slots) {
                const subjCode = this.getSubjectCode(s.subjectId);
                const isHeavy = heavyCodes.some(h => subjCode.includes(h));
                if (isHeavy) {
                    const session = s.period <= 5 ? 0 : 1;
                    const key = `${s.day}-${session}`;
                    if (!daySessionMap.has(key)) daySessionMap.set(key, new Set());
                    daySessionMap.get(key)!.add(subjCode);
                }
            }

            for (const [, heavySubjects] of daySessionMap) {
                if (heavySubjects.size > 1) {
                    // Penalty for every distinct heavy subject beyond the first one
                    penalty += (heavySubjects.size - 1);
                }
            }
        }
        return penalty;
    }

    // HC: Special Subject Time Constraint
    public checkSpecialSubjectTime(schedule: TimeSlot[]): number {
        let penalty = 0;
        for (const s of schedule) {
            const subjCode = this.getSubjectCode(s.subjectId);
            if (subjCode.includes('GDTC') || subjCode.includes('GDQP') || subjCode.includes('QUOC_PHONG')) {
                // Morning: Must be 1, 2, 3. Afternoon: Must be 8, 9, 10
                const isMorning = s.period <= 5;
                if (isMorning) {
                    if (s.period > 3) penalty++;
                } else {
                    if (s.period < 8) penalty++;
                }
            }
        }
        return penalty;
    }

    // HC: Thursday Restriction (P3-5 and P8-10 must be empty)
    public checkThursdayRestriction(schedule: TimeSlot[]): number {
        let violations = 0;
        for (const s of schedule) {
            if (s.day === 5) {
                // Only periods 1, 2, 6, 7 allowed
                if ([3, 4, 5, 8, 9, 10].includes(s.period)) {
                    violations++;
                }
            }
        }
        return violations;
    }

    // SC03: Morning Priority
    private checkMorningPriority(classSchedule: Map<string, TimeSlot[]>): number {
        let penalty = 0;
        const priority = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH'];

        for (const [_, slots] of classSchedule) {
            for (const s of slots) {
                const subjCode = this.getSubjectCode(s.subjectId);
                if (priority.some(p => subjCode.includes(p))) {
                    if (s.period > 3 && s.period <= 5) {
                        penalty++;
                    }
                }
            }
        }
        return penalty;
    }

    // SC04: Block 2 check
    private checkBlock2(classSchedule: Map<string, TimeSlot[]>): number {
        let penalty = 0;
        const blocks = ['TOAN', 'VAN', 'NGU_VAN', 'TIN', 'LY', 'HOA', 'SINH'];

        for (const [_, slots] of classSchedule) {
            const subjectMap = new Map<number, TimeSlot[]>();
            for (const s of slots) {
                if (!subjectMap.has(s.subjectId)) subjectMap.set(s.subjectId, []);
                subjectMap.get(s.subjectId)!.push(s);
            }

            for (const [subjId, subjSlots] of subjectMap) {
                const code = this.getSubjectCode(subjId);
                if (blocks.some(b => code.includes(b))) {
                    subjSlots.sort((a, b) => a.day === b.day ? a.period - b.period : a.day - b.day);
                    for (let i = 0; i < subjSlots.length; i++) {
                        const prev = subjSlots[i - 1];
                        const next = subjSlots[i + 1];
                        const curr = subjSlots[i];
                        const isAdjPrev = prev && prev.day === curr.day && Math.abs(prev.period - curr.period) === 1;
                        const isAdjNext = next && next.day === curr.day && Math.abs(next.period - curr.period) === 1;
                        if (!isAdjPrev && !isAdjNext && subjSlots.length > 1) {
                            penalty++;
                        }
                    }
                }
            }
        }
        return penalty;
    }

    // SC06: No Holes
    private checkNoHoles(teacherSchedule: Map<string, TimeSlot[]>): number {
        let penalty = 0;
        for (const [_, slots] of teacherSchedule) {
            const sortedByDay = new Map<number, TimeSlot[]>();
            slots.forEach(s => {
                if (!sortedByDay.has(s.day)) sortedByDay.set(s.day, []);
                sortedByDay.get(s.day)!.push(s);
            });

            for (const [, daySlots] of sortedByDay) {
                if (daySlots.length < 2) continue;
                daySlots.sort((a, b) => a.period - b.period);
                for (let i = 0; i < daySlots.length - 1; i++) {
                    const curr = daySlots[i];
                    const next = daySlots[i + 1];
                    const currSession = curr.period <= 5 ? 0 : 1;
                    const nextSession = next.period <= 5 ? 0 : 1;
                    if (currSession === nextSession) {
                        const gap = next.period - curr.period - 1;
                        if (gap > 0) penalty += gap;
                    }
                }
            }
        }
        return penalty;
    }

    // SC07: Max Load
    private checkMaxLoad(teacherSchedule: Map<string, TimeSlot[]>): number {
        let penalty = 0;
        for (const [_, slots] of teacherSchedule) {
            const daySessionCounts = new Map<string, number>();
            for (const s of slots) {
                const session = s.period <= 5 ? 'SANG' : 'CHIEU';
                const key = `${s.day}-${session}`;
                daySessionCounts.set(key, (daySessionCounts.get(key) || 0) + 1);
            }
            for (const count of daySessionCounts.values()) {
                if (count > 4) penalty += (count - 4);
            }
        }
        return penalty;
    }

    public getSubjectCode(id: number): string {
        const subj = this.subjects.find(s => s.id === id);
        return subj ? subj.code.toUpperCase() : '';
    }

    public getFitnessDetails(schedule: TimeSlot[]): any {
        const details: string[] = [];

        const hc1 = this.checkTeacherConflictDetails(schedule);
        if (hc1) details.push(`Giáo viên trùng giờ: -${hc1 * 100} điểm (${hc1} lỗi)`);

        const hc2 = this.checkClassConflictDetails(schedule);
        if (hc2) details.push(`Lớp học trùng giờ: -${hc2 * 100} điểm (${hc2} lỗi)`);

        const hc3 = this.checkRoomConflictDetails(schedule);
        if (hc3) details.push(`Phòng học trùng giờ: -${hc3 * 100} điểm (${hc3} lỗi)`);

        // Count teacher busy violations
        let hc4 = 0;
        for (const slot of schedule) {
            if (this.isTeacherBusy(slot.teacherId, slot.day, slot.period)) hc4++;
        }
        if (hc4) details.push(`Giáo viên dạy khi bận: -${hc4 * 100} điểm (${hc4} lỗi)`);

        const hc5 = this.checkSpecialSubjectTime(schedule);
        if (hc5) details.push(`Môn GDTC/GDQP học giờ nắng: -${hc5 * 100} điểm (${hc5} lỗi)`);

        const classSchedule = this.groupBy(schedule, 'classId');
        const hc6 = this.checkHeavySubjects(classSchedule);
        if (hc6) details.push(`Xếp >=2 môn nặng trong cùng 1 buổi: -${hc6 * 100} điểm (${hc6} lỗi)`);

        const hc7 = this.checkThursdayRestriction(schedule);
        if (hc7) details.push(`Vi phạm lịch nghỉ Thứ 5: -${hc7 * 100} điểm (${hc7} lỗi)`);

        const teacherSchedule = this.groupBy(schedule, 'teacherId');

        const sc1 = this.checkSpreadSubjects(classSchedule);
        if (sc1) details.push(`Môn học dồn cục: -${sc1 * 10} điểm`);

        const sc3 = this.checkMorningPriority(classSchedule);
        if (sc3) details.push(`Môn ưu tiên ở tiết cuối: -${sc3 * 15} điểm`);

        const sc4 = this.checkBlock2(classSchedule);
        if (sc4) details.push(`Môn 2 tiết bị xé lẻ: -${sc4 * 10} điểm`);

        const sc6 = this.checkNoHoles(teacherSchedule);
        if (sc6) details.push(`Tiết trống giáo viên: -${sc6 * 5} điểm`);

        const sc7 = this.checkMaxLoad(teacherSchedule);
        if (sc7) details.push(`Giáo viên dạy quá số tiết/buổi: -${sc7 * 10} điểm`);

        const hardViolations = hc1 + hc2 + hc3 + hc4 + hc5 + hc6 + hc7;
        const softPenalty = (sc1 * 10) + (sc3 * 15) + (sc4 * 10) + (sc6 * 5) + (sc7 * 10);
        const score = 1000 - (hardViolations * 100) - softPenalty;

        return { score, details, hardViolations, softPenalty };
    }

    private checkTeacherConflictDetails(schedule: TimeSlot[]): number {
        const map = this.groupBy(schedule, 'teacherId');
        let v = 0;
        for (const [_, slots] of map) v += this.countTimeOverlaps(slots);
        return v;
    }
    private checkClassConflictDetails(schedule: TimeSlot[]): number {
        const map = this.groupBy(schedule, 'classId');
        let v = 0;
        for (const [_, slots] of map) v += this.countTimeOverlaps(slots);
        return v;
    }
    private checkRoomConflictDetails(schedule: TimeSlot[]): number {
        const map = this.groupBy(schedule, 'roomId');
        let v = 0;
        for (const [id, slots] of map) {
            if (id && id !== 'undefined' && id !== 'null' && id !== 'none') {
                v += this.countTimeOverlaps(slots);
            }
        }
        return v;
    }
}
