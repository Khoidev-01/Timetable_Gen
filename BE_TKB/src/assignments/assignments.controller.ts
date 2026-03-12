
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
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
}
