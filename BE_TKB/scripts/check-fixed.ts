import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const timetable = await prisma.generatedTimetable.findFirst({
        where: { semester_id: '4a020e02-3164-413d-9699-c32ba3fe8bd4' },
        orderBy: { created_at: 'desc' },
    });
    const slots = await prisma.timetableSlot.findMany({ where: { timetable_id: timetable!.id } }) as any[];
    const subjects = await prisma.subject.findMany();
    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    
    // Check fixed slots breakdown
    const fixed = slots.filter(s => s.is_locked);
    console.log('=== FIXED SLOTS BREAKDOWN ===');
    const fixedBySubject = new Map<string, number>();
    for (const s of fixed) {
        const subj = subjectMap.get(s.subject_id);
        const code = subj?.code || '?';
        fixedBySubject.set(code, (fixedBySubject.get(code) || 0) + 1);
    }
    for (const [code, count] of [...fixedBySubject.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${code.padEnd(15)} ${count}`);
    }
    console.log(`  TOTAL: ${fixed.length}`);
    
    // How many of the fixed slots are for non-fixed subjects
    // (GVCN_TEACHING creates slots for regular subjects like TOAN, VAN, etc.)
    const fixedCodes = ['CHAO_CO', 'SH_DAU_TUAN', 'SH_CUOI_TUAN', 'SHCN', 'SH_CN', 'SINH_HOAT'];
    let fixedNonFixed = 0;
    for (const s of fixed) {
        const subj = subjectMap.get(s.subject_id);
        if (!subj || !fixedCodes.includes(subj.code)) {
            fixedNonFixed++;
        }
    }
    console.log(`\nFixed slots for NON-fixed subjects (GVCN etc.): ${fixedNonFixed}`);
    console.log(`These eat into the activity budget!`);
    
    console.log(`\n=== MATH ===`);
    console.log(`Total periods expected: 900 (non-fixed) + ~60 (fixed subjects)`);
    console.log(`Fixed slots generated: ${fixed.length}`);
    console.log(`Fixed slots for real subjects: ${fixedNonFixed}`);
    console.log(`Remaining activities needed: 900 - ${fixedNonFixed} = ${900 - fixedNonFixed}`);
    console.log(`Activities actually placed: ${slots.length - fixed.length}`);
    console.log(`Gap: ${900 - fixedNonFixed - (slots.length - fixed.length)}`);
    
    await prisma.$disconnect();
}
main();
