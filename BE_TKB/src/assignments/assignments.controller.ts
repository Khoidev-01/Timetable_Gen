
import { Controller, Get, Post, Body, Query, Put, Param, Delete } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';

@Controller('assignments')
export class AssignmentsController {
    constructor(private readonly assignmentsService: AssignmentsService) { }

    @Get()
    getAssignments(@Query('semester_id') semesterId: string) {
        return this.assignmentsService.findAll(semesterId);
    }

    @Post()
    createAssignment(@Body() body: any) {
        return this.assignmentsService.create(body);
    }

    @Put(':id')
    updateAssignment(@Param('id') id: string, @Body() body: any) {
        return this.assignmentsService.update(id, body);
    }

    @Delete(':id')
    deleteAssignment(@Param('id') id: string) {
        return this.assignmentsService.delete(id);
    }
}
