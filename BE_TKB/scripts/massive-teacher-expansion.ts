import { PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

async function main() {
    const semesterId = '4a020e02-3164-413d-9699-c32ba3fe8bd4';

    // Danh sách các môn cần bổ sung giáo viên để chia nhỏ tải
    const subjectConfigs = [
        { code: 'TOAN', count: 6, prefix: 'T' },
        { code: 'VAN', count: 6, prefix: 'V' },
        { code: 'ANH', count: 6, prefix: 'A' },
        { code: 'LY', count: 5, prefix: 'L' },
        { code: 'HOA', count: 5, prefix: 'H' },
        { code: 'SINH', count: 4, prefix: 'S' },
        { code: 'HDTN', count: 6, prefix: 'HD' },
    ];

    console.log('=== MASSIVE TEACHER EXPANSION ===');

    for (const config of subjectConfigs) {
        const subject = await prisma.subject.findUnique({ where: { code: config.code } });
        if (!subject) continue;

        // 1. Tạo đủ số lượng giáo viên cho mỗi môn
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

        // 2. Lấy tất cả phân công của môn này ở Khối 12
        const assignments = await prisma.teachingAssignment.findMany({
            where: {
                semester_id: semesterId,
                subject_id: subject.id,
                class: { name: { startsWith: '12' } }
            },
            orderBy: { class: { name: 'asc' } }
        });

        // 3. Chia đều assignments cho các giáo viên (mỗi người 1-2 lớp)
        for (let i = 0; i < assignments.length; i++) {
            const teacher = teachers[i % teachers.length];
            await prisma.teachingAssignment.update({
                where: { id: assignments[i].id },
                data: { teacher_id: teacher.id }
            });
        }
        console.log(`✅ Refactor ${config.code}: Distributed ${assignments.length} assignments among ${teachers.length} teachers.`);
    }

    console.log('\nSUCCESS: Teacher pool expanded. Grade 12 is now highly flexible.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
