import { PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

async function main() {
    const semesterId = '4a020e02-3164-413d-9699-c32ba3fe8bd4';

    // Lấy TẤT CẢ các môn học có trong phân công
    const subjects = await prisma.subject.findMany();

    console.log('=== TOTAL GLOBAL TEACHER EXPANSION ===');

    for (const subject of subjects) {
        // Tạo 8 giáo viên cho MỖI môn học
        const teachers: any[] = [];
        for (let i = 1; i <= 8; i++) {
            const code = `GV_${subject.code}_${i}`;
            const t = await prisma.teacher.upsert({
                where: { code },
                update: {},
                create: {
                    id: uuid(),
                    code,
                    full_name: `Giáo viên ${subject.name} ${i}`,
                    short_name: code,
                    major_subject: subject.code,
                    status: 'Dang_day',
                    max_periods_per_week: 30
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

        if (assignments.length === 0) continue;

        for (let i = 0; i < assignments.length; i++) {
            const teacher = teachers[i % teachers.length];
            await prisma.teachingAssignment.update({
                where: { id: assignments[i].id },
                data: { teacher_id: teacher.id }
            });
        }
        console.log(`✅ ${subject.code}: Distributed ${assignments.length} assignments among 8 dedicated teachers.`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
