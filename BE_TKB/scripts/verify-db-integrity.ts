import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const semesterId = '4a020e02-3164-413d-9699-c32ba3fe8bd4';
    
    // 1. Tính tổng tiết cần có
    const assignments = await prisma.teachingAssignment.findMany({
        where: { semester_id: semesterId }
    });
    const totalRequired = assignments.reduce((sum, a) => sum + a.total_periods, 0);

    // 2. Lấy Timetable mới nhất
    const timetable = await prisma.generatedTimetable.findFirst({
        where: { semester_id: semesterId },
        orderBy: { created_at: 'desc' },
        include: { _count: { select: { slots: true } } }
    });

    if (!timetable) {
        console.log('No timetable found.');
        return;
    }

    const totalPlaced = timetable._count.slots;

    console.log('=== DATABASE INTEGRITY CHECK ===');
    console.log(`Required periods (Assignments): ${totalRequired}`);
    console.log(`Actual slots in Database:      ${totalPlaced}`);
    console.log(`Difference:                    ${totalRequired - totalPlaced}`);

    if (totalRequired - totalPlaced === 0) {
        console.log('\n✅ CHÚC MỪNG! Không hề có tiết nào bị mất. Con số 27 trong log chỉ là số tiết bị "ép buộc" (Forced) vào vị trí có lỗi.');
    } else {
        console.log(`\n❌ THỰC SỰ MẤT ${totalRequired - totalPlaced} TIẾT.`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
