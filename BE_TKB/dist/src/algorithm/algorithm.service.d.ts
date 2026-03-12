import { PrismaService } from '../prisma/prisma.service';
import { ConstraintService } from './constraint.service';
export declare class AlgorithmService {
    private prisma;
    private constraintService;
    private readonly logger;
    constructor(prisma: PrismaService, constraintService: ConstraintService);
    runAlgorithm(semesterId: string): Promise<{
        debugLogs: string[];
        fitnessDetails: any;
        success: boolean;
        id: string;
        error?: undefined;
    } | {
        debugLogs: string[];
        success: boolean;
        error: any;
    }>;
    private loadData;
    private initializeSolution;
    private phase1_FixedSlots;
    private phase2_Heuristic;
    private phase3_Genetic;
    private calculateFitness;
    private getConflicts;
    private isSlotOccupied;
    private shuffleArray;
    private saveToDatabase;
    moveSlot(data: {
        slotId: string;
        newDay: number;
        newPeriod: number;
    }): Promise<{
        success: boolean;
    }>;
    toggleLock(slotId: string): Promise<{
        success: boolean;
        is_locked: boolean;
    }>;
}
