import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { JwtPayload } from './jwt-auth.guard';

/**
 * Verifies the JWT AND requires role === 'ADMIN'. Use on management routes
 * (user accounts, etc.) so a TEACHER token cannot create/delete users or
 * escalate to an ADMIN account.
 */
@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const authHeader = request.headers.authorization;
        if (!authHeader) {
            throw new UnauthorizedException('Thiếu Authorization header');
        }
        const token = authHeader.replace(/^Bearer\s+/i, '');
        let payload: JwtPayload;
        try {
            payload = this.jwtService.verify<JwtPayload>(token);
        } catch {
            throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
        }
        (request as Request & { user?: JwtPayload }).user = payload;
        if (payload.role !== 'ADMIN') {
            throw new ForbiddenException('Chỉ quản trị viên mới có quyền thực hiện thao tác này');
        }
        return true;
    }
}
