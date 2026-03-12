import { PrismaService } from '../prisma/prisma.service';
interface WorkbookMessage {
    sheet: string;
    row: number;
    column: string;
    code: string;
    message: string;
}
interface WorkbookSummary {
    subjects: {
        upserted: number;
    };
    teachers: {
        created: number;
        updated: number;
    };
    classes: {
        created: number;
        updated: number;
    };
    combinations: {
        replaced: number;
    };
    assignments: {
        deleted: number;
        created: number;
    };
}
interface ExportPayload {
    buffer: Buffer;
    fileName: string;
}
export declare class ExcelService {
    private readonly prisma;
    private readonly subjectColors;
    constructor(prisma: PrismaService);
    downloadTemplate(academicYearId: string): Promise<ExportPayload>;
    exportWorkbook(academicYearId: string): Promise<ExportPayload>;
    importWorkbook(academicYearId: string, buffer: Buffer): Promise<{
        summary: WorkbookSummary;
        warnings: WorkbookMessage[];
        errors: WorkbookMessage[];
    }>;
    private parseWorkbook;
    private validateWorkbook;
    private upsertTeachers;
    private upsertClasses;
    private loadWorkbookData;
    private buildWorkbookBuffer;
    private buildGuideSheet;
    private buildReferencesSheet;
    private buildSubjectCatalogSheet;
    private buildTeachersSheet;
    private buildClassesSheet;
    private buildCombinationsSheet;
    private buildAssignmentsSheet;
    private buildTeacherSummarySheet;
    private parseTeachersSheet;
    private parseClassesSheet;
    private parseCombinationsSheet;
    private parseAssignmentsSheet;
    private getYearContext;
    private ensureSubjectCatalog;
    private fetchTeacherMap;
    private fetchClassMap;
    private findWorksheet;
    private resolveColumns;
    private resolveSubject;
    private resolveProgramGroup;
    private buildTeacherMajorSubjectMap;
    private validateDuplicateCodes;
    private rowHasValue;
    private readString;
    private readInteger;
    private inferGradeLevel;
    private parseSessionLabel;
    private normalizeSubjectEntry;
    private normalizeSpecialTopicEntry;
}
export {};
