
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.room.findMany();
    }

    async create(data: any) {
        return this.prisma.room.create({ data });
    }

    async update(id: number, data: any) {
        return this.prisma.room.update({ where: { id }, data });
    }

    async delete(id: number) {
        return this.prisma.room.delete({ where: { id } });
    }

    async deleteAll() {
        const result = await this.prisma.room.deleteMany({});
        return { deleted: result.count };
    }
}
