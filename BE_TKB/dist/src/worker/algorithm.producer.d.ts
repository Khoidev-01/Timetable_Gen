import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
export declare class AlgorithmProducer {
    private optimizationQueue;
    private prisma;
    constructor(optimizationQueue: Queue, prisma: PrismaService);
    startOptimization(semesterId: string): Promise<{
        message: string;
        jobId: string | undefined;
        semesterId: string;
    }>;
    getJobStatus(jobId: string): Promise<{
        id: string | undefined;
        state: import("bullmq").JobState | "unknown";
        progress: import("bullmq").JobProgress;
        result: any;
    } | null>;
    getResult(semesterId: string): Promise<never[] | {
        bestSchedule: {
            id: string;
            classId: string;
            className: string | undefined;
            subjectId: number;
            subjectName: string | undefined;
            subject: {
                name: string;
                code: string;
                color: string;
            } | undefined;
            teacherId: string;
            teacherName: string | undefined;
            roomId: number | null;
            roomName: string | undefined;
            day: number;
            period: number;
            session: number;
            is_locked: boolean;
        }[];
        fitness_score: number | null;
        is_official: boolean;
        generated_at: Date;
    }>;
}
