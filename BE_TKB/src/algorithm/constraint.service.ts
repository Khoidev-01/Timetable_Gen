
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConstraintSettingsService } from '../constraints/constraint-settings.service';
import { isBlock, isOutdoor, isSessionExempt } from './subject-rules';

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

    constructor(
        private prisma: PrismaService,
        private settings: ConstraintSettingsService,
    ) { }

    // --- CACHE ---
    public roomMap: Map<string, number> = new Map();
    public subjectMap: Map<string, number> = new Map();
    public subjects: any[] = [];
    public teacherMap: Map<string, any> = new Map();
    public teacherMapByName: Map<string, any> = new Map();
    // Teacher constraints cache: Map<teacherId, Array<{day, period, session, type}>>
    private teacherConstraints: Map<string, any[]> = new Map();
    // Assignments of the semester being solved - used to verify period completeness
    private assignments: any[] = [];
    // Map<teacherId, max periods per week> (0 = no limit configured)
    private teacherLimits: Map<string, number> = new Map();
    // Map<RoomType, number of rooms of that type>
    private roomTypeCapacity: Map<string, number> = new Map();
    // Map<subjectId, required RoomType> for practice subjects and PE
    private subjectRoomType: Map<number, string> = new Map();
    // Ceremony subjects (chào cờ, sinh hoạt) - homeroom duties, not teaching periods
    private ceremonySubjects: Set<number> = new Set();
    // Map<RoomType, room ids of that type>
    private roomsByType: Map<string, number[]> = new Map();
    // Periods the school pins before solving, loaded from fixed_period_rules
    private fixedRules: any[] = [];
    // Map<classId, floor of its home room> and Map<RoomType, floor of that room type>
    private classFloor: Map<string, number> = new Map();
    /** Which session a class normally studies in: 0 morning, 1 afternoon. */
    private classSessionMap: Map<string, number> = new Map();
    /** Upper-cased subject code by id, so the hot scoring loop never scans an array. */
    private subjectCode: Map<number, string> = new Map();
    private roomTypeFloor: Map<string, number> = new Map();
    // Map<teacherId, mobility weight in tenths>
    private mobilityWeight: Map<string, number> = new Map();

    /**
     * Penalty weights. Hard violations use `hardViolation`, soft ones their own entry.
     *
     * These are the shipped defaults. `initialize()` overwrites them with whatever the
     * admin has set on `/admin/configuration`, so the numbers on that screen are the
     * numbers the solver scores with.
     */
    private readonly defaultWeights = {
        hardViolation: 100,
        // Existing soft constraints
        spreadSubjects: 10,
        heavySubjects: 20,
        morningPriority: 15,
        block2: 10,
        teacherGaps: 5,
        teacherMaxLoad: 10,
        // Added in 0.17
        teacherAttendance: 8,
        bothSessionsSameDay: 12,
        afterPhysicalEd: 10,
        noDayOff: 15,
        consecutiveTeaching: 8,
        subjectSpacing: 8,
        afternoonOverload: 12,
        mobility: 3,
        // Taken from the main branch when the two lines of work were merged
        outdoorTiming: 10,
        blockRules: 12,
    };

    public weights = { ...this.defaultWeights };

    /** Hard checks the admin has switched off; empty unless someone changed it. */
    private disabledHard = new Set<string>();

    async initialize(semesterId: string) {
        this.logger.log('Initializing Constraint Service...');

        await this.loadSettings();

        const rooms = await this.prisma.room.findMany();
        rooms.forEach(r => {
            this.roomMap.set(r.name, r.id);
            this.roomTypeCapacity.set(r.type, (this.roomTypeCapacity.get(r.type) || 0) + 1);
            if (!this.roomsByType.has(r.type)) this.roomsByType.set(r.type, []);
            this.roomsByType.get(r.type)!.push(r.id);
            if (!this.roomTypeFloor.has(r.type)) this.roomTypeFloor.set(r.type, r.floor);
        });

        const subjects = await this.prisma.subject.findMany();
        this.subjects = subjects;
        subjects.forEach(s => {
            this.subjectMap.set(s.code, s.id);
            this.subjectCode.set(s.id, s.code.toUpperCase());
            const roomType = this.resolveRoomType(s);
            if (roomType) this.subjectRoomType.set(s.id, roomType);
            if (s.is_special) this.ceremonySubjects.add(s.id);
        });

        const teachers = await this.prisma.teacher.findMany({
            include: { constraints: true }
        });
        teachers.forEach(t => {
            this.teacherMap.set(t.id, t);
            this.teacherMapByName.set(t.code, t);
            // Cache constraints from TeacherConstraint table
            this.teacherConstraints.set(t.id, t.constraints || []);
            this.teacherLimits.set(t.id, t.max_periods_per_week || 0);
            this.mobilityWeight.set(t.id, t.mobility_weight ?? 10);
        });

        const classes = await this.prisma.class.findMany({ include: { fixed_room: true } });
        classes.forEach(c => {
            if (c.fixed_room) this.classFloor.set(c.id, c.fixed_room.floor);
            if (c.main_session !== null && c.main_session !== undefined) {
                this.classSessionMap.set(c.id, c.main_session);
            }
        });

        this.assignments = await this.prisma.teachingAssignment.findMany({
            where: { semester_id: semesterId },
            select: { class_id: true, subject_id: true, total_periods: true }
        });

        this.fixedRules = await this.prisma.fixedPeriodRule.findMany({
            where: { is_active: true },
            orderBy: [{ sort_order: 'asc' }, { day_of_week: 'asc' }, { period: 'asc' }],
        });

        this.logger.log(
            `Loaded ${rooms.length} rooms, ${subjects.length} subjects, ` +
            `${teachers.length} teachers, ${this.assignments.length} assignments.`
        );
    }

    /**
     * Apply the admin's weights.
     *
     * A misconfigured screen must not stop a school from producing a timetable, so a
     * failure here falls back to the shipped defaults and says so loudly rather than
     * aborting the run.
     */
    private async loadSettings() {
        try {
            const { weights, disabledHard } = await this.settings.effective();
            for (const [key, value] of Object.entries(weights)) {
                if (key in this.weights) (this.weights as any)[key] = value;
            }
            this.disabledHard = disabledHard;

            const changed = Object.entries(weights).filter(
                ([key, value]) => (this.defaultWeights as any)[key] !== value,
            );
            if (changed.length || disabledHard.size) {
                this.logger.log(
                    `Admin overrides in effect — ${changed.map(([k, v]) => `${k}=${v}`).join(', ') || 'no weight change'}` +
                    (disabledHard.size ? `; disabled: ${[...disabledHard].join(', ')}` : ''),
                );
            }
        } catch (error) {
            this.logger.error(
                `Không đọc được cấu hình ràng buộc, dùng trọng số mặc định: ${error}`,
            );
            this.weights = { ...this.defaultWeights };
            this.disabledHard = new Set();
        }
    }

    /** True when the admin has switched this hard check off. */
    private isHardDisabled(key: string): boolean {
        return this.disabledHard.has(key);
    }

    /**
     * Which physical room type a subject needs. Returns null for subjects that stay
     * in the class's own room. PE always needs the yard; other practice subjects
     * need their matching lab.
     */
    private resolveRoomType(subject: any): string | null {
        const code = (subject.code || '').toUpperCase();
        if (code === 'GDTC') return 'YARD';
        if (!subject.is_practice) return null;

        const byCode: Record<string, string> = {
            TIN: 'LAB_IT',
            LY: 'LAB_PHYSICS',
            HOA: 'LAB_CHEM',
            SINH: 'LAB_BIO',
        };
        return byCode[code] || null;
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

    /**
     * Every fixed period that applies to a class, taken from the configurable rules.
     * A rule with a null grade or session applies to every class.
     */
    public getFixedRulesFor(gradeLevel: number, mainSession: number): any[] {
        return this.fixedRules.filter(rule =>
            (rule.grade_level === null || rule.grade_level === gradeLevel) &&
            (rule.main_session === null || rule.main_session === mainSession));
    }

    public hasFixedRules(): boolean {
        return this.fixedRules.length > 0;
    }

    /** @deprecated Superseded by the configurable rules; kept for the legacy fallback path. */
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

        // GDDP and HDTN are taught by ordinary teachers, so they cannot be pinned to one
        // slot for every class at once - a single teacher cannot cover 7 classes at the
        // same time. They are scheduled by the heuristic like any other subject.

        return { isFixed: false };
    }

    // --- HARD CONSTRAINTS BATCH CHECK ---
    checkHardConstraints(schedule: TimeSlot[]): number {
        let violations = 0;

        // The three clashes below cannot be switched off - a teacher in two rooms at once
        // is not a preference the school can trade away.

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

        // Room Conflicts. groupBy maps a missing room to the literal 'none', so that
        // bucket has to be skipped too - otherwise every roomless period in the school
        // lands in one group and is counted as a clash with all the others.
        const roomGroups = this.groupBy(schedule, 'roomId');
        for (const [roomId, slots] of roomGroups) {
            if (this.isRoomlessKey(roomId)) continue;
            violations += this.countTimeOverlaps(slots);
        }

        // Teacher Busy Time violations
        if (!this.isHardDisabled('teacherBusy')) {
            for (const slot of schedule) {
                if (this.isTeacherBusy(slot.teacherId, slot.day, slot.period)) {
                    violations++;
                }
            }
        }

        if (!this.isHardDisabled('missingPeriods')) violations += this.checkMissingPeriods(schedule);
        if (!this.isHardDisabled('classGaps')) violations += this.checkClassGaps(schedule);
        if (!this.isHardDisabled('teacherWeeklyLimit')) violations += this.checkTeacherWeeklyLimit(schedule);
        if (!this.isHardDisabled('roomTypeCapacity')) violations += this.checkRoomTypeCapacity(schedule);
        if (!this.isHardDisabled('sessionRestriction')) violations += this.checkSessionRestriction(schedule);

        return violations;
    }

    /**
     * HC: every (class, subject) pair must receive exactly the number of periods
     * declared in its teaching assignment. A schedule that is short on periods is
     * invalid, not merely low quality.
     */
    public checkMissingPeriods(schedule: TimeSlot[]): number {
        if (this.assignments.length === 0) return 0;

        // A subject can carry several assignments for one class - a theory block plus a
        // chuyên đề block, say - so demand has to be summed per (class, subject) before
        // comparing. Checking each assignment on its own would let the theory periods
        // cover the chuyên đề requirement and hide the shortfall.
        const required = new Map<string, number>();
        for (const a of this.assignments) {
            const key = `${a.class_id}|${a.subject_id}`;
            required.set(key, (required.get(key) || 0) + a.total_periods);
        }

        const placed = new Map<string, number>();
        for (const s of schedule) {
            const key = `${s.classId}|${s.subjectId}`;
            placed.set(key, (placed.get(key) || 0) + 1);
        }

        let missing = 0;
        for (const [key, need] of required) {
            const got = placed.get(key) || 0;
            if (got < need) missing += need - got;
        }
        return missing;
    }

    /**
     * HC: a class must not have an empty period between two taught periods of the
     * same session - the students would have nowhere to go.
     */
    public checkClassGaps(schedule: TimeSlot[]): number {
        const byClassDaySession = new Map<string, number[]>();
        for (const s of schedule) {
            const session = s.period <= 5 ? 0 : 1;
            const key = `${s.classId}|${s.day}|${session}`;
            if (!byClassDaySession.has(key)) byClassDaySession.set(key, []);
            byClassDaySession.get(key)!.push(s.period);
        }

        let gaps = 0;
        for (const periods of byClassDaySession.values()) {
            if (periods.length < 2) continue;
            periods.sort((a, b) => a - b);
            for (let i = 0; i < periods.length - 1; i++) {
                gaps += periods[i + 1] - periods[i] - 1;
            }
        }
        return gaps;
    }

    /**
     * HC: a teacher must not exceed their configured weekly period quota.
     * Chào cờ and sinh hoạt are homeroom duties compensated through workload_reduction,
     * so they do not consume the teaching quota - counting them would make every
     * homeroom teacher look two periods busier than they are.
     */
    public checkTeacherWeeklyLimit(schedule: TimeSlot[]): number {
        const counts = new Map<string, number>();
        for (const s of schedule) {
            if (this.ceremonySubjects.has(s.subjectId)) continue;
            counts.set(s.teacherId, (counts.get(s.teacherId) || 0) + 1);
        }

        let excess = 0;
        for (const [teacherId, count] of counts) {
            const limit = this.teacherLimits.get(teacherId) || 0;
            if (limit > 0 && count > limit) excess += count - limit;
        }
        return excess;
    }

    /**
     * HC: at any given time slot, the number of classes needing a special room type
     * must not exceed how many rooms of that type the school has. Skipped for types
     * with no room seeded, since an unknown capacity cannot be enforced.
     */
    public checkRoomTypeCapacity(schedule: TimeSlot[]): number {
        const usage = new Map<string, Map<string, number>>();
        for (const s of schedule) {
            const type = this.subjectRoomType.get(s.subjectId);
            if (!type) continue;

            const timeKey = `${s.day}-${s.period}`;
            if (!usage.has(timeKey)) usage.set(timeKey, new Map());
            const perType = usage.get(timeKey)!;
            perType.set(type, (perType.get(type) || 0) + 1);
        }

        let overflow = 0;
        for (const perType of usage.values()) {
            for (const [type, count] of perType) {
                const capacity = this.roomTypeCapacity.get(type) || 0;
                if (capacity > 0 && count > capacity) overflow += count - capacity;
            }
        }
        return overflow;
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

    /**
     * A class studies in one session; periods in the other one send students home and
     * back again. Physical education, defence, HĐTN and GDĐP are exempt - schools
     * deliberately put those in the free half-day.
     *
     * Taken from the main branch, which scored this while this branch only relied on the
     * generator placing correctly - nothing checked it afterwards.
     */
    public checkSessionRestriction(schedule: TimeSlot[]): number {
        let violations = 0;
        for (const slot of schedule) {
            if (isSessionExempt(this.getSubjectCode(slot.subjectId))) continue;
            const mainSession = this.classSessionMap.get(slot.classId);
            if (mainSession === undefined) continue;
            if ((slot.period <= 5 ? 0 : 1) !== mainSession) violations++;
        }
        return violations;
    }

    /**
     * Physical education belongs in the cool hours: first three periods of the morning,
     * last three of the afternoon. Vietnamese schools avoid the midday sun.
     */
    private checkOutdoorTiming(schedule: TimeSlot[]): number {
        let penalty = 0;
        for (const slot of schedule) {
            if (!isOutdoor(this.getSubjectCode(slot.subjectId))) continue;
            const tooLateInMorning = slot.period <= 5 && slot.period > 3;
            const tooEarlyInAfternoon = slot.period > 5 && slot.period < 8;
            if (tooLateInMorning || tooEarlyInAfternoon) penalty++;
        }
        return penalty;
    }

    /**
     * How much of one session a class spends on the demanding subjects: at most three
     * such periods per session, at most two of any one subject, and never three in a row.
     */
    private checkBlockRules(classSchedule: Map<string, TimeSlot[]>): number {
        let violations = 0;

        for (const slots of classSchedule.values()) {
            const perSession = new Map<string, Map<string, number>>();
            const periodsPerSession = new Map<string, number[]>();

            for (const slot of slots) {
                const code = this.getSubjectCode(slot.subjectId);
                if (!isBlock(code)) continue;
                const key = `${slot.day}-${slot.period <= 5 ? 0 : 1}`;
                if (!perSession.has(key)) perSession.set(key, new Map());
                const counts = perSession.get(key)!;
                counts.set(code, (counts.get(code) ?? 0) + 1);
                if (!periodsPerSession.has(key)) periodsPerSession.set(key, []);
                periodsPerSession.get(key)!.push(slot.period);
            }

            for (const [key, counts] of perSession) {
                let total = 0;
                for (const count of counts.values()) {
                    total += count;
                    if (count > 2) violations += count - 2;
                }
                if (total > 3) violations += total - 3;

                const periods = [...(periodsPerSession.get(key) ?? [])].sort((a, b) => a - b);
                for (let i = 0; i + 2 < periods.length; i++) {
                    if (periods[i + 1] === periods[i] + 1 && periods[i + 2] === periods[i] + 2) {
                        violations++;
                        break;
                    }
                }
            }
        }
        return violations;
    }

    // --- SOFT CONSTRAINTS ---
    calculatePenalty(schedule: TimeSlot[]): number {
        let score = 0;
        const classSchedule = this.groupBy(schedule, 'classId');
        const teacherSchedule = this.groupBy(schedule, 'teacherId');

        score += this.checkSpreadSubjects(classSchedule) * this.weights.spreadSubjects;
        score += this.checkHeavySubjects(classSchedule) * this.weights.heavySubjects;
        score += this.checkMorningPriority(classSchedule) * this.weights.morningPriority;
        score += this.checkBlock2(classSchedule) * this.weights.block2;
        score += this.checkNoHoles(teacherSchedule) * this.weights.teacherGaps;
        score += this.checkMaxLoad(teacherSchedule) * this.weights.teacherMaxLoad;
        score += this.checkTeacherAttendance(teacherSchedule) * this.weights.teacherAttendance;
        score += this.checkBothSessionsSameDay(teacherSchedule) * this.weights.bothSessionsSameDay;
        score += this.checkAfterPhysicalEd(classSchedule) * this.weights.afterPhysicalEd;
        score += this.checkNoDayOff(teacherSchedule) * this.weights.noDayOff;
        score += this.checkConsecutiveTeaching(teacherSchedule) * this.weights.consecutiveTeaching;
        score += this.checkSubjectSpacing(classSchedule) * this.weights.subjectSpacing;
        score += this.checkAfternoonLoad(classSchedule) * this.weights.afternoonOverload;
        score += this.checkMobilityCost(teacherSchedule) * this.weights.mobility;
        score += this.checkOutdoorTiming(schedule) * this.weights.outdoorTiming;
        score += this.checkBlockRules(classSchedule) * this.weights.blockRules;

        return score;
    }

    /**
     * Which floor a period will be taught on. Rooms are only booked once the grid stops
     * moving, so read the floor from the class's home room - or the lab the subject will
     * need - rather than from a room_id that is not settled yet.
     */
    public estimatedFloor(slot: TimeSlot): number | null {
        const roomType = this.subjectRoomType.get(slot.subjectId);
        if (roomType) {
            const floor = this.roomTypeFloor.get(roomType);
            if (floor !== undefined) return floor;
        }
        return this.classFloor.get(slot.classId) ?? null;
    }

    /**
     * SC: stairs climbed between back-to-back periods. Vietnamese secondary schools run
     * to four or five floors with no lift, and a teacher sent 1 -> 4 -> 1 across a
     * morning climbs a few hundred steps a day. No timetabling tool models this, and it
     * costs nothing to: Room.floor is already in the schema.
     *
     * Returned in tenths of a floor so a per-teacher weight can make it heavier for
     * anyone who finds stairs hard.
     */
    public checkMobilityCost(teacherSchedule: Map<string, TimeSlot[]>): number {
        let cost = 0;

        for (const [teacherId, slots] of teacherSchedule) {
            const weight = this.mobilityWeight.get(teacherId) ?? 10;

            const byDay = new Map<number, TimeSlot[]>();
            for (const s of slots) {
                if (!byDay.has(s.day)) byDay.set(s.day, []);
                byDay.get(s.day)!.push(s);
            }

            for (const daySlots of byDay.values()) {
                daySlots.sort((a, b) => a.period - b.period);

                for (let i = 0; i < daySlots.length - 1; i++) {
                    const current = daySlots[i];
                    const next = daySlots[i + 1];
                    // Only consecutive periods force a hurried climb between lessons
                    if (next.period - current.period !== 1) continue;

                    const from = this.estimatedFloor(current);
                    const to = this.estimatedFloor(next);
                    if (from === null || to === null) continue;

                    cost += Math.abs(to - from) * weight;
                }
            }
        }

        // Weights are in tenths, so bring the total back to whole floors
        return Math.round(cost / 10);
    }

    /**
     * SC: a subject should come round again within three days. Guidance on secondary
     * scheduling notes that beyond that the students' grasp of the previous lesson has
     * faded. This is the lower bound that complements checkSpreadSubjects, which only
     * caps how many periods of one subject may land on a single day.
     */
    private checkSubjectSpacing(classSchedule: Map<string, TimeSlot[]>): number {
        const MAX_GAP_DAYS = 3;
        let penalty = 0;

        for (const [, slots] of classSchedule) {
            const daysBySubject = new Map<number, Set<number>>();
            for (const s of slots) {
                if (this.ceremonySubjects.has(s.subjectId)) continue;
                if (!daysBySubject.has(s.subjectId)) daysBySubject.set(s.subjectId, new Set());
                daysBySubject.get(s.subjectId)!.add(s.day);
            }

            for (const [, daySet] of daysBySubject) {
                if (daySet.size < 2) continue;
                const days = [...daySet].sort((a, b) => a - b);
                for (let i = 1; i < days.length; i++) {
                    const gap = days[i] - days[i - 1];
                    if (gap > MAX_GAP_DAYS) penalty += gap - MAX_GAP_DAYS;
                }
            }
        }
        return penalty;
    }

    /**
     * SC: a class should not sit through more than three periods in its secondary
     * session, per the guidance on two-session teaching.
     */
    private checkAfternoonLoad(classSchedule: Map<string, TimeSlot[]>): number {
        const MAX_SECONDARY_PERIODS = 3;
        let penalty = 0;

        for (const [, slots] of classSchedule) {
            const morningCount = slots.filter(s => s.period <= 5).length;
            const mainIsMorning = morningCount >= slots.length / 2;

            const perDay = new Map<number, number>();
            for (const s of slots) {
                const inSecondary = mainIsMorning ? s.period > 5 : s.period <= 5;
                if (!inSecondary) continue;
                perDay.set(s.day, (perDay.get(s.day) || 0) + 1);
            }

            for (const count of perDay.values()) {
                if (count > MAX_SECONDARY_PERIODS) penalty += count - MAX_SECONDARY_PERIODS;
            }
        }
        return penalty;
    }

    /** groupBy stringifies keys, so a slot without a room can arrive under any of these. */
    private isRoomlessKey(key: string): boolean {
        return !key || key === 'none' || key === 'undefined' || key === 'null';
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

    /**
     * SC01: keep a subject from piling up on one day. The limit is two periods a day -
     * exactly one double period - so this rewards block scheduling instead of fighting
     * it. Counting distinct days instead would penalise Toán 4 tiết arranged as two
     * clean doubles, which is what schools actually want.
     */
    private checkSpreadSubjects(classSchedule: Map<string, TimeSlot[]>): number {
        const MAX_PER_DAY = 2;
        let penalty = 0;

        for (const [, slots] of classSchedule) {
            const perSubjectDay = new Map<string, number>();
            for (const s of slots) {
                const key = `${s.subjectId}|${s.day}`;
                perSubjectDay.set(key, (perSubjectDay.get(key) || 0) + 1);
            }
            for (const count of perSubjectDay.values()) {
                if (count > MAX_PER_DAY) penalty += count - MAX_PER_DAY;
            }
        }
        return penalty;
    }

    // SC02: Avoid Heavy Subjects consecutive
    private checkHeavySubjects(classSchedule: Map<string, TimeSlot[]>): number {
        let penalty = 0;
        const heavyCodes = ['TOAN', 'LY', 'HOA', 'VAT_LY', 'HOA_HOC'];

        for (const [_, slots] of classSchedule) {
            const sortedByDay = new Map<number, TimeSlot[]>();
            slots.forEach(s => {
                if (!sortedByDay.has(s.day)) sortedByDay.set(s.day, []);
                sortedByDay.get(s.day)!.push(s);
            });

            for (const [, daySlots] of sortedByDay) {
                daySlots.sort((a, b) => a.period - b.period);
                let consec = 0;

                for (const s of daySlots) {
                    const subjCode = this.getSubjectCode(s.subjectId);
                    const isHeavy = heavyCodes.some(h => subjCode.includes(h));
                    consec = isHeavy ? consec + 1 : 0;
                    if (consec > 3) penalty++;
                }
            }
        }
        return penalty;
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

    /**
     * SC: minimise how many sessions a teacher must physically come to school for.
     * The floor is ceil(periods / 5) - anything above that is wasted trips.
     * This is the single most requested improvement by teachers, and it is distinct
     * from idle periods: 1 period a day for 6 days has zero gaps but is the worst
     * possible schedule.
     */
    private checkTeacherAttendance(teacherSchedule: Map<string, TimeSlot[]>): number {
        let penalty = 0;
        for (const [, slots] of teacherSchedule) {
            const sessions = new Set<string>();
            for (const s of slots) {
                sessions.add(`${s.day}-${s.period <= 5 ? 0 : 1}`);
            }
            const minimum = Math.ceil(slots.length / 5);
            if (sessions.size > minimum) penalty += sessions.size - minimum;
        }
        return penalty;
    }

    /** SC: teaching both morning and afternoon of the same day traps the teacher at school over noon. */
    private checkBothSessionsSameDay(teacherSchedule: Map<string, TimeSlot[]>): number {
        let penalty = 0;
        for (const [, slots] of teacherSchedule) {
            const sessionsPerDay = new Map<number, Set<number>>();
            for (const s of slots) {
                if (!sessionsPerDay.has(s.day)) sessionsPerDay.set(s.day, new Set());
                sessionsPerDay.get(s.day)!.add(s.period <= 5 ? 0 : 1);
            }
            for (const sessions of sessionsPerDay.values()) {
                if (sessions.size > 1) penalty++;
            }
        }
        return penalty;
    }

    /** SC: every teacher should keep at least one weekday completely free. */
    private checkNoDayOff(teacherSchedule: Map<string, TimeSlot[]>): number {
        let penalty = 0;
        for (const [, slots] of teacherSchedule) {
            const days = new Set(slots.map(s => s.day));
            if (days.size >= 6) penalty++;
        }
        return penalty;
    }

    /** SC: students cannot focus on a demanding subject straight after physical education. */
    private checkAfterPhysicalEd(classSchedule: Map<string, TimeSlot[]>): number {
        const demanding = ['TOAN', 'LY', 'HOA', 'VAN'];
        let penalty = 0;

        for (const [, slots] of classSchedule) {
            const byDay = new Map<number, TimeSlot[]>();
            for (const s of slots) {
                if (!byDay.has(s.day)) byDay.set(s.day, []);
                byDay.get(s.day)!.push(s);
            }

            for (const daySlots of byDay.values()) {
                daySlots.sort((a, b) => a.period - b.period);
                for (let i = 0; i < daySlots.length - 1; i++) {
                    const curr = daySlots[i];
                    const next = daySlots[i + 1];
                    if (next.period - curr.period !== 1) continue;
                    if (this.getSubjectCode(curr.subjectId) !== 'GDTC') continue;
                    if (demanding.includes(this.getSubjectCode(next.subjectId))) penalty++;
                }
            }
        }
        return penalty;
    }

    /**
     * SC: teaching more than 4 periods back to back is exhausting. Distinct from
     * checkMaxLoad, which counts the total per session rather than the longest run.
     */
    private checkConsecutiveTeaching(teacherSchedule: Map<string, TimeSlot[]>): number {
        const MAX_RUN = 4;
        let penalty = 0;

        for (const [, slots] of teacherSchedule) {
            const periodsPerDay = new Map<number, number[]>();
            for (const s of slots) {
                if (!periodsPerDay.has(s.day)) periodsPerDay.set(s.day, []);
                periodsPerDay.get(s.day)!.push(s.period);
            }

            for (const periods of periodsPerDay.values()) {
                periods.sort((a, b) => a - b);
                let run = 1;
                for (let i = 1; i < periods.length; i++) {
                    run = periods[i] === periods[i - 1] + 1 ? run + 1 : 1;
                    if (run > MAX_RUN) penalty++;
                }
            }
        }
        return penalty;
    }

    // --- PLACEMENT-TIME GUARDS ---
    // Used by the heuristic so violations are prevented rather than detected afterwards.

    /** True if placing one more period would push the teacher over their weekly quota. */
    public isTeacherAtWeeklyLimit(teacherId: string, schedule: TimeSlot[]): boolean {
        const limit = this.teacherLimits.get(teacherId) || 0;
        if (limit <= 0) return false;

        let count = 0;
        for (const s of schedule) {
            if (s.teacherId !== teacherId) continue;
            if (this.ceremonySubjects.has(s.subjectId)) continue;
            count++;
        }
        return count >= limit;
    }

    /** True if every room of the type this subject needs is already taken at that time. */
    public isRoomTypeFull(subjectId: number, day: number, period: number, schedule: TimeSlot[]): boolean {
        const type = this.subjectRoomType.get(subjectId);
        if (!type) return false;

        const capacity = this.roomTypeCapacity.get(type) || 0;
        if (capacity <= 0) return false;

        let used = 0;
        for (const s of schedule) {
            if (s.day !== day || s.period !== period) continue;
            if (this.subjectRoomType.get(s.subjectId) === type) used++;
        }
        return used >= capacity;
    }

    /** The special room a subject needs, or null when it stays in the class's own room. */
    public getRequiredRoomType(subjectId: number): string | null {
        return this.subjectRoomType.get(subjectId) ?? null;
    }

    /**
     * Pick a room for a period: a free lab or yard when the subject needs one, otherwise
     * the class's own room. Returns undefined only when every specialised room is taken.
     */
    public pickRoom(
        subjectId: number,
        day: number,
        period: number,
        schedule: TimeSlot[],
        classRoomId?: number,
    ): number | undefined {
        const type = this.subjectRoomType.get(subjectId);
        if (!type) return classRoomId;

        for (const roomId of this.roomsByType.get(type) || []) {
            const taken = schedule.some(s =>
                s.day === day && s.period === period && s.roomId === roomId);
            if (!taken) return roomId;
        }
        return undefined;
    }

    /**
     * Cached on purpose. This used to scan the subject array and upper-case the result on
     * every call, which was survivable while only a few checks used it - the merged
     * session and outdoor rules call it for every period on every candidate schedule,
     * turning a two-minute solve into something that had not finished after fifteen.
     */
    public getSubjectCode(id: number): string {
        return this.subjectCode.get(id) ?? '';
    }

    public getFitnessDetails(schedule: TimeSlot[]): any {
        const details: string[] = [];
        const w = this.weights;

        const classSchedule = this.groupBy(schedule, 'classId');
        const teacherSchedule = this.groupBy(schedule, 'teacherId');

        // --- HARD ---
        // Keys match the catalogue, so a check the admin switched off scores zero here too
        const hard: Array<{ key: string; label: string; count: number }> = [
            { key: 'teacherConflict', label: 'Giáo viên trùng giờ', count: this.checkTeacherConflictDetails(schedule) },
            { key: 'classConflict', label: 'Lớp học trùng giờ', count: this.checkClassConflictDetails(schedule) },
            { key: 'roomConflict', label: 'Phòng học trùng giờ', count: this.checkRoomConflictDetails(schedule) },
            { key: 'teacherBusy', label: 'Giáo viên dạy khi bận', count: this.countTeacherBusyViolations(schedule) },
            { key: 'missingPeriods', label: 'Thiếu tiết so với phân công', count: this.checkMissingPeriods(schedule) },
            { key: 'classGaps', label: 'Lớp bị trống tiết giữa buổi', count: this.checkClassGaps(schedule) },
            { key: 'teacherWeeklyLimit', label: 'Giáo viên vượt định mức tuần', count: this.checkTeacherWeeklyLimit(schedule) },
            { key: 'roomTypeCapacity', label: 'Thiếu phòng chức năng', count: this.checkRoomTypeCapacity(schedule) },
            { key: 'sessionRestriction', label: 'Lớp học sai buổi chính', count: this.checkSessionRestriction(schedule) },
        ].map((item) => (this.isHardDisabled(item.key) ? { ...item, count: 0 } : item));

        let hardViolations = 0;
        for (const item of hard) {
            if (!item.count) continue;
            hardViolations += item.count;
            details.push(`${item.label}: -${item.count * w.hardViolation} điểm (${item.count} lỗi)`);
        }

        // --- SOFT ---
        const soft: Array<{ label: string; count: number; weight: number }> = [
            { label: 'Môn học dồn cục', count: this.checkSpreadSubjects(classSchedule), weight: w.spreadSubjects },
            { label: 'Môn nặng học liền nhau', count: this.checkHeavySubjects(classSchedule), weight: w.heavySubjects },
            { label: 'Môn ưu tiên ở tiết cuối', count: this.checkMorningPriority(classSchedule), weight: w.morningPriority },
            { label: 'Môn 2 tiết bị xé lẻ', count: this.checkBlock2(classSchedule), weight: w.block2 },
            { label: 'Tiết trống giáo viên', count: this.checkNoHoles(teacherSchedule), weight: w.teacherGaps },
            { label: 'Giáo viên dạy quá số tiết/buổi', count: this.checkMaxLoad(teacherSchedule), weight: w.teacherMaxLoad },
            { label: 'Giáo viên phải đến trường thêm buổi', count: this.checkTeacherAttendance(teacherSchedule), weight: w.teacherAttendance },
            { label: 'Giáo viên dạy cả sáng lẫn chiều', count: this.checkBothSessionsSameDay(teacherSchedule), weight: w.bothSessionsSameDay },
            { label: 'Môn tư duy xếp ngay sau Thể dục', count: this.checkAfterPhysicalEd(classSchedule), weight: w.afterPhysicalEd },
            { label: 'Giáo viên không có ngày nghỉ', count: this.checkNoDayOff(teacherSchedule), weight: w.noDayOff },
            { label: 'Giáo viên dạy quá 4 tiết liên tiếp', count: this.checkConsecutiveTeaching(teacherSchedule), weight: w.consecutiveTeaching },
            { label: 'Môn học cách nhau quá 3 ngày', count: this.checkSubjectSpacing(classSchedule), weight: w.subjectSpacing },
            { label: 'Lớp học quá 3 tiết buổi phụ', count: this.checkAfternoonLoad(classSchedule), weight: w.afternoonOverload },
            { label: 'Giáo viên phải leo cầu thang', count: this.checkMobilityCost(teacherSchedule), weight: w.mobility },
            { label: 'Thể dục xếp vào giờ nắng', count: this.checkOutdoorTiming(schedule), weight: w.outdoorTiming },
            { label: 'Môn nặng dồn trong một buổi', count: this.checkBlockRules(classSchedule), weight: w.blockRules },
        ];

        let softPenalty = 0;
        for (const item of soft) {
            if (!item.count) continue;
            const cost = item.count * item.weight;
            softPenalty += cost;
            details.push(`${item.label}: -${cost} điểm (${item.count})`);
        }

        const score = 1000 - (hardViolations * w.hardViolation) - softPenalty;

        return {
            score,
            details,
            hardViolations,
            softPenalty,
            isValid: hardViolations === 0,
            offenders: this.locateHardViolations(schedule),
            breakdown: {
                hard: hard.filter(h => h.count > 0),
                soft: soft.filter(s => s.count > 0),
            },
        };
    }

    /**
     * Which periods are actually responsible for each hard violation.
     *
     * The score already said a timetable had three clashes; it never said which cells.
     * Without that the user has to hunt for them by eye, so the explanation stops being
     * useful exactly when it matters.
     */
    public locateHardViolations(schedule: TimeSlot[]): Array<{ label: string; slotIds: string[] }> {
        const findOverlaps = (key: 'teacherId' | 'classId' | 'roomId', label: string) => {
            const cells = new Map<string, TimeSlot[]>();
            for (const s of schedule) {
                const value = s[key];
                if (key === 'roomId' && !value) continue;
                const cellKey = `${value}|${s.day}|${s.period}`;
                if (!cells.has(cellKey)) cells.set(cellKey, []);
                cells.get(cellKey)!.push(s);
            }

            const ids: string[] = [];
            for (const group of cells.values()) {
                if (group.length > 1) ids.push(...group.map(s => s.id).filter(Boolean) as string[]);
            }
            return { label, slotIds: ids };
        };

        // A check the admin switched off must not paint cells red either
        const groups = [
            { key: 'teacherConflict', ...findOverlaps('teacherId', 'Giáo viên trùng giờ') },
            { key: 'classConflict', ...findOverlaps('classId', 'Lớp học trùng giờ') },
            { key: 'roomConflict', ...findOverlaps('roomId', 'Phòng học trùng giờ') },
            {
                key: 'teacherBusy',
                label: 'Giáo viên dạy khi bận',
                slotIds: schedule
                    .filter(s => this.isTeacherBusy(s.teacherId, s.day, s.period))
                    .map(s => s.id)
                    .filter(Boolean) as string[],
            },
            { key: 'classGaps', label: 'Lớp bị trống tiết giữa buổi', slotIds: this.locateClassGaps(schedule) },
        ];

        return groups
            .filter(group => !this.isHardDisabled(group.key))
            .filter(group => group.slotIds.length > 0)
            .map(({ label, slotIds }) => ({ label, slotIds }));
    }

    /** The periods that sit either side of a hole in a class's day. */
    private locateClassGaps(schedule: TimeSlot[]): string[] {
        const byClassDaySession = new Map<string, TimeSlot[]>();
        for (const s of schedule) {
            const session = s.period <= 5 ? 0 : 1;
            const key = `${s.classId}|${s.day}|${session}`;
            if (!byClassDaySession.has(key)) byClassDaySession.set(key, []);
            byClassDaySession.get(key)!.push(s);
        }

        const ids: string[] = [];
        for (const slots of byClassDaySession.values()) {
            if (slots.length < 2) continue;
            slots.sort((a, b) => a.period - b.period);

            for (let i = 0; i < slots.length - 1; i++) {
                if (slots[i + 1].period - slots[i].period > 1) {
                    if (slots[i].id) ids.push(slots[i].id!);
                    if (slots[i + 1].id) ids.push(slots[i + 1].id!);
                }
            }
        }
        return ids;
    }

    private countTeacherBusyViolations(schedule: TimeSlot[]): number {
        let count = 0;
        for (const slot of schedule) {
            if (this.isTeacherBusy(slot.teacherId, slot.day, slot.period)) count++;
        }
        return count;
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
            if (this.isRoomlessKey(id)) continue;
            v += this.countTimeOverlaps(slots);
        }
        return v;
    }
}
