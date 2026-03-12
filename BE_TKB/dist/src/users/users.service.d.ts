import { PrismaService } from '../prisma/prisma.service';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<({
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
    findOne(id: string): Promise<{
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
    }>;
    create(data: any): Promise<{
        id: string;
        username: string;
        password_hash: string;
        role: import(".prisma/client").$Enums.UserRole;
        teacher_profile_id: string | null;
        created_at: Date;
    }>;
    update(id: string, data: any): Promise<{
        id: string;
        username: string;
        password_hash: string;
        role: import(".prisma/client").$Enums.UserRole;
        teacher_profile_id: string | null;
        created_at: Date;
    }>;
    remove(id: string): Promise<{
        id: string;
        username: string;
        password_hash: string;
        role: import(".prisma/client").$Enums.UserRole;
        teacher_profile_id: string | null;
        created_at: Date;
    }>;
}
