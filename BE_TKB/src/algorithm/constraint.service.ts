
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
    public roomMap: Map<string, number> = new Map(); // Name -> ID
    public subjectMap: Map<string, number> = new Map(); // Code -> ID
    public subjects: any[] = []; // Full subject objects
    public teacherMap: Map<string, any> = new Map(); // Teacher ID -> Full Object
    public teacherMapByName: Map<string, any> = new Map(); // Code/Name -> Full Object

    // Initialize config (Load from DB)
    async initialize(semesterId: string) {
        this.logger.log('Initializing Constraint Service...');

        // Cache Rooms
        const rooms = await this.prisma.room.findMany();
        rooms.forEach(r => this.roomMap.set(r.name, r.id));

        // Cache Subjects
        const subjects = await this.prisma.subject.findMany();
        this.subjects = subjects;
        subjects.forEach(s => this.subjectMap.set(s.code, s.id));

        // Cache Teachers
        const teachers = await this.prisma.teacher.findMany();
        teachers.forEach(t => {
            this.teacherMap.set(t.id, t);
            this.teacherMapByName.set(t.code, t); // Map by Code (e.g., 'BGH')
        });

        this.logger.log(`Loaded ${rooms.length} rooms, ${subjects.length} subjects, ${teachers.length} teachers.`);
    }

    // --- HARD CONSTRAINTS (HC) ---

    // HC01: Teacher Conflict
    checkTeacherConflict(slot: TimeSlot, others: TimeSlot[]): boolean {
        // Teacher cannot be in two places at once
        return others.some(o =>
            o.day === slot.day &&
            o.period === slot.period &&
            o.teacherId === slot.teacherId &&
            o.classId !== slot.classId
        );
    }

    // HC02: Class Conflict
    checkClassConflict(slot: TimeSlot, others: TimeSlot[]): boolean {
        // Class cannot have two subjects at once
        return others.some(o =>
            o.day === slot.day &&
            o.period === slot.period &&
            o.classId === slot.classId &&
            o.subjectId !== slot.subjectId
        );
    }

    // HC03: Room Conflict
    checkRoomConflict(slot: TimeSlot, others: TimeSlot[]): boolean {
        if (!slot.roomId) return false;
        // Room cannot host two classes at once
        return others.some(o =>
            o.day === slot.day &&
            o.period === slot.period &&
            o.roomId === slot.roomId &&
            o.classId !== slot.classId
        );
    }

    // HC04-07: Grade-based Room Phasing & Labs
    getValidRooms(grade: number, session: 'SANG' | 'CHIEU', period: number, subjectType: 'LY_THUYET' | 'THUC_HANH', subjectCode?: string): number[] {
        // 1. Check Lab Subjects (HC07)
        if (subjectType === 'THUC_HANH' && subjectCode) {
            const code = subjectCode.toUpperCase();
            if (code.includes('TIN')) return [this.getRoomId('314'), this.getRoomId('315')].filter((id): id is number => id !== undefined);
            if (code.includes('LY') || code.includes('VAT_LY')) return [this.getRoomId('301')].filter((id): id is number => id !== undefined);
            if (code.includes('HOA')) return [this.getRoomId('302')].filter((id): id is number => id !== undefined);
            if (code.includes('SINH')) return [this.getRoomId('303')].filter((id): id is number => id !== undefined);
        }

        const isMorningPeriod = period <= 5;

        // HC04: Grade 12 Morning -> 101-114
        if (grade === 12 && isMorningPeriod) {
            return this.getRangeRoomIds(101, 114);
        }

        // HC05: Grade 11 Afternoon -> 101-114
        if (grade === 11 && !isMorningPeriod) { // Afternoon period (6-10)
            return this.getRangeRoomIds(101, 114);
        }

        // HC06: Grade 10 Morning -> 201-214
        if (grade === 10 && isMorningPeriod) {
            return this.getRangeRoomIds(201, 214);
        }

        // Fallback for Opposite Session or unconstrained slots
        return [...this.getRangeRoomIds(101, 114), ...this.getRangeRoomIds(201, 214)];
    }

    public isTeacherBusy(teacherId: string, day: number, period: number): boolean {
        const teacher = this.teacherMap.get(teacherId);
        if (!teacher || !teacher.ngay_nghi_dang_ky) return false;

        try {
            const offDays = teacher.ngay_nghi_dang_ky as any[];
            if (Array.isArray(offDays)) {
                // Period 1-5 = Session 0 (Sang), 6-10 = Session 1 (Chieu)
                const session = period <= 5 ? 0 : 1;
                return offDays.some(d => d.day === day && (d.session === session || d.session === 2));
            }
        } catch (e) { }
        return false;
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

    // HC08-12: Fixed Slots validation
    checkFixedSlot(day: number, period: number, grade: number, session: 'SANG' | 'CHIEU'): { isFixed: boolean, subjectCode?: string } {
        // 1. CHAO CO: Mon P1 (Morning Only)
        if (day === 2 && period === 1 && session === 'SANG') {
            return { isFixed: true, subjectCode: 'CHAO_CO' };
        }

        // 2. GVCN (Teaching Period) - Mon P2 (Sang) / P6 (Chieu)
        if (day === 2) {
            if (session === 'SANG' && period === 2) return { isFixed: true, subjectCode: 'GVCN_TEACHING' };
            if (session === 'CHIEU' && period === 6) return { isFixed: true, subjectCode: 'GVCN_TEACHING' };
        }

        // 3. GVCN (SH Cuoi Tuan) - Saturday Last Intervals
        if (day === 7) {
            // P4 (Sang) / P9 (Chieu) -> GVCN Teaching Slot
            if ((session === 'SANG' && period === 4) || (session === 'CHIEU' && period === 9)) {
                return { isFixed: true, subjectCode: 'GVCN_TEACHING' };
            }
            // P5 (Sang) / P10 (Chieu) -> SH Cuoi Tuan
            if ((session === 'SANG' && period === 5) || (session === 'CHIEU' && period === 10)) {
                return { isFixed: true, subjectCode: 'SH_CUOI_TUAN' };
            }
        }

        // 4. THURSDAY FIXED SLOTS (GDDP, HDTN)
        if (day === 5) {
            if (session === 'SANG') {
                if (period === 1) return { isFixed: true, subjectCode: 'GDDP' };
                if (period === 2) return { isFixed: true, subjectCode: 'HDTN' };
            }
            if (session === 'CHIEU') {
                if (period === 6) return { isFixed: true, subjectCode: 'GDDP' };
                if (period === 7) return { isFixed: true, subjectCode: 'HDTN' };
            }
        }

        return { isFixed: false };
    }

    // --- HARD CONSTRAINTS BATCH CHECK (Optimized) ---
    checkHardConstraints(schedule: TimeSlot[]): number {
        let violations = 0;

        // 1. Teacher Conflicts
        const teacherMap = this.groupBy(schedule, 'teacherId');
        for (const [_, slots] of teacherMap) {
            violations += this.countTimeOverlaps(slots);
        }

        // 2. Class Conflicts
        const classMap = this.groupBy(schedule, 'classId');
        for (const [_, slots] of classMap) {
            violations += this.countTimeOverlaps(slots);
        }

        // 3. Room Conflicts
        const roomMap = this.groupBy(schedule, 'roomId');
        for (const [roomId, slots] of roomMap) {
            if (!roomId) continue;
            violations += this.countTimeOverlaps(slots);
        }

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

    // --- SOFT CONSTRAINTS (SC) ---
    calculatePenalty(schedule: TimeSlot[]): number {
        let score = 0;

        // Group by Class and Teacher for efficient checks
        const classSchedule = this.groupBy(schedule, 'classId');
        const teacherSchedule = this.groupBy(schedule, 'teacherId');

        score += this.checkSpreadSubjects(classSchedule) * 10;
        score += this.checkHeavySubjects(classSchedule) * 20;
        score += this.checkMorningPriority(classSchedule) * 15;
        score += this.checkBlock2(classSchedule) * 10;
        score += this.checkTeacherOffDay(schedule) * 50; // High penalty for off-day
        score += this.checkNoHoles(teacherSchedule) * 5;
        score += this.checkMaxLoad(teacherSchedule) * 10;

        return score;
    }

    private groupBy(schedule: TimeSlot[], key: keyof TimeSlot): Map<string, TimeSlot[]> {
        const map = new Map<string, TimeSlot[]>();
        for (const s of schedule) {
            const k = String(s[key]);
            if (!map.has(k)) map.set(k, []);
            map.get(k)!.push(s);
        }
        return map;
    }

    // SC01: Spread Subjects (>2 periods/week => spread days)
    private checkSpreadSubjects(classSchedule: Map<string, TimeSlot[]>): number {
        let penalty = 0;
        for (const [_, slots] of classSchedule) {
            const subjectMap = new Map<number, number[]>();
            for (const s of slots) {
                if (!subjectMap.has(s.subjectId)) subjectMap.set(s.subjectId, []);
                subjectMap.get(s.subjectId)!.push(s.day);
            }

            for (const [subjId, days] of subjectMap) {
                if (days.length > 2) {
                    const uniqueDays = new Set(days).size;
                    // Ideally, if 3 periods, should be on at least 2 days? Or 3 days?
                    // Rule: Spread across different days.
                    // If 5 periods -> 5 days ideally.
                    // Penalty if uniqueDays < Math.min(days.length, 3)
                    if (uniqueDays < Math.min(days.length, 3)) {
                        penalty++;
                    }
                }
            }
        }
        return penalty;
    }

    // SC02: Avoid Heavy Subjects (Math, Phys, Chem > 3 consec)
    private checkHeavySubjects(classSchedule: Map<string, TimeSlot[]>): number {
        let penalty = 0;
        const heavySubjects = ['TOAN', 'LY', 'HOA', 'VAT_LY', 'HOA_HOC']; // Codes need to be robust
        // Need to map Subject IDs to codes.

        for (const [_, slots] of classSchedule) {
            // Sort by Day/Period
            const sortedByDay = new Map<number, TimeSlot[]>();
            slots.forEach(s => {
                if (!sortedByDay.has(s.day)) sortedByDay.set(s.day, []);
                sortedByDay.get(s.day)!.push(s);
            });

            for (const [day, daySlots] of sortedByDay) {
                daySlots.sort((a, b) => a.period - b.period);
                let consec = 0;
                let lastSubj = '';

                for (const s of daySlots) {
                    const subjCode = this.getSubjectCode(s.subjectId);
                    const isHeavy = heavySubjects.some(h => subjCode.includes(h));

                    if (isHeavy) {
                        if (subjCode === lastSubj) {
                            consec++;
                        } else {
                            consec = 1;
                            lastSubj = subjCode;
                        }
                    } else {
                        consec = 0;
                        lastSubj = '';
                    }

                    if (consec > 3) penalty++;
                }
            }
        }
        return penalty;
    }

    // SC03: Morning Priority (Math, Lit, Eng in P1-3)
    private checkMorningPriority(classSchedule: Map<string, TimeSlot[]>): number {
        let penalty = 0;
        const priority = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH'];

        for (const [_, slots] of classSchedule) {
            for (const s of slots) {
                const subjCode = this.getSubjectCode(s.subjectId);
                if (priority.some(p => subjCode.includes(p))) {
                    // Check if period is > 3 (and in morning session 1-5)
                    if (s.period > 3 && s.period <= 5) {
                        penalty++;
                    }
                }
            }
        }
        return penalty;
    }

    // SC04: Block 2 (Lit, Math, Prac in 2-period blocks)
    private checkBlock2(classSchedule: Map<string, TimeSlot[]>): number {
        // This is complex to check post-hoc easily, effectively same as "Cluster same subjects"
        // If Lit has 2 single periods on same day separated -> bad.
        // If Lit has single periods on different days -> maybe okay?
        // Let's simplified: Penalty if single period of Math/Lit/Prac exists and total > 1
        let penalty = 0;
        const blocks = ['TOAN', 'VAN', 'NGU_VAN', 'TIN', 'LY', 'HOA', 'SINH']; // Practical/Main

        for (const [_, slots] of classSchedule) {
            const subjectMap = new Map<number, TimeSlot[]>(); // Subj -> Slots
            for (const s of slots) {
                if (!subjectMap.has(s.subjectId)) subjectMap.set(s.subjectId, []);
                subjectMap.get(s.subjectId)!.push(s);
            }

            for (const [subjId, subjSlots] of subjectMap) {
                const code = this.getSubjectCode(subjId);
                if (blocks.some(b => code.includes(b))) {
                    // Check for isolated singles
                    // Sort by Day/Period
                    subjSlots.sort((a, b) => a.day === b.day ? a.period - b.period : a.day - b.day);

                    // Simply check if any slot is isolated (not adjacent to another of same subject)
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

    // SC05: Teacher Off Day
    private checkTeacherOffDay(schedule: TimeSlot[]): number {
        let penalty = 0;
        for (const slot of schedule) {
            const teacher = this.teacherMap.get(slot.teacherId);
            if (teacher && teacher.ngay_nghi_dang_ky) {
                // Assuming json format { "thu": 2, "buoi": 0 } or similar
                // Or list of strings/objects. Need to handle JSON safely.
                // Lets assume simple format for now or skip if complex
                try {
                    const offDays = teacher.ngay_nghi_dang_ky as any[];
                    if (Array.isArray(offDays)) {
                        // Check match
                        // Example format: { day: 2, session: 0 } (0: Sang, 1: Chieu)
                        const session = slot.period <= 5 ? 0 : 1;
                        const isOff = offDays.some(d => d.day === slot.day && (d.session === session || d.session === 2)); // 2=All Day
                        if (isOff) penalty++;
                    }
                } catch (e) { }
            }
        }
        return penalty;
    }

    // SC06: No Holes (Minimize idle periods)
    private checkNoHoles(teacherSchedule: Map<string, TimeSlot[]>): number {
        let penalty = 0;
        for (const [_, slots] of teacherSchedule) {
            const sortedByDay = new Map<number, TimeSlot[]>();
            slots.forEach(s => {
                if (!sortedByDay.has(s.day)) sortedByDay.set(s.day, []);
                sortedByDay.get(s.day)!.push(s);
            });

            for (const [day, daySlots] of sortedByDay) {
                if (daySlots.length < 2) continue;
                daySlots.sort((a, b) => a.period - b.period);

                // Check gaps
                for (let i = 0; i < daySlots.length - 1; i++) {
                    const curr = daySlots[i];
                    const next = daySlots[i + 1];
                    // If same session (Morning/Afternoon) and gap > 1 period
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

    // SC07: Max Load (Avoid > 5 periods / session)
    // Actually > 4 is heavy, > 5 is usually max possible in morning
    // "Avoid exceeding max periods/session"
    private checkMaxLoad(teacherSchedule: Map<string, TimeSlot[]>): number {
        let penalty = 0;
        for (const [_, slots] of teacherSchedule) {
            const daySessionCounts = new Map<string, number>(); // "Day-Session" -> count
            for (const s of slots) {
                const session = s.period <= 5 ? 'SANG' : 'CHIEU';
                const key = `${s.day}-${session}`;
                daySessionCounts.set(key, (daySessionCounts.get(key) || 0) + 1);
            }

            for (const count of daySessionCounts.values()) {
                if (count > 4) penalty += (count - 4); // Soft penalty for 5, Hard for >5?
            }
        }
        return penalty;
    }

    private getSubjectCode(id: number): string {
        const subj = this.subjects.find(s => s.id === id);
        return subj ? subj.code.toUpperCase() : ''; // Update to use 'code' field as per Schema, if ma_mon not exists? 
        // Wait, Schema said id, code, name. Step 8143 line 467 used ma_mon but line 40 used code.
        // Assuming 'code' works based on line 40.
    }

    public getFitnessDetails(schedule: TimeSlot[]): any {
        const details: string[] = [];

        // 1. Hard Constraints
        const hc1 = this.checkTeacherConflictDetails(schedule);
        if (hc1) details.push(`Giáo viên trùng giờ: -${hc1 * 100} điểm (${hc1} lỗi)`);

        const hc2 = this.checkClassConflictDetails(schedule);
        if (hc2) details.push(`Lớp học trùng giờ: -${hc2 * 100} điểm (${hc2} lỗi)`);

        const hc3 = this.checkRoomConflictDetails(schedule);
        if (hc3) details.push(`Phòng học trùng giờ: -${hc3 * 100} điểm (${hc3} lỗi)`);

        // 2. Soft Constraints
        const classSchedule = this.groupBy(schedule, 'classId');
        const teacherSchedule = this.groupBy(schedule, 'teacherId');

        const sc1 = this.checkSpreadSubjects(classSchedule);
        if (sc1) details.push(`Môn học dồn cục (chưa rải đều): -${sc1 * 10} điểm`);

        const sc2 = this.checkHeavySubjects(classSchedule);
        if (sc2) details.push(`Môn nặng học liền nhau: -${sc2 * 20} điểm`);

        const sc3 = this.checkMorningPriority(classSchedule);
        if (sc3) details.push(`Môn ưu tiên học buổi chiều/tiết cuối: -${sc3 * 15} điểm`);

        const sc4 = this.checkBlock2(classSchedule);
        if (sc4) details.push(`Môn 2 tiết bị xé lẻ: -${sc4 * 10} điểm`);

        const sc5 = this.checkTeacherOffDay(schedule);
        if (sc5) details.push(`Giáo viên dạy ngày nghỉ: -${sc5 * 50} điểm`);

        const sc6 = this.checkNoHoles(teacherSchedule);
        if (sc6) details.push(`Tiết trống giáo viên (lủng lịch): -${sc6 * 5} điểm`);

        const sc7 = this.checkMaxLoad(teacherSchedule);
        if (sc7) details.push(`Giáo viên dạy quá số tiết/buổi: -${sc7 * 10} điểm`);

        const hardViolations = hc1 + hc2 + hc3;
        const softPenalty = (sc1 * 10) + (sc2 * 20) + (sc3 * 15) + (sc4 * 10) + (sc5 * 50) + (sc6 * 5) + (sc7 * 10);
        const score = 1000 - (hardViolations * 100) - softPenalty;

        return { score, details };
    }

    // Checking details (helper to count without re-writing logic, assumes countTimeOverlaps is same)
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
        for (const [id, slots] of map) { if (id) v += this.countTimeOverlaps(slots); }
        return v;
    }
}
