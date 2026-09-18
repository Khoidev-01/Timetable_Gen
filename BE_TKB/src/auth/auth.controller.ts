
import { Controller, Post, Body, Get, Patch, Res, Req, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import type { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from './decorators/public.decorator';
import { LoginDto, ChangePasswordDto, UpdateAvatarDto, UpdateMyProfileDto, OtpRequestDto, OtpVerifyDto } from './dto/auth.dto';
import { OtpService } from './otp/otp.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Xác thực')
@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private jwtService: JwtService,
        private otpService: OtpService,
    ) { }

    @Public()
    @Post('captcha')
    async getCaptcha(@Res() res: Response) {
        const captcha = await this.authService.createCaptcha();
        res.status(200).send(captcha);
    }

    // Brute force protection: five attempts a minute from one address
    @Throttle({ default: { ttl: 60_000, limit: 5 } })
    @Public()
    @Post('login')
    async login(@Body() body: LoginDto) {
        // 1. Verify Captcha
        const isValid = await this.authService.validateCaptcha(body.captchaCode, body.captchaSessionId);
        if (!isValid) {
            throw new BadRequestException('Mã captcha không đúng');
        }

        // 2. Validate User
        const user = await this.authService.validateUser(body.username, body.password);
        if (!user) {
            throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
        }

        // 3. Bước hai: mã 6 số qua email. Chỉ cấp JWT sau khi mã đúng.
        if (this.otpService.enabled) {
            return this.otpService.begin(user);
        }
        return this.authService.login(user);
    }

    /** Khai email lần đầu, hoặc gửi lại mã. */
    @Throttle({ default: { ttl: 60_000, limit: 5 } })
    @Public()
    @Post('otp/request')
    requestOtp(@Body() body: OtpRequestDto) {
        return this.otpService.request(body.challenge, body.email);
    }

    @Throttle({ default: { ttl: 60_000, limit: 10 } })
    @Public()
    @Post('otp/verify')
    async verifyOtp(@Body() body: OtpVerifyDto) {
        const user = await this.otpService.verify(body.challenge, body.otp);
        return this.authService.login({
            id: user.id,
            username: user.username,
            role: user.role,
            full_name: user.teacher_profile?.full_name || user.username,
            teacherId: user.teacher_profile?.id || undefined,
            teacher_profile: user.teacher_profile ? {
                id: user.teacher_profile.id,
                code: user.teacher_profile.code,
                full_name: user.teacher_profile.full_name,
                position: user.teacher_profile.position,
                department: user.teacher_profile.department,
            } : undefined,
        });
    }

    @Get('profile')
    async getProfile(@Req() req: Request) {
        const user = this.extractUser(req);
        const profile = await this.authService.getProfile(user.sub);
        if (!profile) throw new UnauthorizedException('User not found');
        return profile;
    }

    /** Tài khoản của tôi: ảnh đại diện + thông tin cá nhân (mọi vai trò). */
    @Get('me')
    async getMyAccount(@Req() req: Request) {
        const account = await this.authService.getMyAccount(this.extractUser(req).sub);
        if (!account) throw new NotFoundException('Không tìm thấy tài khoản');
        return account;
    }

    @Patch('me')
    updateMyProfile(@Req() req: Request, @Body() body: UpdateMyProfileDto) {
        return this.authService.updateMyProfile(this.extractUser(req).sub, body);
    }

    @Patch('me/avatar')
    updateMyAvatar(@Req() req: Request, @Body() body: UpdateAvatarDto) {
        return this.authService.updateMyAvatar(this.extractUser(req).sub, body.avatar);
    }

    @Patch('change-password')
    async changePassword(@Req() req: Request, @Body() body: ChangePasswordDto) {
        const user = this.extractUser(req);
        try {
            return await this.authService.changePassword(user.sub, body.oldPassword, body.newPassword);
        } catch (e: any) {
            throw new BadRequestException(e.message);
        }
    }

    private extractUser(req: Request): any {
        const authHeader = req.headers.authorization;
        if (!authHeader) throw new UnauthorizedException('Missing authorization header');
        const token = authHeader.replace('Bearer ', '');
        try {
            return this.jwtService.verify(token);
        } catch {
            throw new UnauthorizedException('Invalid token');
        }
    }
}
