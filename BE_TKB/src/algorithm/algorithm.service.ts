
import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConstraintService, TimeSlot } from './constraint.service';
import { FETEngine, Activity, FETConfig } from './fet-engine';

interface AlgorithmRunOptions {
    restarts: number;
    maxRecursionDepth: number;
    maxSwapAttempts: number;
    maxTotalBacktracks: number;
    polishIterations: number;
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
        rawOptions?: Partial<Pick<AlgorithmRunOptions, 'restarts'>>
    ) {
        const debugLogs: string[] = [];
        const log = (msg: string) => {
            this.logger.log(msg);
            debugLogs.push(msg);
        };

        try {
            log(`[FET] Starting FET Algorithm for Semester: ${semesterId}`);
            const options = this.normalizeRunOptions(rawOptions);
            log(`[FET] Options: restarts=${options.restarts}, depth=${options.maxRecursionDepth}, backtracks=${options.maxTotalBacktracks}`);

            // 0. Load Cache & Data
            await this.constraintService.initialize(semesterId);
            const data = await this.loadData(semesterId);
            log(`[FET] Data: ${data.classes.length} Classes, ${data.subjects.length} Subjects, ${data.assignments.length} Assignments.`);

            // 1. Load User-Locked Slots
            const prevTimetable = await this.prisma.generatedTimetable.findFirst({
                where: { semester_id: semesterId },
                orderBy: { created_at: 'desc' },
                include: { slots: { where: { is_locked: true } } }
            });

            const lockedSlots: TimeSlot[] = [];
            if (prevTimetable && prevTimetable.slots.length > 0) {
                log(`[FET] Preserving ${prevTimetable.slots.length} locked slots.`);
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

            // 2. Build activities list from assignments
            const activities = this.buildActivities(data);
            log(`[FET] Built ${activities.length} activities to place.`);

            // 3. Multi-restart: run FET engine multiple times, keep best
            let bestSolution: TimeSlot[] | null = null;
            let bestFitnessResult: any = null;

            for (let attempt = 1; attempt <= options.restarts; attempt++) {
                log(`[ATTEMPT ${attempt}/${options.restarts}] Starting FET engine...`);

                // Phase 1: Fixed slots (Anchoring specific activities)
                const currentActivities = this.buildActivities(data);
                const fixedSlots: TimeSlot[] = [...lockedSlots.map(s => ({ ...s }))];
                
                // Map to track which activities are anchored
                const anchoredIds = new Set<string>();
                await this.phase1_FixedSlots(fixedSlots, currentActivities, anchoredIds, data, (msg) => log(`[ATTEMPT ${attempt}] ${msg}`));

                // Remaining activities are those not anchored in Phase 1
                const remainingActivities = currentActivities.filter(a => !anchoredIds.has(a.id));
                log(`[ATTEMPT ${attempt}] Total activities: ${currentActivities.length}. Anchored: ${anchoredIds.size}. Remaining: ${remainingActivities.length}`);

                // Phase 2: FET Recursive Swapping Engine
                const fetConfig: FETConfig = {
                    maxRecursionDepth: options.maxRecursionDepth,
                    maxSwapAttempts: options.maxSwapAttempts,
                    maxTotalBacktracks: options.maxTotalBacktracks,
                    polishIterations: options.polishIterations,
                };

                const engine = new FETEngine(
                    this.constraintService,
                    fetConfig,
                    (msg) => log(`[ATTEMPT ${attempt}] ${msg}`)
                );

                const resultSlots = engine.solve(remainingActivities, fixedSlots);

                // Evaluate
                const fitnessResult = this.constraintService.getFitnessSummary(resultSlots);
                log(`[ATTEMPT ${attempt}] Fitness: ${fitnessResult.score} (hard=${fitnessResult.hardViolations}, soft=${fitnessResult.softPenalty})`);

                const impossible = engine.getImpossibleActivities();
                if (impossible.length > 0) {
                    log(`[ATTEMPT ${attempt}] ⚠ ${impossible.length} activities could not be placed cleanly.`);
                }

                if (!bestSolution || fitnessResult.score > bestFitnessResult.score) {
                    bestSolution = resultSlots;
                    bestFitnessResult = fitnessResult;
                    log(`[ATTEMPT ${attempt}] ★ New best solution!`);
                }

                // If perfect score, stop early
                if (fitnessResult.hardViolations === 0) {
                    log(`[ATTEMPT ${attempt}] ✓ Zero hard violations — stopping early.`);
                    break;
                }
            }

            if (!bestSolution || !bestFitnessResult) {
                throw new Error('Algorithm did not produce any solution.');
            }

            log(`[FET] Saving ${bestSolution.length} slots to database...`);
            const solution = { slots: bestSolution, fitness_score: bestFitnessResult.score };
            const timetable = await this.saveToDatabase(semesterId, solution, data, log);

            return {
                ...timetable,
                debugLogs,
                fitnessDetails: bestFitnessResult.details,
                hardDetails: bestFitnessResult.hardDetails,
                softDetails: bestFitnessResult.softDetails,
                success: true
            };

        } catch (error: any) {
            log(`[ERROR] Algorithm Failed: ${error.message}`);
            if (error.stack) log(`[ERROR] Stack: ${error.stack}`);
            return { debugLogs, success: false, error: error.message };
        }
    }

    // ================================================================
    // DATA LOADING
    // ================================================================

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

    // ================================================================
    // BUILD ACTIVITIES FROM ASSIGNMENTS
    // ================================================================

    private buildActivities(data: any): Activity[] {
        const activities: Activity[] = [];
        const { assignments, subjects, classes } = data;

        for (const assign of assignments) {
            const subject = subjects.find((s: any) => s.id === assign.subject_id);
            if (!subject) continue;

            /* 
            Skip fixed-slot subjects (handled in Phase 1)
            const fixedCodes = [
                'CHAO_CO', 'SH_DAU_TUAN', 'SH_CUOI_TUAN',
                'SHCN', 'SH_CN', 'SINH_HOAT',
            ];
            if (fixedCodes.includes(subject.code)) continue;
            */

            const cls = classes.find((c: any) => c.id === assign.class_id);
            if (!cls) continue;

            const isMorning = cls.main_session === 0;
            const isOppositeSubj = ['GDTC', 'GDQP'].includes(subject.code.toUpperCase());
            const isHDTN = ['HDTN', 'HĐTN'].includes(subject.code.toUpperCase());
            
            const isSpecial = isOppositeSubj; // Only Physical Ed / Defense are special (block placement)
            const isYardSubject = isOppositeSubj;
            const subjCode = subject.code.toUpperCase();
            
            // GDTC/GDQP go to the OPPOSITE session, HDTN and others go to main session
            const activityIsMorning = isOppositeSubj ? !isMorning : isMorning;

            // Create one Activity per period needed
            const totalPeriods = assign.total_periods || 1;
            for (let p = 0; p < totalPeriods; p++) {
                activities.push({
                    id: crypto.randomUUID(),
                    classId: assign.class_id,
                    subjectId: assign.subject_id,
                    teacherId: assign.teacher_id,
                    roomId: isYardSubject ? undefined : (cls.fixed_room_id || undefined),
                    isMorning: activityIsMorning,
                    isSpecial,
                    isYardSubject,
                    subjectCode: subjCode,
                    difficulty: 0,
                });
            }
        }

        return activities;
    }

    private async phase1_FixedSlots(
        solution: TimeSlot[],
        activities: Activity[],
        anchoredIds: Set<string>,
        data: any,
        log: (msg: string) => void
    ) {
        const { classes, subjects } = data;

        const subjectCodeMap = new Map<string, number>();
        subjects.forEach((s: any) => subjectCodeMap.set(s.code, s.id));

        const resolveSubjectId = (code: string) => {
            if (subjectCodeMap.has(code)) return subjectCodeMap.get(code);
            if (code === 'SH_CN') return subjectCodeMap.get('SHCN');
            if (code === 'SINH_HOAT') return subjectCodeMap.get('SHCN');
            return undefined;
        };

        let fixedCount = 0;

        for (const cls of classes) {
            const gradeMatches = cls.name.match(/\d+/);
            const grade = gradeMatches ? parseInt(gradeMatches[0]) : 0;
            const isMorning = [12, 10].includes(grade);
            const session = isMorning ? 'SANG' : 'CHIEU';

            for (let d = 2; d <= 7; d++) {
                for (let p = 1; p <= 10; p++) {
                    const check = this.constraintService.checkFixedSlot(d, p, grade, session);
                    if (!check.isFixed || !check.subjectCode) continue;

                    // Find activity for this fixed slot
                    let activity;
                    if (check.subjectCode === 'GVCN_ANCHOR') {
                        // Find any activity taught by the homeroom teacher of this class
                        activity = activities.find(a => 
                            a.classId === cls.id && 
                            a.teacherId === cls.homeroom_teacher_id && 
                            !anchoredIds.has(a.id)
                        );
                    } else {
                        const targetSubjId = resolveSubjectId(check.subjectCode);
                        if (!targetSubjId) continue;
                        activity = activities.find(a => 
                            a.classId === cls.id && 
                            a.subjectId === targetSubjId && 
                            !anchoredIds.has(a.id)
                        );
                    }

                    if (activity) {
                        solution.push({
                            id: activity.id,
                            day: d,
                            period: p,
                            classId: activity.classId,
                            subjectId: activity.subjectId,
                            teacherId: activity.teacherId,
                            roomId: (activity.subjectCode === 'CHAO_CO' || activity.subjectCode === 'GDTC' || activity.subjectCode === 'GDQP') ? undefined : (cls.fixed_room_id || undefined),
                            isLocked: true,
                        });
                        anchoredIds.add(activity.id);
                        fixedCount++;
                    }
                }
            }
        }
        log(`[FET] Phase 1: Anchored ${fixedCount} fixed activities.`);
    }

    // ================================================================
    // UTILITY METHODS
    // ================================================================

    private normalizeRunOptions(
        rawOptions?: Partial<Pick<AlgorithmRunOptions, 'restarts'>>
    ): AlgorithmRunOptions {
        const normalizeInteger = (value: unknown, fallback: number, min: number, max: number) => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return fallback;
            return Math.min(max, Math.max(min, Math.trunc(parsed)));
        };

        return {
            restarts: normalizeInteger(rawOptions?.restarts, 5, 1, 20),
            maxRecursionDepth: 30,
            maxSwapAttempts: 10000,
            maxTotalBacktracks: 5000000,
            polishIterations: 8000,
        };
    }

    private isSlotOccupied(slots: TimeSlot[], classId: string, day: number, period: number): boolean {
        return slots.some(s => s.classId === classId && s.day === day && s.period === period);
    }

    // ================================================================
    // DATABASE SAVE
    // ================================================================

    private async saveToDatabase(semesterId: string, solution: any, data: any, log: (msg: string) => void) {
        try {
            const timetable = await this.prisma.generatedTimetable.create({
                data: {
                    name: `TKB_FET ${new Date().toLocaleString('vi-VN')}`,
                    semester_id: semesterId,
                    fitness_score: solution.fitness_score,
                }
            });
            log(`[FET] Header Created: ${timetable.id}`);

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
                log(`[FET] Inserted ${batch.count} slots.`);
            } else {
                log('[FET] No slots to insert!');
            }

            return { success: true, id: timetable.id };
        } catch (e) {
            log(`[FET] Save Failed: ${e}`);
            throw e;
        }
    }

    // ================================================================
    // MANUAL OPERATIONS (moveSlot, toggleLock, clearSchedule)
    // ================================================================

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
