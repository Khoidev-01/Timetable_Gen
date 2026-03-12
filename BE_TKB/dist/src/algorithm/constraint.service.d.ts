import { PrismaService } from '../prisma/prisma.service';
export interface TimeSlot {
    id?: string;
    day: number;
    period: number;
    classId: string;
    subjectId: number;
    teacherId: string;
    roomId?: number;
    isLocked?: boolean;
}
export declare class ConstraintService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    roomMap: Map<string, number>;
    subjectMap: Map<string, number>;
    subjects: any[];
    teacherMap: Map<string, any>;
    teacherMapByName: Map<string, any>;
    initialize(semesterId: string): Promise<void>;
    checkTeacherConflict(slot: TimeSlot, others: TimeSlot[]): boolean;
    checkClassConflict(slot: TimeSlot, others: TimeSlot[]): boolean;
    checkRoomConflict(slot: TimeSlot, others: TimeSlot[]): boolean;
    getValidRooms(grade: number, session: 'SANG' | 'CHIEU', period: number, subjectType: 'LY_THUYET' | 'THUC_HANH', subjectCode?: string): number[];
    isTeacherBusy(teacherId: string, day: number, period: number): boolean;
    getRoomIds(): number[];
    getRoomId(name: string): number | undefined;
    private getRangeRoomIds;
    checkFixedSlot(day: number, period: number, grade: number, session: 'SANG' | 'CHIEU'): {
        isFixed: boolean;
        subjectCode?: string;
    };
    checkHardConstraints(schedule: TimeSlot[]): number;
    private countTimeOverlaps;
    calculatePenalty(schedule: TimeSlot[]): number;
    private groupBy;
    private checkSpreadSubjects;
    private checkHeavySubjects;
    private checkMorningPriority;
    private checkBlock2;
    private checkTeacherOffDay;
    private checkNoHoles;
    private checkMaxLoad;
    private getSubjectCode;
    getFitnessDetails(schedule: TimeSlot[]): any;
    private checkTeacherConflictDetails;
    private checkClassConflictDetails;
    private checkRoomConflictDetails;
}
