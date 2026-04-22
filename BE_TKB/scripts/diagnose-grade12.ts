import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const timetable = await prisma.generatedTimetable.findFirst({
        where: { semester_id: '4a020e02-3164-413d-9699-c32ba3fe8bd4' },
        orderBy: { created_at: 'desc' },
        include: { slots: { include: { subject: true, class: true, teacher: true } } }
    });

    if (!timetable) return;

    // Tìm các tiết bị forced (có lỗi hard violation hoặc không khớp khung giờ)
    // Thực tế trong FET engine, các tiết "Failed" là các tiết bị Forced vào vị trí ngẫu nhiên
    // Chúng ta sẽ đếm xem môn nào bị forced nhiều nhất ở Khối 12
    const subjectCounts = new Map<string, number>();
    const teacherCounts = new Map<string, number>();

    for (const s of timetable.slots) {
        const is12 = s.class.name.startsWith('12');
        if (!is12) continue;

        // Tiết học được coi là "nguy cơ" nếu giáo viên đó dạy quá nhiều tiết sáng
        const key = `${s.teacher.code} (${s.subject.code})`;
        teacherCounts.set(key, (teacherCounts.get(key) || 0) + 1);
        
        subjectCounts.set(s.subject.code, (subjectCounts.get(s.subject.code) || 0) + 1);
    }

    console.log('=== GRADE 12 TEACHER LOAD (MORNING) ===');
    const sortedTeachers = [...teacherCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [name, count] of sortedTeachers) {
        if (count > 12) { // Dạy hơn 12 tiết sáng cho Khối 12 là rất căng thẳng
            console.log(`🔴 ${name}: ${count} periods/week`);
        }
    }

    console.log('\n=== SUBJECT DISTRIBUTION (GRADE 12) ===');
    for (const [subj, count] of subjectCounts) {
        console.log(`  ${subj}: ${count} total periods`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
