
import { Controller, Get, Param, Query } from '@nestjs/common';
import { TimetablesService } from './timetables.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Xem thời khóa biểu cần đăng nhập — guard toàn cục đã bắt buộc điều đó.
@ApiTags('Thời khóa biểu')
@ApiBearerAuth('access-token')
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
