
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as svgCaptcha from 'svg-captcha';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';

const CAPTCHA_TTL_SECONDS = 300;

@Injectable()
export class AuthService implements OnModuleDestroy {
    private readonly redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: 2,
    });

    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService
    ) { }

    async onModuleDestroy() {
        await this.redis.quit().catch(() => undefined);
    }

    /**
     * The answer is kept server-side under a random id. The previous design handed the
     * client an HMAC of the answer and compared HMACs on submit, so the pair stayed
     * valid for ever and could be replayed on every login attempt - which is the one
     * thing a captcha exists to stop.
     */
    async createCaptcha() {
        const captcha = svgCaptcha.create({
            size: 4,
            noise: 2,
            color: true,
            background: '#f0f0f0'
        });

        const sessionId = crypto.randomUUID();
        await this.redis.set(
            this.captchaKey(sessionId),
            captcha.text.toLowerCase(),
            'EX',
            CAPTCHA_TTL_SECONDS,
        );

        return { img: captcha.data, sessionId };
    }

    /** Single use: the answer is deleted whether or not it matched. */
    async validateCaptcha(code: string, sessionId: string): Promise<boolean> {
        if (!code || !sessionId) return false;

        const key = this.captchaKey(sessionId);
        const expected = await this.redis.get(key);
        await this.redis.del(key);

        if (!expected) return false;
        return expected === String(code).trim().toLowerCase();
    }

    private captchaKey(sessionId: string) {
        return `captcha:${sessionId}`;
    }

    async validateUser(username: string, pass: string): Promise<any> {
        const user = await this.prisma.user.findUnique({
            where: { username },
            include: { teacher_profile: true }
        });

        if (!user) return null;

        // bcrypt only. The old code fell back to comparing the stored value as plain
        // text, so any account whose hash was never migrated could be signed into with
        // the hash itself read straight out of the database.
        const isMatch = await bcrypt.compare(pass, user.password_hash);
        if (!isMatch) return null;

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
            include: {
                teacher_profile: {
                    include: { homeroom_classes: { select: { id: true, name: true } } }
                }
            }
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
                homeroom_classes: user.teacher_profile.homeroom_classes,
            } : undefined
        };
    }

    async changePassword(userId: string, oldPassword: string, newPassword: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error('User not found');

        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isMatch) throw new Error('Mật khẩu cũ không đúng');

        if (!newPassword || String(newPassword).length < 6) {
            throw new Error('Mật khẩu mới phải có tối thiểu 6 ký tự');
        }

        const hashedNew = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { password_hash: hashedNew }
        });
        return { success: true, message: 'Đổi mật khẩu thành công' };
    }
}
