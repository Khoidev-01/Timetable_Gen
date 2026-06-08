
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AdminGuard } from '../auth/admin.guard';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Controller('users')
@UseGuards(AdminGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get() getUsers() { return this.usersService.findAll(); }
    @Post() createUser(@Body() body: CreateUserDto) { return this.usersService.create(body); }
    @Put(':id') updateUser(@Param('id') id: string, @Body() body: UpdateUserDto) { return this.usersService.update(id, body); }
    @Delete('all') deleteAllUsers(@Query('except_id') exceptId?: string) { return this.usersService.removeAll(exceptId); }
    @Delete(':id') deleteUser(@Param('id') id: string) { return this.usersService.remove(id); }
}
