/**
 * Detailed diagnosis: What's missing and what GDTC/GDQP violations look like
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const timetable = await prisma.generatedTimetable.findFirst({
        where: { semester_id: '4a020e02-3164-413d-9699-c32ba3fe8bd4' },
        orderBy: { created_at: 'desc' },
    });
    if (!timetable) { console.log('No timetable'); return; }

    const slots = await prisma.timetableSlot.findMany({ where: { timetable_id: timetable.id } }) as any[];
    const classes = await prisma.class.findMany();
    const subjects = await prisma.subject.findMany();
    const assignments = await prisma.teachingAssignment.findMany({
        where: { semester_id: '4a020e02-3164-413d-9699-c32ba3fe8bd4' },
    });

    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    const classMap = new Map(classes.map(c => [c.id, c]));

    // 1. GDTC/GDQP violations detail
    console.log('=== GDTC/GDQP VIOLATIONS ===');
    for (const s of slots) {
        const subj = subjectMap.get(s.subject_id);
        if (!subj) continue;
        const code = subj.code?.toUpperCase() || '';
        if (code.includes('GDTC') || code.includes('GDQP') || code.includes('QUOC_PHONG')) {
            const isMorning = s.period <= 5;
            const valid = isMorning ? s.period <= 3 : s.period >= 8;
            if (!valid) {
                const cls = classMap.get(s.class_id);
                console.log(`  ❌ ${code} ${cls?.name} day=${s.day} period=${s.period} (${isMorning ? 'morning' : 'afternoon'})`);
            }
        }
    }

    // 2. Coverage missing detail - which subjects are missing
    console.log('\n=== MISSING COVERAGE ===');
    const classAssignments = new Map<string, Map<number, number>>();
    for (const assign of assignments) {
        if (!classAssignments.has(assign.class_id)) classAssignments.set(assign.class_id, new Map());
        const m = classAssignments.get(assign.class_id)!;
        m.set(assign.subject_id, (m.get(assign.subject_id) || 0) + ((assign as any).total_periods || 1));
    }

    const missingBySubject = new Map<string, number>();
    for (const [classId, expected] of classAssignments) {
        const classSlots = slots.filter(s => s.class_id === classId);
        const actual = new Map<number, number>();
        for (const s of classSlots) {
            actual.set(s.subject_id, (actual.get(s.subject_id) || 0) + 1);
        }
        for (const [subjId, expectedCount] of expected) {
            const actualCount = actual.get(subjId) || 0;
            if (actualCount < expectedCount) {
                const subj = subjectMap.get(subjId);
                const cls = classMap.get(classId);
                const code = subj?.code || '?';
                const missing = expectedCount - actualCount;
                missingBySubject.set(code, (missingBySubject.get(code) || 0) + missing);
                if (missing >= 2) {
                    console.log(`  ${cls?.name?.padEnd(10)} ${code.padEnd(12)} expected=${expectedCount} actual=${actualCount} missing=${missing}`);
                }
            }
        }
    }

    console.log('\n=== MISSING BY SUBJECT ===');
    const sorted = [...missingBySubject.entries()].sort((a, b) => b[1] - a[1]);
    for (const [code, count] of sorted) {
        console.log(`  ${code.padEnd(12)} ${count} periods missing`);
    }

    // 3. How many activities were built vs how many in timetable
    console.log('\n=== ACTIVITY COUNTS ===');
    let totalExpected = 0;
    const fixedCodes = ['CHAO_CO', 'SH_DAU_TUAN', 'SH_CUOI_TUAN', 'SHCN', 'SH_CN', 'SINH_HOAT'];
    for (const assign of assignments) {
        const subj = subjectMap.get(assign.subject_id);
        if (!subj || fixedCodes.includes(subj.code)) continue;
        totalExpected += (assign as any).total_periods || 1;
    }
    const fixedSlots = slots.filter(s => s.is_locked).length;
    const normalSlots = slots.filter(s => !s.is_locked).length;
    console.log(`  Expected activities (non-fixed): ${totalExpected}`);
    console.log(`  Fixed slots in timetable: ${fixedSlots}`);
    console.log(`  Normal slots in timetable: ${normalSlots}`);
    console.log(`  Total slots: ${slots.length}`);
    console.log(`  Gap: ${totalExpected - normalSlots}`);

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
