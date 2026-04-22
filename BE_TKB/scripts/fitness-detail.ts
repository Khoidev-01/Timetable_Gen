import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const tkb = await prisma.generatedTimetable.findFirst({
        orderBy: { created_at: 'desc' },
        include: { slots: true }
    });
    if (!tkb) return console.log('No timetable found');

    const schedule = tkb.slots.map(s => ({
        id: s.id, day: s.day, period: s.period,
        classId: s.class_id, subjectId: s.subject_id,
        teacherId: s.teacher_id, roomId: s.room_id || undefined,
        isLocked: s.is_locked
    }));

    // Call fitness details via API
    const res = await fetch(`http://localhost:4000/algorithm/result/${tkb.semester_id}`);
    const data = await res.json();
    
    console.log('=== FITNESS DETAILS ===');
    console.log(`Score: ${data.fitness?.score}`);
    console.log(`Hard violations: ${data.fitness?.hardViolations}`);
    console.log(`Soft penalty: ${data.fitness?.softPenalty}`);
    console.log('\n--- Hard Details ---');
    for (const d of (data.fitness?.hardDetails || [])) {
        console.log(`  ${d.code.padEnd(30)} ${d.count} × ${d.unitPenalty} = ${d.penalty}`);
    }
    console.log('\n--- Soft Details ---');
    for (const d of (data.fitness?.softDetails || [])) {
        console.log(`  ${d.code.padEnd(30)} ${d.count} × ${d.unitPenalty} = ${d.penalty}`);
    }
    console.log('\n--- Readable ---');
    for (const d of (data.fitness?.details || [])) {
        console.log(`  ${d}`);
    }
    
    await prisma.$disconnect();
}
main();
