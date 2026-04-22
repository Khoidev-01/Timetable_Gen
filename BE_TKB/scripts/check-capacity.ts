import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const subjects = await prisma.subject.findMany();
    const classes = await prisma.class.findMany();
    const assignments = await prisma.teachingAssignment.findMany({
        where: { semester_id: '4a020e02-3164-413d-9699-c32ba3fe8bd4' },
    });
    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    const fixedCodes = ['CHAO_CO', 'SH_DAU_TUAN', 'SH_CUOI_TUAN', 'SHCN', 'SH_CN', 'SINH_HOAT'];

    console.log('Class      | Main | Max Slots | Total Needed | Fixed | Non-Fixed | Deficit');
    console.log('-----------|------|-----------|-------------|-------|-----------|--------');

    for (const cls of classes.sort((a, b) => a.name.localeCompare(b.name))) {
        const isMorning = (cls as any).main_session === 0;
        // Max slots: 6 days × 5 periods = 30, minus Thursday(3), minus Monday P1(1) = 26 for morning
        const maxSlots = isMorning ? 26 : 27;

        const classAssigns = assignments.filter(a => a.class_id === cls.id);
        let totalNeeded = 0;
        let fixedNeeded = 0;
        for (const a of classAssigns) {
            const subj = subjectMap.get(a.subject_id);
            const periods = (a as any).total_periods || 1;
            totalNeeded += periods;
            if (subj && fixedCodes.includes(subj.code)) fixedNeeded += periods;
        }
        const nonFixed = totalNeeded - fixedNeeded;
        // Phase 1 generates: CHAO_CO(1) + SH_CUOI_TUAN(1) + GVCN_TEACHING(varies)
        // Effective need = non-fixed activities that need a slot
        const deficit = nonFixed - maxSlots;

        console.log(`${cls.name.padEnd(10)} | ${isMorning ? 'AM' : 'PM'}   | ${String(maxSlots).padEnd(9)} | ${String(totalNeeded).padEnd(11)} | ${String(fixedNeeded).padEnd(5)} | ${String(nonFixed).padEnd(9)} | ${deficit > 0 ? '⚠ ' + deficit : '✅ ' + deficit}`);
    }

    await prisma.$disconnect();
}
main();
