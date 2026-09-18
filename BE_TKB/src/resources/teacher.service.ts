
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CEREMONY_CODES = new Set(['CHAO_CO', 'SH_DAU_TUAN', 'SH_CUOI_TUAN']);

@Injectable()
export class TeacherService {
    constructor(private prisma: PrismaService) { }

    /**
     * Danh sách giáo viên, kèm các môn mỗi người đang dạy.
     *
     * Môn dạy lấy từ phân công giảng dạy chứ không từ `major_subject`: trường đó trống với
     * mọi giáo viên trong dữ liệu thật, còn phân công thì luôn phản ánh đúng người đó đang
     * đứng lớp môn gì.
     */
    async findAll() {
        const teachers = await this.prisma.teacher.findMany({
            include: {
                constraints: true,
                homeroom_classes: { select: { id: true, name: true } },
                teaching_assignments: { select: { subject: { select: { id: true, code: true, name: true } } } },
            },
            orderBy: { code: 'asc' },
        });

        return teachers.map(({ teaching_assignments, ...teacher }) => {
            const subjects = new Map<number, { id: number; code: string; name: string }>();
            for (const { subject } of teaching_assignments) {
                // Chào cờ và sinh hoạt là hoạt động toàn trường, không phải môn giáo viên đảm nhận
                if (CEREMONY_CODES.has(subject.code)) continue;
                subjects.set(subject.id, subject);
            }
            return {
                ...teacher,
                teaching_subjects: [...subjects.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
            };
        });
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

    async deleteAll() {
        const [, , , , teachers] = await this.prisma.$transaction([
            this.prisma.timetableSlot.deleteMany({}),
            this.prisma.teachingAssignment.deleteMany({}),
            this.prisma.class.updateMany({ data: { homeroom_teacher_id: null } }),
            this.prisma.user.updateMany({ data: { teacher_profile_id: null } }),
            this.prisma.teacher.deleteMany({}),
        ]);
        return { deleted: teachers.count };
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
