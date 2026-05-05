
import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConstraintService, TimeSlot } from './constraint.service';

@Injectable()
export class AlgorithmService {
    private readonly logger = new Logger(AlgorithmService.name);

    constructor(
        private prisma: PrismaService,
        private constraintService: ConstraintService
    ) { }

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

            // 1. Initialize Solution
            const solution = this.initializeSolution(data);

            // 1.1 Load User-Locked Slots from Previous Timetable (If exists)
            const prevTimetable = await this.prisma.generatedTimetable.findFirst({
                where: { semester_id: semesterId },
                orderBy: { created_at: 'desc' },
                include: { slots: { where: { is_locked: true, week: 1 } } } // only template week
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
                });
            }

            // 2. Phase 1: Fixed Slots (Chào Cờ, SHCN)
            await this.phase1_FixedSlots(solution, data, log);
            const phase1Slots = solution.slots.map(s => ({ ...s })); // Save Phase 1 result

            // 3. Multi-restart: Run Phase 2+3 multiple times, keep best
            const NUM_RESTARTS = 1;
            let bestSolution = { slots: [] as any[], fitness_score: -Infinity };

            for (let attempt = 0; attempt < NUM_RESTARTS; attempt++) {
                log(`[INFO] Attempt ${attempt + 1}/${NUM_RESTARTS}...`);
                const attemptSolution = { slots: phase1Slots.map(s => ({ ...s })), fitness_score: 0 };

                this.phase2_Heuristic(attemptSolution, data);
                await this.phase3_Genetic(attemptSolution, data);

                log(`[INFO] Attempt ${attempt + 1} Fitness: ${attemptSolution.fitness_score}`);

                if (attemptSolution.fitness_score > bestSolution.fitness_score) {
                    bestSolution = attemptSolution;
                    log(`[INFO] ★ New best! Fitness: ${bestSolution.fitness_score}`);
                }
            }

            solution.slots = bestSolution.slots;
            (solution as any).fitness_score = bestSolution.fitness_score;

            // 5. Save to Database
            log(`[DEBUG] Saving ${solution.slots.length} slots to database...`);

            // Recalculate Final Fitness with Details
            const fitnessResult = this.constraintService.getFitnessDetails(solution.slots);
            (solution as any).fitness_score = fitnessResult.score;

            const timetable = await this.saveToDatabase(semesterId, solution, data, log);

            return { ...timetable, debugLogs, fitnessDetails: fitnessResult.details, fitnessViolations: fitnessResult.violations, success: true };

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
        this.logger.log('Phase 2: Smart Pair-Based Scheduling...');
        const startP2 = Date.now();
        const { classes, assignments } = data;

        // ── O(1) Index structures ──
        const classOccupied = new Set<string>();
        const teacherOccupied = new Set<string>();
        // Block subjects (TOAN/VAN/ANH) count per class-day-session, broken down by code
        const classDaySessionBlock = new Map<string, Map<string, number>>(); // "classId-day-sess" → Map<code,count>
        // Block subject periods per class-day-session (for 3-consecutive check)
        const classDaySessionBlockPeriods = new Map<string, Set<number>>();
        // Track which subjects already placed on which days per class (for spread)
        const classSubjectDays = new Map<string, Set<number>>(); // "classId-subjectId" → Set<day>
        // Track teacher slot count per day-session (for SC7 overload check)
        const teacherDaySessionCount = new Map<string, number>(); // "teacherId-day-session" → count
        // Track total slots per class-day (for fill-to-5 logic)
        const classDayTotals = new Map<string, number>(); // "classId-day" → count

        const heavyCodes = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH', 'LY', 'VAT_LY', 'HOA', 'HOA_HOC'];
        const blockCodes = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH'];
        const priorityCodes = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH'];

        const trackBlock = (classId: string, day: number, period: number, code: string) => {
            if (!blockCodes.some(b => code.includes(b))) return;
            const sess = period <= 5 ? 0 : 1;
            const hk = `${classId}-${day}-${sess}`;
            if (!classDaySessionBlock.has(hk)) classDaySessionBlock.set(hk, new Map());
            const m = classDaySessionBlock.get(hk)!;
            m.set(code, (m.get(code) || 0) + 1);
            if (!classDaySessionBlockPeriods.has(hk)) classDaySessionBlockPeriods.set(hk, new Set());
            classDaySessionBlockPeriods.get(hk)!.add(period);
        };

        // Build index from existing slots (Phase 1 locked slots)
        for (const s of solution.slots) {
            classOccupied.add(`${s.classId}-${s.day}-${s.period}`);
            teacherOccupied.add(`${s.teacherId}-${s.day}-${s.period}`);
            const code = this.constraintService.getSubjectCode(s.subjectId);
            trackBlock(s.classId, s.day, s.period, code);
            const csKey = `${s.classId}-${s.subjectId}`;
            if (!classSubjectDays.has(csKey)) classSubjectDays.set(csKey, new Set());
            classSubjectDays.get(csKey)!.add(s.day);
            const tdsKey = `${s.teacherId}-${s.day}-${s.period <= 5 ? 0 : 1}`;
            teacherDaySessionCount.set(tdsKey, (teacherDaySessionCount.get(tdsKey) || 0) + 1);
            const dtKey = `${s.classId}-${s.day}`;
            classDayTotals.set(dtKey, (classDayTotals.get(dtKey) || 0) + 1);
        }

        const addSlot = (slot: any) => {
            solution.slots.push(slot);
            classOccupied.add(`${slot.classId}-${slot.day}-${slot.period}`);
            teacherOccupied.add(`${slot.teacherId}-${slot.day}-${slot.period}`);
            const code = this.constraintService.getSubjectCode(slot.subjectId);
            trackBlock(slot.classId, slot.day, slot.period, code);
            const csKey = `${slot.classId}-${slot.subjectId}`;
            if (!classSubjectDays.has(csKey)) classSubjectDays.set(csKey, new Set());
            classSubjectDays.get(csKey)!.add(slot.day);
            const tdsKey = `${slot.teacherId}-${slot.day}-${slot.period <= 5 ? 0 : 1}`;
            teacherDaySessionCount.set(tdsKey, (teacherDaySessionCount.get(tdsKey) || 0) + 1);
            const dtKey = `${slot.classId}-${slot.day}`;
            classDayTotals.set(dtKey, (classDayTotals.get(dtKey) || 0) + 1);
        };

        const subjectById = new Map<number, any>();
        data.subjects.forEach((s: any) => subjectById.set(s.id, s));

        const classAssignments = new Map<string, any[]>();
        assignments.forEach((agg: any) => {
            const subject = subjectById.get(agg.subject_id);
            if (subject && !['CHAO_CO', 'SH_DAU_TUAN', 'SH_CUOI_TUAN'].includes(subject.code)) {
                if (!classAssignments.has(agg.class_id)) classAssignments.set(agg.class_id, []);
                classAssignments.get(agg.class_id)!.push({ ...agg });
            }
        });

        // Helper: check if a slot can be placed
        const canPlaceAt = (cls: any, assign: any, day: number, period: number): boolean => {
            if (classOccupied.has(`${cls.id}-${day}-${period}`)) return false;
            if (day === 2 && period === 1) return false;
            if (day === 5 && [5,10].includes(period)) return false; // Thu: 4 periods/session, block P5 & P10
            if (teacherOccupied.has(`${assign.teacher_id}-${day}-${period}`)) return false;
            if (this.constraintService.isTeacherBusy(assign.teacher_id, day, period)) return false;
            // Teacher overload check: max 5 per session
            const sess = period <= 5 ? 0 : 1;
            const tdsKey = `${assign.teacher_id}-${day}-${sess}`;
            if ((teacherDaySessionCount.get(tdsKey) || 0) >= 5) return false;
            return true;
        };

        // Helper: check block subject rules — R1 total ≤3/session, R2 same code ≤2/session, R3 no 3 consecutive
        const violatesBlockRule = (classId: string, day: number, period: number, subjCode: string): boolean => {
            if (!blockCodes.some(b => subjCode.includes(b))) return false;
            const sess = period <= 5 ? 0 : 1;
            const hk = `${classId}-${day}-${sess}`;
            const m = classDaySessionBlock.get(hk);
            if (m) {
                let total = 0;
                for (const c of m.values()) total += c;
                if (total >= 3) return true;                          // R1: would exceed 3/session
                if ((m.get(subjCode) || 0) >= 2) return true;         // R2: would exceed 2/code/session
            }
            const periodsSet = classDaySessionBlockPeriods.get(hk);
            if (periodsSet) {
                const arr = [...periodsSet, period].sort((a, b) => a - b);
                for (let k = 0; k <= arr.length - 3; k++) {
                    if (arr[k+1] === arr[k] + 1 && arr[k+2] === arr[k] + 2) return true; // R3
                }
            }
            return false;
        };

        // ── Step 0: Pre-place high-conflict subjects (TIN) with cross-class round-robin ──
        // TIN teachers shared across many classes → must coordinate days to avoid teacher conflicts
        const highConflictCodes = ['TIN', 'TIN_HOC'];
        const tinAssignmentsByTeacher = new Map<string, { cls: any; assign: any }[]>();
        for (const cls of classes) {
            const cAssigns = classAssignments.get(cls.id) || [];
            for (const assign of cAssigns) {
                const subj = subjectById.get(assign.subject_id);
                if (!subj || !highConflictCodes.some(hc => subj.code.toUpperCase().includes(hc))) continue;
                if (!tinAssignmentsByTeacher.has(assign.teacher_id)) {
                    tinAssignmentsByTeacher.set(assign.teacher_id, []);
                }
                tinAssignmentsByTeacher.get(assign.teacher_id)!.push({ cls, assign });
            }
        }

        for (const [teacherId, entries] of tinAssignmentsByTeacher) {
            const allDays = [2, 3, 4, 5, 6, 7];
            this.shuffleArray(allDays);
            let dayIdx = 0;

            for (const { cls, assign } of entries) {
                const subj = subjectById.get(assign.subject_id)!;
                const mainStart = cls.main_session === 0 ? 1 : 6;
                const mainEnd = cls.main_session === 0 ? 5 : 10;

                let alreadyAssigned = 0;
                for (const s of solution.slots) {
                    if (s.classId === cls.id && s.subjectId === assign.subject_id) alreadyAssigned++;
                }
                let remaining = Math.max(0, assign.total_periods - alreadyAssigned);

                while (remaining > 0) {
                    const day = allDays[dayIdx % allDays.length];
                    dayIdx++;
                    let placed = false;
                    // Try earliest period first (within main session)
                    for (let p = mainStart; p <= mainEnd && !placed; p++) {
                        if (day === 2 && p === 1) continue;
                        if (day === 5 && [5, 10].includes(p)) continue;
                        if (classOccupied.has(`${cls.id}-${day}-${p}`)) continue;
                        if (teacherOccupied.has(`${teacherId}-${day}-${p}`)) continue;
                        if (this.constraintService.isTeacherBusy(teacherId, day, p)) continue;
                        const sess = p <= 5 ? 0 : 1;
                        const tdsKey = `${teacherId}-${day}-${sess}`;
                        if ((teacherDaySessionCount.get(tdsKey) || 0) >= 5) continue;
                        // Place it
                        addSlot({
                            id: crypto.randomUUID(), day, period: p, classId: cls.id,
                            subjectId: assign.subject_id, teacherId,
                            roomId: cls.fixed_room_id, isLocked: false
                        });
                        remaining--;
                        placed = true;
                    }
                    if (!placed) {
                        this.logger.warn(`[PrePlace] Could not place TIN for ${cls.name} day ${day}, trying next day`);
                    }
                }
            }
        }

        for (const cls of classes) {
            const clsAssignments = classAssignments.get(cls.id) || [];
            if (clsAssignments.length === 0) continue;

            const isMorningMain = cls.main_session === 0;
            const oppositeBlockSubjects: any[] = [];

            // ── Step 1: Classify into pairs and singles ──
            type PlacementUnit = { assign: any, size: 1 | 2, code: string, isPriority: boolean, isBlock: boolean };
            const pairs: PlacementUnit[] = [];
            const singles: PlacementUnit[] = [];
            const oppositeSlots: any[] = [];

            for (const assign of clsAssignments) {
                const subject = subjectById.get(assign.subject_id);
                if (!subject) continue;
                const isOpposite = ['GDQP', 'GDTC'].includes(subject.code);

                let alreadyAssigned = 0;
                for (const s of solution.slots) {
                    if (s.classId === cls.id && s.subjectId === assign.subject_id) alreadyAssigned++;
                }
                const remaining = Math.max(0, assign.total_periods - alreadyAssigned);
                if (remaining === 0) continue;

                if (isOpposite) {
                    oppositeBlockSubjects.push({ assign, count: remaining });
                    continue;
                }

                const code = subject.code.toUpperCase();
                const isPriority = priorityCodes.some(p => code.includes(p));
                const isBlock = blockCodes.some(b => code.includes(b));

                // Group into pairs: for subjects with 2+ periods, create as many pairs as possible
                let r = remaining;
                while (r >= 2 && isBlock) {
                    pairs.push({ assign, size: 2, code, isPriority, isBlock });
                    r -= 2;
                }
                while (r > 0) {
                    singles.push({ assign, size: 1, code, isPriority, isBlock });
                    r--;
                }
            }

            // Sort pairs: priority subjects first, then heavy subjects
            pairs.sort((a, b) => {
                if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
                return 0;
            });
            singles.sort((a, b) => {
                if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
                return 0;
            });

            // ── Step 2a: Place GDTC/GDQP blocks in opposite session — 1 môn / 1 buổi ──
            const gdtcGdqpBlocks = oppositeBlockSubjects;
            const oppDaysUsed = new Set<number>(); // mỗi ngày chỉ 1 môn trái buổi

            for (const block of gdtcGdqpBlocks) {
                const { assign, count } = block;
                const minP = isMorningMain ? 8 : 1;
                const maxP = isMorningMain ? 10 : 3;
                const validRange = Array.from({ length: maxP - minP + 1 }, (_, i) => minP + i);
                let placed = false;
                // Ưu tiên ngày chưa có môn trái buổi nào
                const days = [2, 3, 4, 5, 6, 7]
                    .sort((a, b) => (oppDaysUsed.has(a) ? 1 : 0) - (oppDaysUsed.has(b) ? 1 : 0) || Math.random() - 0.5);

                for (const day of days) {
                    if (placed) break;
                    if (oppDaysUsed.has(day)) continue; // mỗi ngày chỉ 1 môn trái buổi
                    for (let startIdx = 0; startIdx <= validRange.length - count; startIdx++) {
                        const periods = validRange.slice(startIdx, startIdx + count);
                        const ok = periods.every(p => canPlaceAt(cls, assign, day, p));
                        if (ok) {
                            periods.forEach(p => {
                                addSlot({ id: crypto.randomUUID(), day, period: p, classId: cls.id,
                                    subjectId: assign.subject_id, teacherId: assign.teacher_id,
                                    roomId: undefined, isLocked: false });
                            });
                            oppDaysUsed.add(day);
                            placed = true; break;
                        }
                    }
                }
                if (!placed) {
                    for (let k = 0; k < count; k++) oppositeSlots.push(assign);
                }
            }

            // ── Step 3: Place PAIRS on consecutive periods (fixes SC4) ──
            // Available days sorted to spread subjects across different days (fixes SC1)
            const mainPeriodStart = isMorningMain ? 1 : 6;
            const mainPeriodEnd = isMorningMain ? 5 : 10;

            for (const unit of pairs) {
                const { assign, code } = unit;
                let placed = false;

                // Get days sorted: fill other days to 5 first, spread subject (SC1), Thursday last
                const csKey = `${cls.id}-${assign.subject_id}`;
                const usedDays = classSubjectDays.get(csKey) || new Set();
                const baseDays = [2, 3, 4, 6, 7];
                const freshDays = baseDays.filter(d => !usedDays.has(d));
                const staledays = baseDays.filter(d => usedDays.has(d));
                // Prefer days with fewer total slots (fill to 5 before Thursday)
                freshDays.sort((a, b) =>
                    (classDayTotals.get(`${cls.id}-${a}`) || 0) - (classDayTotals.get(`${cls.id}-${b}`) || 0)
                );
                this.shuffleArray(staledays);
                const sortedDays = [...freshDays, ...staledays, 5];

                for (const day of sortedDays) {
                    if (placed) break;
                    // On Thursday always try early periods first to prevent leading gaps;
                    // on other days non-priority yields early slots to priority subjects
                    const periodsToTry: number[][] = [];
                    for (let p = mainPeriodStart; p < mainPeriodEnd; p++) {
                        periodsToTry.push([p, p + 1]);
                    }
                    if (!unit.isPriority && day !== 5) {
                        periodsToTry.reverse();
                    }
                    for (const [p1, p2] of periodsToTry) {
                        if (!canPlaceAt(cls, assign, day, p1)) continue;
                        if (!canPlaceAt(cls, assign, day, p2)) continue;
                        if (violatesBlockRule(cls.id, day, p1, code)) continue;
                        if (violatesBlockRule(cls.id, day, p2, code)) continue;

                        addSlot({ id: crypto.randomUUID(), day, period: p1, classId: cls.id,
                            subjectId: assign.subject_id, teacherId: assign.teacher_id,
                            roomId: cls.fixed_room_id, isLocked: false });
                        addSlot({ id: crypto.randomUUID(), day, period: p2, classId: cls.id,
                            subjectId: assign.subject_id, teacherId: assign.teacher_id,
                            roomId: cls.fixed_room_id, isLocked: false });
                        placed = true; break;
                    }
                }

                if (!placed) {
                    // Fallback: split pair into 2 singles
                    singles.push({ assign, size: 1, code, isPriority: unit.isPriority, isBlock: unit.isBlock });
                    singles.push({ assign, size: 1, code, isPriority: unit.isPriority, isBlock: unit.isBlock });
                }
            }

            // ── Step 4: Place SINGLES (priority first, spread across days) ──
            for (const unit of [...singles]) {
                const { assign, code } = unit;
                let placed = false;

                // Count how many same-subject slots exist per day for this class
                const csKey = `${cls.id}-${assign.subject_id}`;
                const daySlotCount = new Map<number, number>();
                for (const s of solution.slots) {
                    if (s.classId === cls.id && s.subjectId === assign.subject_id) {
                        daySlotCount.set(s.day, (daySlotCount.get(s.day) || 0) + 1);
                    }
                }

                // Sort days: SC1-spread primary, fill-to-5 secondary, Thursday last
                const allDays = [2, 3, 4, 6, 7];
                allDays.sort((a, b) => {
                    const ca = daySlotCount.get(a) || 0;
                    const cb = daySlotCount.get(b) || 0;
                    if (ca !== cb) return ca - cb; // primary: spread same subject (SC1)
                    const ta = classDayTotals.get(`${cls.id}-${a}`) || 0;
                    const tb = classDayTotals.get(`${cls.id}-${b}`) || 0;
                    if (ta !== tb) return ta - tb; // secondary: fill to 5
                    return Math.random() - 0.5;
                });
                allDays.push(5); // Thursday always last

                for (const day of allDays) {
                    if (placed) break;
                    // On Thursday always try early periods first to prevent leading gaps;
                    // on other days non-priority yields early slots to priority subjects
                    const periods: number[] = [];
                    for (let p = mainPeriodStart; p <= mainPeriodEnd; p++) periods.push(p);
                    if (!unit.isPriority && day !== 5) periods.reverse();

                    for (const period of periods) {
                        if (!canPlaceAt(cls, assign, day, period)) continue;
                        if (violatesBlockRule(cls.id, day, period, code)) continue;

                        addSlot({ id: crypto.randomUUID(), day, period, classId: cls.id,
                            subjectId: assign.subject_id, teacherId: assign.teacher_id,
                            roomId: cls.fixed_room_id, isLocked: false });
                        placed = true; break;
                    }
                }

                if (!placed) {
                    this.logger.warn(`[WARNING] Class ${cls.name}: Could not place ${code} in main session`);
                }
            }

            // ── Step 5: Place remaining GDQP/GDTC opposite slots — vẫn giữ 1 môn/ngày ──
            for (const assign of oppositeSlots) {
                let placed = false;
                const oppStart = isMorningMain ? 8 : 1;
                const oppEnd = isMorningMain ? 10 : 3;
                // Thử ngày chưa dùng trước, fallback sang ngày đã dùng nếu không còn lựa
                const dayOrder = [2, 3, 4, 5, 6, 7].sort(
                    (a, b) => (oppDaysUsed.has(a) ? 1 : 0) - (oppDaysUsed.has(b) ? 1 : 0)
                );
                for (const day of dayOrder) {
                    if (placed) break;
                    if (oppDaysUsed.has(day)) continue;
                    for (let p = oppStart; p <= oppEnd && !placed; p++) {
                        if (canPlaceAt(cls, assign, day, p)) {
                            const subject = subjectById.get(assign.subject_id);
                            const isYard = subject && ['GDTC', 'GDQP'].includes(subject.code);
                            addSlot({ id: crypto.randomUUID(), day, period: p, classId: cls.id,
                                subjectId: assign.subject_id, teacherId: assign.teacher_id,
                                roomId: isYard ? undefined : cls.fixed_room_id, isLocked: false });
                            oppDaysUsed.add(day);
                            placed = true;
                        }
                    }
                }
                if (!placed) {
                    this.logger.warn(`[WARNING] Class ${cls.name}: Could not place ${this.constraintService.getSubjectCode(assign.subject_id)}`);
                }
            }
        }
        this.logger.log(`Phase 2 done in ${Date.now() - startP2}ms. Total slots: ${solution.slots.length}`);
        this.phase2c_CompactMainSession(solution, data);
    }

    // Post-process: compact main-session slots toward early periods (no holes at P1, P2…)
    private phase2c_CompactMainSession(solution: any, data: any) {
        const startC = Date.now();
        let moved = 0;
        for (const cls of data.classes) {
            const mainStart = cls.main_session === 0 ? 1 : 6;
            const mainEnd = cls.main_session === 0 ? 5 : 10;
            for (let day = 2; day <= 7; day++) {
                // Build occupied period map for this class-day
                const slotsByPeriod = new Map<number, any>();
                for (const s of solution.slots) {
                    if (s.classId === cls.id && s.day === day) slotsByPeriod.set(s.period, s);
                }
                for (let target = mainStart; target <= mainEnd; target++) {
                    if (slotsByPeriod.has(target)) continue;
                    if (day === 5 && target === 5) continue;     // T5 P5 blocked
                    if (day === 5 && target === 10) continue;    // T5 P10 blocked
                    // Find a movable slot at later period in same main session
                    for (let later = mainEnd; later > target; later--) {
                        const cand = slotsByPeriod.get(later);
                        if (!cand || cand.isLocked) continue;
                        // Check teacher conflict at target
                        if (this.constraintService.isTeacherBusy(cand.teacherId, day, target)) continue;
                        const conflict = solution.slots.some((o: any) =>
                            o !== cand && o.teacherId === cand.teacherId && o.day === day && o.period === target);
                        if (conflict) continue;
                        // Move
                        slotsByPeriod.delete(later);
                        cand.period = target;
                        slotsByPeriod.set(target, cand);
                        moved++;
                        break;
                    }
                }
            }
        }
        this.logger.log(`Phase 2c compact done in ${Date.now() - startC}ms. Moved ${moved} slots to fill early periods.`);
    }

    private async phase3_Genetic(solution: any, data: any) {
        this.logger.log('Phase 3: Full Constraint Optimization...');
        const startTime = Date.now();
        const slots = solution.slots;
        const heavyCodes = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH', 'LY', 'VAT_LY', 'HOA', 'HOA_HOC'];
        const blockCodes = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH'];
        const thursdayHeavyCodes = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH'];

        // Build class session map: classId → 0 (morning) or 1 (afternoon)
        const classMainSession = new Map<string, number>();
        for (const cls of data.classes) {
            classMainSession.set(cls.id, cls.main_session);
        }

        // ── Build O(1) indexes ──
        const teacherAt = new Map<string, Set<number>>();
        const classAt = new Map<string, Set<number>>();
        const classSlotsIdx = new Map<string, number[]>();
        const teacherSlotsIdx = new Map<string, number[]>(); // teacherId → [indices]

        const tKey = (tid: string, d: number, p: number) => `${tid}-${d}-${p}`;
        const cKey = (cid: string, d: number, p: number) => `${cid}-${d}-${p}`;

        const addIdx = (s: any, i: number) => {
            const tk = tKey(s.teacherId, s.day, s.period);
            if (!teacherAt.has(tk)) teacherAt.set(tk, new Set());
            teacherAt.get(tk)!.add(i);
            const ck = cKey(s.classId, s.day, s.period);
            if (!classAt.has(ck)) classAt.set(ck, new Set());
            classAt.get(ck)!.add(i);
        };
        const rmIdx = (s: any, i: number) => {
            teacherAt.get(tKey(s.teacherId, s.day, s.period))?.delete(i);
            classAt.get(cKey(s.classId, s.day, s.period))?.delete(i);
        };

        for (let i = 0; i < slots.length; i++) {
            addIdx(slots[i], i);
            if (!classSlotsIdx.has(slots[i].classId)) classSlotsIdx.set(slots[i].classId, []);
            classSlotsIdx.get(slots[i].classId)!.push(i);
            if (!teacherSlotsIdx.has(slots[i].teacherId)) teacherSlotsIdx.set(slots[i].teacherId, []);
            teacherSlotsIdx.get(slots[i].teacherId)!.push(i);
        }

        // ── Full slot cost function (HC + all SC) ──
        const slotCost = (idx: number): number => {
            const s = slots[idx];
            let cost = 0;
            const code = this.constraintService.getSubjectCode(s.subjectId);

            // === HARD CONSTRAINTS (high weight) ===
            // HC: Teacher conflict
            const ts = teacherAt.get(tKey(s.teacherId, s.day, s.period));
            if (ts && ts.size > 1) cost += 200;
            // HC: Class conflict
            const cs = classAt.get(cKey(s.classId, s.day, s.period));
            if (cs && cs.size > 1) cost += 200;
            // HC: Teacher busy
            if (this.constraintService.isTeacherBusy(s.teacherId, s.day, s.period)) cost += 200;
            // HC: Thursday restriction (4 periods/session, block P5 & P10)
            if (s.day === 5 && [5,10].includes(s.period)) cost += 200;
            // HC: GDTC/GDQP time
            if (code.includes('GDTC') || code.includes('GDQP') || code.includes('QUOC_PHONG')) {
                if (s.period <= 5 ? s.period > 3 : s.period < 8) cost += 150;
            }
            // HC: Non-academic subjects can be in opposite session; academic subjects must be in main session
            const oppositeAllowed = ['GDTC', 'GDQP', 'CHAO_CO', 'SH_CUOI', 'SHCN'];
            const isOppositeAllowed = oppositeAllowed.some(oc => code.includes(oc));
            if (!isOppositeAllowed) {
                const mainSess = classMainSession.get(s.classId) ?? 0; // 0=morning, 1=afternoon
                const slotSess = s.period <= 5 ? 0 : 1;
                if (slotSess !== mainSess) cost += 500; // HARD: wrong session
            }
            // HC9: Block subjects (TOAN/VAN/ANH) — R1 total ≤3/session, R2 same code ≤2/session, R3 no 3 consecutive
            if (blockCodes.some(b => code.includes(b))) {
                const sess9 = s.period <= 5 ? 0 : 1;
                const classSlotsB = classSlotsIdx.get(s.classId) || [];
                let totalBlock = 0;
                let sameCodeCount = 0;
                const blockPeriods: number[] = [];
                for (const j of classSlotsB) {
                    const o = slots[j];
                    if (o.day !== s.day) continue;
                    if ((o.period <= 5 ? 0 : 1) !== sess9) continue;
                    const oc = this.constraintService.getSubjectCode(o.subjectId);
                    if (blockCodes.some(b => oc.includes(b))) {
                        totalBlock++;
                        blockPeriods.push(o.period);
                        if (oc === code) sameCodeCount++;
                    }
                }
                // R1: total > 3 in session — hard
                if (totalBlock > 3) cost += 250;
                // R2: same code > 2 in session — hard
                if (sameCodeCount > 2) cost += 250;
                // R3: 3+ consecutive block periods in session — hard
                blockPeriods.sort((a, b) => a - b);
                for (let k = 0; k <= blockPeriods.length - 3; k++) {
                    if (blockPeriods[k+1] === blockPeriods[k] + 1 && blockPeriods[k+2] === blockPeriods[k] + 2) {
                        cost += 250; break;
                    }
                }
            }



            // SC4: Block 2 — same subject should have consecutive partner on same day
            if (blockCodes.some(b => code.includes(b))) {
                const classSlots = classSlotsIdx.get(s.classId) || [];
                let hasAdjacentPair = false;
                for (const j of classSlots) {
                    if (j === idx) continue;
                    const o = slots[j];
                    if (o.subjectId !== s.subjectId) continue;
                    if (o.day === s.day && Math.abs(o.period - s.period) === 1) {
                        hasAdjacentPair = true;
                        break;
                    }
                }
                if (!hasAdjacentPair) {
                    // Check if this subject has multiple periods total
                    let totalPeriods = 0;
                    for (const j of classSlots) {
                        if (slots[j].subjectId === s.subjectId) totalPeriods++;
                    }
                    if (totalPeriods > 1) cost += 30;
                }
            }

            // SC1: Subject spread — penalty if same subject on same day (non-paired)
            const classSlots2 = classSlotsIdx.get(s.classId) || [];
            let sameDaySameSubj = 0;
            for (const j of classSlots2) {
                if (j === idx) continue;
                const o = slots[j];
                if (o.subjectId === s.subjectId && o.day === s.day) sameDaySameSubj++;
            }
            // Only penalize if 3+ periods of same subject on same day (pairs of 2 are OK)
            if (sameDaySameSubj >= 2) cost += 10;

            // SC7: Teacher overload — count teacher slots in this day-session
            const teacherSlots = teacherSlotsIdx.get(s.teacherId) || [];
            const sess = s.period <= 5 ? 0 : 1;
            let teacherSessionCount = 0;
            for (const j of teacherSlots) {
                const o = slots[j];
                if (o.day === s.day && (o.period <= 5 ? 0 : 1) === sess) teacherSessionCount++;
            }
            if (teacherSessionCount > 4) cost += 10;

            // SC6: Teacher gaps — check gap before/after this slot for this teacher
            let hasGap = false;
            const tSlots = teacherSlotsIdx.get(s.teacherId) || [];
            const sameDaySameSession: number[] = [];
            for (const j of tSlots) {
                const o = slots[j];
                if (o.day === s.day && (o.period <= 5 ? 0 : 1) === sess) sameDaySameSession.push(o.period);
            }
            if (sameDaySameSession.length >= 2) {
                sameDaySameSession.sort((a, b) => a - b);
                for (let k = 0; k < sameDaySameSession.length - 1; k++) {
                    if (sameDaySameSession[k + 1] - sameDaySameSession[k] > 1) { hasGap = true; break; }
                }
            }
            if (hasGap) cost += 5;

            // SC_T5: Toán/Văn/Anh nằm thứ 5 → penalty mềm
            if (s.day === 5 && thursdayHeavyCodes.some(h => code.includes(h))) cost += 15;
            return cost;
        };

        // ── Swap helper ──
        const doSwap = (i: number, j: number) => {
            rmIdx(slots[i], i); rmIdx(slots[j], j);
            const td = slots[i].day, tp = slots[i].period;
            slots[i].day = slots[j].day; slots[i].period = slots[j].period;
            slots[j].day = td; slots[j].period = tp;
            addIdx(slots[i], i); addIdx(slots[j], j);
        };

        // ── Main loop: Targeted Repair with Simulated Annealing ──
        const MAX_ROUNDS = 60;
        let totalImproved = 0;
        const tabu = new Set<string>();
        let staleCount = 0;
        let temperature = 50; // SA temperature: start high, decrease
        const coolingRate = 0.92;

        for (let round = 0; round < MAX_ROUNDS; round++) {
            const violations: {idx: number, cost: number}[] = [];
            for (let i = 0; i < slots.length; i++) {
                if (slots[i].isLocked) continue;
                const c = slotCost(i);
                if (c > 0) violations.push({idx: i, cost: c});
            }
            if (violations.length === 0) { this.logger.log(`Round ${round}: No violations!`); break; }

            violations.sort((a, b) => b.cost - a.cost);

            let roundImproved = 0;
            const toFix = Math.min(violations.length, 3000);

            for (let vi = 0; vi < toFix; vi++) {
                const {idx: badIdx} = violations[vi];
                if (slots[badIdx].isLocked) continue;
                const currentCost = slotCost(badIdx);
                if (currentCost === 0) continue;

                // Strategy 1: Swap within same class
                const classIdxs = classSlotsIdx.get(slots[badIdx].classId) || [];
                let bestDelta = 0, bestJ = -1;

                for (const j of classIdxs) {
                    if (j === badIdx || slots[j].isLocked) continue;
                    const tabuKey = `${Math.min(badIdx,j)}-${Math.max(badIdx,j)}`;
                    if (tabu.has(tabuKey)) continue;

                    const oldCost = currentCost + slotCost(j);
                    doSwap(badIdx, j);
                    const newCost = slotCost(badIdx) + slotCost(j);
                    doSwap(badIdx, j);

                    const delta = newCost - oldCost;
                    if (delta < bestDelta) { bestDelta = delta; bestJ = j; }
                }

                // Strategy 2: For teacher/session conflicts (HC) — try cross-class swap
                if (bestDelta >= 0 && currentCost >= 100) {
                    const teacherIdxs = teacherSlotsIdx.get(slots[badIdx].teacherId) || [];
                    for (const j of teacherIdxs) {
                        if (j === badIdx || slots[j].isLocked) continue;
                        if (slots[j].classId === slots[badIdx].classId) continue;
                        const tabuKey = `${Math.min(badIdx,j)}-${Math.max(badIdx,j)}`;
                        if (tabu.has(tabuKey)) continue;

                        const oldCost2 = currentCost + slotCost(j);
                        doSwap(badIdx, j);
                        const newCost2 = slotCost(badIdx) + slotCost(j);
                        doSwap(badIdx, j);

                        const delta2 = newCost2 - oldCost2;
                        if (delta2 < bestDelta) { bestDelta = delta2; bestJ = j; }
                    }
                }

                // Simulated Annealing: Accept slightly worse moves with probability
                if (bestJ < 0 && temperature > 1) {
                    // Try a random swap within same class
                    const unlocked = classIdxs.filter(j => j !== badIdx && !slots[j].isLocked);
                    if (unlocked.length > 0) {
                        const randJ = unlocked[Math.floor(Math.random() * unlocked.length)];
                        const oldCostR = currentCost + slotCost(randJ);
                        doSwap(badIdx, randJ);
                        const newCostR = slotCost(badIdx) + slotCost(randJ);
                        doSwap(badIdx, randJ);
                        const deltaR = newCostR - oldCostR;
                        // Accept worse move with probability exp(-delta/temperature)
                        if (deltaR <= 0 || Math.random() < Math.exp(-deltaR / temperature)) {
                            bestDelta = deltaR; bestJ = randJ;
                        }
                    }
                }

                if (bestJ >= 0) {
                    const tabuKey = `${Math.min(badIdx,bestJ)}-${Math.max(badIdx,bestJ)}`;
                    tabu.add(tabuKey);
                    if (tabu.size > 5000) { const first = tabu.values().next().value; if (first) tabu.delete(first); }
                    doSwap(badIdx, bestJ);
                    roundImproved++;
                }
            }

            temperature *= coolingRate;
            totalImproved += roundImproved;

            if (round % 10 === 0 || roundImproved === 0) {
                const remainCost = violations.reduce((sum, v) => sum + slotCost(v.idx), 0);
                this.logger.log(`  Round ${round+1}/${MAX_ROUNDS}: V=${violations.length}, Fixed=${roundImproved}, Cost=${remainCost}, T=${temperature.toFixed(1)}`);
            }

            if (roundImproved === 0) {
                staleCount++;
                if (staleCount >= 5) break;
            } else {
                staleCount = 0;
            }
        }

        // ── Phase 3b: Dedicated SC4 pair-merge pass ──
        this.logger.log('Phase 3b: SC4 Pair-Merge Repair...');
        let sc4Fixed = 0;
        const blockCodes2 = blockCodes;
        for (const [classId, classIdxList] of classSlotsIdx) {
            // Group slots by subjectId
            const bySubject = new Map<number, number[]>();
            for (const idx of classIdxList) {
                const s = slots[idx];
                if (s.isLocked) continue;
                const code = this.constraintService.getSubjectCode(s.subjectId);
                if (!blockCodes2.some(b => code.includes(b))) continue;
                if (!bySubject.has(s.subjectId)) bySubject.set(s.subjectId, []);
                bySubject.get(s.subjectId)!.push(idx);
            }

            for (const [subjId, subjIdxs] of bySubject) {
                if (subjIdxs.length < 2) continue;
                
                // Check if any pair exists
                let hasPair = false;
                for (let a = 0; a < subjIdxs.length && !hasPair; a++) {
                    for (let b = a + 1; b < subjIdxs.length && !hasPair; b++) {
                        const sa = slots[subjIdxs[a]], sb = slots[subjIdxs[b]];
                        if (sa.day === sb.day && Math.abs(sa.period - sb.period) === 1) hasPair = true;
                    }
                }
                if (hasPair) continue; // Already has a pair

                // Try to merge two periods to be consecutive
                for (let a = 0; a < subjIdxs.length && !hasPair; a++) {
                    const idxA = subjIdxs[a];
                    const sa = slots[idxA];
                    
                    // Find a free adjacent period on sa's day
                    for (const adjP of [sa.period + 1, sa.period - 1]) {
                        if (hasPair) break;
                        if (adjP < 1 || adjP > 10) continue;
                        // Check same session
                        if ((sa.period <= 5) !== (adjP <= 5)) continue;
                        
                        // Find another slot of same subject on different day
                        for (let b = 0; b < subjIdxs.length; b++) {
                            if (b === a) continue;
                            const idxB = subjIdxs[b];
                            const sb = slots[idxB];
                            if (sb.day === sa.day) continue; // Already same day
                            
                            // Find a swap target at (sa.day, adjP) in this class
                            const targetIdx = classIdxList.find(j => {
                                const sj = slots[j];
                                return j !== idxA && j !== idxB && !sj.isLocked &&
                                    sj.day === sa.day && sj.period === adjP;
                            });
                            
                            if (targetIdx === undefined) continue;
                            
                            // Try swapping idxB with targetIdx
                            const oldCost = slotCost(idxA) + slotCost(idxB) + slotCost(targetIdx);
                            doSwap(idxB, targetIdx);
                            const newCost = slotCost(idxA) + slotCost(idxB) + slotCost(targetIdx);
                            
                            if (newCost < oldCost) {
                                // Keep the swap
                                sc4Fixed++;
                                hasPair = true;
                            } else {
                                doSwap(idxB, targetIdx); // Undo
                            }
                        }
                    }
                }
            }
        }
        if (sc4Fixed > 0) this.logger.log(`  SC4 Pair-Merge: Fixed ${sc4Fixed} pairs`);

        const finalScore = this.calculateFitness(slots);
        const elapsed = Date.now() - startTime;
        this.logger.log(`Phase 3 Complete: Fitness=${finalScore}, TotalFixed=${totalImproved}+${sc4Fixed}, Time=${elapsed}ms`);
        solution.fitness_score = finalScore;
        solution.slots = slots;
    }

    private calculateFitness(slots: any[]): number {
        const hardViolations = this.constraintService.checkHardConstraints(slots);
        const softPenalty = this.constraintService.calculatePenalty(slots);
        return 1000 - (hardViolations * 100) - softPenalty;
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
            // Calculate week count from semester dates
            const semester = await this.prisma.semester.findUnique({
                where: { id: semesterId },
                include: { academic_year: true }
            });
            let numWeeks = 18; // default
            if (semester?.start_date && semester?.end_date) {
                numWeeks = Math.max(1, Math.ceil(
                    (semester.end_date.getTime() - semester.start_date.getTime()) / (7 * 24 * 3600 * 1000)
                ));
            } else if (semester?.academic_year?.weeks) {
                numWeeks = Math.ceil(semester.academic_year.weeks / 2);
            }
            log(`[DEBUG] Expanding template across ${numWeeks} weeks`);

            const timetable = await this.prisma.generatedTimetable.create({
                data: {
                    name: `TKB ${new Date().toLocaleString('vi-VN')}`,
                    semester_id: semesterId,
                    fitness_score: solution.fitness_score,
                }
            });
            log(`[DEBUG] Header Created: ${timetable.id}`);

            // Expand template slots × numWeeks
            const slotsToCreate: any[] = [];
            for (let week = 1; week <= numWeeks; week++) {
                for (const s of solution.slots as TimeSlot[]) {
                    slotsToCreate.push({
                        timetable_id: timetable.id,
                        class_id: s.classId,
                        subject_id: s.subjectId,
                        teacher_id: s.teacherId,
                        room_id: s.roomId,
                        day: s.day,
                        period: s.period,
                        week,
                        is_locked: s.isLocked || false,
                    });
                }
            }

            if (slotsToCreate.length > 0) {
                const batch = await this.prisma.timetableSlot.createMany({
                    data: slotsToCreate,
                    skipDuplicates: true
                });
                log(`[DEBUG] Inserted ${batch.count} slots (${solution.slots.length} × ${numWeeks} weeks).`);
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

        // Find swap target within same week
        const targetSlot = await this.prisma.timetableSlot.findFirst({
            where: {
                timetable_id: sourceSlot.timetable_id,
                class_id: sourceSlot.class_id,
                day: newDay,
                period: newPeriod,
                week: sourceSlot.week
            }
        });

        if (targetSlot) {
            await this.prisma.$transaction(async (tx) => {
                await tx.timetableSlot.update({
                    where: { id: sourceSlot.id },
                    data: { day: 0, period: 0 }
                });
                await tx.timetableSlot.update({
                    where: { id: targetSlot.id },
                    data: { day: sourceSlot.day, period: sourceSlot.period, is_locked: true }
                });
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
