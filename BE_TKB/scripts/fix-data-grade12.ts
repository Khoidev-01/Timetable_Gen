import { PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

async function main() {
    const semesterId = '4a020e02-3164-413d-9699-c32ba3fe8bd4';

    // 1. Tạo giáo viên mới (Dự phòng cho Khối 12)
    const newTeachers = [
        { code: 'GV075', name: 'Nguyễn Toán 12', subject: 'TOAN' },
        { code: 'GV076', name: 'Trần Văn 12', subject: 'VAN' },
        { code: 'GV077', name: 'Lê Anh 12', subject: 'ANH' },
        { code: 'GV078', name: 'Phạm Lý 12', subject: 'LY' },
    ];

    for (const t of newTeachers) {
        await prisma.teacher.upsert({
            where: { code: t.code },
            update: {},
            create: {
                id: uuid(),
                code: t.code,
                full_name: t.name,
                short_name: t.code,
                major_subject: t.subject,
                status: 'Dang_day',
                max_periods_per_week: 20
            }
        });
    }
    console.log('✅ Created 4 new backup teachers (GV075-GV078)');

    // 2. Lấy danh sách lớp Khối 12 bị "nghẽn" (A8-A11)
    const classNames = ['12A8', '12A9', '12A10', '12A11'];
    const classes = await prisma.class.findMany({ where: { name: { in: classNames } } });
    const classIds = classes.map(c => c.id);

    // 3. Reassign TOAN, VAN, ANH, LY cho các lớp này sang GV mới
    const subjectCodes = ['TOAN', 'VAN', 'ANH', 'LY'];
    const subjects = await prisma.subject.findMany({ where: { code: { in: subjectCodes } } });
    
    for (const subj of subjects) {
        const targetTeacherCode = 
            subj.code === 'TOAN' ? 'GV075' :
            subj.code === 'VAN' ? 'GV076' :
            subj.code === 'ANH' ? 'GV077' : 'GV078';
        
        const teacher = await prisma.teacher.findUnique({ where: { code: targetTeacherCode } });
        if (!teacher) continue;

        const updated = await prisma.teachingAssignment.updateMany({
            where: {
                semester_id: semesterId,
                class_id: { in: classIds },
                subject_id: subj.id
            },
            data: { teacher_id: teacher.id }
        });
        console.log(`  Moved ${subj.code} for 4 classes to ${targetTeacherCode} (${updated.count} assignments)`);
    }

    console.log('\nData Fixed! Now Grade 12 has dedicated teachers for core subjects.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
