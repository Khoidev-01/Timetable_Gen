
import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Tài khoản')
@ApiBearerAuth('access-token')
@Controller('users')
@Roles('ADMIN')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get() getUsers() { return this.usersService.findAll(); }
    @Post() createUser(@Body() body: any) { return this.usersService.create(body); }
    @Put(':id') updateUser(@Param('id') id: string, @Body() body: any) { return this.usersService.update(id, body); }
    @Delete(':id') deleteUser(@Param('id') id: string) { return this.usersService.remove(id); }
}
