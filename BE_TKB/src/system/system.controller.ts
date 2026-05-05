
import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { AcademicYearService } from './academic-year.service';
import { SemesterService } from './semester.service';

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

    @Post('years')
    createYear(@Body() body: any) {
        return this.yearService.create(body);
    }

    @Put('years/:id')
    updateYear(@Param('id') id: string, @Body() body: any) {
        return this.yearService.update(id, body);
    }

    @Delete('years/:id')
    deleteYear(@Param('id') id: string) {
        return this.yearService.delete(id);
    }

    @Get('years/active')
    getActiveYear() {
        return this.yearService.getActiveYear();
    }

    @Get('semesters')
    getSemesters() {
        return this.semesterService.findAll();
    }

    @Post('semesters')
    createSemester(@Body() body: any) {
        return this.semesterService.create(body);
    }

    @Put('semesters/:id')
    updateSemester(@Param('id') id: string, @Body() body: any) {
        return this.semesterService.update(id, body);
    }

    @Put('semesters/:id/set-current')
    setCurrentSemester(@Param('id') id: string) {
        return this.semesterService.setCurrent(id);
    }
}
