import { Body, Controller, Delete, Get, Header, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CoverageMode, EffectiveScheduleService } from './effective-schedule.service';
import { SubstituteService } from './substitute.service';
import { AbsenceLinkService } from './absence-link.service';
import { IcalService } from './ical.service';

@ApiTags('Lịch vận hành')
@ApiBearerAuth('access-token')
@Controller('schedule')
export class ScheduleController {
  constructor(
    private readonly effective: EffectiveScheduleService,
    private readonly substitutes: SubstituteService,
    private readonly absenceLink: AbsenceLinkService,
    private readonly icalService: IcalService,
  ) {}

  /**
   * The schedule as it actually stands on one date. Teachers read this rather than the
   * master plan, which stops being true the first time anyone is off sick.
   */
  @Get('effective')
  async effectiveDay(
    @Query('semesterId') semesterId: string,
    @Query('date') date: string,
    @Query('teacherId') teacherId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.effective.forDate(semesterId, date, { teacherId, classId });
  }

  /** Read-only day view for a QR link. Deliberately open - it carries no personal data
   *  beyond the schedule itself, and requiring a login would defeat the point. */
  @Public()
  @Get('public/:token')
  async publicDay(
    @Param('token') token: string,
    @Query('date') date: string,
    @Query('class') className?: string,
    @Query('teacher') teacherName?: string,
  ) {
    const day = date || new Date().toISOString().slice(0, 10);
    return this.effective.byPublicToken(token, day, { className, teacherName });
  }

  /**
   * Calendar feed. Subscribing to this in Google Calendar or Outlook puts the timetable
   * on the teacher's phone, and a covered absence shows up there too.
   */
  @Public()
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Get('ical/:token/:teacherCode')
  async ical(@Param('token') token: string, @Param('teacherCode') teacherCode: string) {
    const payload = await this.icalService.forTeacher(token, teacherCode.replace(/\.ics$/i, ''));
    return payload.body;
  }

  @Roles('ADMIN')
  @Get('overlays/:semesterId')
  async overlays(@Param('semesterId') semesterId: string) {
    return this.effective.listOverlays(semesterId);
  }

  @Roles('ADMIN')
  @Delete('overlays/:id')
  async removeOverlay(@Param('id') id: string) {
    return this.effective.removeOverlay(id);
  }

  /** Every period an absent teacher leaves uncovered, each with ranked stand-ins. */
  /** What approving this leave request would mean, before anyone approves it. */
  @Roles('ADMIN')
  @Get('absence-request/:requestId/preview')
  async previewRequest(@Param('requestId') requestId: string) {
    return this.absenceLink.preview(requestId);
  }

  @Roles('ADMIN')
  @Get('absence-plan')
  async absencePlan(
    @Query('semesterId') semesterId: string,
    @Query('teacherId') teacherId: string,
    @Query('date') date: string,
  ) {
    return this.substitutes.planCoverage(semesterId, teacherId, date);
  }

  /** Commit the cover arrangements for one absence. */
  @Roles('ADMIN')
  @Post('absence')
  async recordAbsence(
    @Body()
    body: {
      semesterId: string;
      teacherId: string;
      date: string;
      reason?: string;
      coverage: Array<{ slotId: string; mode: CoverageMode; substituteTeacherId?: string }>;
    },
    @Req() req: Request,
  ) {
    const user: any = (req as any).user;
    return this.substitutes.recordAbsence({ ...body, createdBy: user?.id });
  }

  /** Substitute periods per teacher in a month, for the allowance calculation. */
  @Roles('ADMIN')
  @Get('substitute-report')
  async substituteReport(@Query('semesterId') semesterId: string, @Query('month') month: string) {
    return this.substitutes.substituteReport(semesterId, month);
  }
}
