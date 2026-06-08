import { PartialType } from '@nestjs/mapped-types';
import { UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
    @IsString()
    @MinLength(1)
    username: string;

    // Optional — UsersService defaults to "123456" when absent.
    @IsOptional() @IsString() @MinLength(6) password?: string;
    @IsOptional() @IsEnum(UserRole) role?: UserRole;
    @IsOptional() @IsString() teacher_profile_id?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}
