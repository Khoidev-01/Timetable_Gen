
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ClassService } from './class.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';

// Reads require login; class mutations require ADMIN.
@UseGuards(JwtAuthGuard)
@Controller('organization')
export class OrganizationController {
    constructor(private readonly classService: ClassService) { }

    @Get('classes') getClasses() { return this.classService.findAll(); }
    @Get('classes/:id') getClass(@Param('id') id: string) { return this.classService.findOne(id); }
    @UseGuards(AdminGuard) @Post('classes') createClass(@Body() body: CreateClassDto) { return this.classService.create(body); }
    @UseGuards(AdminGuard) @Put('classes/:id') updateClass(@Param('id') id: string, @Body() body: UpdateClassDto) { return this.classService.update(id, body); }
    @UseGuards(AdminGuard) @Delete('classes/all') deleteAllClasses() { return this.classService.deleteAll(); }
    @UseGuards(AdminGuard) @Delete('classes/:id') deleteClass(@Param('id') id: string) { return this.classService.delete(id); }
}
