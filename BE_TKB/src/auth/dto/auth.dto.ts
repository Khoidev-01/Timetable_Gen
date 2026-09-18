import { IsDateString, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
    @IsString() @MinLength(1) username: string;
    @IsString() @MinLength(1) password: string;
    @IsString() captchaCode: string;
    @IsString() captchaSessionId: string;
}

export class ChangePasswordDto {
    @IsString() @MinLength(1) oldPassword: string;
    @IsString() @MinLength(6) newPassword: string;
}

/** Thông tin cá nhân giáo viên tự sửa. Chuỗi rỗng nghĩa là xóa giá trị đó. */
export class UpdateMyProfileDto {
    @IsOptional() @IsString() @MinLength(2) @MaxLength(100) full_name?: string;
    @IsOptional() @ValidateIf((_, v) => v !== '') @IsEmail({}, { message: 'Email không hợp lệ' }) @MaxLength(120) email?: string;
    @IsOptional() @ValidateIf((_, v) => v !== '') @Matches(/^[0-9+ .-]{8,15}$/, { message: 'Số điện thoại không hợp lệ' }) phone?: string;
    @IsOptional() @ValidateIf((_, v) => v !== '') @IsDateString({}, { message: 'Ngày sinh không hợp lệ' }) date_of_birth?: string;
    @IsOptional() @IsString() @MaxLength(255) address?: string;
}

export class UpdateAvatarDto {
    /** data:image/jpeg|png|webp;base64,... - để trống để gỡ ảnh */
    @IsString()
    @MaxLength(400_000, { message: 'Ảnh quá lớn' })
    @ValidateIf((_, v) => v !== '')
    @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, { message: 'Ảnh phải là JPEG, PNG hoặc WebP' })
    avatar: string;
}

export class OtpRequestDto {
    @IsString() @MinLength(1) challenge: string;
    @IsOptional() @IsString() @MaxLength(120) email?: string;
}

export class OtpVerifyDto {
    @IsString() @MinLength(1) challenge: string;
    @IsString() @Matches(/^\d{6}$/, { message: 'Mã gồm 6 chữ số' }) otp: string;
}
