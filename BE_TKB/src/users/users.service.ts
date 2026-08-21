
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    // Explicit field selection so password_hash NEVER leaves the service in a
    // list/detail response. (Auth flows read the hash via their own queries.)
    private static readonly SAFE_SELECT = {
        id: true,
        username: true,
        role: true,
        teacher_profile_id: true,
        created_at: true,
        teacher_profile: true,
    } as const;

    async findAll() {
        return this.prisma.user.findMany({ select: UsersService.SAFE_SELECT });
    }

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: UsersService.SAFE_SELECT,
        });
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
        const { password, teacher_profile_id, ...rest } = data;
        const hashedPassword = await bcrypt.hash(password || '123456', 10);
        return this.prisma.user.create({
            data: {
                ...rest,
                password_hash: hashedPassword,
                ...(teacher_profile_id ? { teacher_profile_id } : {}),
            },
            select: UsersService.SAFE_SELECT,
        });
    }

    async update(id: string, data: any) {
        const { password, teacher_profile_id, ...rest } = data;
        const payload: any = { ...rest };
        if (teacher_profile_id) payload.teacher_profile_id = teacher_profile_id;
        if (password) {
            payload.password_hash = await bcrypt.hash(password, 10);
        }

        return this.prisma.user.update({
            where: { id },
            data: payload,
            select: UsersService.SAFE_SELECT,
        });
    }

    async remove(id: string) {
        await this.prisma.user.delete({ where: { id } });
        return { success: true };
    }

    async removeAll(exceptId?: string) {
        const result = await this.prisma.user.deleteMany({
            where: exceptId ? { NOT: { id: exceptId } } : {}
        });
        return { deleted: result.count };
    }
}
