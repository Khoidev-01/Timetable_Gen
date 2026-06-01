import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface JwtPayload {
    sub: string;
    username: string;
    role: 'ADMIN' | 'TEACHER';
}

/**
 * Verifies the `Authorization: Bearer <jwt>` header and populates `req.user`
 * with the decoded JWT payload ({ sub, username, role }).
 *
 * Controllers that read `req.user` (busy-schedule, notifications) MUST be
 * protected by this guard, otherwise `req.user` is always undefined.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const authHeader = request.headers.authorization;
        if (!authHeader) {
            throw new UnauthorizedException('Thiếu Authorization header');
        }
        const token = authHeader.replace(/^Bearer\s+/i, '');
        try {
            const payload = this.jwtService.verify<JwtPayload>(token);
            (request as Request & { user?: JwtPayload }).user = payload;
            return true;
        } catch {
            throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
        }
    }
}
