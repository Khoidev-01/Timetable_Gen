
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
    // Class session cache: classId → main_session (0=morning, 1=afternoon)
    public classSessionMap: Map<string, number> = new Map();

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

        // Build subject code lookup: subjectId -> code
        this.subjectCodeMap.clear();
        subjects.forEach(s => this.subjectCodeMap.set(s.id, s.code));

        this.logger.log(`Loaded ${rooms.length} rooms, ${subjects.length} subjects, ${teachers.length} teachers.`);

        // Cache class sessions
        const classes = await this.prisma.class.findMany();
        classes.forEach(c => this.classSessionMap.set(c.id, c.main_session));
        this.logger.log(`Loaded ${classes.length} class sessions.`);
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

        // Session Restriction: non-GDQP/GDTC must be in main session
        violations += this.checkSessionRestriction(schedule);

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

    // HC: Thursday Restriction — 4 periods per session (P5 and P10 blocked for bán trú)
    public checkThursdayRestriction(schedule: TimeSlot[]): number {
        let violations = 0;
        for (const s of schedule) {
            if (s.day === 5) {
                // Periods 1-4 (morning) and 6-9 (afternoon) allowed; P5 and P10 blocked
                if ([5, 10].includes(s.period)) {
                    violations++;
                }
            }
        }
        return violations;
    }

    // HC: Session Restriction — academic subjects must be in main session
    public checkSessionRestriction(schedule: TimeSlot[]): number {
        let violations = 0;
        // These subjects are allowed in opposite session
        const oppositeAllowed = ['GDTC', 'GDQP', 'HDTN', 'GDDP'];
        for (const s of schedule) {
            const code = this.getSubjectCode(s.subjectId);
            if (oppositeAllowed.some(oc => code.includes(oc))) continue;
            // Skip special subjects (CHAO_CO, SH_CUOI_TUAN)
            if (code.includes('CHAO_CO') || code.includes('SH_CUOI') || code.includes('SHCN')) continue;
            const mainSess = this.classSessionMap.get(s.classId);
            if (mainSess === undefined) continue;
            const slotSess = s.period <= 5 ? 0 : 1;
            if (slotSess !== mainSess) violations++;
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
        const blocks = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH'];

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

    // Cached map for O(1) subject code lookup
    private subjectCodeMap = new Map<number, string>();

    public getSubjectCode(id: number): string {
        if (this.subjectCodeMap.has(id)) return this.subjectCodeMap.get(id)!;
        const subj = this.subjects.find(s => s.id === id);
        const code = subj ? subj.code.toUpperCase() : '';
        this.subjectCodeMap.set(id, code);
        return code;
    }

    private getClassName(classId: string): string {
        // Try to find class name from schedule context or return shortened ID
        return classId.substring(0, 8);
    }

    private getTeacherName(teacherId: string): string {
        const t = this.teacherMap.get(teacherId);
        return t ? (t.full_name || t.code || teacherId.substring(0, 8)) : teacherId.substring(0, 8);
    }

    private getSubjectName(subjectId: number): string {
        const s = this.subjects.find(x => x.id === subjectId);
        return s ? s.name : `MH#${subjectId}`;
    }

    private dayName(day: number): string {
        const names: Record<number, string> = { 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7' };
        return names[day] || `Ngày ${day}`;
    }

    public getFitnessDetails(schedule: TimeSlot[], classMap?: Map<string, string>): any {
        const details: string[] = [];
        const violations: any[] = [];

        const clsName = (id: string) => classMap?.get(id) || this.getClassName(id);

        // ===== HARD CONSTRAINTS =====

        // HC1: Teacher Conflicts
        const teacherGroups = this.groupBy(schedule, 'teacherId');
        let hc1 = 0;
        for (const [teacherId, slots] of teacherGroups) {
            const timeMap = new Map<string, TimeSlot[]>();
            for (const s of slots) {
                const key = `${s.day}-${s.period}`;
                if (!timeMap.has(key)) timeMap.set(key, []);
                timeMap.get(key)!.push(s);
            }
            for (const [key, conflicting] of timeMap) {
                if (conflicting.length > 1) {
                    hc1 += conflicting.length - 1;
                    const classes = conflicting.map(c => clsName(c.classId)).join(', ');
                    const [d, p] = key.split('-');
                    violations.push({
                        type: 'HARD', rule: 'HC1_GV_TRÙNG_GIỜ',
                        msg: `⛔ GV "${this.getTeacherName(teacherId)}" dạy ${conflicting.length} lớp [${classes}] cùng lúc tại ${this.dayName(+d)} tiết ${p}`
                    });
                }
            }
        }
        if (hc1) details.push(`⛔ [HC1] Giáo viên trùng giờ: -${hc1 * 100} điểm (${hc1} lỗi)`);

        // HC2: Class Conflicts
        const classGroups = this.groupBy(schedule, 'classId');
        let hc2 = 0;
        for (const [classId, slots] of classGroups) {
            const timeMap = new Map<string, TimeSlot[]>();
            for (const s of slots) {
                const key = `${s.day}-${s.period}`;
                if (!timeMap.has(key)) timeMap.set(key, []);
                timeMap.get(key)!.push(s);
            }
            for (const [key, conflicting] of timeMap) {
                if (conflicting.length > 1) {
                    hc2 += conflicting.length - 1;
                    const subjects = conflicting.map(c => this.getSubjectCode(c.subjectId)).join(', ');
                    const [d, p] = key.split('-');
                    violations.push({
                        type: 'HARD', rule: 'HC2_LỚP_TRÙNG_GIỜ',
                        msg: `⛔ Lớp "${clsName(classId)}" học ${conflicting.length} môn [${subjects}] cùng lúc tại ${this.dayName(+d)} tiết ${p}`
                    });
                }
            }
        }
        if (hc2) details.push(`⛔ [HC2] Lớp học trùng giờ: -${hc2 * 100} điểm (${hc2} lỗi)`);

        // HC3: Room Conflicts
        const roomGroups = this.groupBy(schedule, 'roomId');
        let hc3 = 0;
        for (const [roomId, slots] of roomGroups) {
            if (!roomId || roomId === 'undefined' || roomId === 'null' || roomId === 'none') continue;
            const timeMap = new Map<string, TimeSlot[]>();
            for (const s of slots) {
                const key = `${s.day}-${s.period}`;
                if (!timeMap.has(key)) timeMap.set(key, []);
                timeMap.get(key)!.push(s);
            }
            for (const [key, conflicting] of timeMap) {
                if (conflicting.length > 1) {
                    hc3 += conflicting.length - 1;
                    const classes = conflicting.map(c => clsName(c.classId)).join(', ');
                    const [d, p] = key.split('-');
                    violations.push({
                        type: 'HARD', rule: 'HC3_PHÒNG_TRÙNG',
                        msg: `⛔ Phòng #${roomId}: ${conflicting.length} lớp [${classes}] tại ${this.dayName(+d)} tiết ${p}`
                    });
                }
            }
        }
        if (hc3) details.push(`⛔ [HC3] Phòng học trùng giờ: -${hc3 * 100} điểm (${hc3} lỗi)`);

        // HC4: Teacher busy
        let hc4 = 0;
        for (const slot of schedule) {
            if (this.isTeacherBusy(slot.teacherId, slot.day, slot.period)) {
                hc4++;
                violations.push({
                    type: 'HARD', rule: 'HC4_GV_BẬN',
                    msg: `⛔ GV "${this.getTeacherName(slot.teacherId)}" bận nhưng vẫn bị xếp dạy ${this.getSubjectCode(slot.subjectId)} lớp "${clsName(slot.classId)}" tại ${this.dayName(slot.day)} tiết ${slot.period}`
                });
            }
        }
        if (hc4) details.push(`⛔ [HC4] Giáo viên dạy khi bận: -${hc4 * 100} điểm (${hc4} lỗi)`);

        // HC5: GDTC/GDQP time
        let hc5 = 0;
        for (const s of schedule) {
            const subjCode = this.getSubjectCode(s.subjectId);
            if (subjCode.includes('GDTC') || subjCode.includes('GDQP') || subjCode.includes('QUOC_PHONG')) {
                const isMorning = s.period <= 5;
                const bad = isMorning ? s.period > 3 : s.period < 8;
                if (bad) {
                    hc5++;
                    violations.push({
                        type: 'HARD', rule: 'HC5_GDTC_GIỜ_NẮNG',
                        msg: `⛔ ${subjCode} lớp "${clsName(s.classId)}" xếp vào ${this.dayName(s.day)} tiết ${s.period} (giờ nắng!). Sáng chỉ được T1-3, Chiều chỉ được T8-10`
                    });
                }
            }
        }
        if (hc5) details.push(`⛔ [HC5] Môn GDTC/GDQP học giờ nắng: -${hc5 * 100} điểm (${hc5} lỗi)`);

        // HC6: Heavy subjects
        const classSchedule = this.groupBy(schedule, 'classId');
        let hc6 = 0;
        const heavyCodes = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH', 'LY', 'VAT_LY', 'HOA', 'HOA_HOC'];
        for (const [classId, slots] of classSchedule) {
            const daySessionMap = new Map<string, Set<string>>();
            for (const s of slots) {
                const subjCode = this.getSubjectCode(s.subjectId);
                if (heavyCodes.some(h => subjCode.includes(h))) {
                    const session = s.period <= 5 ? 'Sáng' : 'Chiều';
                    const key = `${s.day}-${session}`;
                    if (!daySessionMap.has(key)) daySessionMap.set(key, new Set());
                    daySessionMap.get(key)!.add(subjCode);
                }
            }
            for (const [key, heavySet] of daySessionMap) {
                if (heavySet.size > 1) {
                    const count = heavySet.size - 1;
                    hc6 += count;
                    const [d, session] = key.split('-');
                    violations.push({
                        type: 'HARD', rule: 'HC6_MÔN_NẶNG',
                        msg: `⛔ Lớp "${clsName(classId)}" ${this.dayName(+d)} buổi ${session}: ${heavySet.size} môn nặng [${[...heavySet].join(', ')}] trong cùng buổi`
                    });
                }
            }
        }
        if (hc6) details.push(`⛔ [HC6] Xếp >=2 môn nặng trong cùng 1 buổi: -${hc6 * 100} điểm (${hc6} lỗi)`);

        // HC7: Thursday restriction
        let hc7 = 0;
        for (const s of schedule) {
            if (s.day === 5 && [5, 10].includes(s.period)) {
                hc7++;
                violations.push({
                    type: 'HARD', rule: 'HC7_THỨ_5',
                    msg: `⛔ Lớp "${clsName(s.classId)}" xếp ${this.getSubjectCode(s.subjectId)} vào T5 tiết ${s.period} (phải nghỉ)`
                });
            }
        }
        if (hc7) details.push(`⛔ [HC7] Vi phạm lịch nghỉ Thứ 5: -${hc7 * 100} điểm (${hc7} lỗi)`);

        // HC8: Session restriction — academic subjects must be in main session
        let hc8 = 0;
        const oppositeAllowedSubjects = ['GDTC', 'GDQP', 'HDTN', 'GDDP'];
        for (const s of schedule) {
            const subjCode = this.getSubjectCode(s.subjectId);
            if (oppositeAllowedSubjects.some(oc => subjCode.includes(oc))) continue;
            if (subjCode.includes('CHAO_CO') || subjCode.includes('SH_CUOI') || subjCode.includes('SHCN')) continue;
            const mainSess = this.classSessionMap.get(s.classId);
            if (mainSess === undefined) continue;
            const slotSess = s.period <= 5 ? 0 : 1;
            if (slotSess !== mainSess) {
                hc8++;
                violations.push({
                    type: 'HARD', rule: 'HC8_SAI_BUỔI',
                    msg: `⛔ Lớp "${clsName(s.classId)}": ${subjCode} xếp ${mainSess === 0 ? 'chiều' : 'sáng'} (phải học buổi ${mainSess === 0 ? 'sáng' : 'chiều'})`
                });
            }
        }
        if (hc8) details.push(`⛔ [HC8] Môn học sai buổi: -${hc8 * 100} điểm (${hc8} lỗi)`);

        // ===== SOFT CONSTRAINTS =====

        const teacherSchedule = this.groupBy(schedule, 'teacherId');

        // SC1: Spread subjects
        let sc1 = 0;
        for (const [classId, slots] of classSchedule) {
            const subjectMap = new Map<number, number[]>();
            for (const s of slots) {
                if (!subjectMap.has(s.subjectId)) subjectMap.set(s.subjectId, []);
                subjectMap.get(s.subjectId)!.push(s.day);
            }
            for (const [subjId, days] of subjectMap) {
                if (days.length > 2) {
                    const uniqueDays = new Set(days).size;
                    if (uniqueDays < Math.min(days.length, 3)) {
                        sc1++;
                        violations.push({
                            type: 'SOFT', rule: 'SC1_DỒN_CỤC',
                            msg: `⚠️ Lớp "${clsName(classId)}": ${this.getSubjectCode(subjId)} có ${days.length} tiết nhưng chỉ rải ${uniqueDays} ngày [${[...new Set(days)].map(d => this.dayName(d)).join(', ')}]`
                        });
                    }
                }
            }
        }
        if (sc1) details.push(`⚠️ [SC1] Môn học dồn cục: -${sc1 * 10} điểm (${sc1} lỗi)`);


        // SC4: Block 2
        const sc4 = this.checkBlock2(classSchedule);
        if (sc4) details.push(`⚠️ [SC4] Môn 2 tiết bị xé lẻ: -${sc4 * 10} điểm (${sc4} lỗi)`);

        // SC6: No holes
        let sc6 = 0;
        for (const [teacherId, slots] of teacherSchedule) {
            const sortedByDay = new Map<number, TimeSlot[]>();
            slots.forEach(s => {
                if (!sortedByDay.has(s.day)) sortedByDay.set(s.day, []);
                sortedByDay.get(s.day)!.push(s);
            });
            for (const [day, daySlots] of sortedByDay) {
                if (daySlots.length < 2) continue;
                daySlots.sort((a, b) => a.period - b.period);
                for (let i = 0; i < daySlots.length - 1; i++) {
                    const curr = daySlots[i];
                    const next = daySlots[i + 1];
                    const currSession = curr.period <= 5 ? 0 : 1;
                    const nextSession = next.period <= 5 ? 0 : 1;
                    if (currSession === nextSession) {
                        const gap = next.period - curr.period - 1;
                        if (gap > 0) {
                            sc6 += gap;
                            violations.push({
                                type: 'SOFT', rule: 'SC6_TIẾT_TRỐNG_GV',
                                msg: `⚠️ GV "${this.getTeacherName(teacherId)}" ${this.dayName(day)}: trống ${gap} tiết giữa tiết ${curr.period} và ${next.period}`
                            });
                        }
                    }
                }
            }
        }
        if (sc6) details.push(`⚠️ [SC6] Tiết trống giáo viên: -${sc6 * 5} điểm (${sc6} lỗi)`);

        // SC7: Max load
        let sc7 = 0;
        for (const [teacherId, slots] of teacherSchedule) {
            const daySessionCounts = new Map<string, number>();
            for (const s of slots) {
                const session = s.period <= 5 ? 'Sáng' : 'Chiều';
                const key = `${s.day}-${session}`;
                daySessionCounts.set(key, (daySessionCounts.get(key) || 0) + 1);
            }
            for (const [key, count] of daySessionCounts) {
                if (count > 4) {
                    sc7 += count - 4;
                    const [d, session] = key.split('-');
                    violations.push({
                        type: 'SOFT', rule: 'SC7_QUÁ_TẢI_GV',
                        msg: `⚠️ GV "${this.getTeacherName(teacherId)}" ${this.dayName(+d)} buổi ${session}: dạy ${count} tiết (tối đa 4)`
                    });
                }
            }
        }
        if (sc7) details.push(`⚠️ [SC7] Giáo viên dạy quá số tiết/buổi: -${sc7 * 10} điểm (${sc7} lỗi)`);

        const hardViolations = hc1 + hc2 + hc3 + hc4 + hc5 + hc6 + hc7 + hc8;
        const softPenalty = (sc1 * 10) + (sc4 * 10) + (sc6 * 5) + (sc7 * 10);
        const score = 1000 - (hardViolations * 100) - softPenalty;

        return { score, details, violations, hardViolations, softPenalty };
    }
}
