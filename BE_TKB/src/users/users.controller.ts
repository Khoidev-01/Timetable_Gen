
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get() getUsers() { return this.usersService.findAll(); }
    @Post() createUser(@Body() body: any) { return this.usersService.create(body); }
    @Put(':id') updateUser(@Param('id') id: string, @Body() body: any) { return this.usersService.update(id, body); }
    @Delete('all') deleteAllUsers(@Query('except_id') exceptId?: string) { return this.usersService.removeAll(exceptId); }
    @Delete(':id') deleteUser(@Param('id') id: string) { return this.usersService.remove(id); }
}
