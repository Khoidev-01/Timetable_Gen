
import { Controller, Get, Param, Query } from '@nestjs/common';
import { TimetablesService } from './timetables.service';

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
