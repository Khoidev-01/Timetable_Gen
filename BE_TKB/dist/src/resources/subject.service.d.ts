import { PrismaService } from '../prisma/prisma.service';
export declare class SubjectService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        id: number;
        code: string;
        name: string;
        color: string;
        is_special: boolean;
        is_practice: boolean;
    }[]>;
    create(data: any): Promise<{
        id: number;
        code: string;
        name: string;
        color: string;
        is_special: boolean;
        is_practice: boolean;
    }>;
    update(id: number, data: any): Promise<{
        id: number;
        code: string;
        name: string;
        color: string;
        is_special: boolean;
        is_practice: boolean;
    }>;
    delete(id: number): Promise<{
        id: number;
        code: string;
        name: string;
        color: string;
        is_special: boolean;
        is_practice: boolean;
    }>;
}
