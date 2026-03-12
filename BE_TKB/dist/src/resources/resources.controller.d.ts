import { RoomService } from './room.service';
import { SubjectService } from './subject.service';
import { TeacherService } from './teacher.service';
export declare class ResourcesController {
    private readonly roomService;
    private readonly subjectService;
    private readonly teacherService;
    constructor(roomService: RoomService, subjectService: SubjectService, teacherService: TeacherService);
    getRooms(): Promise<{
        id: number;
        name: string;
        type: import(".prisma/client").$Enums.RoomType;
        floor: number;
        capacity: number;
    }[]>;
    createRoom(body: any): Promise<{
        id: number;
        name: string;
        type: import(".prisma/client").$Enums.RoomType;
        floor: number;
        capacity: number;
    }>;
    updateRoom(id: string, body: any): Promise<{
        id: number;
        name: string;
        type: import(".prisma/client").$Enums.RoomType;
        floor: number;
        capacity: number;
    }>;
    deleteRoom(id: string): Promise<{
        id: number;
        name: string;
        type: import(".prisma/client").$Enums.RoomType;
        floor: number;
        capacity: number;
    }>;
    getSubjects(): Promise<{
        id: number;
        code: string;
        name: string;
        color: string;
        is_special: boolean;
        is_practice: boolean;
    }[]>;
    createSubject(body: any): Promise<{
        id: number;
        code: string;
        name: string;
        color: string;
        is_special: boolean;
        is_practice: boolean;
    }>;
    updateSubject(id: string, body: any): Promise<{
        id: number;
        code: string;
        name: string;
        color: string;
        is_special: boolean;
        is_practice: boolean;
    }>;
    deleteSubject(id: string): Promise<{
        id: number;
        code: string;
        name: string;
        color: string;
        is_special: boolean;
        is_practice: boolean;
    }>;
    getTeachers(): Promise<({
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
    getTeacher(id: string): Promise<{
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
    createTeacher(body: any): Promise<{
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
    updateTeacher(id: string, body: any): Promise<{
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
    deleteTeacher(id: string): Promise<{
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
    updateTeacherConstraints(id: string, body: any): Promise<{
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
