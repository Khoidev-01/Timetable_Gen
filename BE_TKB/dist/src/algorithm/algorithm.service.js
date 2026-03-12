"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AlgorithmService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlgorithmService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const constraint_service_1 = require("./constraint.service");
let AlgorithmService = AlgorithmService_1 = class AlgorithmService {
    prisma;
    constraintService;
    logger = new common_1.Logger(AlgorithmService_1.name);
    constructor(prisma, constraintService) {
        this.prisma = prisma;
        this.constraintService = constraintService;
    }
    async runAlgorithm(semesterId) {
        const debugLogs = [];
        const log = (msg) => {
            this.logger.log(msg);
            debugLogs.push(msg);
        };
        try {
            log(`[DEBUG] Starting Algorithm for Semester: ${semesterId}`);
            await this.constraintService.initialize(semesterId);
            const data = await this.loadData(semesterId);
            log(`[DEBUG] Data Loaded: ${data.classes.length} Classes, ${data.subjects.length} Subjects.`);
            const solution = this.initializeSolution(data);
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
                });
            }
            await this.phase1_FixedSlots(solution, data, log);
            this.phase2_Heuristic(solution, data);
            await this.phase3_Genetic(solution, data);
            log(`[DEBUG] Saving ${solution.slots.length} slots to database...`);
            const fitnessResult = this.constraintService.getFitnessDetails(solution.slots);
            solution.fitness_score = fitnessResult.score;
            const timetable = await this.saveToDatabase(semesterId, solution, data, log);
            return { ...timetable, debugLogs, fitnessDetails: fitnessResult.details, success: true };
        }
        catch (error) {
            log(`[ERROR] Algorithm Failed: ${error.message}`);
            if (error.stack)
                log(`[ERROR] Stack: ${error.stack}`);
            return { debugLogs, success: false, error: error.message };
        }
    }
    async loadData(semesterId) {
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
    initializeSolution(data) {
        return {
            slots: [],
            teacherBusy: new Set(),
            roomBusy: new Set(),
            classBusy: new Set(),
        };
    }
    async phase1_FixedSlots(solution, data, log) {
        const { classes, subjects, teachers } = data;
        const subjectCodeMap = new Map();
        subjects.forEach((s) => subjectCodeMap.set(s.code, s.id));
        const resolveSubjectId = (code) => {
            if (subjectCodeMap.has(code))
                return subjectCodeMap.get(code);
            if (code === 'SH_CN')
                return subjectCodeMap.get('SHCN');
            if (code === 'SINH_HOAT')
                return subjectCodeMap.get('SHCN');
            return undefined;
        };
        const bghTeacher = teachers.find((t) => t.code === 'BGH') || teachers[0];
        const bghId = bghTeacher ? bghTeacher.id : null;
        if (!bghId)
            log(`[WARN] No Teacher found for system slots!`);
        let fixedCount = 0;
        for (const cls of classes) {
            const gradeMatches = cls.name.match(/\d+/);
            const grade = gradeMatches ? parseInt(gradeMatches[0]) : 0;
            const isMorning = [12, 10].includes(grade);
            const session = isMorning ? 'SANG' : 'CHIEU';
            for (let d = 2; d <= 7; d++) {
                for (let p = 1; p <= 10; p++) {
                    if (isMorning && p > 5)
                        continue;
                    if (!isMorning && p <= 5)
                        continue;
                    if (this.isSlotOccupied(solution.slots, cls.id, d, p))
                        continue;
                    const check = this.constraintService.checkFixedSlot(d, p, grade, session);
                    if (check.isFixed && check.subjectCode) {
                        let subjId = resolveSubjectId(check.subjectCode);
                        let teacherId = null;
                        if (check.subjectCode === 'GVCN_TEACHING') {
                            const homeroomId = cls.homeroom_teacher_id;
                            if (homeroomId) {
                                const assignment = data.assignments.find((a) => {
                                    if (a.class_id !== cls.id || a.teacher_id !== homeroomId)
                                        return false;
                                    const subj = data.subjects.find((s) => s.id === a.subject_id);
                                    return subj && !subj.is_special;
                                });
                                if (assignment) {
                                    subjId = assignment.subject_id;
                                    teacherId = homeroomId;
                                }
                                else {
                                    log(`[WARNING] GVCN (ID: ${homeroomId}) does not teach any Cultural Subject for Class ${cls.name}.`);
                                }
                            }
                        }
                        if (subjId) {
                            if (['SHCN', 'SH_CN', 'SINH_HOAT', 'SH_DAU_TUAN', 'SH_CUOI_TUAN'].includes(check.subjectCode)) {
                                teacherId = cls.homeroom_teacher_id;
                            }
                            else if (check.subjectCode === 'CHAO_CO') {
                                teacherId = bghId;
                            }
                            else if (['GDDP', 'HDTN'].includes(check.subjectCode)) {
                                const assignment = data.assignments.find((a) => a.class_id === cls.id && a.subject_id === subjId);
                                if (assignment)
                                    teacherId = assignment.teacher_id;
                            }
                            if (!teacherId)
                                teacherId = bghId;
                            let roomId = cls.fixed_room_id;
                            if (check.subjectCode === 'CHAO_CO') {
                                roomId = undefined;
                            }
                            if (teacherId) {
                                const slot = {
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
    phase2_Heuristic(solution, data) {
        this.logger.log('Phase 2: Heuristic Filling with Block Scheduling...');
        const { classes, assignments } = data;
        const classAssignments = new Map();
        assignments.forEach((agg) => {
            const subject = data.subjects.find((s) => s.id === agg.subject_id);
            if (subject && !['CHAO_CO', 'SH_DAU_TUAN', 'SH_CUOI_TUAN', 'GDDP', 'HDTN'].includes(subject.code)) {
                if (!classAssignments.has(agg.class_id))
                    classAssignments.set(agg.class_id, []);
                classAssignments.get(agg.class_id).push({ ...agg });
            }
        });
        for (const cls of classes) {
            const clsAssignments = classAssignments.get(cls.id) || [];
            if (clsAssignments.length === 0) {
                this.logger.warn(`[WARNING] Class ${cls.name} (ID: ${cls.id}) has 0 heuristic assignments.`);
                continue;
            }
            const isMorningMain = cls.main_session === 0;
            const mainSessionSlots = [];
            const oppositeGeneralSlots = [];
            const oppositeBlockSubjects = [];
            for (const assign of clsAssignments) {
                const subject = data.subjects.find((s) => s.id === assign.subject_id);
                const isOpposite = subject && (subject.code === 'GDQP' || subject.code === 'GDTC');
                const alreadyAssigned = solution.slots.filter((s) => s.classId === cls.id && s.subjectId === assign.subject_id).length;
                const remainingNeeded = Math.max(0, assign.total_periods - alreadyAssigned);
                if (remainingNeeded === 0)
                    continue;
                if (isOpposite) {
                    oppositeBlockSubjects.push({ assign, count: remainingNeeded });
                }
                else {
                    for (let i = 0; i < remainingNeeded; i++) {
                        mainSessionSlots.push(assign);
                    }
                }
            }
            for (const block of oppositeBlockSubjects) {
                const { assign, count } = block;
                const minP = isMorningMain ? 6 : 1;
                const maxP = isMorningMain ? 10 : 5;
                const validRange = Array.from({ length: maxP - minP + 1 }, (_, i) => minP + i);
                let placed = false;
                const days = [2, 3, 4, 5, 6, 7].sort(() => 0.5 - Math.random());
                for (const day of days) {
                    if (placed)
                        break;
                    const hasOpposite = solution.slots.some((s) => s.classId === cls.id && s.day === day && (s.period >= minP && s.period <= maxP));
                    if (hasOpposite)
                        continue;
                    for (let startIdx = 0; startIdx <= validRange.length - count; startIdx++) {
                        const periodsToCheck = validRange.slice(startIdx, startIdx + count);
                        const canPlace = periodsToCheck.every(p => {
                            if (day === 2 && p === 1)
                                return false;
                            if (day === 5 && ![1, 2, 6, 7].includes(p))
                                return false;
                            if (this.isSlotOccupied(solution.slots, cls.id, day, p))
                                return false;
                            if (this.constraintService.checkTeacherConflict({ day, period: p, teacherId: assign.teacher_id }, solution.slots))
                                return false;
                            return true;
                        });
                        if (canPlace) {
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
                    for (let k = 0; k < count; k++)
                        oppositeGeneralSlots.push(assign);
                }
            }
            this.shuffleArray(mainSessionSlots);
            this.shuffleArray(oppositeGeneralSlots);
            for (let day = 2; day <= 7; day++) {
                for (let period = 1; period <= 10; period++) {
                    const isMorningPeriod = period <= 5;
                    const isMainSlot = (isMorningMain && isMorningPeriod) || (!isMorningMain && !isMorningPeriod);
                    let candidates = isMainSlot ? mainSessionSlots : oppositeGeneralSlots;
                    if (candidates.length === 0)
                        continue;
                    if (this.isSlotOccupied(solution.slots, cls.id, day, period))
                        continue;
                    if (day === 2 && period === 1)
                        continue;
                    if (day === 5 && ![1, 2, 6, 7].includes(period))
                        continue;
                    for (let i = 0; i < candidates.length; i++) {
                        const assign = candidates[i];
                        if (!isMainSlot) {
                            const hasOpposite = solution.slots.some((s) => s.classId === cls.id && s.day === day && (isMorningMain ? s.period > 5 : s.period <= 5));
                            if (hasOpposite)
                                continue;
                        }
                        if (this.constraintService.checkTeacherConflict({ day, period, teacherId: assign.teacher_id }, solution.slots))
                            continue;
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
    async phase3_Genetic(solution, data) {
        this.logger.log('Phase 3: Genetic Optimization...');
        let currentSlots = [...solution.slots];
        let bestScore = this.calculateFitness(currentSlots);
        this.logger.log(`Initial Fitness: ${bestScore}`);
        const GENERATIONS = 50;
        for (let gen = 0; gen < GENERATIONS; gen++) {
            const conflicts = this.getConflicts(currentSlots);
            if (conflicts.length === 0 && bestScore >= 0)
                break;
            const candidateSlot = conflicts.length > 0
                ? conflicts[Math.floor(Math.random() * conflicts.length)]
                : currentSlots[Math.floor(Math.random() * currentSlots.length)];
            if (!candidateSlot || candidateSlot.isLocked)
                continue;
            const classSlots = currentSlots.filter(s => s.classId === candidateSlot.classId && !s.isLocked);
            const targetSlot = classSlots[Math.floor(Math.random() * classSlots.length)];
            if (targetSlot && targetSlot.id !== candidateSlot.id) {
                const tempDay = candidateSlot.day;
                const tempPeriod = candidateSlot.period;
                candidateSlot.day = targetSlot.day;
                candidateSlot.period = targetSlot.period;
                targetSlot.day = tempDay;
                targetSlot.period = tempPeriod;
                const newScore = this.calculateFitness(currentSlots);
                if (newScore > bestScore) {
                    bestScore = newScore;
                }
                else {
                    targetSlot.period = candidateSlot.period;
                    targetSlot.day = candidateSlot.day;
                    candidateSlot.day = tempDay;
                    candidateSlot.period = tempPeriod;
                }
            }
        }
        solution.fitness_score = bestScore;
        solution.slots = currentSlots;
    }
    calculateFitness(slots) {
        const violations = this.constraintService.checkHardConstraints(slots);
        return 1000 - (violations * 100);
    }
    getConflicts(slots) {
        const conflictedSlots = [];
        const map = new Map();
        slots.forEach(s => {
            const key = `${s.teacherId}-${s.day}-${s.period}`;
            if (!map.has(key))
                map.set(key, []);
            map.get(key).push(s);
        });
        map.forEach(group => {
            if (group.length > 1)
                conflictedSlots.push(...group);
        });
        return conflictedSlots;
    }
    isSlotOccupied(slots, classId, day, period) {
        return slots.some(s => s.classId === classId && s.day === day && s.period === period);
    }
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    async saveToDatabase(semesterId, solution, data, log) {
        try {
            const timetable = await this.prisma.generatedTimetable.create({
                data: {
                    name: `TKB ${new Date().toLocaleString('vi-VN')}`,
                    semester_id: semesterId,
                    fitness_score: solution.fitness_score,
                }
            });
            log(`[DEBUG] Header Created: ${timetable.id}`);
            const slotsToCreate = solution.slots.map((s) => ({
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
            }
            else {
                log('[DEBUG] No slots to insert!');
            }
            return { success: true, id: timetable.id };
        }
        catch (e) {
            log(`[DEBUG] Save Failed: ${e}`);
            throw e;
        }
    }
    async moveSlot(data) {
        const { slotId, newDay, newPeriod } = data;
        const sourceSlot = await this.prisma.timetableSlot.findUnique({
            where: { id: slotId }
        });
        if (!sourceSlot)
            throw new Error('Slot not found');
        const targetSlot = await this.prisma.timetableSlot.findFirst({
            where: {
                timetable_id: sourceSlot.timetable_id,
                class_id: sourceSlot.class_id,
                day: newDay,
                period: newPeriod
            }
        });
        const updates = [];
        if (targetSlot) {
            updates.push(this.prisma.timetableSlot.update({
                where: { id: sourceSlot.id },
                data: { day: 9, period: 99 }
            }));
            updates.push(this.prisma.timetableSlot.update({
                where: { id: targetSlot.id },
                data: { day: sourceSlot.day, period: sourceSlot.period, is_locked: true }
            }));
            updates.push(this.prisma.timetableSlot.update({
                where: { id: sourceSlot.id },
                data: { day: newDay, period: newPeriod, is_locked: true }
            }));
        }
        else {
            updates.push(this.prisma.timetableSlot.update({
                where: { id: sourceSlot.id },
                data: { day: newDay, period: newPeriod, is_locked: true }
            }));
        }
        await this.prisma.$transaction(updates);
        return { success: true };
    }
    async toggleLock(slotId) {
        const slot = await this.prisma.timetableSlot.findUnique({ where: { id: slotId } });
        if (!slot)
            throw new Error('Slot not found');
        const updated = await this.prisma.timetableSlot.update({
            where: { id: slotId },
            data: { is_locked: !slot.is_locked }
        });
        return { success: true, is_locked: updated.is_locked };
    }
};
exports.AlgorithmService = AlgorithmService;
exports.AlgorithmService = AlgorithmService = AlgorithmService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        constraint_service_1.ConstraintService])
], AlgorithmService);
//# sourceMappingURL=algorithm.service.js.map