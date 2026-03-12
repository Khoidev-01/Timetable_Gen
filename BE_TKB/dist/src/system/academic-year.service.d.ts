import { PrismaService } from '../prisma/prisma.service';
export declare class AcademicYearService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<({
        semesters: {
            id: string;
            year_id: string;
            name: string;
            is_current: boolean;
            term_order: number;
        }[];
    } & {
        id: string;
        name: string;
        start_date: Date;
        end_date: Date;
        weeks: number;
        status: import(".prisma/client").$Enums.YearStatus;
    })[]>;
    findOne(id: string): Promise<{
        semesters: {
            id: string;
            year_id: string;
            name: string;
            is_current: boolean;
            term_order: number;
        }[];
    } & {
        id: string;
        name: string;
        start_date: Date;
        end_date: Date;
        weeks: number;
        status: import(".prisma/client").$Enums.YearStatus;
    }>;
    create(data: any): Promise<{
        semesters: {
            id: string;
            year_id: string;
            name: string;
            is_current: boolean;
            term_order: number;
        }[];
    } & {
        id: string;
        name: string;
        start_date: Date;
        end_date: Date;
        weeks: number;
        status: import(".prisma/client").$Enums.YearStatus;
    }>;
    getActiveYear(): Promise<({
        semesters: {
            id: string;
            year_id: string;
            name: string;
            is_current: boolean;
            term_order: number;
        }[];
    } & {
        id: string;
        name: string;
        start_date: Date;
        end_date: Date;
        weeks: number;
        status: import(".prisma/client").$Enums.YearStatus;
    }) | null>;
}
