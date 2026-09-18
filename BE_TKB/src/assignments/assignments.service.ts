
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PAIRED_PERIOD_TYPES, isPairedPeriodType } from './theory-practice';

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
        return this.prisma.$transaction(async (tx) => {
            const created = await tx.teachingAssignment.create({ data });
            await this.alignPairedTeacher(tx, created);
            return created;
        });
    }

    async update(id: string, data: any) {
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.teachingAssignment.update({
                where: { id },
                data,
            });
            await this.alignPairedTeacher(tx, updated);
            return updated;
        });
    }

    /**
     * Đổi giáo viên ở phần lý thuyết thì phần thực hành cùng môn, cùng lớp, cùng học kỳ đổi theo
     * (và ngược lại), để hai phần không bao giờ rơi vào hai người khác nhau.
     */
    private async alignPairedTeacher(
        tx: Prisma.TransactionClient,
        row: { id: string; semester_id: string; class_id: string; subject_id: number; teacher_id: string; period_type: string },
    ) {
        if (!isPairedPeriodType(row.period_type)) return;
        await tx.teachingAssignment.updateMany({
            where: {
                id: { not: row.id },
                semester_id: row.semester_id,
                class_id: row.class_id,
                subject_id: row.subject_id,
                period_type: { in: PAIRED_PERIOD_TYPES },
                teacher_id: { not: row.teacher_id },
            },
            data: { teacher_id: row.teacher_id },
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
