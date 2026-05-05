
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SemesterService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.semester.findMany({ include: { academic_year: true } });
    }

    async findByYear(yearId: string) {
        return this.prisma.semester.findMany({ where: { year_id: yearId } });
    }

    async getCurrentSemester() {
        return this.prisma.semester.findFirst({ where: { is_current: true } });
    }

    async create(data: any) {
        return this.prisma.semester.create({ data });
    }

    async update(id: string, data: any) {
        const { start_date, end_date, name } = data;
        return this.prisma.semester.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(start_date !== undefined && { start_date: start_date ? new Date(start_date) : null }),
                ...(end_date !== undefined && { end_date: end_date ? new Date(end_date) : null }),
            }
        });
    }

    async setCurrent(id: string) {
        // Unset current
        await this.prisma.semester.updateMany({ data: { is_current: false } });
        // Set new current
        return this.prisma.semester.update({ where: { id }, data: { is_current: true } });
    }
}
