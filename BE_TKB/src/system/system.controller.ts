
import { Controller, Get, Post, Body, Param, Put } from '@nestjs/common';
import { AcademicYearService } from './academic-year.service';
import { SemesterService } from './semester.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Năm học & Học kỳ')
@ApiBearerAuth('access-token')
@Controller('system')
export class SystemController {
    constructor(
        private readonly yearService: AcademicYearService,
        private readonly semesterService: SemesterService
    ) { }

    @Get('years')
    getYears() {
        return this.yearService.findAll();
    }

    @Roles('ADMIN') @Post('years')
    createYear(@Body() body: any) {
        return this.yearService.create(body);
    }

    @Get('years/active')
    getActiveYear() {
        return this.yearService.getActiveYear();
    }

    @Get('semesters')
    getSemesters() {
        return this.semesterService.findAll();
    }

    @Roles('ADMIN') @Post('semesters')
    createSemester(@Body() body: any) {
        return this.semesterService.create(body);
    }

    @Roles('ADMIN') @Put('semesters/:id/set-current')
    setCurrentSemester(@Param('id') id: string) {
        return this.semesterService.setCurrent(id);
    }
}
