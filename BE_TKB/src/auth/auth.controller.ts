
import { Controller, Post, Body, Res, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('captcha')
    async getCaptcha(@Res() res: Response) {
        const captcha = this.authService.createCaptcha();
        // Return 200 OK with JSON
        res.status(200).send(captcha);
    }

    @Post('login')
    async login(@Body() body: any) {
        // 1. Verify Captcha
        const isValid = this.authService.validateCaptcha(body.captchaCode, body.captchaSessionId);
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
}
