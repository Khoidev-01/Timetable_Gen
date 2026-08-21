
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * Never select password_hash. Listing accounts used to return every hash in the school,
 * which is an offline cracking target handed out over HTTP.
 */
const SAFE_USER_FIELDS = {
    id: true,
    username: true,
    role: true,
    teacher_profile_id: true,
    created_at: true,
    teacher_profile: true,
} as const;

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.user.findMany({ select: SAFE_USER_FIELDS });
    }

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({ where: { id }, select: SAFE_USER_FIELDS });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    /**
     * Includes password_hash, so this is for authentication only and must never be
     * wired to a controller. AuthService does its own lookup today; kept for that use.
     */
    async findByUsernameWithSecret(username: string) {
        return this.prisma.user.findUnique({ where: { username }, include: { teacher_profile: true } });
    }

    async create(data: any) {
        const { password, ...rest } = data;
        const hashedPassword = await bcrypt.hash(password || '123456', 10);
        return this.prisma.user.create({
            data: { ...rest, password_hash: hashedPassword },
            select: SAFE_USER_FIELDS
        });
    }

    async update(id: string, data: any) {
        const { password, ...rest } = data;
        const payload: any = { ...rest };
        if (password) {
            payload.password_hash = await bcrypt.hash(password, 10);
        }

        return this.prisma.user.update({
            where: { id },
            data: payload,
            select: SAFE_USER_FIELDS
        });
    }

    async remove(id: string) {
        return this.prisma.user.delete({ where: { id } });
    }
}
