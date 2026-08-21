
import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoomService } from './room.service';
import { SubjectService } from './subject.service';
import { TeacherService } from './teacher.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/teacher.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Đọc chỉ cần đăng nhập; mọi thao tác ghi cần ADMIN.
@ApiTags('Tài nguyên')
@ApiBearerAuth('access-token')
@Controller('resources')
export class ResourcesController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly roomService: RoomService,
        private readonly subjectService: SubjectService,
        private readonly teacherService: TeacherService
    ) { }

    // DASHBOARD STATS
    @Get('stats')
    async getStats() {
        const [teachers, classes, subjects, rooms] = await Promise.all([
            this.prisma.teacher.count(),
            this.prisma.class.count(),
            this.prisma.subject.count(),
            this.prisma.room.count(),
        ]);
        return { teachers, classes, subjects, rooms };
    }

    // ROOMS
    @Get('rooms') getRooms() { return this.roomService.findAll(); }
    @Roles('ADMIN') @Post('rooms') createRoom(@Body() body: CreateRoomDto) { return this.roomService.create(body); }
    @Roles('ADMIN') @Put('rooms/:id') updateRoom(@Param('id') id: string, @Body() body: UpdateRoomDto) { return this.roomService.update(+id, body); }
    @Roles('ADMIN') @Delete('rooms/all') deleteAllRooms() { return this.roomService.deleteAll(); }
    @Roles('ADMIN') @Delete('rooms/:id') deleteRoom(@Param('id') id: string) { return this.roomService.delete(+id); }

    // SUBJECTS
    @Get('subjects') getSubjects() { return this.subjectService.findAll(); }
    @Roles('ADMIN') @Post('subjects') createSubject(@Body() body: CreateSubjectDto) { return this.subjectService.create(body); }
    @Roles('ADMIN') @Put('subjects/:id') updateSubject(@Param('id') id: string, @Body() body: UpdateSubjectDto) { return this.subjectService.update(+id, body); }
    @Roles('ADMIN') @Delete('subjects/all') deleteAllSubjects() { return this.subjectService.deleteAll(); }
    @Roles('ADMIN') @Delete('subjects/:id') deleteSubject(@Param('id') id: string) { return this.subjectService.delete(+id); }

    // TEACHERS
    @Get('teachers') getTeachers() { return this.teacherService.findAll(); }
    @Get('teachers/:id') getTeacher(@Param('id') id: string) { return this.teacherService.findOne(id); }
    @Roles('ADMIN') @Post('teachers') createTeacher(@Body() body: CreateTeacherDto) { return this.teacherService.create(body); }
    @Roles('ADMIN') @Put('teachers/:id') updateTeacher(@Param('id') id: string, @Body() body: UpdateTeacherDto) { return this.teacherService.update(id, body); }
    @Roles('ADMIN') @Delete('teachers/all') deleteAllTeachers() { return this.teacherService.deleteAll(); }
    @Roles('ADMIN') @Delete('teachers/:id') deleteTeacher(@Param('id') id: string) { return this.teacherService.delete(id); }

    // TEACHER CONSTRAINTS
    @Roles('ADMIN')
    @Put('teachers/:id/constraints')
    updateTeacherConstraints(@Param('id') id: string, @Body() body: any) {
        return this.teacherService.updateConstraints(id, body);
    }
}
