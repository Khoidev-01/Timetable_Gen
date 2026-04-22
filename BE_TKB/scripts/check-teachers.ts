import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const subjects = await prisma.subject.findMany();
    const teachers = await prisma.teacher.findMany();
    const assignments = await prisma.teachingAssignment.findMany({
        where: { semester_id: '4a020e02-3164-413d-9699-c32ba3fe8bd4' },
    });
    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    const teacherMap = new Map(teachers.map(t => [t.id, t]));

    // Find teachers that teach the missing subjects in 12A
    const missingSubjects = ['TOAN', 'VAN', 'HOA', 'LS'];
    const grade12Classes = ['12A1','12A2','12A3','12A4','12A5','12A6','12A7','12A8','12A9','12A10','12A11'];

    console.log('=== GIÁO VIÊN DẠY MÔN THIẾU Ở KHỐI 12A ===\n');

    for (const code of missingSubjects) {
        const subj = subjects.find(s => s.code === code);
        if (!subj) continue;

        // Find all teachers teaching this subject
        const teacherIds = new Set<string>();
        const teacherClasses = new Map<string, string[]>();

        for (const a of assignments) {
            if (a.subject_id !== subj.id) continue;
            teacherIds.add(a.teacher_id);
            if (!teacherClasses.has(a.teacher_id)) teacherClasses.set(a.teacher_id, []);
            // Find class name
            const cls = await prisma.class.findUnique({ where: { id: a.class_id } });
            teacherClasses.get(a.teacher_id)!.push(cls?.name || '?');
        }

        console.log(`📚 ${code} (${subj.name || code}):`);
        for (const [tid, classes] of teacherClasses) {
            const teacher = teacherMap.get(tid);
            const totalPeriods = assignments
                .filter(a => a.teacher_id === tid && a.subject_id === subj.id)
                .reduce((sum, a) => sum + ((a as any).total_periods || 1), 0);
            console.log(`   👩‍🏫 ${(teacher?.full_name || teacher?.code || tid).padEnd(25)} dạy ${classes.length} lớp (${totalPeriods} tiết/tuần): ${classes.join(', ')}`);
        }
        console.log('');
    }

    // Check teacher busy time
    console.log('=== GIÁO VIÊN BẬN (BUSY TIME) ===\n');
    for (const code of missingSubjects) {
        const subj = subjects.find(s => s.code === code);
        if (!subj) continue;
        const teacherIds = [...new Set(assignments.filter(a => a.subject_id === subj.id).map(a => a.teacher_id))];
        for (const tid of teacherIds) {
            const teacher = await prisma.teacher.findUnique({ where: { id: tid }, include: { constraints: true } });
            if (!teacher) continue;
            const busyCount = teacher.constraints.filter(c => c.type === 'BUSY').length;
            const totalPeriods = assignments
                .filter(a => a.teacher_id === tid)
                .reduce((sum, a) => sum + ((a as any).total_periods || 1), 0);
            if (busyCount > 0 || totalPeriods > 25) {
                console.log(`   ${(teacher.full_name || teacher.code).padEnd(25)} ${totalPeriods} tiết/tuần, ${busyCount} tiết bận`);
            }
        }
    }

    await prisma.$disconnect();
}
main();
