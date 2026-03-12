import { PrismaService } from '../prisma/prisma.service';
export declare class ExportService {
    private prisma;
    constructor(prisma: PrismaService);
    exportScheduleToExcel(semesterId: string): Promise<Buffer>;
}
