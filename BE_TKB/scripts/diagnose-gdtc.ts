import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const timetable = await prisma.generatedTimetable.findFirst({
        where: { semester_id: '4a020e02-3164-413d-9699-c32ba3fe8bd4' },
        orderBy: { created_at: 'desc' },
        include: { slots: { include: { subject: true, class: true, teacher: true } } },
    });
    if (!timetable) return;

    console.log('=== GDTC/GDQP VIOLATIONS ===');
    const violations = timetable.slots.filter(s => {
        const code = s.subject.code.toUpperCase();
        if (!code.includes('GDTC') && !code.includes('GDQP')) return false;
        const isMorning = s.period <= 5;
        if (isMorning && s.period > 3) return true;  // Should be P1-3 only
        if (!isMorning && s.period < 8) return true;  // Should be P8-10 only
        return false;
    });

    console.log(`Total violations: ${violations.length}`);
    for (const v of violations) {
        console.log(`  ${v.class.name.padEnd(6)} ${v.subject.code.padEnd(8)} T${v.day}-P${v.period} GV:${v.teacher.code}`);
    }

    console.log('\n=== GDTC/GDQP CORRECT SLOTS ===');
    const correct = timetable.slots.filter(s => {
        const code = s.subject.code.toUpperCase();
        if (!code.includes('GDTC') && !code.includes('GDQP')) return false;
        const isMorning = s.period <= 5;
        if (isMorning && s.period <= 3) return true;
        if (!isMorning && s.period >= 8) return true;
        return false;
    });

    // Group by teacher and day to see conflicts
    const byTeacherDay = new Map<string, typeof correct>();
    for (const s of [...violations, ...correct]) {
        const key = `${s.teacher.code}-T${s.day}`;
        if (!byTeacherDay.has(key)) byTeacherDay.set(key, []);
        byTeacherDay.get(key)!.push(s);
    }

    console.log('\n=== TEACHER-DAY GDTC CONFLICTS ===');
    for (const [key, slots] of byTeacherDay) {
        if (slots.length > 1) {
            const periods = slots.map(s => `${s.class.name}:P${s.period}(${s.subject.code})`).join(', ');
            console.log(`  ${key}: ${periods}`);
        }
    }

    // Show available P8-10 slots per class
    console.log('\n=== CLASS AVAILABILITY AT P8-10 (afternoon) ===');
    const violated12 = violations.filter(v => v.class.name.startsWith('12'));
    const violatedClasses = new Set(violated12.map(v => v.class_id));

    for (const classId of violatedClasses) {
        const className = violated12.find(v => v.class_id === classId)!.class.name;
        const classSlots = timetable.slots.filter(s => s.class_id === classId);
        // Count P8-10 usage per day
        for (let day = 2; day <= 7; day++) {
            if (day === 5) continue;
            const p8to10 = classSlots.filter(s => s.day === day && s.period >= 8 && s.period <= 10);
            if (p8to10.length === 0) {
                console.log(`  ${className} T${day}: FREE at P8-10`);
            }
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
