import { AlgorithmService } from './algorithm.service';
import { AlgorithmProducer } from '../worker/algorithm.producer';
import { ExportService } from './export.service';
import type { Response } from 'express';
export declare class AlgorithmController {
    private readonly algorithmService;
    private readonly algorithmProducer;
    private readonly exportService;
    constructor(algorithmService: AlgorithmService, algorithmProducer: AlgorithmProducer, exportService: ExportService);
    startOptimization(body: {
        semesterId: string;
    }): Promise<{
        message: string;
        jobId: string | undefined;
        semesterId: string;
    }>;
    getStatus(jobId: string): Promise<{
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
    exportSchedule(semesterId: string, res: Response): Promise<void>;
    moveSlot(body: {
        slotId: string;
        newDay: number;
        newPeriod: number;
        newRoomId?: number;
    }): Promise<{
        success: boolean;
    }>;
    toggleLock(body: {
        slotId: string;
    }): Promise<{
        success: boolean;
        is_locked: boolean;
    }>;
}
