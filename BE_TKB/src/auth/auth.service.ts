
import { Injectable } from '@nestjs/common';
import * as svgCaptcha from 'svg-captcha';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    private readonly SECRET = process.env.JWT_SECRET || 'MY_CAPTCHA_SECRET_KEY';

    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService
    ) { }

    createCaptcha() {
        const captcha = svgCaptcha.create({
            size: 4,
            noise: 2,
            color: true,
            background: '#f0f0f0'
        });

        const hash = crypto.createHmac('sha256', this.SECRET)
            .update(captcha.text.toLowerCase())
            .digest('hex');

        return {
            img: captcha.data,
            sessionId: hash
        };
    }

    validateCaptcha(code: string, sessionId: string): boolean {
        if (!code || !sessionId) return false;
        const hash = crypto.createHmac('sha256', this.SECRET)
            .update(code.toLowerCase())
            .digest('hex');
        return hash === sessionId;
    }

    async validateUser(username: string, pass: string): Promise<any> {
        const user = await this.prisma.user.findUnique({
            where: { username },
            include: { teacher_profile: true }
        });

        if (!user) return null;

        // Compare password with bcrypt hash
        const isMatch = await bcrypt.compare(pass, user.password_hash);
        if (!isMatch) {
            // Fallback: plain text comparison for legacy data
            if (user.password_hash !== pass) return null;
        }

        return {
            id: user.id,
            username: user.username,
            role: user.role,
            full_name: user.teacher_profile?.full_name || user.username,
            teacher_profile: user.teacher_profile ? {
                id: user.teacher_profile.id,
                code: user.teacher_profile.code,
                full_name: user.teacher_profile.full_name,
            } : undefined
        };
    }

    async login(user: any) {
        const payload = { username: user.username, sub: user.id, role: user.role };
        return {
            access_token: this.jwtService.sign(payload),
            user
        };
    }

    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { teacher_profile: true }
        });
        if (!user) return null;
        return {
            id: user.id,
            username: user.username,
            role: user.role,
            full_name: user.teacher_profile?.full_name || user.username,
            teacherId: user.teacher_profile?.id || undefined,
            teacher_profile: user.teacher_profile ? {
                id: user.teacher_profile.id,
                code: user.teacher_profile.code,
                full_name: user.teacher_profile.full_name,
            } : undefined
        };
    }

    async changePassword(userId: string, oldPassword: string, newPassword: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error('User not found');

        // Verify old password
        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isMatch) {
            // Fallback plain text check
            if (user.password_hash !== oldPassword) {
                throw new Error('Mật khẩu cũ không đúng');
            }
        }

        const hashedNew = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { password_hash: hashedNew }
        });
        return { success: true, message: 'Đổi mật khẩu thành công' };
    }
}
