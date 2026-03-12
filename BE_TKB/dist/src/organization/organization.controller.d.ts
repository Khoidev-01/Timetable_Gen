import { ClassService } from './class.service';
export declare class OrganizationController {
    private readonly classService;
    constructor(classService: ClassService);
    getClasses(): Promise<({
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
            department: string | null;
            status: string;
            workload_reduction: number;
            notes: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        grade_level: number;
        main_session: number;
        student_count: number | null;
        combination_code: string | null;
        notes: string | null;
        fixed_room_id: number | null;
        homeroom_teacher_id: string | null;
    })[]>;
    getClass(id: string): Promise<{
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
            department: string | null;
            status: string;
            workload_reduction: number;
            notes: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        grade_level: number;
        main_session: number;
        student_count: number | null;
        combination_code: string | null;
        notes: string | null;
        fixed_room_id: number | null;
        homeroom_teacher_id: string | null;
    }>;
    createClass(body: any): Promise<{
        id: string;
        name: string;
        grade_level: number;
        main_session: number;
        student_count: number | null;
        combination_code: string | null;
        notes: string | null;
        fixed_room_id: number | null;
        homeroom_teacher_id: string | null;
    }>;
    updateClass(id: string, body: any): Promise<{
        id: string;
        name: string;
        grade_level: number;
        main_session: number;
        student_count: number | null;
        combination_code: string | null;
        notes: string | null;
        fixed_room_id: number | null;
        homeroom_teacher_id: string | null;
    }>;
    deleteClass(id: string): Promise<{
        id: string;
        name: string;
        grade_level: number;
        main_session: number;
        student_count: number | null;
        combination_code: string | null;
        notes: string | null;
        fixed_room_id: number | null;
        homeroom_teacher_id: string | null;
    }>;
}
