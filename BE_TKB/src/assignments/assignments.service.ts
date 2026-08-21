
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssignmentsService {
    constructor(private prisma: PrismaService) { }

    async findAll(semesterId: string) {
        return this.prisma.teachingAssignment.findMany({
            where: { semester_id: semesterId },
            include: { subject: true, teacher: true, class: true }
        });
    }

    async create(data: any) {
        return this.prisma.teachingAssignment.create({ data });
    }

    async update(id: string, data: any) {
        return this.prisma.teachingAssignment.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        return this.prisma.teachingAssignment.delete({
            where: { id },
        });
    }

    async deleteAll(semesterId?: string) {
        const result = await this.prisma.teachingAssignment.deleteMany({
            where: semesterId ? { semester_id: semesterId } : {},
        });
        return { deleted: result.count };
    }

    async importAssignments(semesterId: string, assignments: any[]) {
        // Bulk create logic
        // This relies on Excel parsing which should now return English fields
        return this.prisma.teachingAssignment.createMany({ data: assignments });
    }
}
