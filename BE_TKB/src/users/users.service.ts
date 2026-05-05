
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

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

    async findByUsername(username: string) {
        return this.prisma.user.findUnique({ where: { username }, include: { teacher_profile: true } });
    }

    async create(data: any) {
        const { password, ...rest } = data;
        const hashedPassword = await bcrypt.hash(password || '123456', 10);
        return this.prisma.user.create({
            data: { ...rest, password_hash: hashedPassword },
            include: { teacher_profile: true }
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
            include: { teacher_profile: true }
        });
    }

    async remove(id: string) {
        return this.prisma.user.delete({ where: { id } });
    }

    async removeAll(exceptId?: string) {
        const result = await this.prisma.user.deleteMany({
            where: exceptId ? { NOT: { id: exceptId } } : {}
        });
        return { deleted: result.count };
    }
}
