
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

    async importAssignments(semesterId: string, assignments: any[]) {
        // Bulk create logic
        // This relies on Excel parsing which should now return English fields
        return this.prisma.teachingAssignment.createMany({ data: assignments });
    }
}
