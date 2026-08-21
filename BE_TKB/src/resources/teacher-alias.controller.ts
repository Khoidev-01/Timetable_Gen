import { Controller, Get, Patch, Param, Body, NotFoundException, ForbiddenException, BadRequestException, Req, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { TeacherService } from './teacher.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Vietnamese alias routes for teacher endpoints.
 * FE uses /giao-vien/:id for teacher data access.
 */
@ApiTags('Giáo viên')
@ApiBearerAuth('access-token')
@Controller('giao-vien')
export class TeacherAliasController {
    constructor(
        private readonly teacherService: TeacherService,
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
    ) { }

    private readonly logger = new Logger(TeacherAliasController.name);

    /**
     * A teacher may only touch their own record. Without this the busy-time endpoint
     * lets any signed-in teacher rewrite a colleague's availability, which then steers
     * the whole timetable.
     */
    private async assertOwnership(req: Request, teacherId: string) {
        const actor: any = (req as any).user;
        if (!actor) throw new ForbiddenException('Chưa xác thực.');
        if (actor.role === 'ADMIN') return;

        const account = await this.prisma.user.findUnique({
            where: { id: actor.id },
            select: { teacher_profile_id: true },
        });

        if (account?.teacher_profile_id !== teacherId) {
            throw new ForbiddenException('Chỉ được xem và sửa dữ liệu của chính mình.');
        }
    }

    @Get(':id')
    async getTeacher(@Param('id') id: string, @Req() req: Request) {
        await this.assertOwnership(req, id);
        return this.readTeacher(id);
    }

    private async readTeacher(id: string) {
        const teacher = await this.teacherService.findOne(id);
        // Map to FE-expected format with ngay_nghi_dang_ky from constraints
        const busySlots = (teacher.constraints || []).map((c: any) => ({
            day: c.day_of_week,
            period: c.period,
            session: c.session,
            type: c.type
        }));
        return {
            ...teacher,
            ho_ten: teacher.full_name,
            ngay_nghi_dang_ky: busySlots
        };
    }

    @Patch(':id')
    async updateTeacher(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
        await this.assertOwnership(req, id);
        // Handle ngay_nghi_dang_ky update via constraints
        if (body.ngay_nghi_dang_ky !== undefined) {
            // Convert string array format "day_session" to constraints
            const rawSlots = body.ngay_nghi_dang_ky;
            let constraints: any[] = [];

            if (Array.isArray(rawSlots)) {
                constraints = rawSlots.map((item: any) => {
                    if (typeof item === 'string') {
                        // Format: "day_session" e.g. "2_0"
                        const [day, session] = item.split('_').map(Number);
                        return {
                            day: day,
                            period: 1, // Default - session-level busy
                            session: session,
                            type: 'BUSY'
                        };
                    }
                    return {
                        day: item.day,
                        period: item.period || 1,
                        session: item.session ?? 0,
                        type: item.type || 'BUSY'
                    };
                });

                // For session-level busy (from TeacherRegistration), expand to all 5 periods
                const expanded: any[] = [];
                for (const c of constraints) {
                    if (typeof rawSlots[0] === 'string') {
                        // Session-level: expand to 5 periods
                        for (let p = 1; p <= 5; p++) {
                            expanded.push({ day: c.day, period: p, session: c.session, type: 'BUSY' });
                        }
                    } else {
                        expanded.push(c);
                    }
                }

                await this.teacherService.updateConstraints(id, expanded.length > 0 ? expanded : constraints);
            }
            return this.readTeacher(id);
        }

        // Regular field update
        const { ngay_nghi_dang_ky, ...rest } = body;
        if (Object.keys(rest).length > 0) {
            await this.teacherService.update(id, rest);
        }
        return this.readTeacher(id);
    }

    /**
     * A teacher's three-level answer for the week.
     *
     * BUSY is a fact the timetable must respect. AVOID and PREFER are wishes weighed
     * against everyone else's - keeping them apart is what lets a teacher say "I would
     * rather not" without it being read as "I cannot", which is how a school ends up
     * with a timetable nobody can build.
     */
    @Patch(':id/busy-time')
    async updateBusyTime(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
        await this.assertOwnership(req, id);
        const { busySlots } = body;
        if (!Array.isArray(busySlots)) {
            return { success: false, message: 'busySlots must be an array' };
        }

        const ALLOWED = ['BUSY', 'AVOID', 'PREFER'];
        for (const slot of busySlots) {
            if (slot.type !== undefined && !ALLOWED.includes(slot.type)) {
                throw new BadRequestException(
                    `Mức "${slot.type}" không hợp lệ. Chỉ nhận BUSY (bận), AVOID (hạn chế) hoặc PREFER (mong muốn).`,
                );
            }
        }

        // FE gửi: [{ day: 2, period: 1, session: 0, type: 'AVOID' }, ...]
        // Thiếu type thì hiểu là BUSY, giữ nguyên hành vi của phiên bản một mức
        const constraints = busySlots.map((s: any) => ({
            day: s.day,
            period: s.period,
            session: s.session,
            type: s.type ?? 'BUSY',
        }));

        const teacher = await this.teacherService.findOne(id);
        await this.teacherService.updateConstraints(id, constraints);

        // Tell the admins - a request entered after the timetable was built changes it
        const busyCount = constraints.filter((c) => c.type === 'BUSY').length;
        try {
            await this.notificationService.notifyBusyScheduleUpdate(
                teacher.full_name,
                teacher.code,
                busyCount,
            );
        } catch (e) {
            this.logger.warn(`Không tạo được thông báo lịch bận: ${e}`);
        }

        return {
            success: true,
            message: 'Đã cập nhật đăng ký',
            counts: {
                busy: busyCount,
                avoid: constraints.filter((c) => c.type === 'AVOID').length,
                prefer: constraints.filter((c) => c.type === 'PREFER').length,
            },
        };
    }

    /** What this teacher has registered, so the grid can be drawn from the truth. */
    @Get(':id/preferences')
    async getPreferences(@Param('id') id: string, @Req() req: Request) {
        await this.assertOwnership(req, id);
        const rows = await this.prisma.teacherConstraint.findMany({
            where: { teacher_id: id },
            select: { day_of_week: true, period: true, session: true, type: true },
        });
        return rows.map((r) => ({ day: r.day_of_week, period: r.period, session: r.session, type: r.type }));
    }
}
