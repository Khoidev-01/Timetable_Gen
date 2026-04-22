import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const subjects = await prisma.subject.findMany();
    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    const assignments = await prisma.teachingAssignment.findMany({
        where: { semester_id: '4a020e02-3164-413d-9699-c32ba3fe8bd4' },
    });
    
    const fixedCodes = ['CHAO_CO', 'SH_DAU_TUAN', 'SH_CUOI_TUAN', 'SHCN', 'SH_CN', 'SINH_HOAT'];
    
    let totalAll = 0;
    let totalFixed = 0;
    let totalNonFixed = 0;
    let assignCount = 0;
    
    for (const a of assignments) {
        const subj = subjectMap.get(a.subject_id);
        if (!subj) continue;
        const periods = (a as any).total_periods || 1;
        totalAll += periods;
        if (fixedCodes.includes(subj.code)) {
            totalFixed += periods;
        } else {
            totalNonFixed += periods;
        }
        assignCount++;
    }
    
    console.log(`Total assignments: ${assignCount}`);
    console.log(`Total periods (all): ${totalAll}`);
    console.log(`Total periods (fixed subjects): ${totalFixed}`);
    console.log(`Total periods (non-fixed): ${totalNonFixed}`);
    console.log(`\nExpected slots = fixed_slots_from_phase1 + non_fixed_activities`);
    console.log(`30 classes × ~5 fixed slots each ≈ ${30 * 5} fixed slots`);
    
    // Check a few sample assignments for CHAO_CO
    console.log('\n--- CHAO_CO assignments ---');
    for (const a of assignments) {
        const subj = subjectMap.get(a.subject_id);
        if (subj?.code === 'CHAO_CO') {
            console.log(`  class=${a.class_id.substring(0,8)} total_periods=${(a as any).total_periods}`);
        }
    }
    
    // Check SINH_HOAT/SHCN assignments
    console.log('\n--- SHCN assignments ---');
    for (const a of assignments) {
        const subj = subjectMap.get(a.subject_id);
        if (subj && ['SHCN', 'SH_CN', 'SINH_HOAT'].includes(subj.code)) {
            console.log(`  class=${a.class_id.substring(0,8)} subject=${subj.code} total_periods=${(a as any).total_periods}`);
        }
    }

    // Count how many total_periods are null/undefined/0
    let nullPeriods = 0;
    for (const a of assignments) {
        if (!(a as any).total_periods) nullPeriods++;
    }
    console.log(`\nAssignments with no total_periods: ${nullPeriods}`);
    
    await prisma.$disconnect();
}
main();
