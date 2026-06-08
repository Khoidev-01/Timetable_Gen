
import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { AcademicYearService } from './academic-year.service';
import { SemesterService } from './semester.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import {
    CreateAcademicYearDto,
    UpdateAcademicYearDto,
    CreateSemesterDto,
    UpdateSemesterDto,
} from './dto/system.dto';

// Reads require login; year/semester mutations require ADMIN.
@UseGuards(JwtAuthGuard)
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

    @UseGuards(AdminGuard)
    @Post('years')
    createYear(@Body() body: CreateAcademicYearDto) {
        return this.yearService.create(body);
    }

    @UseGuards(AdminGuard)
    @Put('years/:id')
    updateYear(@Param('id') id: string, @Body() body: UpdateAcademicYearDto) {
        return this.yearService.update(id, body);
    }

    @UseGuards(AdminGuard)
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

    @UseGuards(AdminGuard)
    @Post('semesters')
    createSemester(@Body() body: CreateSemesterDto) {
        return this.semesterService.create(body);
    }

    @UseGuards(AdminGuard)
    @Put('semesters/:id')
    updateSemester(@Param('id') id: string, @Body() body: UpdateSemesterDto) {
        return this.semesterService.update(id, body);
    }

    @UseGuards(AdminGuard)
    @Put('semesters/:id/set-current')
    setCurrentSemester(@Param('id') id: string) {
        return this.semesterService.setCurrent(id);
    }

    @UseGuards(AdminGuard)
    @Delete('semesters/:id')
    deleteSemester(@Param('id') id: string) {
        return this.semesterService.delete(id);
    }
}
