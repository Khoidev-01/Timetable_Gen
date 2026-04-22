/**
 * FET-Inspired Recursive Swapping Engine
 * Based on FET (Free Educational Timetabling) v5+ algorithm.
 * 
 * Core idea: Place activities one-by-one (hardest first).
 * When no valid slot exists, recursively displace conflicting activities
 * using a tabu list to prevent infinite cycles.
 */

import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';
import { ConstraintService, TimeSlot } from './constraint.service';

// Represents one "unit of work" to be placed into the timetable
export interface Activity {
    id: string;
    classId: string;
    subjectId: number;
    teacherId: string;
    roomId?: number;
    isMorning: boolean;
    isSpecial: boolean;    // GDTC, GDQP
    isYardSubject: boolean;
    subjectCode: string;
    difficulty: number;    // lower = harder to place
}

export interface FETConfig {
    maxRecursionDepth: number;   // FET default: 14
    maxSwapAttempts: number;     // max attempts per activity
    maxTotalBacktracks: number;  // global backtrack budget
    polishIterations: number;    // soft constraint optimization passes
}

const DEFAULT_CONFIG: FETConfig = {
    maxRecursionDepth: 14,
    maxSwapAttempts: 2000,
    maxTotalBacktracks: 500000,
    polishIterations: 3000,
};

export class FETEngine {
    private readonly logger = new Logger(FETEngine.name);
    private schedule: TimeSlot[] = [];
    private totalSwapCalls = 0;
    private impossibleActivities: Activity[] = [];

    // Performance index: "day-period" → list of slots at that time
    private timeIndex: Map<string, TimeSlot[]> = new Map();

    constructor(
        private constraintService: ConstraintService,
        private config: FETConfig = DEFAULT_CONFIG,
        private log: (msg: string) => void = (m) => Logger.log(m),
    ) {}

    /**
     * Main entry point: build a complete timetable.
     * @param activities All activities to place (already excludes fixed slots)
     * @param fixedSlots Pre-placed slots (Chào Cờ, SHCN, etc.)
     */
    public solve(activities: Activity[], fixedSlots: TimeSlot[]): TimeSlot[] {
        this.schedule = fixedSlots.map(s => ({ ...s }));
        this.totalSwapCalls = 0;
        this.impossibleActivities = [];
        this.rebuildTimeIndex();

        // Step 1: Sort by difficulty (hardest first)
        const sorted = this.sortByDifficulty(activities);
        this.log(`[FET] Sorted ${sorted.length} activities by difficulty.`);

        // Step 1.5: Handle block-scheduling for GDTC/GDQP first
        const blockActivities: Activity[] = [];
        const normalActivities: Activity[] = [];
        for (const act of sorted) {
            if (act.isSpecial) {
                blockActivities.push(act);
            } else {
                normalActivities.push(act);
            }
        }

        // Place block subjects (GDTC, GDQP) — try to group same class+subject on same day
        this.placeBlockActivities(blockActivities);

        // Step 2: Place each remaining activity using recursive swapping
        // Re-sort normal activities since schedule changed
        this.resortByDifficulty(normalActivities);

        let placed = 0;
        let failed = 0;

        for (let i = 0; i < normalActivities.length; i++) {
            const activity = normalActivities[i];
            const success = this.placeActivity(activity);

            if (success) {
                placed++;
            } else {
                failed++;
                this.impossibleActivities.push(activity);
                // Force-place to avoid losing the activity entirely
                this.forcePlaceFallback(activity);
            }

            // Re-sort remaining activities every 100 placements (dynamic difficulty update)
            if (i > 0 && i % 100 === 0) {
                const remaining = normalActivities.slice(i + 1);
                this.resortByDifficulty(remaining);
                normalActivities.splice(i + 1, remaining.length, ...remaining);
            }

            if (i % 50 === 0 || i === normalActivities.length - 1) {
                this.log(`[FET] Progress: ${i + 1}/${normalActivities.length} (placed=${placed}, failed=${failed}, swaps=${this.totalSwapCalls})`);
            }
        }

        this.log(`[FET] Construction done: ${placed} placed, ${failed} forced. Total swap calls: ${this.totalSwapCalls}`);

        // Step 3: Polish — optimize soft constraints with targeted local search
        this.polishSoftConstraints();

        return this.schedule;
    }

    public getImpossibleActivities(): Activity[] {
        return this.impossibleActivities;
    }

    // ================================================================
    // PERFORMANCE INDEX
    // ================================================================

    private rebuildTimeIndex() {
        this.timeIndex.clear();
        for (const s of this.schedule) {
            const key = `${s.day}-${s.period}`;
            if (!this.timeIndex.has(key)) this.timeIndex.set(key, []);
            this.timeIndex.get(key)!.push(s);
        }
    }

    private addToIndex(slot: TimeSlot) {
        const key = `${slot.day}-${slot.period}`;
        if (!this.timeIndex.has(key)) this.timeIndex.set(key, []);
        this.timeIndex.get(key)!.push(slot);
    }

    private removeFromIndex(slot: TimeSlot) {
        const key = `${slot.day}-${slot.period}`;
        const arr = this.timeIndex.get(key);
        if (arr) {
            const idx = arr.findIndex(s => s.id === slot.id);
            if (idx >= 0) arr.splice(idx, 1);
        }
    }

    /** Fast conflict lookup using time index */
    private findConflictsAtTime(slot: TimeSlot): TimeSlot[] {
        const key = `${slot.day}-${slot.period}`;
        const slotsAtTime = this.timeIndex.get(key) || [];
        const conflicts: TimeSlot[] = [];

        for (const s of slotsAtTime) {
            if (s.id === slot.id) continue;
            // Same class
            if (s.classId === slot.classId) { conflicts.push(s); continue; }
            // Same teacher
            if (s.teacherId === slot.teacherId) { conflicts.push(s); continue; }
            // Same room
            if (slot.roomId && s.roomId === slot.roomId && s.classId !== slot.classId) {
                conflicts.push(s);
            }
        }
        return conflicts;
    }

    // ================================================================
    // STEP 1: Sort by Difficulty
    // ================================================================

    private sortByDifficulty(activities: Activity[]): Activity[] {
        this.resortByDifficulty(activities);
        return activities;
    }

    private resortByDifficulty(activities: Activity[]) {
        for (const act of activities) {
            act.difficulty = this.constraintService.countAvailableSlots(
                act.teacherId, act.classId, act.subjectId, act.isMorning, this.schedule
            );
        }
        activities.sort((a, b) => {
            if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
            if (a.isSpecial !== b.isSpecial) return a.isSpecial ? -1 : 1;
            return 0;
        });
    }

    // ================================================================
    // STEP 1.5: Block Scheduling for GDTC/GDQP
    // ================================================================

    private placeBlockActivities(blockActivities: Activity[]) {
        if (blockActivities.length === 0) return;
        this.log(`[FET] Placing ${blockActivities.length} block activities (GDTC/GDQP)...`);

        // Group by classId + subjectId
        const groups = new Map<string, Activity[]>();
        for (const act of blockActivities) {
            const key = `${act.classId}-${act.subjectId}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(act);
        }

        let placedBlocks = 0;
        let failedBlocks = 0;

        for (const [, acts] of groups) {
            const count = acts.length;
            const sample = acts[0];
            // GDTC/GDQP: opposite session, periods 1-3 (morning) or 8-10 (afternoon)
            const minP = sample.isMorning ? 8 : 1;
            const maxP = sample.isMorning ? 10 : 3;

            let placed = false;
            const days = [2, 3, 4, 5, 6, 7].sort(() => 0.5 - Math.random());

            for (const day of days) {
                if (placed) break;
                // Thursday restriction
                if (day === 5) continue;

                // Check if any opposite-session slot already used on this day for this class
                const hasExisting = this.schedule.some(s =>
                    s.classId === sample.classId && s.day === day &&
                    s.period >= minP && s.period <= maxP
                );
                if (hasExisting) continue;

                // Find consecutive slots
                const validRange = Array.from({ length: maxP - minP + 1 }, (_, i) => minP + i);
                for (let startIdx = 0; startIdx <= validRange.length - count; startIdx++) {
                    const periods = validRange.slice(startIdx, startIdx + count);

                    const canPlace = periods.every(p => {
                        if (this.constraintService.isTeacherBusy(sample.teacherId, day, p)) return false;
                        const conflicts = this.findConflictsAtTime({
                            id: 'test', day, period: p,
                            classId: sample.classId, subjectId: sample.subjectId,
                            teacherId: sample.teacherId
                        });
                        return conflicts.length === 0;
                    });

                    if (canPlace) {
                        for (let i = 0; i < count; i++) {
                            const slot: TimeSlot = {
                                id: acts[i].id,
                                day,
                                period: periods[i],
                                classId: sample.classId,
                                subjectId: sample.subjectId,
                                teacherId: sample.teacherId,
                                roomId: undefined, // yard subject
                                isLocked: false,
                            };
                            this.schedule.push(slot);
                            this.addToIndex(slot);
                        }
                        placed = true;
                        placedBlocks += count;
                        break;
                    }
                }
            }

            if (!placed) {
                failedBlocks += count;
                // Fallback: place individually
                for (const act of acts) {
                    if (!this.placeActivity(act)) {
                        this.impossibleActivities.push(act);
                        this.forcePlaceFallback(act);
                    }
                }
            }
        }

        this.log(`[FET] Block placement done: ${placedBlocks} placed, ${failedBlocks} fell back to individual.`);
    }

    // ================================================================
    // STEP 2: Recursive Swapping (FET Core)
    // ================================================================

    /**
     * Try to place an activity into the timetable.
     * Returns true if successfully placed.
     */
    private placeActivity(activity: Activity): boolean {
        const candidates = this.getCandidateSlots(activity);

        // Try 1: Find an empty valid slot (greedy)
        for (const candidate of candidates) {
            if (candidate.score > 0) break; // remaining candidates all have conflicts
            const slot: TimeSlot = {
                id: activity.id,
                day: candidate.day,
                period: candidate.period,
                classId: activity.classId,
                subjectId: activity.subjectId,
                teacherId: activity.teacherId,
                roomId: activity.isYardSubject ? undefined : activity.roomId,
                isLocked: false,
            };
            if (this.constraintService.isPlacementValid(slot, this.schedule)) {
                this.schedule.push(slot);
                this.addToIndex(slot);
                return true;
            }
        }

        // Try 2: Recursive swapping
        const tabuSet = new Set<string>();
        for (const candidate of candidates) {
            if (this.totalSwapCalls >= this.config.maxTotalBacktracks) break;

            const slot: TimeSlot = {
                id: activity.id,
                day: candidate.day,
                period: candidate.period,
                classId: activity.classId,
                subjectId: activity.subjectId,
                teacherId: activity.teacherId,
                roomId: activity.isYardSubject ? undefined : activity.roomId,
                isLocked: false,
            };
            const success = this.tryPlaceWithSwapping(slot, 0, tabuSet);
            if (success) return true;
        }

        return false;
    }

    /**
     * Core recursive swapping: try to place a slot, displacing conflicts recursively.
     * 
     * FIX: Uses schedule snapshots for reliable rollback instead of tracking IDs.
     */
    private tryPlaceWithSwapping(
        slot: TimeSlot,
        depth: number,
        tabuSet: Set<string>,
    ): boolean {
        this.totalSwapCalls++;

        if (depth > this.config.maxRecursionDepth) return false;
        if (this.totalSwapCalls >= this.config.maxTotalBacktracks) return false;

        // Check structural constraints (don't depend on other slots)
        if (!this.isStructurallyValid(slot)) return false;

        // Find who is in the way
        const conflicts = this.findConflictsAtTime(slot);

        if (conflicts.length === 0) {
            // Check full validity including heavy subjects, consecutive, etc.
            if (this.constraintService.isPlacementValid(slot, this.schedule)) {
                this.schedule.push(slot);
                this.addToIndex(slot);
                return true;
            }
            return false;
        }

        // Filter out locked slots — cannot displace them
        const displaceable = conflicts.filter(c => !c.isLocked);
        if (displaceable.length !== conflicts.length) return false;

        // Tabu check
        const tabuKey = `${slot.classId}-${slot.subjectId}-${slot.day}-${slot.period}`;
        if (tabuSet.has(tabuKey)) return false;
        tabuSet.add(tabuKey);

        // SNAPSHOT schedule for reliable rollback
        const scheduleSnapshot = this.schedule.map(s => ({ ...s }));

        // Remove conflicts from schedule (incremental index update)
        for (const c of displaceable) {
            this.removeFromIndex(c);
        }
        const removedIds = new Set(displaceable.map(s => s.id!));
        this.schedule = this.schedule.filter(s => !removedIds.has(s.id!));

        // Verify placement is valid now (check heavy subjects, consecutive, etc.)
        if (!this.constraintService.isPlacementValid(slot, this.schedule)) {
            // Restore: re-add removed slots
            this.schedule = scheduleSnapshot;
            this.rebuildTimeIndex();
            return false;
        }

        // Place our slot
        this.schedule.push(slot);
        this.addToIndex(slot);

        // Try to re-place each displaced activity
        let allReplaced = true;

        for (const displaced of displaceable) {
            // Determine correct session for displaced activity
            // For GDTC/GDQP: they belong to the OPPOSITE session of the class
            const dCode = this.constraintService.getSubjectCode(displaced.subjectId);
            const isDisplacedSpecial = dCode.includes('GDTC') || dCode.includes('GDQP') || dCode.includes('QUOC_PHONG');
            // Original period tells us which session it WAS in (which is correct for it)
            const displacedIsMorning = isDisplacedSpecial
                ? displaced.period <= 5   // keep actual session (opposite of class)
                : displaced.period <= 5;  // normal: session matches period

            const displacedActivity: Activity = {
                id: displaced.id || crypto.randomUUID(),
                classId: displaced.classId,
                subjectId: displaced.subjectId,
                teacherId: displaced.teacherId,
                roomId: displaced.roomId,
                isMorning: displacedIsMorning,
                isSpecial: isDisplacedSpecial,
                isYardSubject: !displaced.roomId,
                subjectCode: dCode,
                difficulty: 0,
            };

            const candidates = this.getCandidateSlots(displacedActivity);
            let replacedOk = false;

            for (const cand of candidates) {
                const newSlot: TimeSlot = {
                    id: displacedActivity.id,
                    day: cand.day,
                    period: cand.period,
                    classId: displacedActivity.classId,
                    subjectId: displacedActivity.subjectId,
                    teacherId: displacedActivity.teacherId,
                    roomId: displacedActivity.isYardSubject ? undefined : displacedActivity.roomId,
                    isLocked: false,
                };
                if (this.tryPlaceWithSwapping(newSlot, depth + 1, tabuSet)) {
                    replacedOk = true;
                    break;
                }
            }

            if (!replacedOk) {
                allReplaced = false;
                break;
            }
        }

        if (!allReplaced) {
            // ROLLBACK to snapshot (rebuilds index once)
            this.schedule = scheduleSnapshot;
            this.rebuildTimeIndex();
            return false;
        }

        return true;
    }

    // ================================================================
    // STEP 3: Polish — Hard Repair + Simulated Annealing
    // ================================================================

    private polishSoftConstraints() {
        this.log('[FET] Phase 3: Polishing soft constraints...');
        this.rebuildTimeIndex();

        // Phase 3a: Repair hard violations
        this.repairHardViolations();

        // Phase 3b: Block pairing — pair same-subject slots into adjacent periods
        this.repairBlockPairs();

        // Phase 3c: Teacher gap compaction
        this.repairTeacherGaps();

        // Phase 3d: General greedy polish
        this.generalPolish();
    }

    /**
     * Phase 3a: Fix hard violations by trying ALL unlocked slots as swap candidates.
     */
    private repairHardViolations() {
        let hardCount = this.constraintService.checkHardConstraints(this.schedule);
        if (hardCount === 0) return;
        this.log(`[FET] Repairing ${hardCount} hard violations...`);

        let staleCount = 0;
        const maxStale = 500;

        for (let attempt = 0; attempt < 5000 && hardCount > 0 && staleCount < maxStale; attempt++) {
            const unlocked = this.schedule.filter(s => !s.isLocked);
            const offender = this.findHardViolationSlot(unlocked);
            if (!offender) break;

            let improved = false;

            // Try same-class swaps first, then same-teacher cross-class swaps
            const sameClass = unlocked.filter(s => s.classId === offender.classId && s.id !== offender.id);
            const crossClass = unlocked.filter(s =>
                s.teacherId === offender.teacherId && s.classId !== offender.classId && s.id !== offender.id
            );
            const candidates = [...sameClass, ...crossClass].sort(() => Math.random() - 0.5);

            for (const target of candidates) {
                const origDay1 = offender.day, origPeriod1 = offender.period;
                const origDay2 = target.day, origPeriod2 = target.period;

                offender.day = origDay2; offender.period = origPeriod2;
                target.day = origDay1; target.period = origPeriod1;

                const newHard = this.constraintService.checkHardConstraints(this.schedule);
                if (newHard < hardCount) {
                    hardCount = newHard;
                    this.rebuildTimeIndex();
                    improved = true;
                    break;
                }

                offender.day = origDay1; offender.period = origPeriod1;
                target.day = origDay2; target.period = origPeriod2;
            }

            staleCount = improved ? 0 : staleCount + 1;
        }
        this.log(`[FET] Hard repair done. Remaining: ${hardCount}`);
    }

    private findHardViolationSlot(unlocked: TimeSlot[]): TimeSlot | undefined {
        const shuffled = [...unlocked].sort(() => Math.random() - 0.5);

        for (const slot of shuffled) {
            const code = this.constraintService.getSubjectCode(slot.subjectId);

            // GDTC/GDQP time violations
            if (code && (code.includes('GDTC') || code.includes('GDQP') || code.includes('QUOC_PHONG'))) {
                const isMorning = slot.period <= 5;
                if (isMorning && slot.period > 3) return slot;
                if (!isMorning && slot.period < 8) return slot;
            }

            // Teacher conflict
            const key = `${slot.day}-${slot.period}`;
            const slotsAtTime = this.timeIndex.get(key) || [];
            for (const other of slotsAtTime) {
                if (other.id !== slot.id && other.teacherId === slot.teacherId) return slot;
            }

            // Teacher busy
            if (this.constraintService.isTeacherBusy(slot.teacherId, slot.day, slot.period)) return slot;

            // Heavy subjects in same session (>= 3 heavy subjects in one session)
            const heavyCodes = ['TOAN', 'VAN', 'NGU_VAN', 'ANH', 'TIENG_ANH', 'LY', 'VAT_LY', 'HOA', 'HOA_HOC'];
            if (code && heavyCodes.some(h => code.includes(h))) {
                const session = slot.period <= 5 ? 0 : 1;
                const sameClassSameSession = this.schedule.filter(s =>
                    s.classId === slot.classId && s.day === slot.day &&
                    (s.period <= 5 ? 0 : 1) === session && s.id !== slot.id
                );
                const heavyCount = sameClassSameSession.filter(s => {
                    const c = this.constraintService.getSubjectCode(s.subjectId);
                    return heavyCodes.some(h => c.includes(h));
                }).length;
                if (heavyCount >= 2) return slot;
            }

            // Consecutive same subject > 2
            const sameClassSlots = this.schedule.filter(s =>
                s.classId === slot.classId && s.day === slot.day
            ).sort((a, b) => a.period - b.period);

            let cc = 1;
            for (let i = 1; i < sameClassSlots.length; i++) {
                if (sameClassSlots[i].subjectId === sameClassSlots[i - 1].subjectId &&
                    sameClassSlots[i].period === sameClassSlots[i - 1].period + 1) {
                    cc++;
                    if (cc > 2 && sameClassSlots[i].subjectId === slot.subjectId) return slot;
                } else {
                    cc = 1;
                }
            }
        }
        return undefined;
    }

    /**
     * Phase 3b: Pair same-subject slots into adjacent periods.
     */
    private repairBlockPairs() {
        const blockSubjects = ['TOAN', 'VAN', 'NGU_VAN', 'TIN', 'LY', 'HOA', 'SINH'];
        const hardBaseline = this.constraintService.checkHardConstraints(this.schedule);
        let pairsFixed = 0;

        const classMap = new Map<string, TimeSlot[]>();
        for (const s of this.schedule) {
            if (s.isLocked) continue;
            if (!classMap.has(s.classId)) classMap.set(s.classId, []);
            classMap.get(s.classId)!.push(s);
        }

        for (const [_, classSlots] of classMap) {
            const subjectMap = new Map<number, TimeSlot[]>();
            for (const s of classSlots) {
                if (!subjectMap.has(s.subjectId)) subjectMap.set(s.subjectId, []);
                subjectMap.get(s.subjectId)!.push(s);
            }

            for (const [subjId, subjSlots] of subjectMap) {
                const code = this.constraintService.getSubjectCode(subjId);
                if (!blockSubjects.some(b => code.includes(b))) continue;
                if (subjSlots.length < 2) continue;

                for (const slot of subjSlots) {
                    const hasAdjacentPartner = subjSlots.some(other =>
                        other.id !== slot.id && other.day === slot.day &&
                        Math.abs(other.period - slot.period) === 1
                    );
                    if (hasAdjacentPartner) continue;

                    let paired = false;
                    for (const partner of subjSlots) {
                        if (partner.id === slot.id || paired) continue;
                        for (const targetPeriod of [partner.period + 1, partner.period - 1]) {
                            if (targetPeriod < 1 || targetPeriod > 10) continue;
                            if (partner.day === 5 && [3, 4, 5, 8, 9, 10].includes(targetPeriod)) continue;
                            if (partner.day === 2 && targetPeriod === 1) continue;
                            if ((partner.period <= 5) !== (targetPeriod <= 5)) continue;

                            const occupant = classSlots.find(s =>
                                s.day === partner.day && s.period === targetPeriod && !s.isLocked
                            );
                            if (!occupant || occupant.id === slot.id) continue;

                            const origDay1 = slot.day, origPeriod1 = slot.period;
                            const origDay2 = occupant.day, origPeriod2 = occupant.period;

                            slot.day = origDay2; slot.period = origPeriod2;
                            occupant.day = origDay1; occupant.period = origPeriod1;

                            const newHard = this.constraintService.checkHardConstraints(this.schedule);
                            if (newHard <= hardBaseline) {
                                pairsFixed++;
                                paired = true;
                                break;
                            }

                            slot.day = origDay1; slot.period = origPeriod1;
                            occupant.day = origDay2; occupant.period = origPeriod2;
                        }
                    }
                }
            }
        }
        this.rebuildTimeIndex();
        this.log(`[FET] Block pairing done. Pairs fixed: ${pairsFixed}`);
    }

    /**
     * Phase 3c: Compact teacher schedules by swapping to reduce gaps.
     */
    private repairTeacherGaps() {
        const hardBaseline = this.constraintService.checkHardConstraints(this.schedule);
        let gapsFixed = 0;

        const teacherMap = new Map<string, TimeSlot[]>();
        for (const s of this.schedule) {
            if (!teacherMap.has(s.teacherId)) teacherMap.set(s.teacherId, []);
            teacherMap.get(s.teacherId)!.push(s);
        }

        for (const [_, teacherSlots] of teacherMap) {
            const dayMap = new Map<number, TimeSlot[]>();
            for (const s of teacherSlots) {
                if (!dayMap.has(s.day)) dayMap.set(s.day, []);
                dayMap.get(s.day)!.push(s);
            }

            for (const [day, daySlots] of dayMap) {
                for (const sessionPeriods of [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]]) {
                    const sessionSlots = daySlots
                        .filter(s => sessionPeriods.includes(s.period))
                        .sort((a, b) => a.period - b.period);

                    if (sessionSlots.length < 2) continue;

                    for (let i = 0; i < sessionSlots.length - 1; i++) {
                        const gap = sessionSlots[i + 1].period - sessionSlots[i].period - 1;
                        if (gap <= 0) continue;

                        const gapSlot = sessionSlots[i + 1];
                        if (gapSlot.isLocked) continue;

                        const targetPeriod = sessionSlots[i].period + 1;
                        const occupant = this.schedule.find(s =>
                            s.classId === gapSlot.classId && s.day === day &&
                            s.period === targetPeriod && !s.isLocked
                        );

                        if (!occupant) continue;

                        const origDay1 = gapSlot.day, origPeriod1 = gapSlot.period;
                        const origDay2 = occupant.day, origPeriod2 = occupant.period;

                        gapSlot.day = origDay2; gapSlot.period = origPeriod2;
                        occupant.day = origDay1; occupant.period = origPeriod1;

                        const newHard = this.constraintService.checkHardConstraints(this.schedule);
                        if (newHard > hardBaseline) {
                            gapSlot.day = origDay1; gapSlot.period = origPeriod1;
                            occupant.day = origDay2; occupant.period = origPeriod2;
                        } else {
                            gapsFixed++;
                        }
                    }
                }
            }
        }
        this.rebuildTimeIndex();
        this.log(`[FET] Teacher gap repair done. Gaps fixed: ${gapsFixed}`);
    }

    /**
     * Phase 3d: General greedy polish — random swaps that improve soft penalty.
     */
    private generalPolish() {
        const hardBaseline = this.constraintService.checkHardConstraints(this.schedule);
        const startPenalty = this.constraintService.calculatePenalty(this.schedule);
        let currentPenalty = startPenalty;

        const totalIter = this.config.polishIterations;

        for (let iter = 0; iter < totalIter; iter++) {
            const unlocked = this.schedule.filter(s => !s.isLocked);
            if (unlocked.length === 0) break;

            const slot = unlocked[Math.floor(Math.random() * unlocked.length)];
            let target: TimeSlot | undefined;
            const r = Math.random();

            if (r < 0.30) {
                const sameTeacher = unlocked.filter(s =>
                    s.teacherId === slot.teacherId && s.id !== slot.id && s.classId !== slot.classId
                );
                if (sameTeacher.length > 0)
                    target = sameTeacher[Math.floor(Math.random() * sameTeacher.length)];
            } else if (r < 0.40) {
                const emptySlots = this.findEmptySlots(slot);
                if (emptySlots.length > 0) {
                    const dest = emptySlots[Math.floor(Math.random() * emptySlots.length)];
                    const origDay = slot.day, origPeriod = slot.period;
                    slot.day = dest.day; slot.period = dest.period;

                    const newHard = this.constraintService.checkHardConstraints(this.schedule);
                    if (newHard > hardBaseline) {
                        slot.day = origDay; slot.period = origPeriod;
                        continue;
                    }

                    const newPenalty = this.constraintService.calculatePenalty(this.schedule);
                    if (newPenalty < currentPenalty) {
                        currentPenalty = newPenalty;
                    } else {
                        slot.day = origDay; slot.period = origPeriod;
                    }
                    continue;
                }
            }

            if (!target) {
                const sameClass = unlocked.filter(s =>
                    s.classId === slot.classId && s.id !== slot.id
                );
                if (sameClass.length === 0) continue;
                target = sameClass[Math.floor(Math.random() * sameClass.length)];
            }

            const origDay1 = slot.day, origPeriod1 = slot.period;
            const origDay2 = target.day, origPeriod2 = target.period;

            slot.day = origDay2; slot.period = origPeriod2;
            target.day = origDay1; target.period = origPeriod1;

            const newHardViolations = this.constraintService.checkHardConstraints(this.schedule);
            if (newHardViolations > hardBaseline) {
                slot.day = origDay1; slot.period = origPeriod1;
                target.day = origDay2; target.period = origPeriod2;
                continue;
            }

            const newPenalty = this.constraintService.calculatePenalty(this.schedule);
            if (newPenalty < currentPenalty) {
                currentPenalty = newPenalty;
            } else {
                slot.day = origDay1; slot.period = origPeriod1;
                target.day = origDay2; target.period = origPeriod2;
            }
        }

        this.rebuildTimeIndex();
        this.log(`[FET] Polish done. Soft penalty: ${startPenalty} → ${currentPenalty}`);
    }

    /**
     * Find empty time slots for a given slot's class (no class or teacher conflict).
     */
    private findEmptySlots(slot: TimeSlot): { day: number; period: number }[] {
        const results: { day: number; period: number }[] = [];
        for (let day = 2; day <= 7; day++) {
            for (let period = 1; period <= 10; period++) {
                if (day === 5 && [3, 4, 5, 8, 9, 10].includes(period)) continue;
                if (day === 2 && period === 1) continue;
                const key = `${day}-${period}`;
                const existing = this.timeIndex.get(key) || [];
                const hasClassConflict = existing.some(s => s.classId === slot.classId);
                const hasTeacherConflict = existing.some(s => s.teacherId === slot.teacherId);
                if (!hasClassConflict && !hasTeacherConflict) {
                    results.push({ day, period });
                }
            }
        }
        return results;
    }

    // ================================================================
    // HELPERS
    // ================================================================

    private getCandidateSlots(activity: Activity): { day: number; period: number; score: number }[] {
        const candidates: { day: number; period: number; score: number }[] = [];
        const subjCode = activity.subjectCode;
        const isSpecial = subjCode.includes('GDTC') || subjCode.includes('GDQP') || subjCode.includes('QUOC_PHONG');

        for (let day = 2; day <= 7; day++) {
            for (let period = 1; period <= 10; period++) {
                const isMorningPeriod = period <= 5;

                // Thursday restriction
                if (day === 5 && [3, 4, 5, 8, 9, 10].includes(period)) continue;

                // Monday P1 reserved for Chào Cờ
                if (day === 2 && period === 1) continue;

                // Special subject time: GDTC/GDQP must be P1-3 (morning) or P8-10 (afternoon)
                if (isSpecial) {
                    if (isMorningPeriod && period > 3) continue;
                    if (!isMorningPeriod && period < 8) continue;
                }

                // Session penalty: opposite session slots get a high penalty so they're
                // used only when main session is full
                const isMainSession = activity.isMorning === isMorningPeriod;
                const sessionPenalty = isMainSession ? 0 : 100;

                // Score: number of existing conflicts (fewer = better)
                const conflictCount = this.findConflictsAtTime({
                    id: 'test', day, period,
                    classId: activity.classId,
                    subjectId: activity.subjectId,
                    teacherId: activity.teacherId,
                    roomId: activity.isYardSubject ? undefined : activity.roomId,
                }).length;

                candidates.push({ day, period, score: conflictCount + sessionPenalty });
            }
        }

        // Sort: empty slots first, then fewer conflicts, with randomization for ties
        candidates.sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            return Math.random() - 0.5;
        });

        return candidates;
    }

    /**
     * Check structural validity (constraints that don't depend on other slots).
     */
    private isStructurallyValid(slot: TimeSlot): boolean {
        // Teacher busy
        if (this.constraintService.isTeacherBusy(slot.teacherId, slot.day, slot.period)) return false;
        // Thursday
        if (slot.day === 5 && [3, 4, 5, 8, 9, 10].includes(slot.period)) return false;
        // Monday P1
        if (slot.day === 2 && slot.period === 1) return false;
        // Special subject time
        const code = this.constraintService.getSubjectCode(slot.subjectId);
        if (code.includes('GDTC') || code.includes('GDQP') || code.includes('QUOC_PHONG')) {
            if (slot.period <= 5 && slot.period > 3) return false;
            if (slot.period > 5 && slot.period < 8) return false;
        }
        return true;
    }

    /**
     * Last resort: force-place an activity into the least-conflicting slot.
     */
    private forcePlaceFallback(activity: Activity) {
        const candidates = this.getCandidateSlots(activity);

        // Only place if no class AND no teacher conflict (clean placement)
        for (const cand of candidates) {
            const key = `${cand.day}-${cand.period}`;
            const existing = this.timeIndex.get(key) || [];
            if (existing.some(s => s.classId === activity.classId)) continue;
            if (existing.some(s => s.teacherId === activity.teacherId)) continue;

            const slot: TimeSlot = {
                id: activity.id,
                day: cand.day,
                period: cand.period,
                classId: activity.classId,
                subjectId: activity.subjectId,
                teacherId: activity.teacherId,
                roomId: activity.isYardSubject ? undefined : activity.roomId,
                isLocked: false,
            };
            this.schedule.push(slot);
            this.addToIndex(slot);
            this.log(`[FET] FORCED: ${activity.subjectCode} for class ${activity.classId} at day=${cand.day} period=${cand.period}`);
            return;
        }

        // No slot available at all — class is completely full
        this.log(`[FET] DROPPED: ${activity.subjectCode} for class ${activity.classId} — no available slot`);
    }
}
