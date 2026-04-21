
import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConstraintService, TimeSlot } from './constraint.service';

interface AlgorithmRunOptions {
    generations: number;
    restarts: number;
    initialTemperature: number;
    coolingRate: number;
    reheatThreshold: number;
}

@Injectable()
export class AlgorithmService {
    private readonly logger = new Logger(AlgorithmService.name);

    constructor(
        private prisma: PrismaService,
        private constraintService: ConstraintService
    ) { }

    async runAlgorithm(
        semesterId: string,
        rawOptions?: Partial<Pick<AlgorithmRunOptions, 'generations' | 'restarts'>>
    ) {
        const debugLogs: string[] = [];
        const log = (msg: string) => {
            this.logger.log(msg);
            debugLogs.push(msg);
        };

        try {
            log(`[DEBUG] Starting Algorithm for Semester: ${semesterId}`);
            const options = this.normalizeRunOptions(rawOptions);
            log(
                `[DEBUG] Options: generations=${options.generations}, restarts=${options.restarts}, initialTemperature=${options.initialTemperature}, coolingRate=${options.coolingRate}`
            );

            // 0. Load Cache & Data
            await this.constraintService.initialize(semesterId);
            const data = await this.loadData(semesterId);
            log(`[DEBUG] Data Loaded: ${data.classes.length} Classes, ${data.subjects.length} Subjects.`);

            // 1.1 Load User-Locked Slots from Previous Timetable (If exists)
            const prevTimetable = await this.prisma.generatedTimetable.findFirst({
                where: { semester_id: semesterId },
                orderBy: { created_at: 'desc' },
                include: { slots: { where: { is_locked: true } } }
            });

            const lockedSlots: TimeSlot[] = [];
            if (prevTimetable && prevTimetable.slots.length > 0) {
                log(`[INFO] Found ${prevTimetable.slots.length} locked slots from previous run. Preserving...`);
                prevTimetable.slots.forEach(s => {
                    lockedSlots.push({
                        id: s.id,
                        day: s.day,
                        period: s.period,
                        classId: s.class_id,
                        subjectId: s.subject_id,
                        teacherId: s.teacher_id,
                        roomId: s.room_id || undefined,
                        isLocked: true
                    });
                });
            }

            // 2. Phase 1: Fixed Slots (Chào Cờ, SHCN)
            let bestSolution: any = null;
            let bestFitnessResult: any = null;

            for (let attempt = 1; attempt <= options.restarts; attempt++) {
                const attemptPrefix = `[ATTEMPT ${attempt}/${options.restarts}]`;
                log(`${attemptPrefix} Initializing solution...`);

                const solution = this.initializeSolution(data);
                lockedSlots.forEach((slot) => {
                    solution.slots.push({ ...slot });
                });

                await this.phase1_FixedSlots(solution, data, (msg) => log(`${attemptPrefix} ${msg}`));
                this.phase2_Heuristic(solution, data);
                await this.phase3_Genetic(solution, data, options, (msg) => log(`${attemptPrefix} ${msg}`));

                const fitnessResult = this.constraintService.getFitnessDetails(solution.slots);
                (solution as any).fitness_score = fitnessResult.score;
                log(`${attemptPrefix} Finished with fitness ${fitnessResult.score}.`);

                if (!bestSolution || fitnessResult.score > bestFitnessResult.score) {
                    bestSolution = {
                        ...solution,
                        slots: solution.slots.map((slot: TimeSlot) => ({ ...slot })),
                    };
                    bestFitnessResult = fitnessResult;
                    log(`${attemptPrefix} New best solution.`);
                }
            }

            if (!bestSolution || !bestFitnessResult) {
                throw new Error('Algorithm did not produce any solution.');
            }

            log(`[DEBUG] Saving ${bestSolution.slots.length} slots to database...`);
            const timetable = await this.saveToDatabase(semesterId, bestSolution, data, log);

            return { ...timetable, debugLogs, fitnessDetails: bestFitnessResult.details, success: true };

        } catch (error: any) {
            log(`[ERROR] Algorithm Failed: ${error.message}`);
            if (error.stack) log(`[ERROR] Stack: ${error.stack}`);
            return { debugLogs, success: false, error: error.message };
        }
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

    private normalizeRunOptions(
        rawOptions?: Partial<Pick<AlgorithmRunOptions, 'generations' | 'restarts'>>
    ): AlgorithmRunOptions {
        const normalizeInteger = (value: unknown, fallback: number, min: number, max: number) => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return fallback;
            return Math.min(max, Math.max(min, Math.trunc(parsed)));
        };

        return {
            generations: normalizeInteger(rawOptions?.generations, 800, 100, 5000),
            restarts: normalizeInteger(rawOptions?.restarts, 1, 1, 20),
            initialTemperature: 100,
            coolingRate: 0.995,
            reheatThreshold: 50,
        };
    }

    private async phase1_FixedSlots(solution: any, data: any, log: (msg: string) => void) {
        const { classes, subjects, teachers } = data;

        const subjectCodeMap = new Map<string, number>();
        subjects.forEach((s: any) => subjectCodeMap.set(s.code, s.id));

        const resolveSubjectId = (code: string) => {
            if (subjectCodeMap.has(code)) return subjectCodeMap.get(code);
            if (code === 'SH_CN') return subjectCodeMap.get('SHCN');
            if (code === 'SINH_HOAT') return subjectCodeMap.get('SHCN');
            return undefined;
        };

        // Chào cờ: ưu tiên dùng GVCN cho mỗi lớp, fallback sang GV đầu tiên
        const bghTeacher = teachers.find((t: any) => t.code === 'BGH');
        const fallbackTeacherId = bghTeacher ? bghTeacher.id : null;

        let fixedCount = 0;

        for (const cls of classes) {
            const gradeMatches = cls.name.match(/\d+/);
            const grade = gradeMatches ? parseInt(gradeMatches[0]) : 0;
            const isMorning = [12, 10].includes(grade);
            const session = isMorning ? 'SANG' : 'CHIEU';

            for (let d = 2; d <= 7; d++) {
                for (let p = 1; p <= 10; p++) {
                    if (isMorning && p > 5) continue;
                    if (!isMorning && p <= 5) continue;

                    // CHECK IF OCCUPIED (e.g. User Locked)
                    if (this.isSlotOccupied(solution.slots, cls.id, d, p)) continue;

                    const check = this.constraintService.checkFixedSlot(d, p, grade, session);

                    if (check.isFixed && check.subjectCode) {
                        let subjId = resolveSubjectId(check.subjectCode);
                        let teacherId = null;

                        // SPECIAL HANDLER: GVCN Teaching Slot
                        if (check.subjectCode === 'GVCN_TEACHING') {
                            const homeroomId = cls.homeroom_teacher_id;
                            if (homeroomId) {
                                const assignment = data.assignments.find((a: any) => {
                                    if (a.class_id !== cls.id || a.teacher_id !== homeroomId) return false;
                                    const subj = data.subjects.find((s: any) => s.id === a.subject_id);
                                    return subj && !subj.is_special;
                                });

                                if (assignment) {
                                    subjId = assignment.subject_id;
                                    teacherId = homeroomId;
                                } else {
                                    log(`[WARNING] GVCN (ID: ${homeroomId}) does not teach any Cultural Subject for Class ${cls.name}.`);
                                }
                            }
                        }

                        if (subjId) {
                            // Assign Teacher
                            if (['SHCN', 'SH_CN', 'SINH_HOAT', 'SH_DAU_TUAN', 'SH_CUOI_TUAN'].includes(check.subjectCode)) {
                                teacherId = cls.homeroom_teacher_id;
                            } else if (check.subjectCode === 'CHAO_CO') {
                                // Chào cờ: dùng GVCN của lớp để tránh conflict khi 1 GV dạy nhiều lớp cùng lúc
                                teacherId = cls.homeroom_teacher_id || fallbackTeacherId;
                            } else if (['GDDP', 'HDTN'].includes(check.subjectCode)) {
                                const assignment = data.assignments.find((a: any) =>
                                    a.class_id === cls.id && a.subject_id === subjId
                                );
                                if (assignment) teacherId = assignment.teacher_id;
                            }

                            if (!teacherId) teacherId = cls.homeroom_teacher_id || fallbackTeacherId || (teachers[0] ? teachers[0].id : null);

                            // Assign Room
                            let roomId = cls.fixed_room_id;
                            // If Chào Cờ, force 'undefined' (or logic mapping to YARD)
                            if (check.subjectCode === 'CHAO_CO') {
                                roomId = undefined;
                            }

                            if (teacherId) {
                                const slot: TimeSlot = {
                                    day: d,
                                    period: p,
                                    classId: cls.id,
                                    subjectId: subjId,
                                    teacherId: teacherId,
                                    roomId: roomId,
                                    isLocked: true
                                };
                                solution.slots.push(slot);
                                fixedCount++;
                            }
                        }
                    }
                }
            }
        }
        log(`[DEBUG] Phase 1: Generated ${fixedCount} fixed slots.`);
    }

    private phase2_Heuristic(solution: any, data: any) {
        this.logger.log('Phase 2: Heuristic Filling with Block Scheduling...');
        const { classes, assignments } = data;

        const classAssignments = new Map<string, any[]>();
        assignments.forEach((agg: any) => {
            const subject = data.subjects.find((s: any) => s.id === agg.subject_id);
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
            for (const assign of clsAssignments) {
                const subject = data.subjects.find((s: any) => s.id === assign.subject_id);
                // GDQP, GDTC => Opposite Session
                const isOpposite = subject && (subject.code === 'GDQP' || subject.code === 'GDTC');

                const alreadyAssigned = solution.slots.filter((s: any) =>
                    s.classId === cls.id && s.subjectId === assign.subject_id
                ).length;

                const remainingNeeded = Math.max(0, assign.total_periods - alreadyAssigned);
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
                // GDTC/GDQP: Morning (1-3), Afternoon (8-10)
                const minP = isMorningMain ? 8 : 1;
                const maxP = isMorningMain ? 10 : 3;
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
                            if (day === 2 && p === 1) return false;
                            // Thursday: Only periods 1, 2 (Morning) and 6, 7 (Afternoon) allowed
                            if (day === 5 && (p === 3 || p === 4 || p === 5 || p === 8 || p === 9 || p === 10)) return false;

                            // Occupied?
                            if (this.isSlotOccupied(solution.slots, cls.id, day, p)) return false;
                            // Teacher Busy?
                            if (this.constraintService.checkTeacherConflict({ day, period: p, teacherId: assign.teacher_id } as any, solution.slots)) return false;

                            return true;
                        });

                        if (canPlace) {
                            // EXECUTE PLACEMENT
                            periodsToCheck.forEach(p => {
                                // GDTC/GDQP học tại sân bãi, không dùng phòng học vật lý (tránh lỗi unique_room_slot)
                                const subject = data.subjects.find((s: any) => s.id === assign.subject_id);
                                const isYardSubject = subject && ['GDTC', 'GDQP'].includes(subject.code);
                                solution.slots.push({
                                    id: crypto.randomUUID(),
                                    day, period: p,
                                    classId: cls.id,
                                    subjectId: assign.subject_id,
                                    teacherId: assign.teacher_id,
                                    roomId: isYardSubject ? undefined : cls.fixed_room_id,
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
                    if (day === 2 && period === 1) continue;
                    // Thursday: Only periods 1, 2 (Morning) and 6, 7 (Afternoon) allowed
                    if (day === 5 && (period === 3 || period === 4 || period === 5 || period === 8 || period === 9 || period === 10)) continue;

                    // Try to assign
                    let placed = false;
                    for (let pass = 0; pass < 2; pass++) {
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
                            
                            // Check Heavy Subject conflict for this session
                            const heavyCodes = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH', 'LY', 'VAT_LY', 'HOA', 'HOA_HOC'];
                            const subjCode = this.constraintService.getSubjectCode(assign.subject_id);
                            if (pass === 0 && heavyCodes.some(h => subjCode.includes(h))) {
                                const sessionSlots = solution.slots.filter((s: any) => {
                                    if (s.classId !== cls.id || s.day !== day) return false;
                                    const isSameSession = isMorningPeriod ? (s.period <= 5) : (s.period > 5);
                                    return isSameSession;
                                });

                                // Check 1: Another DIFFERENT heavy subject already in this session
                                const hasOtherHeavy = sessionSlots.some((s: any) => {
                                    const existingCode = this.constraintService.getSubjectCode(s.subjectId);
                                    if (existingCode === subjCode) return false;
                                    return heavyCodes.some(h => existingCode.includes(h));
                                });
                                if (hasOtherHeavy) continue;

                                // Check 2: Same heavy subject already has >=2 periods in this session
                                const sameSubjectCount = sessionSlots.filter((s: any) =>
                                    this.constraintService.getSubjectCode(s.subjectId) === subjCode
                                ).length;
                                if (sameSubjectCount >= 2) continue;

                                // Check 3: Would create >2 consecutive same-subject periods
                                const dayClassSlots = solution.slots
                                    .filter((s: any) => s.classId === cls.id && s.day === day)
                                    .map((s: any) => ({ period: s.period, subjectId: s.subjectId }));
                                dayClassSlots.push({ period, subjectId: assign.subject_id });
                                dayClassSlots.sort((a: any, b: any) => a.period - b.period);

                                let maxConsec = 1;
                                let curConsec = 1;
                                for (let k = 1; k < dayClassSlots.length; k++) {
                                    if (dayClassSlots[k].subjectId === dayClassSlots[k - 1].subjectId &&
                                        dayClassSlots[k].period === dayClassSlots[k - 1].period + 1) {
                                        curConsec++;
                                        maxConsec = Math.max(maxConsec, curConsec);
                                    } else {
                                        curConsec = 1;
                                    }
                                }
                                if (maxConsec > 2) continue;
                            }

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
                            placed = true;
                            break;
                        }
                        if (placed) break;
                    }
                }
            }

            if (mainSessionSlots.length > 0 || oppositeGeneralSlots.length > 0) {
                this.logger.warn(`[WARNING] Class ${cls.name}: Incomplete Schedule. Remaining: ${mainSessionSlots.length} Main, ${oppositeGeneralSlots.length} Opposite.`);
            }
        }
    }

    private async phase3_Genetic(
        solution: any,
        data: any,
        options: AlgorithmRunOptions,
        log?: (msg: string) => void
    ) {
        const emit = log ?? ((msg: string) => this.logger.log(msg));
        emit('Phase 3: Genetic Optimization with Simulated Annealing...');
        let currentSlots = [...solution.slots];
        let bestScore = this.calculateFitness(currentSlots);
        let bestSlots = currentSlots.map(s => ({ ...s }));
        emit(`Initial Fitness: ${bestScore}`);

        const GENERATIONS = options.generations;
        let temperature = options.initialTemperature;
        const coolingRate = options.coolingRate;
        let stagnation = 0;

        for (let gen = 0; gen < GENERATIONS; gen++) {
            const conflicts = this.getConflicts(currentSlots);
            if (conflicts.length === 0 && bestScore >= 0) {
                emit(`[GA] Converged at generation ${gen} with score ${bestScore}`);
                break;
            }

            // Choose a problematic slot to fix
            const candidateSlot = conflicts.length > 0
                ? conflicts[Math.floor(Math.random() * conflicts.length)]
                : currentSlots.filter(s => !s.isLocked)[Math.floor(Math.random() * currentSlots.filter(s => !s.isLocked).length)];

            if (!candidateSlot || candidateSlot.isLocked) continue;

            // With 30% chance, try cross-class swap for teacher conflicts
            let targetSlot: any = null;
            if (Math.random() < 0.3) {
                // Cross-class swap: find another unlocked slot with same teacher at a different time
                const crossCandidates = currentSlots.filter(s =>
                    !s.isLocked &&
                    s.id !== candidateSlot.id &&
                    s.classId !== candidateSlot.classId
                );
                if (crossCandidates.length > 0) {
                    targetSlot = crossCandidates[Math.floor(Math.random() * crossCandidates.length)];
                }
            }

            if (!targetSlot) {
                // Same-class swap (original behavior)
                const classSlots = currentSlots.filter(s => s.classId === candidateSlot.classId && !s.isLocked);
                targetSlot = classSlots[Math.floor(Math.random() * classSlots.length)];
            }

            if (targetSlot && targetSlot.id !== candidateSlot.id) {
                const tempDay = candidateSlot.day;
                const tempPeriod = candidateSlot.period;
                candidateSlot.day = targetSlot.day;
                candidateSlot.period = targetSlot.period;
                targetSlot.day = tempDay;
                targetSlot.period = tempPeriod;

                const newScore = this.calculateFitness(currentSlots);

                // Simulated Annealing: accept worse solutions with decreasing probability
                const delta = newScore - bestScore;
                if (delta > 0) {
                    bestScore = newScore;
                    bestSlots = currentSlots.map(s => ({ ...s }));
                    stagnation = 0;
                } else if (Math.random() < Math.exp(delta / temperature)) {
                    // Accept worse solution to escape local minimum
                    stagnation++;
                } else {
                    // Revert swap
                    targetSlot.period = candidateSlot.period;
                    targetSlot.day = candidateSlot.day;
                    candidateSlot.day = tempDay;
                    candidateSlot.period = tempPeriod;
                    stagnation++;
                }
            }

            // Cool down temperature
            temperature *= coolingRate;

            // If stagnating too long, reheat
            if (stagnation > options.reheatThreshold) {
                temperature = Math.max(temperature, 30);
                stagnation = 0;
            }

            if (gen % 100 === 0 || gen === GENERATIONS - 1) {
                emit(`[GA] Gen ${gen}: Score=${bestScore}, Temp=${temperature.toFixed(2)}, Conflicts=${conflicts.length}`);
            }
        }

        // Restore best found solution
        solution.fitness_score = bestScore;
        solution.slots = bestSlots;
    }

    private calculateFitness(slots: any[]): number {
        const hardViolations = this.constraintService.checkHardConstraints(slots);
        const softPenalty = this.constraintService.calculatePenalty(slots);
        return 1000 - (hardViolations * 100) - softPenalty;
    }

    private getConflicts(slots: any[]): any[] {
        const conflictedSlots: any[] = [];

        // Teacher conflicts
        const teacherMap = new Map<string, any[]>();
        slots.forEach(s => {
            const key = `teacher-${s.teacherId}-${s.day}-${s.period}`;
            if (!teacherMap.has(key)) teacherMap.set(key, []);
            teacherMap.get(key)!.push(s);
        });
        teacherMap.forEach(group => {
            if (group.length > 1) conflictedSlots.push(...group);
        });

        // Class conflicts
        const classMap = new Map<string, any[]>();
        slots.forEach(s => {
            const key = `class-${s.classId}-${s.day}-${s.period}`;
            if (!classMap.has(key)) classMap.set(key, []);
            classMap.get(key)!.push(s);
        });
        classMap.forEach(group => {
            if (group.length > 1) conflictedSlots.push(...group);
        });

        // Teacher busy time violations
        for (const s of slots) {
            if (this.constraintService.isTeacherBusy(s.teacherId, s.day, s.period)) {
                conflictedSlots.push(s);
            }
        }

        return conflictedSlots;
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

    private async saveToDatabase(semesterId: string, solution: any, data: any, log: (msg: string) => void) {
        try {
            const timetable = await this.prisma.generatedTimetable.create({
                data: {
                    name: `TKB ${new Date().toLocaleString('vi-VN')}`,
                    semester_id: semesterId,
                    fitness_score: solution.fitness_score,
                }
            });
            log(`[DEBUG] Header Created: ${timetable.id}`);

            const slotsToCreate = solution.slots.map((s: TimeSlot) => ({
                timetable_id: timetable.id,
                class_id: s.classId,
                subject_id: s.subjectId,
                teacher_id: s.teacherId,
                room_id: s.roomId,
                day: s.day,
                period: s.period,
                is_locked: s.isLocked || false,
            }));

            if (slotsToCreate.length > 0) {
                const batch = await this.prisma.timetableSlot.createMany({
                    data: slotsToCreate,
                    skipDuplicates: true
                });
                log(`[DEBUG] Inserted ${batch.count} slots.`);
            } else {
                log('[DEBUG] No slots to insert!');
            }

            return { success: true, id: timetable.id };
        } catch (e) {
            log(`[DEBUG] Save Failed: ${e}`);
            throw e;
        }
    }

    async moveSlot(data: { slotId: string, newDay: number, newPeriod: number }) {
        const { slotId, newDay, newPeriod } = data;

        const sourceSlot = await this.prisma.timetableSlot.findUnique({
            where: { id: slotId }
        });
        if (!sourceSlot) throw new Error('Slot not found');

        const targetSlot = await this.prisma.timetableSlot.findFirst({
            where: {
                timetable_id: sourceSlot.timetable_id,
                class_id: sourceSlot.class_id,
                day: newDay,
                period: newPeriod
            }
        });

        if (targetSlot) {
            // SWAP with sequential transaction to avoid unique constraint violations
            await this.prisma.$transaction(async (tx) => {
                // 1. Move Source to temp position
                await tx.timetableSlot.update({
                    where: { id: sourceSlot.id },
                    data: { day: 0, period: 0 }
                });
                // 2. Move Target to Source's original position
                await tx.timetableSlot.update({
                    where: { id: targetSlot.id },
                    data: { day: sourceSlot.day, period: sourceSlot.period, is_locked: true }
                });
                // 3. Move Source to Target's original position
                await tx.timetableSlot.update({
                    where: { id: sourceSlot.id },
                    data: { day: newDay, period: newPeriod, is_locked: true }
                });
            });
        } else {
            await this.prisma.timetableSlot.update({
                where: { id: sourceSlot.id },
                data: { day: newDay, period: newPeriod, is_locked: true }
            });
        }

        return { success: true };
    }
    async toggleLock(slotId: string) {
        const slot = await this.prisma.timetableSlot.findUnique({ where: { id: slotId } });
        if (!slot) throw new Error('Slot not found');

        const updated = await this.prisma.timetableSlot.update({
            where: { id: slotId },
            data: { is_locked: !slot.is_locked }
        });
        return { success: true, is_locked: updated.is_locked };
    }

    async clearSchedule(semesterId: string) {
        await this.prisma.generatedTimetable.deleteMany({
            where: { semester_id: semesterId }
        });
        return { success: true };
    }
}
