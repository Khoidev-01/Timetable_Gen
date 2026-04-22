import { PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

async function main() {
    const semesterId = '4a020e02-3164-413d-9699-c32ba3fe8bd4';

    const subjectConfigs = [
        { code: 'TOAN', count: 12, prefix: 'T' },
        { code: 'VAN', count: 12, prefix: 'V' },
        { code: 'ANH', count: 10, prefix: 'A' },
        { code: 'LY', count: 8, prefix: 'L' },
        { code: 'HOA', count: 8, prefix: 'H' },
        { code: 'SINH', count: 6, prefix: 'S' },
        { code: 'HDTN', count: 12, prefix: 'HD' },
        { code: 'TIN', count: 6, prefix: 'TI' },
    ];

    console.log('=== GLOBAL TEACHER EXPANSION ===');

    for (const config of subjectConfigs) {
        const subject = await prisma.subject.findUnique({ where: { code: config.code } });
        if (!subject) continue;

        const teachers: any[] = [];
        for (let i = 1; i <= config.count; i++) {
            const code = `GV_${config.prefix}${i}`;
            const t = await prisma.teacher.upsert({
                where: { code },
                update: {},
                create: {
                    id: uuid(),
                    code,
                    full_name: `Giáo viên ${config.code} ${i}`,
                    short_name: code,
                    major_subject: config.code,
                    status: 'Dang_day',
                    max_periods_per_week: 25
                }
            });
            teachers.push(t);
        }

        const assignments = await prisma.teachingAssignment.findMany({
            where: {
                semester_id: semesterId,
                subject_id: subject.id
            },
            orderBy: { class: { name: 'asc' } }
        });

        for (let i = 0; i < assignments.length; i++) {
            const teacher = teachers[i % teachers.length];
            await prisma.teachingAssignment.update({
                where: { id: assignments[i].id },
                data: { teacher_id: teacher.id }
            });
        }
        console.log(`✅ ${config.code}: Distributed ${assignments.length} assignments among ${teachers.length} teachers.`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
