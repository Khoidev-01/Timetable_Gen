
import { Controller, Get, Post, Body, Query, Put, Param, Delete } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateAssignmentDto, UpdateAssignmentDto } from './dto/assignment.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Đọc chỉ cần đăng nhập; mọi thao tác ghi cần ADMIN.
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

    @Roles('ADMIN')
    @Post()
    createAssignment(@Body() body: CreateAssignmentDto) {
        return this.assignmentsService.create(body);
    }

    @Roles('ADMIN')
    @Put(':id')
    updateAssignment(@Param('id') id: string, @Body() body: UpdateAssignmentDto) {
        return this.assignmentsService.update(id, body);
    }

    @Roles('ADMIN')
    @Delete('all')
    deleteAllAssignments(@Query('semester_id') semesterId?: string) {
        return this.assignmentsService.deleteAll(semesterId);
    }

    @Roles('ADMIN')
    @Delete(':id')
    deleteAssignment(@Param('id') id: string) {
        return this.assignmentsService.delete(id);
    }
}
