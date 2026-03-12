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
        term_order: number;
    })[]>;
    findByYear(yearId: string): Promise<{
        id: string;
        year_id: string;
        name: string;
        is_current: boolean;
        term_order: number;
    }[]>;
    getCurrentSemester(): Promise<{
        id: string;
        year_id: string;
        name: string;
        is_current: boolean;
        term_order: number;
    } | null>;
    create(data: any): Promise<{
        id: string;
        year_id: string;
        name: string;
        is_current: boolean;
        term_order: number;
    }>;
    setCurrent(id: string): Promise<{
        id: string;
        year_id: string;
        name: string;
        is_current: boolean;
        term_order: number;
    }>;
}
