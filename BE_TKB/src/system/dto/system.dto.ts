import { PartialType } from '@nestjs/mapped-types';
import { YearStatus } from '@prisma/client';
import {
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    MinLength,
} from 'class-validator';

export class CreateAcademicYearDto {
    @IsString() @MinLength(1) name: string;
    @IsDateString() start_date: string;
    @IsDateString() end_date: string;
    @IsOptional() @IsInt() weeks?: number;
    @IsOptional() @IsEnum(YearStatus) status?: YearStatus;
}

// Update only touches name/start/end/status (see AcademicYearService.update).
export class UpdateAcademicYearDto {
    @IsOptional() @IsString() name?: string;
    @IsOptional() @IsDateString() start_date?: string;
    @IsOptional() @IsDateString() end_date?: string;
    @IsOptional() @IsEnum(YearStatus) status?: YearStatus;
}

export class CreateSemesterDto {
    @IsString() @MinLength(1) year_id: string;
    @IsString() @MinLength(1) name: string;
    @IsOptional() @IsBoolean() is_current?: boolean;
    @IsOptional() @IsInt() term_order?: number;
    @IsOptional() @IsDateString() start_date?: string;
    @IsOptional() @IsDateString() end_date?: string;
}

// Update only touches name/start/end (see SemesterService.update).
export class UpdateSemesterDto {
    @IsOptional() @IsString() name?: string;
    @IsOptional() @IsDateString() start_date?: string;
    @IsOptional() @IsDateString() end_date?: string;
}
