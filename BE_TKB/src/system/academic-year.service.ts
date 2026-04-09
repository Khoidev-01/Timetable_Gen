
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AcademicYearService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.academicYear.findMany({
            orderBy: { start_date: 'desc' },
            include: { semesters: { orderBy: { term_order: 'asc' } } }
        });
    }

    async findOne(id: string) {
        const year = await this.prisma.academicYear.findUnique({ where: { id }, include: { semesters: { orderBy: { term_order: 'asc' } } } });
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
                        { name: 'HK1', is_current: false, term_order: 1 },
                        { name: 'HK2', is_current: false, term_order: 2 }
                    ]
                }
            },
            include: { semesters: true }
        });
    }

    async update(id: string, data: any) {
        const existing = await this.prisma.academicYear.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Không tìm thấy năm học.');

        const { name, start_date, end_date, status } = data;
        return this.prisma.academicYear.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(start_date !== undefined && { start_date: new Date(start_date) }),
                ...(end_date !== undefined && { end_date: new Date(end_date) }),
                ...(status !== undefined && { status }),
            },
            include: { semesters: { orderBy: { term_order: 'asc' } } },
        });
    }

    async delete(id: string) {
        const existing = await this.prisma.academicYear.findUnique({
            where: { id },
            include: { semesters: { include: { _count: { select: { teaching_assignments: true, generated_timetables: true } } } } },
        });
        if (!existing) throw new NotFoundException('Không tìm thấy năm học.');

        // Check if there's data linked to this year's semesters
        const hasData = existing.semesters.some(
            s => s._count.teaching_assignments > 0 || s._count.generated_timetables > 0,
        );
        if (hasData) {
            throw new BadRequestException(
                'Không thể xóa năm học đã có dữ liệu phân công hoặc thời khóa biểu. Vui lòng xóa dữ liệu trước.',
            );
        }

        // Delete semesters first, then academic year
        await this.prisma.semester.deleteMany({ where: { year_id: id } });
        return this.prisma.academicYear.delete({ where: { id } });
    }

    async getActiveYear() {
        return this.prisma.academicYear.findFirst({
            where: { status: 'ACTIVE' },
            include: { semesters: { orderBy: { term_order: 'asc' } } }
        });
    }
}
