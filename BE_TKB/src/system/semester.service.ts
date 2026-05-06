
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
        await this.prisma.semester.updateMany({ data: { is_current: false } });
        return this.prisma.semester.update({ where: { id }, data: { is_current: true } });
    }

    async delete(id: string) {
        const sem = await this.prisma.semester.findUnique({
            where: { id },
            include: { _count: { select: { teaching_assignments: true, generated_timetables: true, busy_requests: true } } }
        });
        if (!sem) throw new NotFoundException('Không tìm thấy học kỳ');
        if (sem._count.teaching_assignments > 0 || sem._count.generated_timetables > 0) {
            throw new BadRequestException('Học kỳ đã có dữ liệu phân công hoặc TKB. Xóa dữ liệu đó trước.');
        }
        await this.prisma.teacherBusyRequest.deleteMany({ where: { semester_id: id } });
        return this.prisma.semester.delete({ where: { id } });
    }
}
