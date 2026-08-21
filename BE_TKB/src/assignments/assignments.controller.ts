
import { Controller, Get, Post, Body, Query, Put, Param, Delete } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Phân công')
@ApiBearerAuth('access-token')
@Controller('assignments')
@Roles('ADMIN')
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
