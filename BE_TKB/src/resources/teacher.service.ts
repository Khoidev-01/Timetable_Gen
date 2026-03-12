
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeacherService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.teacher.findMany({ include: { constraints: true } });
    }

    async findOne(id: string) {
        const teacher = await this.prisma.teacher.findUnique({
            where: { id },
            include: { constraints: true, homeroom_classes: true }
        });
        if (!teacher) throw new NotFoundException('Teacher not found');
        return teacher;
    }

    async create(data: any) {
        return this.prisma.teacher.create({ data });
    }

    async update(id: string, data: any) {
        return this.prisma.teacher.update({ where: { id }, data });
    }

    async delete(id: string) {
        return this.prisma.teacher.delete({ where: { id } });
    }

    // Constraint Management
    async updateConstraints(teacherId: string, constraints: any[]) {
        // Clear old hard/soft constraints for this teacher? Or merge?
        // User said "Index scan instead of JSON".
        // Strategy: Delete all for this teacher and re-insert or diff.
        // Simple: Delete all constraints and re-insert.
        await this.prisma.teacherConstraint.deleteMany({ where: { teacher_id: teacherId } });

        if (constraints.length > 0) {
            await this.prisma.teacherConstraint.createMany({
                data: constraints.map(c => ({
                    teacher_id: teacherId,
                    day_of_week: c.day,
                    period: c.period,
                    session: c.session,
                    type: c.type // BUSY or AVOID
                }))
            });
        }
        return this.findOne(teacherId);
    }
}
