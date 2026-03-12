
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.class.findMany({
            include: { fixed_room: true, homeroom_teacher: true }
        });
    }

    async findOne(id: string) {
        const cls = await this.prisma.class.findUnique({
            where: { id },
            include: { fixed_room: true, homeroom_teacher: true }
        });
        if (!cls) throw new NotFoundException('Class not found');
        return cls;
    }

    async create(data: any) {
        return this.prisma.class.create({ data });
    }

    async update(id: string, data: any) {
        return this.prisma.class.update({ where: { id }, data });
    }

    async delete(id: string) {
        return this.prisma.class.delete({ where: { id } });
    }
}
