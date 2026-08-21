
import { Controller, Post, Body, Get, Patch, Res, Req, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import type { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from './decorators/public.decorator';
import { LoginDto, ChangePasswordDto } from './dto/auth.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Xác thực')
@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private jwtService: JwtService
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

        // 3. Login (Generate JWT)
        return this.authService.login(user);
    }

    @Get('profile')
    async getProfile(@Req() req: Request) {
        const user = this.extractUser(req);
        const profile = await this.authService.getProfile(user.sub);
        if (!profile) throw new UnauthorizedException('User not found');
        return profile;
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
