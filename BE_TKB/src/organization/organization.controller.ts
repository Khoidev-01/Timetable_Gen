import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ClassService } from './class.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Every route needs a login (the global guard sees to that); only the writes need ADMIN.
@ApiTags('Lớp học')
@ApiBearerAuth('access-token')
@Controller('organization')
export class OrganizationController {
    constructor(private readonly classService: ClassService) { }

    @Get('classes') getClasses() { return this.classService.findAll(); }
    @Get('classes/:id') getClass(@Param('id') id: string) { return this.classService.findOne(id); }
    @Roles('ADMIN') @Post('classes') createClass(@Body() body: CreateClassDto) { return this.classService.create(body); }
    @Roles('ADMIN') @Put('classes/:id') updateClass(@Param('id') id: string, @Body() body: UpdateClassDto) { return this.classService.update(id, body); }
    @Roles('ADMIN') @Delete('classes/all') deleteAllClasses() { return this.classService.deleteAll(); }
    @Roles('ADMIN') @Delete('classes/:id') deleteClass(@Param('id') id: string) { return this.classService.delete(id); }
}
