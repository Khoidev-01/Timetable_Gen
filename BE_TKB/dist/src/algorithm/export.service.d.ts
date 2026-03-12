import { PrismaService } from '../prisma/prisma.service';
export declare class ExportService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    exportScheduleToExcel(semesterId: string): Promise<{
        buffer: Buffer;
        fileName: string;
    }>;
}
