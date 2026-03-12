import { PrismaService } from '../prisma/prisma.service';
export declare class SemesterService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<({
        academic_year: {
            id: string;
            name: string;
            start_date: Date;
            end_date: Date;
            weeks: number;
            status: import(".prisma/client").$Enums.YearStatus;
        };
    } & {
        id: string;
        year_id: string;
        name: string;
        is_current: boolean;
    })[]>;
    findByYear(yearId: string): Promise<{
        id: string;
        year_id: string;
        name: string;
        is_current: boolean;
    }[]>;
    getCurrentSemester(): Promise<{
        id: string;
        year_id: string;
        name: string;
        is_current: boolean;
    } | null>;
    create(data: any): Promise<{
        id: string;
        year_id: string;
        name: string;
        is_current: boolean;
    }>;
    setCurrent(id: string): Promise<{
        id: string;
        year_id: string;
        name: string;
        is_current: boolean;
    }>;
}
