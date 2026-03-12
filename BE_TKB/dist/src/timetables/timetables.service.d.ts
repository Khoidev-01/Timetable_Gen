import { PrismaService } from '../prisma/prisma.service';
export declare class TimetablesService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(semesterId: string): Promise<({
        slots: {
            id: string;
            timetable_id: string;
            class_id: string;
            subject_id: number;
            teacher_id: string;
            room_id: number | null;
            day: number;
            period: number;
            is_locked: boolean;
        }[];
    } & {
        id: string;
        name: string;
        semester_id: string;
        is_official: boolean;
        fitness_score: number | null;
        created_at: Date;
    })[]>;
    findOne(id: string): Promise<{
        slots: {
            id: string;
            timetable_id: string;
            class_id: string;
            subject_id: number;
            teacher_id: string;
            room_id: number | null;
            day: number;
            period: number;
            is_locked: boolean;
        }[];
    } & {
        id: string;
        name: string;
        semester_id: string;
        is_official: boolean;
        fitness_score: number | null;
        created_at: Date;
    }>;
    create(data: any): Promise<{
        id: string;
        name: string;
        semester_id: string;
        is_official: boolean;
        fitness_score: number | null;
        created_at: Date;
    }>;
}
