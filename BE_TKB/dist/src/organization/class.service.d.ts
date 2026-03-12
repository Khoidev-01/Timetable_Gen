import { PrismaService } from '../prisma/prisma.service';
export declare class ClassService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<({
        fixed_room: {
            id: number;
            name: string;
            type: import(".prisma/client").$Enums.RoomType;
            floor: number;
            capacity: number;
        } | null;
        homeroom_teacher: {
            id: string;
            code: string;
            full_name: string;
            short_name: string | null;
            email: string | null;
            phone: string | null;
            max_periods_per_week: number;
        } | null;
    } & {
        id: string;
        name: string;
        grade_level: number;
        main_session: number;
        fixed_room_id: number | null;
        homeroom_teacher_id: string | null;
    })[]>;
    findOne(id: string): Promise<{
        fixed_room: {
            id: number;
            name: string;
            type: import(".prisma/client").$Enums.RoomType;
            floor: number;
            capacity: number;
        } | null;
        homeroom_teacher: {
            id: string;
            code: string;
            full_name: string;
            short_name: string | null;
            email: string | null;
            phone: string | null;
            max_periods_per_week: number;
        } | null;
    } & {
        id: string;
        name: string;
        grade_level: number;
        main_session: number;
        fixed_room_id: number | null;
        homeroom_teacher_id: string | null;
    }>;
    create(data: any): Promise<{
        id: string;
        name: string;
        grade_level: number;
        main_session: number;
        fixed_room_id: number | null;
        homeroom_teacher_id: string | null;
    }>;
    update(id: string, data: any): Promise<{
        id: string;
        name: string;
        grade_level: number;
        main_session: number;
        fixed_room_id: number | null;
        homeroom_teacher_id: string | null;
    }>;
    delete(id: string): Promise<{
        id: string;
        name: string;
        grade_level: number;
        main_session: number;
        fixed_room_id: number | null;
        homeroom_teacher_id: string | null;
    }>;
}
