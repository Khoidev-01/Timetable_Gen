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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlgorithmProducer = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const prisma_service_1 = require("../prisma/prisma.service");
let AlgorithmProducer = class AlgorithmProducer {
    optimizationQueue;
    prisma;
    constructor(optimizationQueue, prisma) {
        this.optimizationQueue = optimizationQueue;
        this.prisma = prisma;
    }
    async startOptimization(semesterId) {
        const job = await this.optimizationQueue.add('optimize-schedule', {
            semesterId,
            params: {
                populationSize: 50,
                maxGenerations: 100,
                mutationRate: 0.02
            }
        });
        return { message: 'Optimization started', jobId: job.id, semesterId };
    }
    async getJobStatus(jobId) {
        const job = await this.optimizationQueue.getJob(jobId);
        if (!job)
            return null;
        const state = await job.getState();
        const progress = job.progress;
        const result = job.returnvalue;
        return { id: job.id, state, progress, result };
    }
    async getResult(semesterId) {
        const latestTkb = await this.prisma.generatedTimetable.findFirst({
            where: { semester_id: semesterId },
            orderBy: { created_at: 'desc' },
            include: {
                slots: true
            }
        });
        if (!latestTkb)
            return [];
        const teacherIds = [...new Set(latestTkb.slots.map(t => t.teacher_id).filter(Boolean))];
        const teachers = await this.prisma.teacher.findMany({
            where: { id: { in: teacherIds } },
            select: { id: true, full_name: true }
        });
        const teacherMap = new Map(teachers.map(t => [t.id, t.full_name]));
        const roomIds = [...new Set(latestTkb.slots.map(t => t.room_id).filter(Boolean))];
        const rooms = await this.prisma.room.findMany({
            where: { id: { in: roomIds } },
            select: { id: true, name: true }
        });
        const roomMap = new Map(rooms.map(r => [r.id, r.name]));
        const subjectIds = [...new Set(latestTkb.slots.map(t => t.subject_id).filter(Boolean))];
        const subjects = await this.prisma.subject.findMany({
            where: { id: { in: subjectIds } },
            select: { id: true, name: true, code: true, color: true }
        });
        const subjectMap = new Map(subjects.map(s => [s.id, s]));
        const classIds = [...new Set(latestTkb.slots.map(t => t.class_id).filter(Boolean))];
        const classes = await this.prisma.class.findMany({
            where: { id: { in: classIds } },
            select: { id: true, name: true }
        });
        const classMap = new Map(classes.map(c => [c.id, c.name]));
        const bestSchedule = latestTkb.slots.map(tiet => {
            const subj = subjectMap.get(tiet.subject_id);
            return {
                id: tiet.id,
                classId: tiet.class_id,
                className: classMap.get(tiet.class_id),
                subjectId: tiet.subject_id,
                subjectName: subj?.name,
                subject: subj ? { name: subj.name, code: subj.code, color: subj.color } : undefined,
                teacherId: tiet.teacher_id,
                teacherName: tiet.teacher_id ? teacherMap.get(tiet.teacher_id) : undefined,
                roomId: tiet.room_id,
                roomName: tiet.room_id ? roomMap.get(tiet.room_id) : undefined,
                day: tiet.day,
                period: tiet.period,
                session: tiet.period <= 5 ? 0 : 1,
                is_locked: tiet.is_locked
            };
        });
        return {
            bestSchedule,
            fitness_score: latestTkb.fitness_score,
            is_official: latestTkb.is_official,
            generated_at: latestTkb.created_at
        };
    }
};
exports.AlgorithmProducer = AlgorithmProducer;
exports.AlgorithmProducer = AlgorithmProducer = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('optimization')),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        prisma_service_1.PrismaService])
], AlgorithmProducer);
//# sourceMappingURL=algorithm.producer.js.map