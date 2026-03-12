
import { Injectable } from '@nestjs/common';
import * as svgCaptcha from 'svg-captcha';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
    private readonly SECRET = 'MY_CAPTCHA_SECRET_KEY'; // Simple secret

    constructor(
        private usersService: UsersService,
        private jwtService: JwtService
    ) { }

    createCaptcha() {
        const captcha = svgCaptcha.create({
            size: 4,
            noise: 2,
            color: true,
            background: '#f0f0f0'
        });

        // Simple "SessionID" = Hash(code + secret)
        // In prod, use Redis or Session Store. Here we stay stateless.
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
        // Check Admin
        // const user = await this.usersService.findOne(username); // Assume UsersService has this
        // Check logic manually for now or integrate with User Service

        // Mock Admin
        if (username === 'admin' && pass === '123') {
            return { id: 'admin', username: 'admin', role: 'ADMIN', full_name: 'Administrator' };
        }

        // Check DB via UsersService
        // Need to update UsersService to supports findByUsername
        // OR direct prisma call?
        // Let's use Prisma directly via UsersService if available, or just mock for step 1

        // Real implementation using findAll?
        // Let's assume UsersService needs an update, or use PrismaService here directly?
        // Better: Inject PrismaService if UsersService is scant.

        // Actually, let me inject PrismaService here for speed as UsersService might be basic CRUD
        return null; // Update this after checking UsersService
    }

    async login(user: any) {
        const payload = { username: user.username, sub: user.id, role: user.role };
        return {
            access_token: this.jwtService.sign(payload),
            user
        };
    }
}
