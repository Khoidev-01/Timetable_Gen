
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConstraintService, TimeSlot } from './constraint.service';
import { AlgorithmGateway, SlotTuple } from './algorithm.gateway';
import { Move, MoveOperations } from './solvers/solver.interface';
import { LocalSearchSolver } from './solvers/improvement.solvers';
import { Actor, ChangeLogService } from './change-log.service';
import { ChangeAction } from '@prisma/client';

/** Progress frames are throttled: the search runs thousands of moves a second. */
const BROADCAST_INTERVAL_MS = 250;

@Injectable()
export class AlgorithmService {
    private readonly logger = new Logger(AlgorithmService.name);

    constructor(
        private prisma: PrismaService,
        private constraintService: ConstraintService,
        private gateway: AlgorithmGateway,
        private changeLog: ChangeLogService,
    ) { }

    private broadcast = {
        semesterId: '',
        attempt: 0,
        maxAttempts: 0,
        required: 0,
        lastSentAt: 0,
    };

    /**
     * Push a frame to whoever is watching. `force` bypasses the throttle for phase
     * boundaries, where the visual jump is the whole point.
     */
    private emitProgress(phase: string, slots: TimeSlot[], force = false, withSlots = true) {
        const { semesterId } = this.broadcast;
        if (!semesterId) return;

        const now = Date.now();
        if (!force && now - this.broadcast.lastSentAt < BROADCAST_INTERVAL_MS) return;
        this.broadcast.lastSentAt = now;

        this.gateway.publish(semesterId, {
            attempt: this.broadcast.attempt,
            maxAttempts: this.broadcast.maxAttempts,
            phase,
            placed: slots.length,
            required: this.broadcast.required,
            hardViolations: this.constraintService.checkHardConstraints(slots),
            score: this.calculateFitness(slots),
            slots: withSlots ? this.toTuples(slots) : undefined,
        });
    }

    private toTuples(slots: TimeSlot[]): SlotTuple[] {
        return slots.map(s => [s.classId, s.day, s.period, s.subjectId, s.teacherId] as SlotTuple);
    }

    async runAlgorithm(semesterId: string) {
        const debugLogs: string[] = [];
        const log = (msg: string) => {
            this.logger.log(msg);
            debugLogs.push(msg);
        };

        try {
            log(`[DEBUG] Starting Algorithm for Semester: ${semesterId}`);

            // 0. Load Cache & Data
            await this.constraintService.initialize(semesterId);
            const data = await this.loadData(semesterId);
            log(`[DEBUG] Data Loaded: ${data.classes.length} Classes, ${data.subjects.length} Subjects.`);

            // Ceremonies have no teaching assignment behind them, so the target is the
            // assigned periods plus the fixed slots each class will receive - otherwise
            // the progress bar reads 217/203 and looks broken
            const assignedPeriods = data.assignments.reduce((sum: number, a: any) => sum + a.total_periods, 0);
            const ceremonySlots = data.classes.reduce((sum: number, cls: any) => {
                const rules = this.constraintService.getFixedRulesFor(cls.grade_level, cls.main_session);
                return sum + rules.filter((r: any) => r.subject_code !== 'GVCN_TEACHING').length;
            }, 0);

            this.broadcast = {
                semesterId,
                attempt: 0,
                maxAttempts: 0,
                required: assignedPeriods + ceremonySlots,
                lastSentAt: 0,
            };

            // 1. Initialize Solution
            const solution = this.initializeSolution(data);

            // 1.1 Load User-Locked Slots from Previous Timetable (If exists)
            const prevTimetable = await this.prisma.generatedTimetable.findFirst({
                where: { semester_id: semesterId },
                orderBy: { created_at: 'desc' },
                include: { slots: { where: { is_locked: true } } }
            });

            if (prevTimetable && prevTimetable.slots.length > 0) {
                log(`[INFO] Found ${prevTimetable.slots.length} locked slots from previous run. Preserving...`);
                prevTimetable.slots.forEach(s => {
                    solution.slots.push({
                        id: s.id,
                        day: s.day,
                        period: s.period,
                        classId: s.class_id,
                        subjectId: s.subject_id,
                        teacherId: s.teacher_id,
                        roomId: s.room_id || undefined,
                        isLocked: true
                    });
                    // Mark resources as busy?
                    // solution.teacherBusy.add(...) -> Algorithm logic uses this Set? 
                    // initializeSolution sets are empty. Phase 2 checks isSlotOccupied (which iterates slots).
                    // Phase 3 Genetic uses slots.
                    // So just pushing to slots is sufficient for conflict checks if checkTeacherConflict checks `solution.slots`.
                    // But wait, checkFixedSlot? 
                    // Phase 1 might try to add fixed slots. It checks `isSlotOccupied`?
                    // Phase 1 usually iterates classes and adds slots.
                    // I need to update Phase 1 to check `if (this.isSlotOccupied(solution.slots, cls.id, d, p)) continue;`.
                });
            }

            // 2. Every phase is randomised, so a single run is one draw from a fairly
            // wide distribution. Build several and keep the best - restarts buy more
            // than a longer search on one starting point.
            // Only some attempts land on a fully valid grid, so keep drawing until one
            // does, then spend the remaining budget improving its soft score.
            const MAX_ATTEMPTS = 12;
            const MIN_ATTEMPTS = 5;
            const VARIANTS_TO_KEEP = 3;
            const lockedSlots = [...solution.slots];
            const candidates: Array<{ slots: TimeSlot[]; hard: number; score: number }> = [];

            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                const bestSoFar = candidates[0];
                if (bestSoFar && bestSoFar.hard === 0 && attempt > MIN_ATTEMPTS) break;

                const quiet = () => { /* only the summary is worth logging */ };
                const candidate = { slots: lockedSlots.map(s => ({ ...s })) };

                this.broadcast.attempt = attempt;
                this.broadcast.maxAttempts = MAX_ATTEMPTS;

                await this.buildOneSolution(candidate, data, quiet);

                const hard = this.constraintService.checkHardConstraints(candidate.slots);
                const score = this.calculateFitness(candidate.slots);
                log(`[DEBUG] Lần thử ${attempt}: ${candidate.slots.length} tiết, ${hard} lỗi cứng, điểm ${score}.`);

                candidates.push({ slots: candidate.slots, hard, score });

                // A usable timetable always beats a prettier unusable one, so compare the
                // hard violations first and only fall back to the score on a tie
                candidates.sort((a, b) => (a.hard !== b.hard ? a.hard - b.hard : b.score - a.score));
            }

            // Offering the head teacher a choice is only useful when the options really
            // differ, so drop attempts that landed on the same placement
            const variants = this.distinctVariants(candidates).slice(0, VARIANTS_TO_KEEP);
            const best = variants[0];

            solution.slots = best.slots;
            log(`[DEBUG] Giữ ${variants.length} phương án, tốt nhất: ${best.hard} lỗi cứng, điểm ${best.score}.`);
            this.emitProgress('Hoàn tất', solution.slots, true);

            // 5. Save every variant, then score what was actually stored
            log(`[DEBUG] Saving ${variants.length} phương án...`);

            const savedVariants: any[] = [];
            for (let index = 0; index < variants.length; index++) {
                const variant = { slots: variants[index].slots };
                const label = `Phương án ${index + 1}`;
                const result = await this.saveToDatabase(semesterId, variant, data, log, label);
                savedVariants.push({ ...result, label });
            }

            const saved = savedVariants[0];

            return {
                success: true,
                id: saved.id,
                debugLogs,
                fitnessScore: saved.fitness.score,
                fitnessDetails: saved.fitness.details,
                isValid: saved.fitness.isValid,
                stats: saved.stats,
                variants: savedVariants.map(v => ({
                    id: v.id,
                    label: v.label,
                    score: v.fitness.score,
                    isValid: v.fitness.isValid,
                    hardViolations: v.fitness.hardViolations,
                })),
            };

        } catch (error: any) {
            log(`[ERROR] Algorithm Failed: ${error.message}`);
            if (error.stack) log(`[ERROR] Stack: ${error.stack}`);
            return { debugLogs, success: false, error: error.message };
        }
    }

    /**
     * Construction only: fixed periods, the greedy fill and the repair passes, with no
     * improvement step. Benchmarks start every solver from a construction like this so
     * the comparison measures the search, not the starting point.
     */
    public async buildConstruction(data: any): Promise<TimeSlot[]> {
        const quiet = () => undefined;
        const solution: any = { slots: [] };

        await this.phase1_FixedSlots(solution, data, quiet);
        this.phase2_Heuristic(solution, data);
        this.repairMissingPeriods(solution, data, quiet);
        this.consolidateBlocks(solution, data, quiet);
        this.compactClassSchedules(solution, data, quiet);
        this.alignHomeroomToEndOfDay(solution, data, quiet);

        return solution.slots;
    }

    /** Load everything a benchmark run needs, warming the constraint cache too. */
    public async prepareData(semesterId: string) {
        await this.constraintService.initialize(semesterId);
        return this.loadData(semesterId);
    }

    /** One full construct-then-improve pass over an already locked-in starting point. */
    private async buildOneSolution(solution: any, data: any, log: (msg: string) => void) {
        await this.phase1_FixedSlots(solution, data, log);
        this.emitProgress('Tiết cố định', solution.slots, true);

        this.phase2_Heuristic(solution, data);
        this.emitProgress('Xếp heuristic', solution.slots, true);

        // Place whatever the single-pass heuristic could not fit
        this.repairMissingPeriods(solution, data, log);
        this.emitProgress('Bù tiết thiếu', solution.slots, true);

        // Bring split double periods back together
        this.consolidateBlocks(solution, data, log);
        this.emitProgress('Ghép tiết đôi', solution.slots, true);

        // Close any gap left in the middle of a class's session
        this.compactClassSchedules(solution, data, log);
        this.alignHomeroomToEndOfDay(solution, data, log);
        this.emitProgress('Dồn tiết', solution.slots, true);

        // A short search first, so a second repair sweep can use any cell it frees up
        await this.phase3_LocalSearch(solution, data, log, 4000);

        this.repairMissingPeriods(solution, data, log);
        this.compactClassSchedules(solution, data, log);
        this.alignHomeroomToEndOfDay(solution, data, log);

        // Then the main search runs last, so nothing undoes what it achieves
        await this.phase3_LocalSearch(solution, data, log, 12000);

        // Rooms are settled once the grid stops moving - threading room bookings through
        // every swap and relocation would double the cost of each move for no benefit
        this.assignRooms(solution, data, log);
        this.emitProgress('Gán phòng', solution.slots, true);
    }

    /**
     * Give every period a room: a free lab or yard for practice subjects, the class's own
     * room for ordinary lessons, and none for the whole-school assembly. Runs after the
     * search so a slot never carries a booking that a later move invalidated.
     */
    private assignRooms(solution: any, data: any, log: (msg: string) => void) {
        const assembly = data.subjects.find((s: any) => s.code === 'CHAO_CO');
        const placed: TimeSlot[] = [];
        let unresolved = 0;

        // Specialised subjects book first - they have the fewest rooms to choose from
        const ordered = [...(solution.slots as TimeSlot[])].sort((a, b) => {
            const aSpecial = this.constraintService.getRequiredRoomType(a.subjectId) ? 0 : 1;
            const bSpecial = this.constraintService.getRequiredRoomType(b.subjectId) ? 0 : 1;
            return aSpecial - bSpecial;
        });

        for (const slot of ordered) {
            if (assembly && slot.subjectId === assembly.id) {
                slot.roomId = undefined;
                placed.push(slot);
                continue;
            }

            const cls = data.classes.find((c: any) => c.id === slot.classId);
            const room = this.constraintService.pickRoom(
                slot.subjectId, slot.day, slot.period, placed, cls?.fixed_room_id ?? undefined);

            if (room === undefined && this.constraintService.getRequiredRoomType(slot.subjectId)) {
                // Every specialised room is taken; fall back to the class room so the
                // period is still taught rather than dropped
                slot.roomId = cls?.fixed_room_id ?? undefined;
                unresolved++;
            } else {
                slot.roomId = room;
            }
            placed.push(slot);
        }

        if (unresolved > 0) {
            log(`[WARN] ${unresolved} tiết thực hành không còn phòng chức năng trống, phải học tại phòng lớp.`);
        }
    }

    /**
     * Pulling within a day cannot help when the period that would fill the hole is
     * blocked by its teacher. Look across the class's other days instead, and only take
     * a period that sits last in its own day so the move cannot open a new hole there.
     */
    private closeGapsAcrossDays(solution: any, data: any): number {
        const SESSIONS: Array<[number, number]> = [[1, 5], [6, 10]];
        const slots: TimeSlot[] = solution.slots;
        let moved = 0;

        for (const cls of data.classes) {
            for (const [start, end] of SESSIONS) {
                for (let day = 2; day <= 7; day++) {
                    for (let period = start; period <= end; period++) {
                        if (this.isSlotOccupied(slots, cls.id, day, period)) continue;
                        if (!this.isCellAllowed(day, period)) continue;

                        // Only a hole if the class still has lessons later that day
                        const hasLater = slots.some(s =>
                            s.classId === cls.id && s.day === day && s.period > period && s.period <= end);
                        if (!hasLater) continue;

                        const donor = slots.find(s => {
                            if (s.classId !== cls.id || s.isLocked) return false;
                            if (s.day === day) return false;
                            if (s.period < start || s.period > end) return false;

                            // Taking it must not leave a hole behind
                            const isLastOfItsDay = !slots.some(o =>
                                o.classId === cls.id && o.day === s.day &&
                                o.period > s.period && o.period <= end);
                            if (!isLastOfItsDay) return false;

                            if (this.constraintService.isTeacherBusy(s.teacherId, day, period)) return false;
                            if (this.constraintService.isRoomTypeFull(s.subjectId, day, period, slots)) return false;

                            return !slots.some(o =>
                                o !== s && o.day === day && o.period === period &&
                                o.teacherId === s.teacherId);
                        });

                        if (!donor) continue;

                        donor.day = day;
                        donor.period = period;
                        moved++;
                    }
                }
            }
        }
        return moved;
    }

    /**
     * Sinh hoạt cuối tuần belongs at the end of the class's last school day, not at a
     * fixed period number. Pinning it to period 5 leaves a hole whenever the class runs
     * out of lessons earlier, and that hole is a hard violation the compaction pass
     * cannot close because the ceremony itself is locked.
     */
    private alignHomeroomToEndOfDay(solution: any, data: any, log: (msg: string) => void) {
        const homeroomSubject = data.subjects.find((s: any) => s.code === 'SH_CUOI_TUAN');
        if (!homeroomSubject) return;

        let moved = 0;

        for (const cls of data.classes) {
            const onLastDay = (solution.slots as TimeSlot[])
                .filter(s => s.classId === cls.id && s.day === 7);

            const ceremony = onLastDay.find(s => s.subjectId === homeroomSubject.id);
            if (!ceremony) continue;

            const lessons = onLastDay
                .filter(s => s !== ceremony)
                .map(s => s.period)
                .sort((a, b) => a - b);
            if (lessons.length === 0) continue;

            const target = lessons[lessons.length - 1] + 1;
            if (target === ceremony.period) continue;
            if (!this.sameSession(ceremony.period, target)) continue;
            if (this.isSlotOccupied(solution.slots, cls.id, 7, target)) continue;
            if (this.constraintService.isTeacherBusy(ceremony.teacherId, 7, target)) continue;
            if (this.constraintService.checkTeacherConflict(
                { day: 7, period: target, teacherId: ceremony.teacherId } as any, solution.slots)) continue;

            ceremony.period = target;
            moved++;
        }

        if (moved > 0) log(`[DEBUG] Sinh hoạt: dời ${moved} tiết về cuối buổi.`);
    }

    private async loadData(semesterId: string) {
        const [teachers, rooms, assignments, classes, subjects] = await Promise.all([
            this.prisma.teacher.findMany({ include: { constraints: true } }),
            this.prisma.room.findMany(),
            this.prisma.teachingAssignment.findMany({
                where: { semester_id: semesterId },
                include: { subject: true }
            }),
            this.prisma.class.findMany({ include: { fixed_room: true, homeroom_teacher: true } }),
            this.prisma.subject.findMany()
        ]);
        return { teachers, rooms, assignments, classes, subjects };
    }

    private initializeSolution(data: any) {
        return {
            slots: [] as TimeSlot[],
            teacherBusy: new Set<string>(),
            roomBusy: new Set<string>(),
            classBusy: new Set<string>(),
        };
    }

    private async phase1_FixedSlots(solution: any, data: any, log: (msg: string) => void) {
        const { classes, subjects, teachers } = data;

        if (!this.constraintService.hasFixedRules()) {
            log('[WARN] Chưa cấu hình quy tắc tiết cố định nào - bỏ qua Phase 1.');
            return;
        }

        const subjectByCode = new Map<string, any>();
        subjects.forEach((s: any) => subjectByCode.set(s.code, s));

        const bgh = teachers.find((t: any) => t.code === 'BGH') || teachers[0];
        let placed = 0;
        const unresolved: string[] = [];

        for (const cls of classes) {
            const rules = this.constraintService.getFixedRulesFor(cls.grade_level, cls.main_session);

            for (const rule of rules) {
                if (this.isSlotOccupied(solution.slots, cls.id, rule.day_of_week, rule.period)) continue;

                const resolved = this.resolveFixedRule(rule, cls, data, subjectByCode, bgh);
                if (!resolved) {
                    unresolved.push(`${cls.name}/${rule.name}`);
                    continue;
                }

                // A rule that pins the same subject for several classes only works when
                // each class has its own teacher for it. Where they share one, pinning
                // both would put the teacher in two rooms at once; leave the period to
                // the heuristic instead of pushing a slot that gets dropped on save.
                const teacherTaken = solution.slots.some((s: TimeSlot) =>
                    s.day === rule.day_of_week &&
                    s.period === rule.period &&
                    s.teacherId === resolved.teacherId);

                if (teacherTaken) {
                    unresolved.push(`${cls.name}/${rule.name} (giáo viên đã bận)`);
                    continue;
                }

                solution.slots.push({
                    day: rule.day_of_week,
                    period: rule.period,
                    classId: cls.id,
                    subjectId: resolved.subjectId,
                    teacherId: resolved.teacherId,
                    roomId: cls.fixed_room_id ?? undefined,
                    isLocked: rule.is_locked,
                });
                placed++;
            }
        }

        log(`[DEBUG] Phase 1: đặt ${placed} tiết cố định.`);
        if (unresolved.length > 0) {
            log(`[WARN] Không áp dụng được ${unresolved.length} quy tắc: ${unresolved.slice(0, 8).join(', ')}`);
        }
    }

    /** Work out which subject and teacher a fixed rule means for one particular class. */
    private resolveFixedRule(
        rule: any,
        cls: any,
        data: any,
        subjectByCode: Map<string, any>,
        bgh: any,
    ): { subjectId: number; teacherId: string } | null {
        // Pseudo-subject: whatever cultural subject the homeroom teacher already teaches
        // this class, so they are in the room right before or after the ceremony
        if (rule.subject_code === 'GVCN_TEACHING') {
            const homeroomId = cls.homeroom_teacher_id;
            if (!homeroomId) return null;

            const assignment = data.assignments.find((a: any) => {
                if (a.class_id !== cls.id || a.teacher_id !== homeroomId) return false;
                const subject = data.subjects.find((s: any) => s.id === a.subject_id);
                return subject && !subject.is_special;
            });
            if (!assignment) return null;

            return { subjectId: assignment.subject_id, teacherId: homeroomId };
        }

        const subject = subjectByCode.get(rule.subject_code);
        if (!subject) return null;

        let teacherId: string | null = null;
        if (rule.teacher_rule === 'BGH') {
            teacherId = bgh?.id ?? null;
        } else if (rule.teacher_rule === 'ASSIGNED') {
            const assignment = data.assignments.find((a: any) =>
                a.class_id === cls.id && a.subject_id === subject.id);
            teacherId = assignment?.teacher_id ?? null;
        } else {
            teacherId = cls.homeroom_teacher_id ?? null;
        }

        if (!teacherId) teacherId = cls.homeroom_teacher_id ?? bgh?.id ?? null;
        if (!teacherId) return null;

        return { subjectId: subject.id, teacherId };
    }

    private phase2_Heuristic(solution: any, data: any) {
        this.logger.log('Phase 2: Heuristic Filling with Block Scheduling...');
        const { classes, assignments } = data;

        const classAssignments = new Map<string, any[]>();
        assignments.forEach((agg: any) => {
            const subject = data.subjects.find((s: any) => s.id === agg.subject_id);
            // Only whole-school ceremonies are excluded; every other subject, GDDP and
            // HDTN included, still needs the heuristic to place its remaining periods.
            if (subject && !['CHAO_CO', 'SH_DAU_TUAN', 'SH_CUOI_TUAN'].includes(subject.code)) {
                if (!classAssignments.has(agg.class_id)) classAssignments.set(agg.class_id, []);
                classAssignments.get(agg.class_id)!.push({ ...agg });
            }
        });

        for (const cls of classes) {
            const clsAssignments = classAssignments.get(cls.id) || [];
            if (clsAssignments.length === 0) {
                this.logger.warn(`[WARNING] Class ${cls.name} (ID: ${cls.id}) has 0 heuristic assignments.`);
                continue;
            }

            const isMorningMain = cls.main_session === 0;
            const mainSessionSlots: any[] = [];
            const oppositeGeneralSlots: any[] = [];
            const oppositeBlockSubjects: any[] = []; // { assign, count }

            // 1. Classify Assignments
            // Demand is summed per subject first: a subject may carry a theory row and a
            // chuyên đề row, and subtracting the already-placed periods from each row
            // separately would discount the same fixed slot twice.
            const demandBySubject = new Map<number, number>();
            for (const assign of clsAssignments) {
                demandBySubject.set(
                    assign.subject_id,
                    (demandBySubject.get(assign.subject_id) || 0) + assign.total_periods,
                );
            }

            const seenSubjects = new Set<number>();
            for (const assign of clsAssignments) {
                if (seenSubjects.has(assign.subject_id)) continue;
                seenSubjects.add(assign.subject_id);

                const subject = data.subjects.find((s: any) => s.id === assign.subject_id);
                // GDQP, GDTC => Opposite Session
                const isOpposite = subject && (subject.code === 'GDQP' || subject.code === 'GDTC');

                const alreadyAssigned = solution.slots.filter((s: any) =>
                    s.classId === cls.id && s.subjectId === assign.subject_id
                ).length;

                const remainingNeeded = Math.max(
                    0,
                    (demandBySubject.get(assign.subject_id) || 0) - alreadyAssigned,
                );
                if (remainingNeeded === 0) continue;

                if (isOpposite) {
                    oppositeBlockSubjects.push({ assign, count: remainingNeeded });
                } else {
                    for (let i = 0; i < remainingNeeded; i++) {
                        mainSessionSlots.push(assign);
                    }
                }
            }

            // 2. Pre-allocate Block Subjects (GDQP, GDTC)
            // Goal: Place ALL 'count' periods in ONE session (consecutive)
            for (const block of oppositeBlockSubjects) {
                const { assign, count } = block;
                const minP = isMorningMain ? 6 : 1;
                const maxP = isMorningMain ? 10 : 5;
                const validRange = Array.from({ length: maxP - minP + 1 }, (_, i) => minP + i);

                let placed = false;
                const days = [2, 3, 4, 5, 6, 7].sort(() => 0.5 - Math.random());

                for (const day of days) {
                    if (placed) break;

                    // Opposite Separation Check: Is there ANY opposite subject already on this day?
                    const hasOpposite = solution.slots.some((s: any) =>
                        s.classId === cls.id && s.day === day && (s.period >= minP && s.period <= maxP)
                    );
                    if (hasOpposite) continue; // Try next day

                    // Try to find 'count' consecutive slots
                    for (let startIdx = 0; startIdx <= validRange.length - count; startIdx++) {
                        const periodsToCheck = validRange.slice(startIdx, startIdx + count);

                        // Check if ALL periods are free/valid
                        const canPlace = periodsToCheck.every(p => {
                            // Blocked Rules
                            if (!this.isCellAllowed(day, p)) return false;

                            // Occupied?
                            if (this.isSlotOccupied(solution.slots, cls.id, day, p)) return false;
                            // Teacher already teaching elsewhere?
                            if (this.constraintService.checkTeacherConflict({ day, period: p, teacherId: assign.teacher_id } as any, solution.slots)) return false;
                            // Teacher registered this slot as busy?
                            if (this.constraintService.isTeacherBusy(assign.teacher_id, day, p)) return false;
                            // No lab / yard left at this time?
                            if (this.constraintService.isRoomTypeFull(assign.subject_id, day, p, solution.slots)) return false;

                            return true;
                        });

                        if (canPlace) {
                            // EXECUTE PLACEMENT
                            periodsToCheck.forEach(p => {
                                solution.slots.push({
                                    id: crypto.randomUUID(),
                                    day, period: p,
                                    classId: cls.id,
                                    subjectId: assign.subject_id,
                                    teacherId: assign.teacher_id,
                                    roomId: cls.fixed_room_id,
                                    isLocked: false
                                });
                            });
                            placed = true;
                            break;
                        }
                    }
                }
                if (!placed) {
                    this.logger.warn(`[WARNING] Could not place Block Subject ${assign.subject_id} (${count} periods) for Class ${cls.name}`);
                    // Fallback: Dump into general pool
                    for (let k = 0; k < count; k++) oppositeGeneralSlots.push(assign);
                }
            }

            // 3. Fill Remaining (Main + General Opposite)
            this.shuffleArray(mainSessionSlots);
            this.shuffleArray(oppositeGeneralSlots);

            for (let day = 2; day <= 7; day++) {
                for (let period = 1; period <= 10; period++) {
                    const isMorningPeriod = period <= 5;
                    const isMainSlot = (isMorningMain && isMorningPeriod) || (!isMorningMain && !isMorningPeriod);

                    let candidates = isMainSlot ? mainSessionSlots : oppositeGeneralSlots;
                    if (candidates.length === 0) continue;

                    if (this.isSlotOccupied(solution.slots, cls.id, day, period)) continue;

                    // RULES BLOCK
                    if (!this.isCellAllowed(day, period)) continue;

                    // Try to assign
                    for (let i = 0; i < candidates.length; i++) {
                        const assign = candidates[i];

                        // For General Opposite (fallback), we verify strict separation again
                        if (!isMainSlot) {
                            const hasOpposite = solution.slots.some((s: any) =>
                                s.classId === cls.id && s.day === day && (isMorningMain ? s.period > 5 : s.period <= 5)
                            );
                            if (hasOpposite) continue;
                        }

                        if (this.constraintService.checkTeacherConflict({ day, period, teacherId: assign.teacher_id } as any, solution.slots)) continue;
                        if (this.constraintService.isTeacherBusy(assign.teacher_id, day, period)) continue;
                        if (this.constraintService.isTeacherAtWeeklyLimit(assign.teacher_id, solution.slots)) continue;
                        if (this.constraintService.isRoomTypeFull(assign.subject_id, day, period, solution.slots)) continue;

                        const slot = {
                            id: crypto.randomUUID(),
                            day, period,
                            classId: cls.id,
                            subjectId: assign.subject_id,
                            teacherId: assign.teacher_id,
                            roomId: cls.fixed_room_id,
                            isLocked: false
                        };
                        solution.slots.push(slot);
                        candidates.splice(i, 1);
                        break;
                    }
                }
            }

            if (mainSessionSlots.length > 0 || oppositeGeneralSlots.length > 0) {
                this.logger.warn(`[WARNING] Class ${cls.name}: Incomplete Schedule. Remaining: ${mainSessionSlots.length} Main, ${oppositeGeneralSlots.length} Opposite.`);
            }
        }
    }

    /**
     * The heuristic sweeps the grid once, so a period it could not fit at the moment it
     * passed a cell is lost for good. Sweep the shortfall again: look for a free cell,
     * and when the only obstacle is the teacher standing in another class, try moving
     * that one blocking period out of the way.
     */
    private repairMissingPeriods(solution: any, data: any, log: (msg: string) => void) {
        const placed = new Map<string, number>();
        for (const s of solution.slots as TimeSlot[]) {
            const key = `${s.classId}|${s.subjectId}`;
            placed.set(key, (placed.get(key) || 0) + 1);
        }

        const required = new Map<string, { need: number; assign: any }>();
        for (const a of data.assignments) {
            const key = `${a.class_id}|${a.subject_id}`;
            const current = required.get(key);
            required.set(key, { need: (current?.need || 0) + a.total_periods, assign: a });
        }

        let repaired = 0;
        let unresolved = 0;

        for (const [key, { need, assign }] of required) {
            for (let placedCount = placed.get(key) || 0; placedCount < need; placedCount++) {
                if (this.tryPlacePeriod(solution, data, assign)) repaired++;
                else unresolved++;
            }
        }

        log(`[DEBUG] Repair: đặt thêm ${repaired} tiết, còn thiếu ${unresolved} tiết.`);
    }

    /** Find any legal cell for one period of an assignment, relocating a blocker if needed. */
    private tryPlacePeriod(solution: any, data: any, assign: any): boolean {
        const cls = data.classes.find((c: any) => c.id === assign.class_id);
        if (!cls) return false;

        const subject = data.subjects.find((s: any) => s.id === assign.subject_id);
        const isOpposite = subject && (subject.code === 'GDQP' || subject.code === 'GDTC');
        const isMorningMain = cls.main_session === 0;
        const wantMorning = isOpposite ? !isMorningMain : isMorningMain;
        const [minP, maxP] = wantMorning ? [1, 5] : [6, 10];

        // Filling a shortfall must not push the teacher past their weekly quota
        if (this.constraintService.isTeacherAtWeeklyLimit(assign.teacher_id, solution.slots)) return false;

        for (let day = 2; day <= 7; day++) {
            for (let period = minP; period <= maxP; period++) {
                if (!this.isCellAllowed(day, period)) continue;
                if (this.isSlotOccupied(solution.slots, cls.id, day, period)) continue;
                if (this.constraintService.isTeacherBusy(assign.teacher_id, day, period)) continue;
                if (this.constraintService.isRoomTypeFull(assign.subject_id, day, period, solution.slots)) continue;

                const blocker = solution.slots.find((s: TimeSlot) =>
                    s.day === day && s.period === period && s.teacherId === assign.teacher_id);

                if (blocker && (blocker.isLocked || !this.relocateSlot(solution, blocker))) continue;

                solution.slots.push({
                    id: crypto.randomUUID(),
                    day,
                    period,
                    classId: cls.id,
                    subjectId: assign.subject_id,
                    teacherId: assign.teacher_id,
                    roomId: cls.fixed_room_id,
                    isLocked: false,
                });
                return true;
            }
        }
        return false;
    }

    /** Move an unlocked slot to another legal cell of its own class and session. */
    private relocateSlot(solution: any, slot: TimeSlot): boolean {
        const [minP, maxP] = slot.period <= 5 ? [1, 5] : [6, 10];

        for (let day = 2; day <= 7; day++) {
            for (let period = minP; period <= maxP; period++) {
                if (day === slot.day && period === slot.period) continue;
                if (!this.isCellAllowed(day, period)) continue;
                if (this.isSlotOccupied(solution.slots, slot.classId, day, period)) continue;
                if (this.constraintService.isTeacherBusy(slot.teacherId, day, period)) continue;
                if (this.constraintService.checkTeacherConflict(
                    { day, period, teacherId: slot.teacherId } as any, solution.slots)) continue;

                slot.day = day;
                slot.period = period;
                return true;
            }
        }
        return false;
    }

    /**
     * A subject taught twice a week reads far better as one double period than as two
     * scattered singles, and readme 3.1 asks for it. The heuristic fills cell by cell so
     * it cannot build blocks; walk the result instead and swap lone periods next to a
     * sibling whenever both teachers stay free.
     */
    private consolidateBlocks(solution: any, data: any, log: (msg: string) => void) {
        let merged = 0;

        for (const cls of data.classes) {
            const bySubject = new Map<number, TimeSlot[]>();
            for (const s of solution.slots as TimeSlot[]) {
                if (s.classId !== cls.id) continue;
                if (!bySubject.has(s.subjectId)) bySubject.set(s.subjectId, []);
                bySubject.get(s.subjectId)!.push(s);
            }

            for (const [, siblings] of bySubject) {
                if (siblings.length < 2) continue;

                for (const lone of siblings) {
                    if (lone.isLocked) continue;
                    if (this.hasAdjacentSibling(solution.slots, lone)) continue;

                    const target = this.findBlockPartnerCell(solution.slots, lone, siblings);
                    if (!target) continue;

                    this.swapPositions(lone, target);
                    merged++;
                }
            }
        }

        log(`[DEBUG] Blocks: ghép được ${merged} tiết thành cặp.`);
    }

    /** Does this slot already sit next to another period of the same subject? */
    private hasAdjacentSibling(slots: TimeSlot[], slot: TimeSlot): boolean {
        return slots.some(s =>
            s !== slot &&
            s.classId === slot.classId &&
            s.subjectId === slot.subjectId &&
            s.day === slot.day &&
            Math.abs(s.period - slot.period) === 1);
    }

    /**
     * Find a slot of the same class sitting beside one of `siblings`, which could trade
     * places with `lone` without breaking either teacher's schedule.
     */
    private findBlockPartnerCell(slots: TimeSlot[], lone: TimeSlot, siblings: TimeSlot[]): TimeSlot | null {
        for (const anchor of siblings) {
            if (anchor === lone) continue;

            // Two periods a day is one double period; a third would just be piling up
            const sameDayCount = siblings.filter(s => s.day === anchor.day).length;
            if (sameDayCount >= 2) continue;

            for (const period of [anchor.period - 1, anchor.period + 1]) {
                if (!this.sameSession(anchor.period, period)) continue;
                if (!this.isCellAllowed(anchor.day, period)) continue;

                const target = slots.find(s =>
                    s.classId === lone.classId && s.day === anchor.day && s.period === period);

                if (!target || target === lone || target.isLocked) continue;
                if (target.subjectId === lone.subjectId) continue;
                if (this.canSwapPositions(slots, lone, target)) return target;
            }
        }
        return null;
    }

    /**
     * Both slots may trade day/period without breaking a hard constraint. Checks the
     * teacher and the class, so this is safe for swaps across two different classes too.
     */
    private canSwapPositions(slots: TimeSlot[], a: TimeSlot, b: TimeSlot): boolean {
        if (a.isLocked || b.isLocked) return false;
        if (!this.sameSession(a.period, b.period)) return false;
        if (!this.isCellAllowed(a.day, a.period) || !this.isCellAllowed(b.day, b.period)) return false;

        const legal = (slot: TimeSlot, day: number, period: number) => {
            if (this.constraintService.isTeacherBusy(slot.teacherId, day, period)) return false;
            return !slots.some(s =>
                s !== a && s !== b &&
                s.day === day && s.period === period &&
                (s.teacherId === slot.teacherId || s.classId === slot.classId));
        };

        return legal(a, b.day, b.period) && legal(b, a.day, a.period);
    }

    private swapPositions(a: TimeSlot, b: TimeSlot) {
        const day = a.day;
        const period = a.period;
        a.day = b.day;
        a.period = b.period;
        b.day = day;
        b.period = period;
    }

    private sameSession(a: number, b: number): boolean {
        if (b < 1 || b > 10) return false;
        return (a <= 5) === (b <= 5);
    }

    /**
     * Cells the school keeps free, on top of the fixed ceremonies.
     *
     * Thursday used to be hardcoded down to two periods a session, which is undocumented
     * anywhere in the schema or the readme. Measured on the sample data it is decisive:
     * with the short Thursday the timetable is 4 periods short of the teaching plan and
     * therefore invalid; with a full Thursday it places all 214 periods with zero hard
     * violations. It is left configurable rather than deleted - if a school really does
     * run a short Thursday, set `shortThursday` back to true and expect the shortfall.
     */
    private readonly gridPolicy = {
        shortThursday: false,
        shortThursdayPeriods: [1, 2, 6, 7],
    };

    private isCellAllowed(day: number, period: number): boolean {
        // Monday period 1 belongs to the whole-school assembly
        if (day === 2 && period === 1) return false;

        if (this.gridPolicy.shortThursday && day === 5) {
            return this.gridPolicy.shortThursdayPeriods.includes(period);
        }
        return true;
    }

    /**
     * Pull each class's periods towards the front of its session so students never
     * sit through an empty period in the middle of the day - they have nowhere to go.
     * Only unlocked slots move, and only into a period where the teacher is genuinely
     * free and the required room type still has capacity.
     */
    private compactClassSchedules(solution: any, data: any, log: (msg: string) => void) {
        const SESSIONS: Array<[number, number]> = [[1, 5], [6, 10]];
        let moved = 0;

        for (const cls of data.classes) {
            for (let day = 2; day <= 7; day++) {
                for (const [start, end] of SESSIONS) {
                    let progress = true;

                    while (progress) {
                        progress = false;

                        for (let p = start; p <= end; p++) {
                            if (this.isSlotOccupied(solution.slots, cls.id, day, p)) continue;

                            // Earliest later slot of this class that may legally move into the hole
                            const candidate = solution.slots.find((s: TimeSlot) =>
                                s.classId === cls.id &&
                                s.day === day &&
                                s.period > p &&
                                s.period <= end &&
                                !s.isLocked &&
                                !this.constraintService.checkTeacherConflict(
                                    { day, period: p, teacherId: s.teacherId } as any, solution.slots) &&
                                !this.constraintService.isTeacherBusy(s.teacherId, day, p) &&
                                !this.constraintService.isRoomTypeFull(s.subjectId, day, p, solution.slots)
                            );

                            if (!candidate) continue;

                            candidate.period = p;
                            moved++;
                            progress = true;
                        }
                    }
                }
            }
        }

        moved += this.closeGapsAcrossDays(solution, data);

        const remaining = this.constraintService.checkClassGaps(solution.slots);
        log(`[DEBUG] Compaction: moved ${moved} slots, ${remaining} class gaps remaining.`);
    }

    /**
     * Local search over pairwise swaps.
     *
     * The previous version ran 50 iterations and only ever traded two periods of the
     * *same* class, so it could never resolve the common case of one teacher wanted by
     * two classes at once, and 50 tries over ~200 periods was statistically negligible.
     * This version samples both same-class and cross-class swaps, rejects anything that
     * would break a hard constraint, and keeps a swap when the score does not get worse -
     * accepting equal moves lets it drift across plateaus instead of stalling.
     */
    private async phase3_LocalSearch(
        solution: any,
        data: any,
        log: (msg: string) => void,
        iterations = 12000,
    ) {
        const ITERATIONS = iterations;
        const PLATEAU_LIMIT = Math.max(1000, Math.floor(iterations / 5));

        const slots: TimeSlot[] = solution.slots;
        let score = this.calculateFitness(slots);
        const initial = score;

        let improvements = 0;
        let sinceImprovement = 0;

        for (let i = 0; i < ITERATIONS; i++) {
            const movable = slots.filter(s => !s.isLocked);
            if (movable.length < 2) break;

            // Three move types. Swaps rearrange a busy grid, relocations open up cells,
            // and the targeted move goes straight after the largest remaining penalty:
            // the number of separate sessions a teacher has to come to school for.
            const roll = Math.random();
            const undo = roll < 0.35
                ? this.trySwapMove(slots, movable)
                : roll < 0.7
                    ? this.tryRelocateMove(slots, movable)
                    : this.tryConsolidateTeacherMove(slots, movable);

            if (!undo) continue;

            const candidate = this.calculateFitness(slots);

            if (candidate > score) {
                score = candidate;
                improvements++;
                sinceImprovement = 0;
            } else if (candidate === score) {
                sinceImprovement++;
            } else {
                undo();
                sinceImprovement++;
            }

            if (candidate > score) this.emitProgress('Tối ưu', slots);
            if (sinceImprovement >= PLATEAU_LIMIT) break;
        }

        solution.fitness_score = score;
        log(`[DEBUG] Local search: ${initial} → ${score} (${improvements} lần cải thiện).`);
    }

    /**
     * Wrap the move generators so a solver can drive the search without knowing anything
     * about classes, teachers or rooms. Benchmarking different strategies then means
     * swapping the solver, not rewriting the neighbourhood.
     */
    public moveOperations(): MoveOperations {
        return {
            fitness: (slots: TimeSlot[]) => this.calculateFitness(slots),
            hardViolations: (slots: TimeSlot[]) => this.constraintService.checkHardConstraints(slots),
            randomMove: (slots: TimeSlot[]) => {
                const movable = slots.filter(s => !s.isLocked);
                if (movable.length < 2) return null;

                const roll = Math.random();
                if (roll < 0.35) return this.swapMove(slots, movable);
                if (roll < 0.7) return this.relocateMove(slots, movable);
                return this.consolidateTeacherMove(slots, movable);
            },
        };
    }

    private swapMove(slots: TimeSlot[], movable: TimeSlot[]): Move | null {
        const a = movable[Math.floor(Math.random() * movable.length)];
        const b = movable[Math.floor(Math.random() * movable.length)];

        if (a === b) return null;
        if (a.day === b.day && a.period === b.period) return null;
        if (!this.canSwapPositions(slots, a, b)) return null;

        this.swapPositions(a, b);
        return {
            key: `swap:${[a.classId, b.classId].sort().join('|')}`,
            undo: () => this.swapPositions(a, b),
        };
    }

    private relocateMove(slots: TimeSlot[], movable: TimeSlot[]): Move | null {
        const slot = movable[Math.floor(Math.random() * movable.length)];
        const before = { day: slot.day, period: slot.period };
        const undo = this.tryRelocateMove(slots, [slot]);
        if (!undo) return null;

        return { key: `move:${slot.classId}:${before.day}-${before.period}`, undo };
    }

    private consolidateTeacherMove(slots: TimeSlot[], movable: TimeSlot[]): Move | null {
        const undo = this.tryConsolidateTeacherMove(slots, movable);
        if (!undo) return null;
        return { key: `consolidate:${Math.random().toString(36).slice(2, 8)}`, undo };
    }

    /** Trade two periods; returns an undo callback, or null when the swap is illegal. */
    private trySwapMove(slots: TimeSlot[], movable: TimeSlot[]): (() => void) | null {
        const a = movable[Math.floor(Math.random() * movable.length)];
        const b = movable[Math.floor(Math.random() * movable.length)];

        if (a === b) return null;
        if (a.day === b.day && a.period === b.period) return null;
        if (!this.canSwapPositions(slots, a, b)) return null;

        this.swapPositions(a, b);
        return () => this.swapPositions(a, b);
    }

    /**
     * Take a period out of the session where a teacher has the least to do and put it in
     * a session they already attend. Random relocation stumbles onto this occasionally;
     * aiming at the teacher's lightest session finds it far more often, and cutting a
     * whole trip to school is the single biggest quality win left.
     */
    private tryConsolidateTeacherMove(slots: TimeSlot[], movable: TimeSlot[]): (() => void) | null {
        const seed = movable[Math.floor(Math.random() * movable.length)];
        const own = movable.filter(s => s.teacherId === seed.teacherId);
        if (own.length < 2) return null;

        const bySession = new Map<string, TimeSlot[]>();
        for (const s of own) {
            const key = `${s.day}|${s.period <= 5 ? 0 : 1}`;
            if (!bySession.has(key)) bySession.set(key, []);
            bySession.get(key)!.push(s);
        }
        if (bySession.size < 2) return null;

        const sessions = [...bySession.entries()].sort((a, b) => a[1].length - b[1].length);
        const [lightestKey, lightestSlots] = sessions[0];
        const victim = lightestSlots[Math.floor(Math.random() * lightestSlots.length)];

        for (const [key, group] of sessions) {
            if (key === lightestKey) continue;

            const host = group[0];
            const [minP, maxP] = host.period <= 5 ? [1, 5] : [6, 10];
            if (!this.sameSession(victim.period, host.period)) continue;

            for (let period = minP; period <= maxP; period++) {
                if (!this.isCellAllowed(host.day, period)) continue;
                if (this.isSlotOccupied(slots, victim.classId, host.day, period)) continue;
                if (this.constraintService.isTeacherBusy(victim.teacherId, host.day, period)) continue;

                const clash = slots.some(s =>
                    s !== victim && s.day === host.day && s.period === period &&
                    s.teacherId === victim.teacherId);
                if (clash) continue;

                const oldDay = victim.day;
                const oldPeriod = victim.period;
                victim.day = host.day;
                victim.period = period;

                return () => {
                    victim.day = oldDay;
                    victim.period = oldPeriod;
                };
            }
        }
        return null;
    }

    /** Move one period into a cell its class leaves empty; returns an undo callback. */
    private tryRelocateMove(slots: TimeSlot[], movable: TimeSlot[]): (() => void) | null {
        const slot = movable[Math.floor(Math.random() * movable.length)];
        const [minP, maxP] = slot.period <= 5 ? [1, 5] : [6, 10];

        const day = 2 + Math.floor(Math.random() * 6);
        const period = minP + Math.floor(Math.random() * (maxP - minP + 1));

        if (day === slot.day && period === slot.period) return null;
        if (!this.isCellAllowed(day, period)) return null;
        if (this.constraintService.isTeacherBusy(slot.teacherId, day, period)) return null;
        if (this.constraintService.isRoomTypeFull(slot.subjectId, day, period, slots)) return null;

        const blocked = slots.some(s =>
            s !== slot &&
            s.day === day && s.period === period &&
            (s.classId === slot.classId || s.teacherId === slot.teacherId));
        if (blocked) return null;

        const oldDay = slot.day;
        const oldPeriod = slot.period;
        slot.day = day;
        slot.period = period;

        return () => {
            slot.day = oldDay;
            slot.period = oldPeriod;
        };
    }

    private calculateFitness(slots: any[]): number {
        const hardViolations = this.constraintService.checkHardConstraints(slots);
        const softPenalty = this.constraintService.calculatePenalty(slots);
        return 1000 - (hardViolations * 100) - softPenalty;
    }

    /**
     * Two attempts can converge on exactly the same schedule. Presenting those as
     * separate options would be a false choice, so compare placements and keep one.
     */
    private distinctVariants<T extends { slots: TimeSlot[] }>(candidates: T[]): T[] {
        const seen = new Set<string>();
        const unique: T[] = [];

        for (const candidate of candidates) {
            const fingerprint = candidate.slots
                .map(s => `${s.classId}:${s.day}:${s.period}:${s.subjectId}`)
                .sort()
                .join('|');

            if (seen.has(fingerprint)) continue;
            seen.add(fingerprint);
            unique.push(candidate);
        }
        return unique;
    }

    private isSlotOccupied(slots: any[], classId: string, day: number, period: number): boolean {
        return slots.some(s => s.classId === classId && s.day === day && s.period === period);
    }

    private shuffleArray(array: any[]) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /**
     * Split generated slots into those that can be persisted and those that would break
     * one of the three unique indexes (class / teacher / room per time slot).
     *
     * Detecting the clash here rather than letting `skipDuplicates` swallow it is what
     * keeps the stored timetable and the reported score describing the same thing.
     * Note that a null room_id does not participate in the room index, mirroring how
     * Postgres treats NULL in a unique constraint.
     */
    private partitionSlots(slots: TimeSlot[]) {
        const classKeys = new Set<string>();
        const teacherKeys = new Set<string>();
        const roomKeys = new Set<string>();

        const accepted: TimeSlot[] = [];
        const rejected: Array<{ slot: TimeSlot; reason: string }> = [];

        for (const s of slots) {
            const time = `${s.day}-${s.period}`;
            const classKey = `${s.classId}|${time}`;
            const teacherKey = `${s.teacherId}|${time}`;
            const roomKey = s.roomId ? `${s.roomId}|${time}` : null;

            let reason: string | null = null;
            if (classKeys.has(classKey)) reason = 'lớp đã có tiết khác cùng giờ';
            else if (teacherKeys.has(teacherKey)) reason = 'giáo viên đã dạy lớp khác cùng giờ';
            else if (roomKey && roomKeys.has(roomKey)) reason = 'phòng đã được lớp khác dùng';

            if (reason) {
                rejected.push({ slot: s, reason });
                continue;
            }

            classKeys.add(classKey);
            teacherKeys.add(teacherKey);
            if (roomKey) roomKeys.add(roomKey);
            accepted.push(s);
        }

        return { accepted, rejected };
    }

    private async saveToDatabase(semesterId: string, solution: any, data: any, log: (msg: string) => void, label?: string) {
        const generated = solution.slots.length;
        const { accepted, rejected } = this.partitionSlots(solution.slots);

        if (rejected.length > 0) {
            log(`[WARN] ${rejected.length} tiết bị từ chối vì vi phạm ràng buộc duy nhất:`);
            const SHOWN = 20;
            for (const r of rejected.slice(0, SHOWN)) {
                const className = data.classes.find((c: any) => c.id === r.slot.classId)?.name ?? r.slot.classId;
                const subjectName = data.subjects.find((s: any) => s.id === r.slot.subjectId)?.name ?? r.slot.subjectId;
                log(`[WARN]   Thứ ${r.slot.day} tiết ${r.slot.period} · ${className} · ${subjectName} — ${r.reason}`);
            }
            if (rejected.length > SHOWN) {
                log(`[WARN]   ... và ${rejected.length - SHOWN} tiết khác`);
            }
        }

        const timetable = await this.prisma.generatedTimetable.create({
            data: {
                name: label ? `${label} — ${new Date().toLocaleString('vi-VN')}`
                            : `TKB ${new Date().toLocaleString('vi-VN')}`,
                semester_id: semesterId,
            }
        });
        log(`[DEBUG] Header Created: ${timetable.id}`);

        if (accepted.length > 0) {
            await this.prisma.timetableSlot.createMany({
                data: accepted.map((s: TimeSlot) => ({
                    timetable_id: timetable.id,
                    class_id: s.classId,
                    subject_id: s.subjectId,
                    teacher_id: s.teacherId,
                    room_id: s.roomId,
                    day: s.day,
                    period: s.period,
                    is_locked: s.isLocked || false,
                })),
            });
        } else {
            log('[WARN] Không có tiết nào để lưu!');
        }

        // Score the timetable that actually exists, not the one held in memory
        const stored = await this.prisma.timetableSlot.findMany({
            where: { timetable_id: timetable.id }
        });
        const storedSlots: TimeSlot[] = stored.map(s => ({
            id: s.id,
            day: s.day,
            period: s.period,
            classId: s.class_id,
            subjectId: s.subject_id,
            teacherId: s.teacher_id,
            roomId: s.room_id ?? undefined,
            isLocked: s.is_locked,
        }));

        const fitness = this.constraintService.getFitnessDetails(storedSlots);

        await this.prisma.generatedTimetable.update({
            where: { id: timetable.id },
            data: { fitness_score: fitness.score }
        });

        log(`[DEBUG] Sinh ${generated} tiết → lưu ${stored.length} tiết → từ chối ${rejected.length} tiết.`);
        log(`[DEBUG] Điểm chấm trên dữ liệu đã lưu: ${fitness.score} — ${fitness.isValid ? 'HỢP LỆ' : 'KHÔNG HỢP LỆ'}`);
        fitness.details.forEach((d: string) => log(`[DEBUG]   ${d}`));

        return {
            id: timetable.id,
            fitness,
            stats: { generated, saved: stored.length, rejected: rejected.length },
        };
    }

    async moveSlot(data: { slotId: string, newDay: number, newPeriod: number }, actor: Actor = { name: 'Hệ thống' }) {
        const { slotId, newDay, newPeriod } = data;

        const sourceSlot = await this.prisma.timetableSlot.findUnique({ where: { id: slotId } });
        if (!sourceSlot) throw new NotFoundException('Không tìm thấy tiết học.');
        if (sourceSlot.is_locked) {
            throw new BadRequestException('Tiết này đang bị khóa, hãy mở khóa trước khi di chuyển.');
        }

        const targetSlot = await this.prisma.timetableSlot.findFirst({
            where: {
                timetable_id: sourceSlot.timetable_id,
                class_id: sourceSlot.class_id,
                day: newDay,
                period: newPeriod,
            },
        });

        // The table has three unique indexes - class, teacher and room per time slot.
        // Checking only the class let a drag that double-books a teacher through, where
        // it surfaced as a raw Prisma error the UI could not explain.
        await this.assertMoveIsLegal(sourceSlot, newDay, newPeriod, targetSlot?.id);
        if (targetSlot) {
            if (targetSlot.is_locked) {
                throw new BadRequestException('Tiết ở vị trí đích đang bị khóa.');
            }
            await this.assertMoveIsLegal(targetSlot, sourceSlot.day, sourceSlot.period, sourceSlot.id);
        }

        const touched = [sourceSlot.id, targetSlot?.id].filter(Boolean) as string[];
        const before = await this.changeLog.snapshot(touched);

        if (targetSlot) {
            // Park the source out of the way so the swap never trips a unique index
            await this.prisma.$transaction(async (tx) => {
                await tx.timetableSlot.update({
                    where: { id: sourceSlot.id },
                    data: { day: -1, period: -1 },
                });
                await tx.timetableSlot.update({
                    where: { id: targetSlot.id },
                    data: { day: sourceSlot.day, period: sourceSlot.period, is_locked: true },
                });
                await tx.timetableSlot.update({
                    where: { id: sourceSlot.id },
                    data: { day: newDay, period: newPeriod, is_locked: true },
                });
            });
        } else {
            await this.prisma.timetableSlot.update({
                where: { id: sourceSlot.id },
                data: { day: newDay, period: newPeriod, is_locked: true },
            });
        }

        await this.changeLog.record({
            timetableId: sourceSlot.timetable_id,
            slotId: sourceSlot.id,
            actor,
            action: targetSlot ? ChangeAction.SWAP : ChangeAction.MOVE,
            description: targetSlot
                ? `Hoán đổi tiết Thứ ${sourceSlot.day}/tiết ${sourceSlot.period} với Thứ ${newDay}/tiết ${newPeriod}`
                : `Chuyển tiết từ Thứ ${sourceSlot.day}/tiết ${sourceSlot.period} sang Thứ ${newDay}/tiết ${newPeriod}`,
            before,
            after: await this.changeLog.snapshot(touched),
        });

        return { success: true };
    }

    /** Reject a move that would put a teacher or a room in two places at once. */
    private async assertMoveIsLegal(
        slot: { id: string; timetable_id: string; teacher_id: string; room_id: number | null },
        day: number,
        period: number,
        ignoreSlotId?: string,
    ) {
        const ignore = [slot.id, ignoreSlotId].filter(Boolean) as string[];

        const teacherClash = await this.prisma.timetableSlot.findFirst({
            where: {
                timetable_id: slot.timetable_id,
                teacher_id: slot.teacher_id,
                day,
                period,
                id: { notIn: ignore },
            },
            include: { class: true },
        });
        if (teacherClash) {
            throw new BadRequestException(
                `Giáo viên đã có tiết ở lớp ${teacherClash.class?.name ?? ''} vào Thứ ${day} tiết ${period}.`,
            );
        }

        if (slot.room_id) {
            const roomClash = await this.prisma.timetableSlot.findFirst({
                where: {
                    timetable_id: slot.timetable_id,
                    room_id: slot.room_id,
                    day,
                    period,
                    id: { notIn: ignore },
                },
                include: { class: true, room: true },
            });
            if (roomClash) {
                throw new BadRequestException(
                    `Phòng ${roomClash.room?.name ?? ''} đã được lớp ${roomClash.class?.name ?? ''} sử dụng vào Thứ ${day} tiết ${period}.`,
                );
            }
        }
    }

    async toggleLock(slotId: string, actor: Actor = { name: 'Hệ thống' }) {
        const slot = await this.prisma.timetableSlot.findUnique({ where: { id: slotId } });
        if (!slot) throw new NotFoundException('Không tìm thấy tiết học.');

        const before = await this.changeLog.snapshot([slotId]);
        const updated = await this.prisma.timetableSlot.update({
            where: { id: slotId },
            data: { is_locked: !slot.is_locked }
        });

        await this.changeLog.record({
            timetableId: slot.timetable_id,
            slotId,
            actor,
            action: updated.is_locked ? ChangeAction.LOCK : ChangeAction.UNLOCK,
            description: `${updated.is_locked ? 'Khóa' : 'Mở khóa'} tiết Thứ ${slot.day}/tiết ${slot.period}`,
            before,
            after: await this.changeLog.snapshot([slotId]),
        });

        return { success: true, is_locked: updated.is_locked };
    }
}
