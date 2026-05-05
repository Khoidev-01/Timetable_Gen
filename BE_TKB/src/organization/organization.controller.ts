
import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ClassService } from './class.service';

@Controller('organization')
export class OrganizationController {
    constructor(private readonly classService: ClassService) { }

    @Get('classes') getClasses() { return this.classService.findAll(); }
    @Get('classes/:id') getClass(@Param('id') id: string) { return this.classService.findOne(id); }
    @Post('classes') createClass(@Body() body: any) { return this.classService.create(body); }
    @Put('classes/:id') updateClass(@Param('id') id: string, @Body() body: any) { return this.classService.update(id, body); }
    @Delete('classes/all') deleteAllClasses() { return this.classService.deleteAll(); }
    @Delete('classes/:id') deleteClass(@Param('id') id: string) { return this.classService.delete(id); }
}
