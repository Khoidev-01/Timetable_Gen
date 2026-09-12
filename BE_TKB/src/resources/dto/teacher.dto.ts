import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateTeacherDto {
    @IsString()
    @MinLength(1)
    code: string;

    @IsString()
    @MinLength(1)
    full_name: string;

    @IsOptional() @IsString() short_name?: string;
    @IsOptional() @IsString() email?: string;
    @IsOptional() @IsString() phone?: string;
    @IsOptional() @IsString() major_subject?: string;
    // JSON string of grades, e.g. "[10,11,12]"
    @IsOptional() @IsString() teachable_grades?: string;
    @IsOptional() @IsString() position?: string;
    @IsOptional() @IsInt() @Min(0) max_periods_per_week?: number;
    @IsOptional() @IsString() department?: string;
    @IsOptional() @IsString() status?: string;
    @IsOptional() @IsInt() @Min(0) workload_reduction?: number;
    /**
     * Leo cầu thang nặng đến đâu với riêng giáo viên này, tính theo phần mười. 10 là bình
     * thường; nâng lên cho giáo viên lớn tuổi hoặc có khó khăn đi lại.
     *
     * Chặn trên ở 100 là có chủ ý: đây là hệ số của một khoản phạt mềm, đặt nó lên hàng
     * nghìn thì một người sẽ nuốt hết ngân sách tối ưu và cả trường nhận lịch xấu đi.
     */
    @IsOptional() @IsInt() @Min(1) @Max(100) mobility_weight?: number;
    @IsOptional() @IsString() notes?: string;
}

export class UpdateTeacherDto extends PartialType(CreateTeacherDto) {}

// Note: PUT /resources/teachers/:id/constraints takes a raw array body which
// class-validator cannot whitelist at the top level; that route keeps its
// untyped body and the service maps each item defensively.
