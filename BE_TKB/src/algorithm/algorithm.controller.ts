import { Controller, Post, Body, Get, Param, Query, Res } from '@nestjs/common';
import { AlgorithmService } from './algorithm.service';
import { AlgorithmProducer } from '../worker/algorithm.producer';
import { ExportService } from './export.service';
import type { Response } from 'express';
import { buildAttachmentDisposition } from '../excel/excel.utils';

@Controller('algorithm')
export class AlgorithmController {
    constructor(
        private readonly algorithmService: AlgorithmService,
        private readonly algorithmProducer: AlgorithmProducer,
        private readonly exportService: ExportService
    ) { }

    @Post('start')
    async startOptimization(@Body() body: { semesterId: string }) {
        return this.algorithmProducer.startOptimization(body.semesterId);
    }

    @Get('status/:jobId')
    async getStatus(@Param('jobId') jobId: string) {
        return this.algorithmProducer.getJobStatus(jobId);
    }

    @Get('result/:semesterId')
    async getResult(@Param('semesterId') semesterId: string) {
        return this.algorithmProducer.getResult(semesterId);
    }

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

    @Post('move-slot')
    async moveSlot(@Body() body: { slotId: string, newDay: number, newPeriod: number, newRoomId?: number }) {
        return this.algorithmService.moveSlot(body);
    }
    @Post('toggle-lock')
    async toggleLock(@Body() body: { slotId: string }) {
        return this.algorithmService.toggleLock(body.slotId);
    }
}
