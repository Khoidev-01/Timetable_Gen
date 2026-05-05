import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';

const DAY_LABELS: Record<number, string> = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7' };

@Injectable()
export class BusyScheduleService {
    constructor(
        private prisma: PrismaService,
        private notificationService: NotificationService,
    ) { }

    // ─── TEACHER ───────────────────────────────────────────────────────────────

    /** Resolve user → teacher profile */
    private async getTeacherIdFromUser(userId: string): Promise<string> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { teacher_profile_id: true },
        });
        if (!user?.teacher_profile_id) throw new BadRequestException('Tài khoản chưa liên kết hồ sơ giáo viên');
        return user.teacher_profile_id;
    }

    async submit(userId: string, body: { semesterId: string; slots: { weekNumber: number; dayOfWeek: number; period: number }[]; reason: string }) {
        const teacherId = await this.getTeacherIdFromUser(userId);

        const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId }, select: { full_name: true, code: true } });

        // Upsert each slot (skip if already exists for same week/day/period)
        const created: string[] = [];
        for (const s of body.slots) {
            try {
                await this.prisma.teacherBusyRequest.upsert({
                    where: {
                        teacher_id_semester_id_week_number_day_of_week_period: {
                            teacher_id: teacherId,
                            semester_id: body.semesterId,
                            week_number: s.weekNumber,
                            day_of_week: s.dayOfWeek,
                            period: s.period,
                        },
                    },
                    update: { reason: body.reason, status: 'PENDING', rejection_note: null, reviewed_by: null, reviewed_at: null },
                    create: {
                        teacher_id: teacherId,
                        semester_id: body.semesterId,
                        week_number: s.weekNumber,
                        day_of_week: s.dayOfWeek,
                        period: s.period,
                        reason: body.reason,
                    },
                });
                created.push(`${DAY_LABELS[s.dayOfWeek] ?? s.dayOfWeek}/T${s.period}`);
            } catch (_) { /* skip duplicate */ }
        }

        // Notify admins
        if (created.length > 0 && teacher) {
            await this.notificationService.create({
                userId: null, // broadcast to all admins
                category: 'BUSY_SCHEDULE',
                title: 'GV đăng ký lịch bận mới',
                message: `${teacher.full_name} (${teacher.code}) đăng ký bận Tuần ${body.slots[0]?.weekNumber}: ${created.slice(0, 5).join(', ')}${created.length > 5 ? '...' : ''}`,
                metadata: { teacherId, teacherName: teacher.full_name, slots: body.slots },
            });
        }

        return { success: true, count: created.length };
    }

    async getMyRequests(userId: string, semesterId: string) {
        const teacherId = await this.getTeacherIdFromUser(userId);
        return this.prisma.teacherBusyRequest.findMany({
            where: { teacher_id: teacherId, semester_id: semesterId },
            orderBy: [{ week_number: 'asc' }, { day_of_week: 'asc' }, { period: 'asc' }],
        });
    }

    async cancelRequest(userId: string, requestId: string) {
        const teacherId = await this.getTeacherIdFromUser(userId);
        const req = await this.prisma.teacherBusyRequest.findUnique({ where: { id: requestId } });
        if (!req) throw new NotFoundException('Không tìm thấy yêu cầu');
        if (req.teacher_id !== teacherId) throw new BadRequestException('Không có quyền');
        if (req.status !== 'PENDING') throw new BadRequestException('Chỉ có thể hủy yêu cầu đang chờ duyệt');
        await this.prisma.teacherBusyRequest.delete({ where: { id: requestId } });
        return { success: true };
    }

    // ─── ADMIN ─────────────────────────────────────────────────────────────────

    async getAll(semesterId: string, status?: string) {
        return this.prisma.teacherBusyRequest.findMany({
            where: {
                semester_id: semesterId,
                ...(status ? { status: status as any } : {}),
            },
            include: { teacher: { select: { full_name: true, code: true } } },
            orderBy: [{ created_at: 'desc' }],
        });
    }

    async approve(requestId: string, adminUserId: string) {
        const req = await this.prisma.teacherBusyRequest.findUnique({
            where: { id: requestId },
            include: { teacher: { select: { full_name: true, user: { select: { id: true } } } } },
        });
        if (!req) throw new NotFoundException('Không tìm thấy yêu cầu');

        await this.prisma.teacherBusyRequest.update({
            where: { id: requestId },
            data: { status: 'APPROVED', reviewed_by: adminUserId, reviewed_at: new Date() },
        });

        // Notify teacher
        const teacherUserId = req.teacher.user?.id;
        if (teacherUserId) {
            await this.notificationService.create({
                userId: teacherUserId,
                category: 'BUSY_SCHEDULE',
                title: '✅ Lịch bận đã được duyệt',
                message: `Yêu cầu bận Tuần ${req.week_number}, ${DAY_LABELS[req.day_of_week] ?? req.day_of_week} Tiết ${req.period} đã được admin duyệt.`,
            });
        }

        return { success: true };
    }

    async reject(requestId: string, adminUserId: string, note: string) {
        const req = await this.prisma.teacherBusyRequest.findUnique({
            where: { id: requestId },
            include: { teacher: { select: { full_name: true, user: { select: { id: true } } } } },
        });
        if (!req) throw new NotFoundException('Không tìm thấy yêu cầu');

        await this.prisma.teacherBusyRequest.update({
            where: { id: requestId },
            data: { status: 'REJECTED', rejection_note: note, reviewed_by: adminUserId, reviewed_at: new Date() },
        });

        const teacherUserId = req.teacher.user?.id;
        if (teacherUserId) {
            await this.notificationService.create({
                userId: teacherUserId,
                category: 'BUSY_SCHEDULE',
                title: '❌ Lịch bận bị từ chối',
                message: `Yêu cầu bận Tuần ${req.week_number}, ${DAY_LABELS[req.day_of_week] ?? req.day_of_week} Tiết ${req.period} bị từ chối${note ? ': ' + note : '.'}`,
            });
        }

        return { success: true };
    }

    async getConflicts(semesterId: string) {
        // APPROVED busy requests
        const approved = await this.prisma.teacherBusyRequest.findMany({
            where: { semester_id: semesterId, status: 'APPROVED' },
            include: { teacher: { select: { full_name: true, code: true } } },
        });
        if (approved.length === 0) return [];

        // Latest timetable for this semester
        const latestTkb = await this.prisma.generatedTimetable.findFirst({
            where: { semester_id: semesterId },
            orderBy: { created_at: 'desc' },
            select: { id: true },
        });
        if (!latestTkb) return [];

        const conflicts: any[] = [];

        for (const req of approved) {
            // Find matching slot in timetable (same teacher, day, period, week)
            const conflictSlots = await this.prisma.timetableSlot.findMany({
                where: {
                    timetable_id: latestTkb.id,
                    teacher_id: req.teacher_id,
                    day: req.day_of_week,
                    period: req.period,
                    week: req.week_number,
                },
                include: {
                    class: { select: { name: true } },
                    subject: { select: { name: true, code: true } },
                },
            });

            for (const slot of conflictSlots) {
                // Find substitute teachers: same subject + semester assignment, free at this slot
                const candidates = await this.prisma.teachingAssignment.findMany({
                    where: {
                        semester_id: semesterId,
                        subject_id: slot.subject_id,
                        teacher_id: { not: req.teacher_id },
                    },
                    include: { teacher: { select: { id: true, full_name: true, code: true } } },
                    distinct: ['teacher_id'],
                });

                // Filter: not busy themselves, not already teaching at this slot/week
                const suggestions: any[] = [];
                for (const candidate of candidates) {
                    const tid = candidate.teacher.id;
                    const isBusy = await this.prisma.teacherBusyRequest.findFirst({
                        where: { teacher_id: tid, semester_id: semesterId, week_number: req.week_number, day_of_week: req.day_of_week, period: req.period, status: 'APPROVED' },
                    });
                    const hasSlot = await this.prisma.timetableSlot.findFirst({
                        where: { timetable_id: latestTkb.id, teacher_id: tid, day: req.day_of_week, period: req.period, week: req.week_number },
                    });
                    if (!isBusy && !hasSlot) suggestions.push(candidate.teacher);
                    if (suggestions.length >= 3) break;
                }

                conflicts.push({
                    busyRequestId: req.id,
                    timetableSlotId: slot.id,
                    teacher: req.teacher,
                    weekNumber: req.week_number,
                    dayOfWeek: req.day_of_week,
                    period: req.period,
                    className: slot.class.name,
                    subjectName: slot.subject.name,
                    reason: req.reason,
                    suggestions,
                });
            }
        }

        return conflicts;
    }

    async resolveConflict(timetableSlotId: string, substituteTeacherId: string) {
        const slot = await this.prisma.timetableSlot.findUnique({ where: { id: timetableSlotId } });
        if (!slot) throw new NotFoundException('Không tìm thấy slot');
        await this.prisma.timetableSlot.update({
            where: { id: timetableSlotId },
            data: { teacher_id: substituteTeacherId },
        });
        return { success: true };
    }
}
