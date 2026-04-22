import { PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

async function main() {
    const semesterId = '4a020e02-3164-413d-9699-c32ba3fe8bd4';

    // 1. Create new teachers in DB
    const gv073Id = uuid();
    const gv074Id = uuid();

    await prisma.teacher.createMany({
        data: [
            {
                id: gv073Id,
                code: 'GV073',
                full_name: 'Nguyễn Văn Tùng',
                short_name: 'Tùng',
                major_subject: 'GDTC',
                position: 'GV',
                department: 'Tổ Thể dục',
                status: 'Dang_day',
                max_periods_per_week: 17,
            },
            {
                id: gv074Id,
                code: 'GV074',
                full_name: 'Trần Minh Khôi',
                short_name: 'Khôi',
                major_subject: 'GDQP',
                position: 'GV',
                department: 'Tổ Thể dục',
                status: 'Dang_day',
                max_periods_per_week: 17,
            },
        ],
        skipDuplicates: true,
    });
    console.log(`Created GV073 (id=${gv073Id}) and GV074 (id=${gv074Id})`);

    // 2. Find existing teacher IDs
    const gv059 = await prisma.teacher.findUnique({ where: { code: 'GV059' } });
    const gv060 = await prisma.teacher.findUnique({ where: { code: 'GV060' } });
    const gv064 = await prisma.teacher.findUnique({ where: { code: 'GV064' } });
    const gv065 = await prisma.teacher.findUnique({ where: { code: 'GV065' } });

    if (!gv059 || !gv060 || !gv064 || !gv065) {
        console.error('Missing teacher records!');
        return;
    }

    // 3. Find GDTC/GDQP subject IDs
    const gdtc = await prisma.subject.findFirst({ where: { code: 'GDTC' } });
    const gdqp = await prisma.subject.findFirst({ where: { code: 'GDQP' } });
    if (!gdtc || !gdqp) {
        console.error('Missing GDTC/GDQP subjects!');
        return;
    }

    // 4. Find class IDs
    const classNames = ['12A1', '12A3', '12A4', '12A6', '12A7', '12A8', '12A9'];
    const classes = await prisma.class.findMany({
        where: { name: { in: classNames } },
    });
    const classMap = new Map(classes.map(c => [c.name, c.id]));
    console.log('Classes:', [...classMap.entries()].map(([n, id]) => `${n}=${id.substring(0, 8)}`).join(', '));

    // 5. Reassign GDTC from GV059→GV073 for: 12A3, 12A8
    //    Reassign GDTC from GV060→GV073 for: 12A4, 12A9
    const gdtcReassigns = [
        { class: '12A3', from: gv059.id, to: gv073Id },
        { class: '12A8', from: gv059.id, to: gv073Id },
        { class: '12A4', from: gv060.id, to: gv073Id },
        { class: '12A9', from: gv060.id, to: gv073Id },
    ];

    for (const r of gdtcReassigns) {
        const classId = classMap.get(r.class);
        if (!classId) { console.log(`Class ${r.class} not found`); continue; }
        const updated = await prisma.teachingAssignment.updateMany({
            where: {
                semester_id: semesterId,
                class_id: classId,
                subject_id: gdtc.id,
                teacher_id: r.from,
            },
            data: { teacher_id: r.to },
        });
        console.log(`  ✅ GDTC ${r.class}: ${updated.count} row(s) → GV073`);
    }

    // 6. Reassign GDQP from GV064→GV074 for: 12A3, 12A6, 12A9
    //    Reassign GDQP from GV065→GV074 for: 12A1, 12A4, 12A7
    const gdqpReassigns = [
        { class: '12A3', from: gv064.id, to: gv074Id },
        { class: '12A6', from: gv064.id, to: gv074Id },
        { class: '12A9', from: gv064.id, to: gv074Id },
        { class: '12A1', from: gv065.id, to: gv074Id },
        { class: '12A4', from: gv065.id, to: gv074Id },
        { class: '12A7', from: gv065.id, to: gv074Id },
    ];

    for (const r of gdqpReassigns) {
        const classId = classMap.get(r.class);
        if (!classId) { console.log(`Class ${r.class} not found`); continue; }
        const updated = await prisma.teachingAssignment.updateMany({
            where: {
                semester_id: semesterId,
                class_id: classId,
                subject_id: gdqp.id,
                teacher_id: r.from,
            },
            data: { teacher_id: r.to },
        });
        console.log(`  ✅ GDQP ${r.class}: ${updated.count} row(s) → GV074`);
    }

    // 7. Verify new distribution
    console.log('\n=== NEW DISTRIBUTION ===');
    const allGDTC = await prisma.teachingAssignment.findMany({
        where: {
            semester_id: semesterId,
            subject_id: { in: [gdtc.id, gdqp.id] },
        },
        include: { teacher: true, class: true, subject: true },
    });

    const byTeacher = new Map<string, string[]>();
    for (const a of allGDTC) {
        const key = a.teacher.code;
        if (!byTeacher.has(key)) byTeacher.set(key, []);
        byTeacher.get(key)!.push(`${a.class.name}(${a.subject.code}×${a.total_periods})`);
    }
    for (const [code, classes] of [...byTeacher.entries()].sort()) {
        console.log(`  ${code}: ${classes.length} assignments → ${classes.join(', ')}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
