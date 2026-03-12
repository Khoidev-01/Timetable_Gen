import type { Response } from 'express';
import { ExcelService } from './excel.service';
export declare class ExcelController {
    private readonly excelService;
    constructor(excelService: ExcelService);
    downloadTemplate(academicYearId: string, res: Response): Promise<void>;
    exportWorkbook(academicYearId: string, res: Response): Promise<void>;
    importWorkbook(academicYearId: string, file: Express.Multer.File): Promise<any>;
}
