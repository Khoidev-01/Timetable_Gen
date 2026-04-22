import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const semesterId = '4a020e02-3164-413d-9699-c32ba3fe8bd4';
    const assignments = await prisma.teachingAssignment.findMany({
        where: { 
            semester_id: semesterId,
            class: { name: { startsWith: '12' } }
        },
        include: { teacher: true, subject: true, class: true }
    });

    const teacherWorkload = new Map<string, { name: string, classes: string[], total: number }>();

    for (const a of assignments) {
        const key = a.teacher.code;
        if (!teacherWorkload.has(key)) {
            teacherWorkload.set(key, { name: a.teacher.full_name, classes: [], total: 0 });
        }
        const stats = teacherWorkload.get(key)!;
        stats.total += a.total_periods;
        stats.classes.push(`${a.class.name}(${a.total_periods})`);
    }

    console.log('=== TEACHERS WITH MULTIPLE GRADE 12 CLASSES ===');
    for (const [code, stats] of teacherWorkload) {
        if (stats.total > 15) { // Nếu dạy > 15 tiết chỉ riêng cho khối 12 sáng
            console.log(`🔴 ${code} (${stats.name}): ${stats.total} periods`);
            console.log(`   Classes: ${stats.classes.join(', ')}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
