import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const semesterId = '4a020e02-3164-413d-9699-c32ba3fe8bd4';
    const cls = await prisma.class.findFirst({ 
        where: { name: '12A1' },
        include: { 
            teaching_assignments: {
                where: { semester_id: semesterId },
                include: { subject: true }
            }
        }
    });

    if (!cls) return;

    console.log(`=== SUBJECT BREAKDOWN FOR ${cls.name} ===`);
    let total = 0;
    for (const ta of cls.teaching_assignments) {
        console.log(`  - ${ta.subject.name} (${ta.subject.code}): ${ta.total_periods} tiết`);
        total += ta.total_periods;
    }
    console.log(`\nTổng phân công: ${total} tiết`);
    console.log(`Cộng thêm Chào cờ (1) + SHCN (1) = ${total + 2} tiết`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
