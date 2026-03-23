
import { Controller, Post, Body, Get, Patch, Res, Req, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import type { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private jwtService: JwtService
    ) { }

    @Post('captcha')
    async getCaptcha(@Res() res: Response) {
        const captcha = this.authService.createCaptcha();
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

    @Get('profile')
    async getProfile(@Req() req: Request) {
        const user = this.extractUser(req);
        const profile = await this.authService.getProfile(user.sub);
        if (!profile) throw new UnauthorizedException('User not found');
        return profile;
    }

    @Patch('change-password')
    async changePassword(@Req() req: Request, @Body() body: any) {
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
