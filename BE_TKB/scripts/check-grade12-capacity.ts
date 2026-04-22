import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const semesterId = '4a020e02-3164-413d-9699-c32ba3fe8bd4';
    const classes = await prisma.class.findMany({ 
        where: { name: { startsWith: '12' } },
        include: { 
            teaching_assignments: {
                where: { semester_id: semesterId },
                include: { subject: true }
            }
        }
    });

    console.log('=== PERIOD COUNT PER CLASS (GRADE 12 MORNING) ===');
    console.log('Capacity: 30 slots (5 periods x 6 days)\n');

    for (const cls of classes) {
        let totalMorning = 0;
        let totalAfternoon = 0;

        for (const ta of cls.teaching_assignments) {
            const code = ta.subject.code.toUpperCase();
            const isOpposite = ['GDTC', 'GDQP'].includes(code);
            
            // Theo logic hiện tại: GDTC/GDQP học trái buổi (chiều), còn lại học cùng buổi (sáng)
            if (isOpposite) {
                totalAfternoon += ta.total_periods;
            } else {
                totalMorning += ta.total_periods;
            }
        }

        // Cộng thêm 2 tiết cố định: Chào cờ (1) và SHCN (1)
        totalMorning += 2;

        const isOverloaded = totalMorning > 30;
        console.log(`${isOverloaded ? '🔴' : '✅'} ${cls.name}: Morning: ${totalMorning} periods, Afternoon: ${totalAfternoon} periods`);
        
        if (isOverloaded) {
            console.log(`   ⚠️ OVERLOAD: ${totalMorning}/30! Thuật toán không thể xếp đủ.`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
