
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoomService } from './room.service';
import { SubjectService } from './subject.service';
import { TeacherService } from './teacher.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/teacher.dto';

// Read routes require a valid login; every mutation requires ADMIN.
@UseGuards(JwtAuthGuard)
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
    @UseGuards(AdminGuard) @Post('rooms') createRoom(@Body() body: CreateRoomDto) { return this.roomService.create(body); }
    @UseGuards(AdminGuard) @Put('rooms/:id') updateRoom(@Param('id') id: string, @Body() body: UpdateRoomDto) { return this.roomService.update(+id, body); }
    @UseGuards(AdminGuard) @Delete('rooms/all') deleteAllRooms() { return this.roomService.deleteAll(); }
    @UseGuards(AdminGuard) @Delete('rooms/:id') deleteRoom(@Param('id') id: string) { return this.roomService.delete(+id); }

    // SUBJECTS
    @Get('subjects') getSubjects() { return this.subjectService.findAll(); }
    @UseGuards(AdminGuard) @Post('subjects') createSubject(@Body() body: CreateSubjectDto) { return this.subjectService.create(body); }
    @UseGuards(AdminGuard) @Put('subjects/:id') updateSubject(@Param('id') id: string, @Body() body: UpdateSubjectDto) { return this.subjectService.update(+id, body); }
    @UseGuards(AdminGuard) @Delete('subjects/all') deleteAllSubjects() { return this.subjectService.deleteAll(); }
    @UseGuards(AdminGuard) @Delete('subjects/:id') deleteSubject(@Param('id') id: string) { return this.subjectService.delete(+id); }

    // TEACHERS
    @Get('teachers') getTeachers() { return this.teacherService.findAll(); }
    @Get('teachers/:id') getTeacher(@Param('id') id: string) { return this.teacherService.findOne(id); }
    @UseGuards(AdminGuard) @Post('teachers') createTeacher(@Body() body: CreateTeacherDto) { return this.teacherService.create(body); }
    @UseGuards(AdminGuard) @Put('teachers/:id') updateTeacher(@Param('id') id: string, @Body() body: UpdateTeacherDto) { return this.teacherService.update(id, body); }
    @UseGuards(AdminGuard) @Delete('teachers/all') deleteAllTeachers() { return this.teacherService.deleteAll(); }
    @UseGuards(AdminGuard) @Delete('teachers/:id') deleteTeacher(@Param('id') id: string) { return this.teacherService.delete(id); }

    // TEACHER CONSTRAINTS
    @UseGuards(AdminGuard)
    @Put('teachers/:id/constraints')
    updateTeacherConstraints(@Param('id') id: string, @Body() body: any) {
        return this.teacherService.updateConstraints(id, body);
    }
}
