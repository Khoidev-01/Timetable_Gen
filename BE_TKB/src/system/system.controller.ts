
import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { AcademicYearService } from './academic-year.service';
import { SemesterService } from './semester.service';
import { Roles } from '../auth/decorators/roles.decorator';
import {
    CreateAcademicYearDto,
    UpdateAcademicYearDto,
    CreateSemesterDto,
    UpdateSemesterDto,
} from './dto/system.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Đọc chỉ cần đăng nhập; mọi thao tác ghi cần ADMIN.
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

    @Roles('ADMIN')
    @Post('years')
    createYear(@Body() body: CreateAcademicYearDto) {
        return this.yearService.create(body);
    }

    @Roles('ADMIN')
    @Put('years/:id')
    updateYear(@Param('id') id: string, @Body() body: UpdateAcademicYearDto) {
        return this.yearService.update(id, body);
    }

    @Roles('ADMIN')
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

    @Roles('ADMIN')
    @Post('semesters')
    createSemester(@Body() body: CreateSemesterDto) {
        return this.semesterService.create(body);
    }

    @Roles('ADMIN')
    @Put('semesters/:id')
    updateSemester(@Param('id') id: string, @Body() body: UpdateSemesterDto) {
        return this.semesterService.update(id, body);
    }

    @Roles('ADMIN')
    @Put('semesters/:id/set-current')
    setCurrentSemester(@Param('id') id: string) {
        return this.semesterService.setCurrent(id);
    }

    @Roles('ADMIN')
    @Delete('semesters/:id')
    deleteSemester(@Param('id') id: string) {
        return this.semesterService.delete(id);
    }
}
