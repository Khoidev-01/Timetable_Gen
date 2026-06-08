import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { BusyScheduleService } from './busy-schedule.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('busy-schedule')
@UseGuards(JwtAuthGuard)
export class BusyScheduleController {
    constructor(private readonly service: BusyScheduleService) { }

    // ─── TEACHER ───────────────────────────────────────────────────────────────

    @Post()
    submit(@Req() req: any, @Body() body: any) {
        const userId = req.user?.sub ?? req.user?.id ?? '';
        return this.service.submit(userId, body);
    }

    @Get('my')
    getMyRequests(@Req() req: any, @Query('semesterId') semesterId: string) {
        const userId = req.user?.sub ?? req.user?.id ?? '';
        return this.service.getMyRequests(userId, semesterId);
    }

    @Delete(':id')
    cancel(@Req() req: any, @Param('id') id: string) {
        const userId = req.user?.sub ?? req.user?.id ?? '';
        return this.service.cancelRequest(userId, id);
    }

    // ─── ADMIN ─────────────────────────────────────────────────────────────────
    // AdminGuard on every route below: approving/rejecting/listing all teachers'
    // requests and resolving conflicts are management actions. Without it a
    // TEACHER token could self-approve its own busy requests (privilege escalation).

    @UseGuards(AdminGuard)
    @Get()
    getAll(@Query('semesterId') semesterId: string, @Query('status') status?: string) {
        return this.service.getAll(semesterId, status);
    }

    @UseGuards(AdminGuard)
    @Patch(':id/approve')
    approve(@Req() req: any, @Param('id') id: string) {
        const adminUserId = req.user?.sub ?? req.user?.id ?? '';
        return this.service.approve(id, adminUserId);
    }

    @UseGuards(AdminGuard)
    @Patch(':id/reject')
    reject(@Req() req: any, @Param('id') id: string, @Body() body: { note?: string }) {
        const adminUserId = req.user?.sub ?? req.user?.id ?? '';
        return this.service.reject(id, adminUserId, body.note ?? '');
    }

    @UseGuards(AdminGuard)
    @Get('conflicts/:semesterId')
    getConflicts(@Param('semesterId') semesterId: string) {
        return this.service.getConflicts(semesterId);
    }

    @UseGuards(AdminGuard)
    @Post('conflicts/resolve')
    resolve(@Body() body: { timetableSlotId: string; substituteTeacherId: string }) {
        return this.service.resolveConflict(body.timetableSlotId, body.substituteTeacherId);
    }
}
