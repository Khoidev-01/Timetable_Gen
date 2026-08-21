import { Controller, Get, Patch, Param, Body, NotFoundException, ForbiddenException, Req, Logger } from '@nestjs/common';
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

    @Patch(':id/busy-time')
    async updateBusyTime(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
        await this.assertOwnership(req, id);
        const { busySlots } = body;
        if (!Array.isArray(busySlots)) {
            return { success: false, message: 'busySlots must be an array' };
        }

        // busySlots format from FE: [{ day: 2, period: 1, session: 0 }, ...]
        const constraints = busySlots.map((s: any) => ({
            day: s.day,
            period: s.period,
            session: s.session,
            type: 'BUSY'
        }));

        await this.teacherService.updateConstraints(id, constraints);
        return { success: true, message: 'Đã cập nhật lịch bận' };
    }
}
