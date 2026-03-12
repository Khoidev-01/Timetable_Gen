import { PrismaService } from '../prisma/prisma.service';
export declare class AssignmentsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(semesterId: string): Promise<({
        subject: {
            id: number;
            code: string;
            name: string;
            color: string;
            is_special: boolean;
            is_practice: boolean;
        };
        teacher: {
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
        };
        class: {
            id: string;
            name: string;
            grade_level: number;
            main_session: number;
            student_count: number | null;
            combination_code: string | null;
            notes: string | null;
            fixed_room_id: number | null;
            homeroom_teacher_id: string | null;
        };
    } & {
        id: string;
        semester_id: string;
        class_id: string;
        teacher_id: string;
        subject_id: number;
        total_periods: number;
        period_type: import(".prisma/client").$Enums.PeriodType;
        required_room_type: import(".prisma/client").$Enums.RoomType | null;
        block_config: string | null;
    })[]>;
    create(data: any): Promise<{
        id: string;
        semester_id: string;
        class_id: string;
        teacher_id: string;
        subject_id: number;
        total_periods: number;
        period_type: import(".prisma/client").$Enums.PeriodType;
        required_room_type: import(".prisma/client").$Enums.RoomType | null;
        block_config: string | null;
    }>;
    update(id: string, data: any): Promise<{
        id: string;
        semester_id: string;
        class_id: string;
        teacher_id: string;
        subject_id: number;
        total_periods: number;
        period_type: import(".prisma/client").$Enums.PeriodType;
        required_room_type: import(".prisma/client").$Enums.RoomType | null;
        block_config: string | null;
    }>;
    delete(id: string): Promise<{
        id: string;
        semester_id: string;
        class_id: string;
        teacher_id: string;
        subject_id: number;
        total_periods: number;
        period_type: import(".prisma/client").$Enums.PeriodType;
        required_room_type: import(".prisma/client").$Enums.RoomType | null;
        block_config: string | null;
    }>;
    importAssignments(semesterId: string, assignments: any[]): Promise<import(".prisma/client").Prisma.BatchPayload>;
}
