import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const semesterId = '4a020e02-3164-413d-9699-c32ba3fe8bd4';

    // 1. Phân tích tải trọng thực tế của GV GDTC (bao gồm cả các môn khác như HDTN, SHCN nếu có)
    const assignments = await prisma.teachingAssignment.findMany({
        where: { semester_id: semesterId },
        include: { teacher: true, subject: true, class: true }
    });

    const teacherStats = new Map<string, { total: number, gdtc: number, gdqp: number, other: number, id: string }>();
    
    for (const a of assignments) {
        const key = a.teacher.code;
        if (!teacherStats.has(key)) {
            teacherStats.set(key, { total: 0, gdtc: 0, gdqp: 0, other: 0, id: a.teacher_id });
        }
        const s = teacherStats.get(key)!;
        s.total += a.total_periods;
        if (a.subject.code === 'GDTC') s.gdtc += a.total_periods;
        else if (a.subject.code === 'GDQP') s.gdqp += a.total_periods;
        else s.other += a.total_periods;
    }

    console.log('=== BEFORE REBALANCING ===');
    for (const [code, s] of teacherStats) {
        if (s.gdtc > 0 || s.gdqp > 0) {
            console.log(`${code}: Total ${s.total} (GDTC:${s.gdtc}, GDQP:${s.gdqp}, Other:${s.other})`);
        }
    }

    // 2. Tìm các GV GDTC đang có tải trọng cao (>15 tiết) hoặc tỷ lệ Other cao
    // Chuyển bớt các lớp 12 (khối đang bị thiếu tiết) sang các GV có tải thấp hơn
    const targetTeachers = Array.from(teacherStats.entries())
        .filter(([, s]) => s.gdtc > 0 || s.gdqp > 0)
        .sort((a, b) => a[1].total - b[1].total);

    const lowestGDTCTeacher = targetTeachers.find(([, s]) => s.gdtc > 0)?.[1];
    const lowestGDQPTeacher = targetTeachers.find(([, s]) => s.gdqp > 0)?.[1];

    if (!lowestGDTCTeacher || !lowestGDQPTeacher) return;

    console.log(`\nRebalancing targets: GDTC -> ${lowestGDTCTeacher.id.substring(0,8)}, GDQP -> ${lowestGDQPTeacher.id.substring(0,8)}`);

    // 3. Thực hiện chuyển đổi 2 lớp GDTC và 2 lớp GDQP của khối 12 từ GV tải cao sang GV tải thấp
    const highLoadGDTC = targetTeachers.filter(([, s]) => s.gdtc >= 12).reverse();
    
    for (const [code, stats] of highLoadGDTC) {
        if (stats.id === lowestGDTCTeacher.id) continue;

        const classToMove = assignments.find(a => 
            a.teacher_id === stats.id && a.subject.code === 'GDTC' && a.class.name.startsWith('12')
        );

        if (classToMove) {
            await prisma.teachingAssignment.update({
                where: { id: classToMove.id },
                data: { teacher_id: lowestGDTCTeacher.id }
            });
            console.log(`Moved GDTC ${classToMove.class.name} from ${code} to target.`);
            break; 
        }
    }

    console.log('\nRebalancing complete. Run algorithm again.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
