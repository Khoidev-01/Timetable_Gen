
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Quan ly tai khoan la viec cua ADMIN.

@ApiTags('Tài khoản')
@ApiBearerAuth('access-token')
@Controller('users')
@Roles('ADMIN')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get() getUsers() { return this.usersService.findAll(); }
    @Post() createUser(@Body() body: CreateUserDto) { return this.usersService.create(body); }
    @Put(':id') updateUser(@Param('id') id: string, @Body() body: UpdateUserDto) { return this.usersService.update(id, body); }
    @Delete('all') deleteAllUsers(@Query('except_id') exceptId?: string) { return this.usersService.removeAll(exceptId); }
    @Delete(':id') deleteUser(@Param('id') id: string) { return this.usersService.remove(id); }
}
