import { AcademicYearService } from './academic-year.service';
import { SemesterService } from './semester.service';
export declare class SystemController {
    private readonly yearService;
    private readonly semesterService;
    constructor(yearService: AcademicYearService, semesterService: SemesterService);
    getYears(): Promise<({
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
    createYear(body: any): Promise<{
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
    getSemesters(): Promise<({
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
    createSemester(body: any): Promise<{
        id: string;
        year_id: string;
        name: string;
        is_current: boolean;
        term_order: number;
    }>;
    setCurrentSemester(id: string): Promise<{
        id: string;
        year_id: string;
        name: string;
        is_current: boolean;
        term_order: number;
    }>;
}
