import { PrismaService } from '../prisma/prisma.service';
export declare class TeacherService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<({
        constraints: {
            id: number;
            teacher_id: string;
            day_of_week: number;
            period: number;
            session: number;
            type: import(".prisma/client").$Enums.ConstraintType;
        }[];
    } & {
        id: string;
        code: string;
        full_name: string;
        short_name: string | null;
        email: string | null;
        phone: string | null;
        max_periods_per_week: number;
        department: string | null;
        status: string;
        workload_reduction: number;
        notes: string | null;
    })[]>;
    findOne(id: string): Promise<{
        homeroom_classes: {
            id: string;
            name: string;
            grade_level: number;
            main_session: number;
            student_count: number | null;
            combination_code: string | null;
            notes: string | null;
            fixed_room_id: number | null;
            homeroom_teacher_id: string | null;
        }[];
        constraints: {
            id: number;
            teacher_id: string;
            day_of_week: number;
            period: number;
            session: number;
            type: import(".prisma/client").$Enums.ConstraintType;
        }[];
    } & {
        id: string;
        code: string;
        full_name: string;
        short_name: string | null;
        email: string | null;
        phone: string | null;
        max_periods_per_week: number;
        department: string | null;
        status: string;
        workload_reduction: number;
        notes: string | null;
    }>;
    create(data: any): Promise<{
        id: string;
        code: string;
        full_name: string;
        short_name: string | null;
        email: string | null;
        phone: string | null;
        max_periods_per_week: number;
        department: string | null;
        status: string;
        workload_reduction: number;
        notes: string | null;
    }>;
    update(id: string, data: any): Promise<{
        id: string;
        code: string;
        full_name: string;
        short_name: string | null;
        email: string | null;
        phone: string | null;
        max_periods_per_week: number;
        department: string | null;
        status: string;
        workload_reduction: number;
        notes: string | null;
    }>;
    delete(id: string): Promise<{
        id: string;
        code: string;
        full_name: string;
        short_name: string | null;
        email: string | null;
        phone: string | null;
        max_periods_per_week: number;
        department: string | null;
        status: string;
        workload_reduction: number;
        notes: string | null;
    }>;
    updateConstraints(teacherId: string, constraints: any[]): Promise<{
        homeroom_classes: {
            id: string;
            name: string;
            grade_level: number;
            main_session: number;
            student_count: number | null;
            combination_code: string | null;
            notes: string | null;
            fixed_room_id: number | null;
            homeroom_teacher_id: string | null;
        }[];
        constraints: {
            id: number;
            teacher_id: string;
            day_of_week: number;
            period: number;
            session: number;
            type: import(".prisma/client").$Enums.ConstraintType;
        }[];
    } & {
        id: string;
        code: string;
        full_name: string;
        short_name: string | null;
        email: string | null;
        phone: string | null;
        max_periods_per_week: number;
        department: string | null;
        status: string;
        workload_reduction: number;
        notes: string | null;
    }>;
}
