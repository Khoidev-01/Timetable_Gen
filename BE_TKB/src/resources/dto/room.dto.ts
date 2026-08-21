import { PartialType } from '@nestjs/mapped-types';
import { RoomType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateRoomDto {
    @IsString()
    @MinLength(1)
    name: string;

    @IsEnum(RoomType)
    type: RoomType;

    @IsInt()
    floor: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    capacity?: number;
}

export class UpdateRoomDto extends PartialType(CreateRoomDto) {}
