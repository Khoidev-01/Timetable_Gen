import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSubjectDto {
    @IsString()
    @MinLength(1)
    code: string;

    @IsString()
    @MinLength(1)
    name: string;

    @IsString()
    @MinLength(1)
    color: string;

    @IsOptional()
    @IsBoolean()
    is_special?: boolean;

    @IsOptional()
    @IsBoolean()
    is_practice?: boolean;
}

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}
