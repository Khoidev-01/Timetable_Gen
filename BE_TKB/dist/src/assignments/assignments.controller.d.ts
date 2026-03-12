import { AssignmentsService } from './assignments.service';
export declare class AssignmentsController {
    private readonly assignmentsService;
    constructor(assignmentsService: AssignmentsService);
    getAssignments(semesterId: string): Promise<({
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
        };
        class: {
            id: string;
            name: string;
            grade_level: number;
            main_session: number;
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
    createAssignment(body: any): Promise<{
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
}
