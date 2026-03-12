
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AcademicYearService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.academicYear.findMany({
            orderBy: { start_date: 'desc' },
            include: { semesters: true }
        });
    }

    async findOne(id: string) {
        const year = await this.prisma.academicYear.findUnique({ where: { id }, include: { semesters: true } });
        if (!year) throw new NotFoundException('Academic Year not found');
        return year;
    }

    async create(data: any) {
        // Automatically create HK1 and HK2
        return this.prisma.academicYear.create({
            data: {
                ...data,
                semesters: {
                    create: [
                        { name: 'HK1', is_current: false },
                        { name: 'HK2', is_current: false }
                    ]
                }
            },
            include: { semesters: true }
        });
    }

    async getActiveYear() {
        return this.prisma.academicYear.findFirst({
            where: { status: 'ACTIVE' },
            include: { semesters: true }
        });
    }
}
