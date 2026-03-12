
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.user.findMany({ include: { teacher_profile: true } });
    }

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({ where: { id }, include: { teacher_profile: true } });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async create(data: any) {
        // In a real app, hash password here.
        // mapping plain password to password_hash if provided
        const { password, ...rest } = data;
        const payload = { ...rest, password_hash: password || '123456' };
        return this.prisma.user.create({ data: payload });
    }

    async update(id: string, data: any) {
        const { password, ...rest } = data;
        const payload = { ...rest };
        if (password) payload.password_hash = password;

        return this.prisma.user.update({
            where: { id },
            data: payload
        });
    }

    async remove(id: string) {
        return this.prisma.user.delete({ where: { id } });
    }
}
