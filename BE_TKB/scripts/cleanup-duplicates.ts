import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const semesterId = '4a020e02-3164-413d-9699-c32ba3fe8bd4';

    console.log('--- DATABASE CLEANUP (DE-DUPLICATION) ---');

    // 1. Lấy tất cả assignments của học kỳ này
    const assignments = await prisma.teachingAssignment.findMany({
        where: { semester_id: semesterId }
    });

    const seen = new Set<string>();
    const toDelete: string[] = [];

    for (const a of assignments) {
        const key = `${a.class_id}-${a.subject_id}`;
        if (seen.has(key)) {
            toDelete.push(a.id);
        } else {
            seen.add(key);
        }
    }

    console.log(`Found ${toDelete.length} duplicate assignments.`);

    // 2. Xóa các bản trùng
    if (toDelete.length > 0) {
        await prisma.teachingAssignment.deleteMany({
            where: { id: { in: toDelete } }
        });
        console.log(`✅ Deleted ${toDelete.length} duplicates.`);
    }

    // 3. Kiểm tra lại tổng số tiết của một lớp bất kỳ (ví dụ 11B8)
    const check = await prisma.teachingAssignment.findMany({
        where: { class_id: '62bd5c38-6ed2-4a0b-a1d1-f3d248c973b4', semester_id: semesterId }
    });
    const total = check.reduce((s, x) => s + x.total_periods, 0);
    console.log(`11B8 now has ${total} periods. (Target: ~30)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
