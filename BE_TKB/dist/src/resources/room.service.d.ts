import { PrismaService } from '../prisma/prisma.service';
export declare class RoomService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        id: number;
        name: string;
        type: import(".prisma/client").$Enums.RoomType;
        floor: number;
        capacity: number;
    }[]>;
    create(data: any): Promise<{
        id: number;
        name: string;
        type: import(".prisma/client").$Enums.RoomType;
        floor: number;
        capacity: number;
    }>;
    update(id: number, data: any): Promise<{
        id: number;
        name: string;
        type: import(".prisma/client").$Enums.RoomType;
        floor: number;
        capacity: number;
    }>;
    delete(id: number): Promise<{
        id: number;
        name: string;
        type: import(".prisma/client").$Enums.RoomType;
        floor: number;
        capacity: number;
    }>;
}
