import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req } from '@nestjs/common';
import { BusyScheduleService } from './busy-schedule.service';

@Controller('busy-schedule')
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

    @Get()
    getAll(@Query('semesterId') semesterId: string, @Query('status') status?: string) {
        return this.service.getAll(semesterId, status);
    }

    @Patch(':id/approve')
    approve(@Req() req: any, @Param('id') id: string) {
        const adminUserId = req.user?.sub ?? req.user?.id ?? '';
        return this.service.approve(id, adminUserId);
    }

    @Patch(':id/reject')
    reject(@Req() req: any, @Param('id') id: string, @Body() body: { note?: string }) {
        const adminUserId = req.user?.sub ?? req.user?.id ?? '';
        return this.service.reject(id, adminUserId, body.note ?? '');
    }

    @Get('conflicts/:semesterId')
    getConflicts(@Param('semesterId') semesterId: string) {
        return this.service.getConflicts(semesterId);
    }

    @Post('conflicts/resolve')
    resolve(@Body() body: { timetableSlotId: string; substituteTeacherId: string }) {
        return this.service.resolveConflict(body.timetableSlotId, body.substituteTeacherId);
    }
}
