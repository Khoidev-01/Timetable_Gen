import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AlgorithmService } from '../algorithm/algorithm.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConstraintService } from '../algorithm/constraint.service';

@Injectable()
export class AlgorithmProducer {
    private readonly logger = new Logger(AlgorithmProducer.name);

    constructor(
        @InjectQueue('optimization') private optimizationQueue: Queue,
        private algorithmService: AlgorithmService,
        private prisma: PrismaService,
        private constraintService: ConstraintService
    ) { }

    async startOptimization(semesterId: string) {
        // Check if Redis/Queue is available with a timeout
        const isRedisAvailable = await this.checkRedis();
        
        if (isRedisAvailable) {
            try {
                const job = await this.optimizationQueue.add('optimize-schedule', {
                    semesterId,
                    params: { populationSize: 100, maxGenerations: 200, mutationRate: 0.05 }
                });
                return { message: 'Optimization started', jobId: job.id, semesterId };
            } catch (error) {
                this.logger.warn('Queue add failed, falling back to direct mode');
            }
        }

        // Fallback: run directly without queue
        this.logger.warn('Running algorithm directly (no Redis)...');
        const result = await this.algorithmService.runAlgorithm(semesterId);
        return { 
            message: 'Optimization completed (direct mode)', 
            jobId: 'direct-' + Date.now(), 
            semesterId, 
            directResult: true,
            success: result.success 
        };
    }

    private async checkRedis(): Promise<boolean> {
        try {
            const client = await (this.optimizationQueue as any).client;
            if (!client) return false;
            const result = await Promise.race([
                client.ping(),
                new Promise((_, reject) => setTimeout(() => reject('timeout'), 1000))
            ]);
            return result === 'PONG';
        } catch {
            return false;
        }
    }

    async getJobStatus(jobId: string) {
        // Handle direct-mode jobs
        if (jobId.startsWith('direct-')) {
            return { id: jobId, state: 'completed', progress: 100, result: { success: true } };
        }
        const job = await this.optimizationQueue.getJob(jobId);
        if (!job) return null;

        const state = await job.getState();
        const progress = job.progress;
        const result = job.returnvalue;

        return { id: job.id, state, progress, result };
    }

    async getResult(semesterId: string) {
        const latestTkb = await this.prisma.generatedTimetable.findFirst({
            where: { semester_id: semesterId },
            orderBy: { created_at: 'desc' },
            include: {
                slots: true
            }
        });

        if (!latestTkb) return [];

        // Fetch Reference Data (Names)
        const teacherIds = [...new Set(latestTkb.slots.map(t => t.teacher_id).filter(Boolean))];
        const teachers = await this.prisma.teacher.findMany({
            where: { id: { in: teacherIds as string[] } },
            select: { id: true, full_name: true }
        });
        const teacherMap = new Map(teachers.map(t => [t.id, t.full_name]));

        const roomIds = [...new Set(latestTkb.slots.map(t => t.room_id).filter(Boolean))];
        const rooms = await this.prisma.room.findMany({
            where: { id: { in: roomIds as number[] } },
            select: { id: true, name: true }
        });
        const roomMap = new Map(rooms.map(r => [r.id, r.name]));

        // Fetch Subject Names, Codes, Colors
        const subjectIds = [...new Set(latestTkb.slots.map(t => t.subject_id).filter(Boolean))];
        const subjects = await this.prisma.subject.findMany({
            where: { id: { in: subjectIds as number[] } },
            select: { id: true, name: true, code: true, color: true }
        });
        const subjectMap = new Map(subjects.map(s => [s.id, s]));

        // Fetch Class Names
        const classIds = [...new Set(latestTkb.slots.map(t => t.class_id).filter(Boolean))];
        const classes = await this.prisma.class.findMany({
            where: { id: { in: classIds as string[] } },
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

        // Calculate fitness details
        const timeSlots = latestTkb.slots.map(t => ({
            id: t.id,
            day: t.day,
            period: t.period,
            classId: t.class_id,
            subjectId: t.subject_id,
            teacherId: t.teacher_id,
            roomId: t.room_id || undefined,
            isLocked: t.is_locked
        }));
        
        await this.constraintService.initialize(semesterId);
        const fitnessResult = this.constraintService.getFitnessDetails(timeSlots, classMap);

        return {
            bestSchedule,
            fitness_score: latestTkb.fitness_score,
            fitnessDetails: fitnessResult.details,
            fitnessViolations: fitnessResult.violations,
            hardViolations: fitnessResult.hardViolations,
            softPenalty: fitnessResult.softPenalty,
            is_official: latestTkb.is_official,
            generated_at: latestTkb.created_at
        };
    }
}
