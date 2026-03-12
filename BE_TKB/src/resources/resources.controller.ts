
import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { RoomService } from './room.service';
import { SubjectService } from './subject.service';
import { TeacherService } from './teacher.service';

@Controller('resources')
export class ResourcesController {
    constructor(
        private readonly roomService: RoomService,
        private readonly subjectService: SubjectService,
        private readonly teacherService: TeacherService
    ) { }

    // ROOMS
    @Get('rooms') getRooms() { return this.roomService.findAll(); }
    @Post('rooms') createRoom(@Body() body: any) { return this.roomService.create(body); }
    @Put('rooms/:id') updateRoom(@Param('id') id: string, @Body() body: any) { return this.roomService.update(+id, body); }
    @Delete('rooms/:id') deleteRoom(@Param('id') id: string) { return this.roomService.delete(+id); }

    // SUBJECTS
    @Get('subjects') getSubjects() { return this.subjectService.findAll(); }
    @Post('subjects') createSubject(@Body() body: any) { return this.subjectService.create(body); }
    @Put('subjects/:id') updateSubject(@Param('id') id: string, @Body() body: any) { return this.subjectService.update(+id, body); }
    @Delete('subjects/:id') deleteSubject(@Param('id') id: string) { return this.subjectService.delete(+id); }

    // TEACHERS
    @Get('teachers') getTeachers() { return this.teacherService.findAll(); }
    @Get('teachers/:id') getTeacher(@Param('id') id: string) { return this.teacherService.findOne(id); }
    @Post('teachers') createTeacher(@Body() body: any) { return this.teacherService.create(body); }
    @Put('teachers/:id') updateTeacher(@Param('id') id: string, @Body() body: any) { return this.teacherService.update(id, body); }
    @Delete('teachers/:id') deleteTeacher(@Param('id') id: string) { return this.teacherService.delete(id); }

    // TEACHER CONSTRAINTS
    @Put('teachers/:id/constraints')
    updateTeacherConstraints(@Param('id') id: string, @Body() body: any) {
        // body should be array of constraints
        return this.teacherService.updateConstraints(id, body);
    }
}
