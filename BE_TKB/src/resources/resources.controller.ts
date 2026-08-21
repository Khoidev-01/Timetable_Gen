
import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { RoomService } from './room.service';
import { SubjectService } from './subject.service';
import { TeacherService } from './teacher.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Tài nguyên')
@ApiBearerAuth('access-token')
@Controller('resources')
export class ResourcesController {
    constructor(
        private readonly roomService: RoomService,
        private readonly subjectService: SubjectService,
        private readonly teacherService: TeacherService
    ) { }

    // ROOMS
    @Get('rooms') getRooms() { return this.roomService.findAll(); }
    @Roles('ADMIN') @Post('rooms') createRoom(@Body() body: any) { return this.roomService.create(body); }
    @Roles('ADMIN') @Put('rooms/:id') updateRoom(@Param('id') id: string, @Body() body: any) { return this.roomService.update(+id, body); }
    @Roles('ADMIN') @Delete('rooms/:id') deleteRoom(@Param('id') id: string) { return this.roomService.delete(+id); }

    // SUBJECTS
    @Get('subjects') getSubjects() { return this.subjectService.findAll(); }
    @Roles('ADMIN') @Post('subjects') createSubject(@Body() body: any) { return this.subjectService.create(body); }
    @Roles('ADMIN') @Put('subjects/:id') updateSubject(@Param('id') id: string, @Body() body: any) { return this.subjectService.update(+id, body); }
    @Roles('ADMIN') @Delete('subjects/:id') deleteSubject(@Param('id') id: string) { return this.subjectService.delete(+id); }

    // TEACHERS
    @Get('teachers') getTeachers() { return this.teacherService.findAll(); }
    @Get('teachers/:id') getTeacher(@Param('id') id: string) { return this.teacherService.findOne(id); }
    @Roles('ADMIN') @Post('teachers') createTeacher(@Body() body: any) { return this.teacherService.create(body); }
    @Roles('ADMIN') @Put('teachers/:id') updateTeacher(@Param('id') id: string, @Body() body: any) { return this.teacherService.update(id, body); }
    @Roles('ADMIN') @Delete('teachers/:id') deleteTeacher(@Param('id') id: string) { return this.teacherService.delete(id); }

    // TEACHER CONSTRAINTS
    @Roles('ADMIN') @Put('teachers/:id/constraints')
    updateTeacherConstraints(@Param('id') id: string, @Body() body: any) {
        // body should be array of constraints
        return this.teacherService.updateConstraints(id, body);
    }
}
