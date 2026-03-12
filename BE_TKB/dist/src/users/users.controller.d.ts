import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getUsers(): Promise<({
        teacher_profile: {
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
        username: string;
        password_hash: string;
        role: import(".prisma/client").$Enums.UserRole;
        teacher_profile_id: string | null;
        created_at: Date;
    })[]>;
    createUser(body: any): Promise<{
        id: string;
        username: string;
        password_hash: string;
        role: import(".prisma/client").$Enums.UserRole;
        teacher_profile_id: string | null;
        created_at: Date;
    }>;
    updateUser(id: string, body: any): Promise<{
        id: string;
        username: string;
        password_hash: string;
        role: import(".prisma/client").$Enums.UserRole;
        teacher_profile_id: string | null;
        created_at: Date;
    }>;
    deleteUser(id: string): Promise<{
        id: string;
        username: string;
        password_hash: string;
        role: import(".prisma/client").$Enums.UserRole;
        teacher_profile_id: string | null;
        created_at: Date;
    }>;
}
