
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubjectService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.subject.findMany();
    }

    async create(data: any) {
        return this.prisma.subject.create({ data });
    }

    async update(id: number, data: any) {
        return this.prisma.subject.update({ where: { id }, data });
    }

    async delete(id: number) {
        return this.prisma.subject.delete({ where: { id } });
    }
}
