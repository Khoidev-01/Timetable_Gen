import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateClassDto {
    @IsString()
    @MinLength(1)
    name: string;

    @IsInt()
    grade_level: number;

    @IsInt()
    main_session: number; // 0 = morning, 1 = afternoon

    @IsOptional() @IsInt() student_count?: number;
    @IsOptional() @IsString() combination_code?: string;
    @IsOptional() @IsString() notes?: string;
    @IsOptional() @IsInt() fixed_room_id?: number;
    @IsOptional() @IsString() homeroom_teacher_id?: string;
}

export class UpdateClassDto extends PartialType(CreateClassDto) {}
