import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const timetable = await prisma.generatedTimetable.findFirst({
        where: { semester_id: '4a020e02-3164-413d-9699-c32ba3fe8bd4' },
        orderBy: { created_at: 'desc' },
        include: { slots: { include: { subject: true, class: true, teacher: true } } }
    });

    if (!timetable) return;

    // Tìm các tiết học có Day hoặc Period bất thường (ví dụ Day=0 hoặc Period=0 nếu algorithm gán fallback)
    // Hoặc trong trường hợp này, các tiết bị "Forced" thường nằm ở các ô cuối tuần P5, P10
    const counts = new Map<string, number>();
    for (const s of timetable.slots) {
        const key = `${s.class.name} - ${s.subject.code}`;
        counts.set(key, (counts.get(key) || 0) + 1);
    }

    // So sánh với TeachingAssignment để tìm tiết thiếu
    const assignments = await prisma.teachingAssignment.findMany({
        where: { semester_id: '4a020e02-3164-413d-9699-c32ba3fe8bd4' },
        include: { subject: true, class: true }
    });

    console.log('=== MISSING PERIODS REPORT ===');
    for (const a of assignments) {
        const key = `${a.class.name} - ${a.subject.code}`;
        const placed = counts.get(key) || 0;
        if (placed < a.total_periods) {
            console.log(`❌ ${key}: Missing ${a.total_periods - placed} periods (Placed ${placed}/${a.total_periods})`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
