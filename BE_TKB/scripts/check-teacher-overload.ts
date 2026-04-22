import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const semesterId = '4a020e02-3164-413d-9699-c32ba3fe8bd4';
    const assignments = await prisma.teachingAssignment.findMany({
        where: { semester_id: semesterId },
        include: { teacher: true, subject: true, class: true }
    });

    const gdtcTeachers = new Map<string, { name: string, periods: number, classes: string[] }>();

    for (const a of assignments) {
        if (a.subject.code === 'GDTC' || a.subject.code === 'GDQP') {
            const key = a.teacher.code;
            if (!gdtcTeachers.has(key)) {
                gdtcTeachers.set(key, { name: a.teacher.full_name, periods: 0, classes: [] });
            }
            const stats = gdtcTeachers.get(key)!;
            stats.periods += a.total_periods;
            stats.classes.push(`${a.class.name}(${a.subject.code}x${a.total_periods})`);
        }
    }

    console.log('=== GDTC/GDQP TEACHER LOAD ANALYSIS ===');
    console.log('Max valid slots per week (P1-3 or P8-10): 15 periods\n');

    for (const [code, stats] of gdtcTeachers) {
        const isOverloaded = stats.periods > 15;
        console.log(`${isOverloaded ? '🔴' : '✅'} ${code} (${stats.name}): ${stats.periods} periods`);
        console.log(`   Assignments: ${stats.classes.join(', ')}`);
        if (isOverloaded) console.log(`   ⚠️ OVERLOADED: Need ${stats.periods} slots but only 15 available!`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
