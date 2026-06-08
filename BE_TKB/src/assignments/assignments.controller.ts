
import { Controller, Get, Post, Body, Query, Put, Param, Delete, UseGuards } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CreateAssignmentDto, UpdateAssignmentDto } from './dto/assignment.dto';

// Reads require login; assignment mutations require ADMIN.
@UseGuards(JwtAuthGuard)
@Controller('assignments')
export class AssignmentsController {
    constructor(private readonly assignmentsService: AssignmentsService) { }

    @Get()
    getAssignments(@Query('semester_id') semesterId: string) {
        return this.assignmentsService.findAll(semesterId);
    }

    @UseGuards(AdminGuard)
    @Post()
    createAssignment(@Body() body: CreateAssignmentDto) {
        return this.assignmentsService.create(body);
    }

    @UseGuards(AdminGuard)
    @Put(':id')
    updateAssignment(@Param('id') id: string, @Body() body: UpdateAssignmentDto) {
        return this.assignmentsService.update(id, body);
    }

    @UseGuards(AdminGuard)
    @Delete('all')
    deleteAllAssignments(@Query('semester_id') semesterId?: string) {
        return this.assignmentsService.deleteAll(semesterId);
    }

    @UseGuards(AdminGuard)
    @Delete(':id')
    deleteAssignment(@Param('id') id: string) {
        return this.assignmentsService.delete(id);
    }
}
