import { Controller, Post, Body, Get, Param, Query, Req, Res } from '@nestjs/common';
import { AlgorithmService } from './algorithm.service';
import { AlgorithmProducer } from '../worker/algorithm.producer';
import { ExportService } from './export.service';
import type { Request, Response } from 'express';
import { buildAttachmentDisposition } from '../excel/excel.utils';
import { Roles } from '../auth/decorators/roles.decorator';
import { FeasibilityService } from './feasibility.service';
import { BenchmarkService } from './benchmark.service';
import { VariantService } from './variant.service';
import { SwapGraphService } from './swap-graph.service';
import { ChangeLogService } from './change-log.service';
import { AnalyticsService } from './analytics.service';
import { PatternMiningService } from './pattern-mining.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Thuật toán')
@ApiBearerAuth('access-token')
@Controller('algorithm')
export class AlgorithmController {
    constructor(
        private readonly algorithmService: AlgorithmService,
        private readonly algorithmProducer: AlgorithmProducer,
        private readonly exportService: ExportService,
        private readonly feasibilityService: FeasibilityService,
        private readonly benchmarkService: BenchmarkService,
        private readonly variantService: VariantService,
        private readonly swapGraph: SwapGraphService,
        private readonly changeLog: ChangeLogService,
        private readonly analytics: AnalyticsService,
        private readonly patternMining: PatternMiningService
    ) { }

    /**
     * Rules the school follows but never wrote down, read back out of the manual edits.
     * Reported as questions, not findings - the same drag can have several causes.
     */
    @Roles('ADMIN')
    @Get('mined-rules/:semesterId')
    async minedRules(@Param('semesterId') semesterId: string) {
        return this.patternMining.mine(semesterId);
    }

    /** Accept one mined suggestion. Adds a busy time; never replaces the existing ones. */
    @Roles('ADMIN')
    @Post('mined-rules/accept')
    async acceptMinedRule(@Body() body: { teacherId: string, day: number, period: number, session: number }) {
        return this.patternMining.acceptTeacherBusy(body);
    }

    /** Real figures for the overview screen. */
    @Roles('ADMIN')
    @Get('dashboard/:semesterId')
    async dashboard(@Param('semesterId') semesterId: string) {
        return this.analytics.dashboard(semesterId);
    }

    /** Report data problems before anyone waits on a full solve. */
    @Roles('ADMIN')
    @Get('preflight/:semesterId')
    async preflight(@Param('semesterId') semesterId: string) {
        return this.feasibilityService.analyse(semesterId);
    }

    /** All schedules kept from the last run, with the numbers needed to choose between them. */
    @Roles('ADMIN')
    @Get('variants/:semesterId')
    async variants(@Param('semesterId') semesterId: string) {
        return this.variantService.listForSemester(semesterId);
    }

    /** Make one variant the school's official timetable. */
    @Roles('ADMIN')
    @Post('publish/:timetableId')
    async publish(@Param('timetableId') timetableId: string) {
        return this.variantService.publish(timetableId);
    }

    /** Which cells this period may be dragged to, and what each move would cost. */
    @Roles('ADMIN')
    @Get('move-targets/:slotId')
    async moveTargets(@Param('slotId') slotId: string) {
        return this.swapGraph.previewMoves(slotId);
    }

    /** Chain swaps that free up a period, including ones needing three or four people. */
    @Roles('ADMIN')
    @Get('swap-options/:slotId')
    async swapOptions(@Param('slotId') slotId: string) {
        return this.swapGraph.findOptions(slotId);
    }

    /** Carry out one rotation atomically. */
    @Roles('ADMIN')
    @Post('apply-swap')
    async applySwap(@Body() body: { slotIds: string[] }, @Req() req: Request) {
        return this.swapGraph.applyCycle(body.slotIds ?? [], this.actorOf(req));
    }

    /** Public link and QR image for a published timetable. */
    @Roles('ADMIN')
    @Get('public-link/:timetableId')
    async publicLink(@Param('timetableId') timetableId: string) {
        return this.variantService.publicLink(timetableId);
    }

    @Roles('ADMIN')
    @Get('solvers')
    listSolvers() {
        return this.benchmarkService.listSolvers();
    }

    /** Compare improvement strategies on the same problem, with numbers. */
    @Roles('ADMIN')
    @Post('benchmark')
    async benchmark(@Body() body: { semesterId: string; solverKeys?: string[]; runs?: number; iterations?: number }) {
        return this.benchmarkService.run(body);
    }

    @Roles('ADMIN')
    @Post('start')
    async startOptimization(@Body() body: { semesterId: string }) {
        return this.algorithmProducer.startOptimization(body.semesterId);
    }

    @Roles('ADMIN')
    @Get('status/:jobId')
    async getStatus(@Param('jobId') jobId: string) {
        return this.algorithmProducer.getJobStatus(jobId);
    }

    @Get('result/:semesterId')
    async getResult(
        @Param('semesterId') semesterId: string,
        @Query('week') week?: string
    ) {
        return this.algorithmProducer.getResult(semesterId, week ? parseInt(week, 10) : 1);
    }

    @Roles('ADMIN')
    @Get('export/:semesterId')
    async exportSchedule(@Param('semesterId') semesterId: string, @Res() res: Response) {
        const payload = await this.exportService.exportScheduleToExcel(semesterId);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': buildAttachmentDisposition(payload.fileName),
            'Content-Length': payload.buffer.length,
        });
        res.end(payload.buffer);
    }

    @Roles('ADMIN')
    @Post('move-slot')
    async moveSlot(@Body() body: { slotId: string, newDay: number, newPeriod: number, newRoomId?: number }, @Req() req: Request) {
        return this.algorithmService.moveSlot(body, this.actorOf(req));
    }

    /** Who changed what, most recent first. */
    @Roles('ADMIN')
    @Get('history/:timetableId')
    async history(@Param('timetableId') timetableId: string) {
        return this.changeLog.history(timetableId);
    }

    /** Put one logged change back the way it was. */
    @Roles('ADMIN')
    @Post('undo/:logId')
    async undo(@Param('logId') logId: string, @Req() req: Request) {
        return this.changeLog.revert(logId, this.actorOf(req));
    }

    private actorOf(req: Request) {
        const user: any = (req as any).user;
        return { id: user?.id, name: user?.username ?? 'Không rõ' };
    }
    @Roles('ADMIN')
    @Post('toggle-lock')
    async toggleLock(@Body() body: { slotId: string }, @Req() req: Request) {
        return this.algorithmService.toggleLock(body.slotId, this.actorOf(req));
    }

    @Roles('ADMIN')
    @Post('clear/:semesterId')
    async clearSchedule(@Param('semesterId') semesterId: string) {
        return this.algorithmService.clearSchedule(semesterId);
    }
}
