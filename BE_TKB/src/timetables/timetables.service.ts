
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TimetablesService {
    constructor(private prisma: PrismaService) { }

    async findAll(semesterId: string) {
        return this.prisma.generatedTimetable.findMany({
            where: { semester_id: semesterId },
            orderBy: { created_at: 'desc' },
            include: { slots: true }
        });
    }

    async findOne(id: string) {
        const timetable = await this.prisma.generatedTimetable.findUnique({
            where: { id },
            include: { slots: true }
        });
        if (!timetable) throw new NotFoundException('Timetable not found');
        return timetable;
    }

    async create(data: any) {
        return this.prisma.generatedTimetable.create({ data });
    }
}
