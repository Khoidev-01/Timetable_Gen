import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const semesterId = '4a020e02-3164-413d-9699-c32ba3fe8bd4';

    // Get new teacher IDs
    const gv073 = await prisma.teacher.findUnique({ where: { code: 'GV073' } });
    const gv074 = await prisma.teacher.findUnique({ where: { code: 'GV074' } });
    const gv059 = await prisma.teacher.findUnique({ where: { code: 'GV059' } });
    const gv060 = await prisma.teacher.findUnique({ where: { code: 'GV060' } });
    const gv064 = await prisma.teacher.findUnique({ where: { code: 'GV064' } });
    const gv065 = await prisma.teacher.findUnique({ where: { code: 'GV065' } });

    if (!gv073 || !gv074 || !gv059 || !gv060 || !gv064 || !gv065) {
        console.error('Missing teachers!'); return;
    }

    const gdtc = await prisma.subject.findFirst({ where: { code: 'GDTC' } });
    const gdqp = await prisma.subject.findFirst({ where: { code: 'GDQP' } });
    if (!gdtc || !gdqp) { console.error('Missing subjects!'); return; }

    // Revert GDTC: GV073 → GV059 for 12A3,12A8 and GV073 → GV060 for 12A4,12A9
    const classNames = ['12A1', '12A3', '12A4', '12A6', '12A7', '12A8', '12A9'];
    const classes = await prisma.class.findMany({ where: { name: { in: classNames } } });
    const classMap = new Map(classes.map(c => [c.name, c.id]));

    const gdtcReverts = [
        { class: '12A3', from: gv073.id, to: gv059.id, toName: 'GV059' },
        { class: '12A8', from: gv073.id, to: gv059.id, toName: 'GV059' },
        { class: '12A4', from: gv073.id, to: gv060.id, toName: 'GV060' },
        { class: '12A9', from: gv073.id, to: gv060.id, toName: 'GV060' },
    ];
    const gdqpReverts = [
        { class: '12A3', from: gv074.id, to: gv064.id, toName: 'GV064' },
        { class: '12A6', from: gv074.id, to: gv064.id, toName: 'GV064' },
        { class: '12A9', from: gv074.id, to: gv064.id, toName: 'GV064' },
        { class: '12A1', from: gv074.id, to: gv065.id, toName: 'GV065' },
        { class: '12A4', from: gv074.id, to: gv065.id, toName: 'GV065' },
        { class: '12A7', from: gv074.id, to: gv065.id, toName: 'GV065' },
    ];

    for (const r of [...gdtcReverts, ...gdqpReverts]) {
        const classId = classMap.get(r.class);
        if (!classId) continue;
        const subjectId = r.toName.startsWith('GV06') && parseInt(r.toName.slice(-1)) >= 4 ? gdqp.id : gdtc.id;
        // Actually check by from teacher
        const updated = await prisma.teachingAssignment.updateMany({
            where: { semester_id: semesterId, class_id: classId, teacher_id: r.from },
            data: { teacher_id: r.to },
        });
        console.log(`  ✅ ${r.class}: ${updated.count} row(s) → ${r.toName}`);
    }

    // Delete new teachers
    await prisma.teacher.deleteMany({ where: { code: { in: ['GV073', 'GV074'] } } });
    console.log('\nDeleted GV073 and GV074.');

    // Verify
    const remaining = await prisma.teacher.findMany({ where: { code: { in: ['GV073', 'GV074'] } } });
    console.log(`Remaining: ${remaining.length} (should be 0)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
