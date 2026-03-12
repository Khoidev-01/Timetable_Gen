// @ts-nocheck
import { PrismaClient, PeriodType, RoomType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding (Hybrid TS/SQL Clean)...');

    try {
        // 0. SETUP DB
        try {
            await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
            const tables = ['academic_years', 'semesters', 'users', 'teachers', 'classes', 'teaching_assignments', 'generated_timetables', 'timetable_slots'];
            for (const t of tables) {
                try {
                    await prisma.$executeRawUnsafe(`ALTER TABLE "${t}" ALTER COLUMN id SET DEFAULT gen_random_uuid();`);
                } catch (e) { }
            }
        } catch (e) { console.warn('DB Config Warning:', e); }

        const sqlPath = path.join(__dirname, 'seed_custom.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        const sections = sql.split(/\n-- \d+\. .*/).filter(s => s.trim().length > 0);

        // 1. EXECUTE STATIC SQL (Cleanup, Years, Rooms, Subjects)
        // Run first 4 sections.
        for (let i = 0; i < 4; i++) {
            if (sections[i]) {
                const content = sections[i].trim();
                const stmts = content.split(';').map(s => s.trim()).filter(s => s.length > 0);
                for (const stmt of stmts) {
                    await prisma.$executeRawUnsafe(stmt);
                }
                console.log(`Executed SQL Section ${i + 1}`);
            }
        }

        // 2. TEACHERS (TS Implementation)
        console.log('Seeding Teachers...');
        const subjectsList = ['TOAN', 'VAN', 'ANH', 'LY', 'HOA', 'SINH', 'SU', 'DIA', 'GDKT', 'CN', 'TIN'];
        for (let i = 1; i <= 15; i++) {
            for (const sub of subjectsList) {
                await prisma.teacher.create({
                    data: {
                        code: `GV_${sub}_${i}`,
                        full_name: `GV ${sub} ${i}`,
                        short_name: `${sub} ${i}`,
                        max_periods_per_week: 18
                    }
                }).catch(() => { });
            }
        }
        for (let i = 1; i <= 6; i++) {
            await prisma.teacher.create({ data: { code: `GV_HDTN_${i}`, full_name: `GV HĐTN ${i}`, short_name: `HĐTN ${i}`, max_periods_per_week: 20 } });
        }
        await prisma.teacher.createMany({
            data: [
                { code: 'GV_TD_1', full_name: 'GV Thể Dục 1', short_name: 'TD1', max_periods_per_week: 25 },
                { code: 'GV_TD_2', full_name: 'GV Thể Dục 2', short_name: 'TD2', max_periods_per_week: 25 },
                { code: 'GV_QP_1', full_name: 'GV QP 1', short_name: 'QP1', max_periods_per_week: 25 },
                { code: 'BGH', full_name: 'Ban Giám Hiệu', short_name: 'BGH', max_periods_per_week: 0 }
            ]
        });

        // 3. CLASSES (TS Implementation)
        console.log('Seeding Classes...');
        const getRandom = async (model: any, filter: any) => {
            const items = await model.findMany({ where: filter });
            return items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;
        };
        const getRoom = async (name: string) => prisma.room.findFirst({ where: { name } });

        for (let i = 1; i <= 14; i++) {
            // 12A
            const r12 = await getRoom(`${100 + i}`);
            // Use generic filter if TS complains about specific field typing in filter
            const t12 = await getRandom(prisma.teacher, { OR: [{ code: { startsWith: 'GV_TOAN' } }, { code: { startsWith: 'GV_VAN' } }, { code: { startsWith: 'GV_ANH' } }] });
            await prisma.class.create({ data: { name: `12A${i}`, grade_level: 12, main_session: 0, fixed_room_id: r12 ? r12.id : null, homeroom_teacher_id: t12 ? t12.id : null } });

            // 11B
            const r11 = await getRoom(`${100 + i}`);
            const t11 = await getRandom(prisma.teacher, { OR: [{ code: { startsWith: 'GV_TOAN' } }, { code: { startsWith: 'GV_VAN' } }, { code: { startsWith: 'GV_ANH' } }] });
            await prisma.class.create({ data: { name: `11B${i}`, grade_level: 11, main_session: 1, fixed_room_id: r11 ? r11.id : null, homeroom_teacher_id: t11 ? t11.id : null } });

            // 10C
            const r10 = await getRoom(`${200 + i}`);
            const t10 = await getRandom(prisma.teacher, { OR: [{ code: { startsWith: 'GV_TOAN' } }, { code: { startsWith: 'GV_VAN' } }, { code: { startsWith: 'GV_ANH' } }] });
            await prisma.class.create({ data: { name: `10C${i}`, grade_level: 10, main_session: 0, fixed_room_id: r10 ? r10.id : null, homeroom_teacher_id: t10 ? t10.id : null } });
        }

        // 4. ASSIGNMENTS
        console.log('Seeding Assignments...');
        const semester = await prisma.semester.findFirst();
        const classes = await prisma.class.findMany();
        const subjects = await prisma.subject.findMany();
        const teachers = await prisma.teacher.findMany();

        if (!semester) throw new Error("No Semester");

        const createAssign = async (cls: any, subCode: string, periods: number, type: PeriodType, roomType?: RoomType) => {
            const sub = subjects.find(s => s.code === subCode);
            if (!sub) return;

            let tid = null;
            if (['SH_DAU_TUAN', 'SH_CUOI_TUAN'].includes(subCode)) tid = cls.homeroom_teacher_id;
            else if (subCode === 'CHAO_CO') tid = teachers.find(t => t.code === 'BGH')?.id;
            else if (subCode === 'HDTN') tid = (teachers.find(t => t.code.startsWith('GV_HDTN_1')))?.id;
            else if (subCode === 'GDDP') tid = (teachers.find(t => t.code.startsWith('GV_SU_1')))?.id;
            else {
                const homeroom = teachers.find(t => t.id === cls.homeroom_teacher_id);
                if (homeroom && homeroom.code.includes(`GV_${subCode}`)) tid = homeroom.id;
                else {
                    const canTeach = teachers.filter(t => t.code.startsWith(`GV_${subCode.substring(0, 2)}`));
                    if (canTeach.length > 0) tid = canTeach[Math.floor(Math.random() * canTeach.length)].id;
                    else tid = teachers[Math.floor(Math.random() * teachers.length)].id;
                }
            }
            // Fallback to random teacher if not found, to imply assignment exists
            if (!tid) tid = teachers[0].id;

            await prisma.teachingAssignment.create({
                data: {
                    semester_id: semester.id,
                    class_id: cls.id,
                    subject_id: sub.id,
                    teacher_id: tid,
                    total_periods: periods,
                    period_type: type,
                    required_room_type: roomType || null,
                    block_config: periods >= 2 ? '2' : '1'
                }
            });
        };

        for (const cls of classes) {
            await createAssign(cls, 'CHAO_CO', 1, PeriodType.SPECIAL, RoomType.YARD);
            await createAssign(cls, 'SH_DAU_TUAN', 1, PeriodType.SPECIAL);
            await createAssign(cls, 'SH_CUOI_TUAN', 1, PeriodType.SPECIAL);
            await createAssign(cls, 'TOAN', 4, PeriodType.THEORY);
            await createAssign(cls, 'VAN', 3, PeriodType.THEORY);
            await createAssign(cls, 'ANH', 3, PeriodType.THEORY);
            await createAssign(cls, 'LY', 3, PeriodType.THEORY);
            await createAssign(cls, 'HOA', 2, PeriodType.THEORY);
            await createAssign(cls, 'SINH', 1, PeriodType.THEORY);
        }

        console.log('Seeding Completed Successfully.');

    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
