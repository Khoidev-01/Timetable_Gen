import { PartialType } from '@nestjs/mapped-types';
import { PeriodType, RoomType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateAssignmentDto {
    @IsString() @MinLength(1) semester_id: string;
    @IsString() @MinLength(1) class_id: string;
    @IsString() @MinLength(1) teacher_id: string;

    @IsInt()
    subject_id: number;

    @IsInt()
    @Min(1)
    total_periods: number;

    @IsOptional() @IsEnum(PeriodType) period_type?: PeriodType;
    @IsOptional() @IsEnum(RoomType) required_room_type?: RoomType;
    @IsOptional() @IsString() block_config?: string;
}

export class UpdateAssignmentDto extends PartialType(CreateAssignmentDto) {}
