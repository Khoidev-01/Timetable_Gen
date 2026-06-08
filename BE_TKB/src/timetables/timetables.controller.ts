
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TimetablesService } from './timetables.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Viewing timetables requires a valid login.
@UseGuards(JwtAuthGuard)
@Controller('timetables')
export class TimetablesController {
    constructor(private readonly timetablesService: TimetablesService) { }

    @Get()
    getTimetables(@Query('semester_id') semesterId: string) {
        return this.timetablesService.findAll(semesterId);
    }

    @Get(':id')
    getTimetable(@Param('id') id: string) {
        return this.timetablesService.findOne(id);
    }
}
