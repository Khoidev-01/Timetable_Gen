import { PrismaService } from '../prisma/prisma.service';
export declare class ExcelService {
    private prisma;
    constructor(prisma: PrismaService);
    readTeachers(buffer: any): Promise<{
        importedWithSuccess: number;
        totalRows: number;
    }>;
    readAssignments(buffer: any): Promise<{
        count: number;
        errors: string[];
    }>;
    readComplexAssignment(buffer: any, semesterId?: string): Promise<{
        successCount: number;
        errors: string[];
    }>;
}
