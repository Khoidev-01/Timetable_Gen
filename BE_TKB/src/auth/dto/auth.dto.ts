import { IsString, MinLength } from 'class-validator';

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
