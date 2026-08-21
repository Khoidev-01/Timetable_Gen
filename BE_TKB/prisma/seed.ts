import { RoomType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { ExcelService } from '../src/excel/excel.service';
import { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaService();
const excelService = new ExcelService(prisma);

const MOCK_WORKBOOK = path.resolve(
  __dirname,
  '..',
  '..',
  'Mau_phan_cong_giang_day_THPT_GDPT2018_co_du_lieu_mau.xlsx',
);

const ROOM_SEED = [
  ...Array.from({ length: 14 }, (_, index) => ({
    name: String(101 + index),
    floor: 1,
    type: RoomType.CLASSROOM,
  })),
  { name: '115', floor: 1, type: RoomType.CLASSROOM },
  ...Array.from({ length: 14 }, (_, index) => ({
    name: String(201 + index),
    floor: 2,
    type: RoomType.CLASSROOM,
  })),
  { name: '215', floor: 2, type: RoomType.CLASSROOM },
  { name: '301', floor: 3, type: RoomType.LAB_PHYSICS },
  { name: '302', floor: 3, type: RoomType.LAB_CHEM },
  { name: '303', floor: 3, type: RoomType.LAB_BIO },
  { name: '314', floor: 3, type: RoomType.LAB_IT },
  { name: '315', floor: 3, type: RoomType.LAB_IT },
  // Physical education needs open ground; without these the yard-capacity rule cannot
  // be enforced and every GDTC period looks unconstrained
  { name: 'Sân A', floor: 0, type: RoomType.YARD },
  { name: 'Sân B', floor: 0, type: RoomType.YARD },
];

async function main() {
  console.log('Start workbook-based seed...');
  await prisma.$connect();

  try {
    await resetDatabase();
    const academicYear = await seedAcademicYear();
    await seedAdminUser();
    await seedRooms();
    await seedFixedPeriodRules();
    await importMockWorkbook(academicYear.id);
    await assignHomeRooms();

    console.log(`Seed completed for academic year ${academicYear.name}.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function resetDatabase() {
  console.log('Resetting local data...');
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      fixed_period_rules,
      timetable_slots,
      generated_timetables,
      teaching_assignments,
      curriculum_combinations,
      teacher_constraints,
      users,
      classes,
      teachers,
      subjects,
      rooms,
      semesters,
      academic_years
    RESTART IDENTITY CASCADE;
  `);
}

async function seedAcademicYear() {
  console.log('Creating academic year and semesters...');
  return prisma.academicYear.create({
    data: {
      name: '2026-2027',
      start_date: new Date('2026-09-05T00:00:00Z'),
      end_date: new Date('2027-05-31T00:00:00Z'),
      status: 'ACTIVE',
      semesters: {
        create: [
          { name: 'HK1', is_current: true, term_order: 1 },
          { name: 'HK2', is_current: false, term_order: 2 },
        ],
      },
    },
    include: { semesters: true },
  });
}

async function seedAdminUser() {
  console.log('Creating admin user...');
  const passwordHash = await bcrypt.hash('123456', 10);
  await prisma.user.create({
    data: {
      username: 'admin',
      password_hash: passwordHash,
      role: 'ADMIN',
    },
  });
}

async function seedRooms() {
  console.log('Creating baseline rooms...');
  await prisma.room.createMany({ data: ROOM_SEED });
}

/**
 * Default fixed periods. Morning and afternoon classes each get their own set so that
 * an afternoon class is not left without a chào cờ, and sinh hoạt lands at the end of
 * its own session rather than at a period number that belongs to the other shift.
 */
async function seedFixedPeriodRules() {
  console.log('Creating default fixed period rules...');

  const rules = [
    // --- Lớp học buổi sáng (tiết 1-5) ---
    { name: 'Chào cờ đầu tuần', subject_code: 'CHAO_CO', day_of_week: 2, period: 1, main_session: 0, teacher_rule: 'HOMEROOM', sort_order: 1 },
    { name: 'GVCN dạy tiết 2 Thứ 2', subject_code: 'GVCN_TEACHING', day_of_week: 2, period: 2, main_session: 0, teacher_rule: 'HOMEROOM', is_locked: false, sort_order: 2 },
    { name: 'Sinh hoạt cuối tuần', subject_code: 'SH_CUOI_TUAN', day_of_week: 7, period: 5, main_session: 0, teacher_rule: 'HOMEROOM', sort_order: 3 },

    // --- Lớp học buổi chiều (tiết 6-10) ---
    { name: 'Chào cờ đầu tuần', subject_code: 'CHAO_CO', day_of_week: 2, period: 6, main_session: 1, teacher_rule: 'HOMEROOM', sort_order: 4 },
    { name: 'GVCN dạy tiết 2 Thứ 2', subject_code: 'GVCN_TEACHING', day_of_week: 2, period: 7, main_session: 1, teacher_rule: 'HOMEROOM', is_locked: false, sort_order: 5 },
    { name: 'Sinh hoạt cuối tuần', subject_code: 'SH_CUOI_TUAN', day_of_week: 7, period: 10, main_session: 1, teacher_rule: 'HOMEROOM', sort_order: 6 },
  ];

  await prisma.fixedPeriodRule.createMany({
    data: rules.map((rule) => ({
      ...rule,
      teacher_rule: rule.teacher_rule as any,
      is_locked: rule.is_locked ?? true,
    })),
  });
}

/**
 * Vietnamese secondary schools keep each class in its own room and let the teachers
 * move, so every class needs a home room. The workbook has no room column, so assign
 * them here: grade 10 upstairs, grades 11 and 12 on the first floor.
 */
async function assignHomeRooms() {
  console.log('Assigning home rooms to classes...');

  const classrooms = await prisma.room.findMany({
    where: { type: RoomType.CLASSROOM },
    orderBy: { name: 'asc' },
  });
  const classes = await prisma.class.findMany({ orderBy: [{ grade_level: 'asc' }, { name: 'asc' }] });

  const upstairs = classrooms.filter((room) => room.floor === 2);
  const downstairs = classrooms.filter((room) => room.floor === 1);
  let upstairsIndex = 0;
  let downstairsIndex = 0;

  for (const cls of classes) {
    const pool = cls.grade_level === 10 ? upstairs : downstairs;
    const index = cls.grade_level === 10 ? upstairsIndex++ : downstairsIndex++;
    const room = pool[index];
    if (!room) continue;

    await prisma.class.update({
      where: { id: cls.id },
      data: { fixed_room_id: room.id },
    });
  }
}

async function importMockWorkbook(academicYearId: string) {
  if (!fs.existsSync(MOCK_WORKBOOK)) {
    throw new Error(`Mock workbook not found: ${MOCK_WORKBOOK}`);
  }

  console.log(`Importing workbook ${path.basename(MOCK_WORKBOOK)}...`);
  let result;
  try {
    result = await excelService.importWorkbook(
      academicYearId,
      fs.readFileSync(MOCK_WORKBOOK),
    );
  } catch (error: any) {
    const workbookErrors = error?.response?.errors;
    if (Array.isArray(workbookErrors) && workbookErrors.length > 0) {
      console.error('Workbook validation errors:');
      workbookErrors.slice(0, 20).forEach((item: any) => {
        console.error(
          `  - [${item.sheet} row ${item.row} col ${item.column}] ${item.message}`,
        );
      });
    }
    throw error;
  }

  console.log('Import summary:', JSON.stringify(result.summary, null, 2));
  console.log(`Warnings: ${result.warnings.length}`);
  if (result.warnings.length > 0) {
    result.warnings.slice(0, 10).forEach((warning) => {
      console.log(
        `  - [${warning.sheet} row ${warning.row} col ${warning.column}] ${warning.message}`,
      );
    });
  }
}

main().catch((error) => {
  console.error('Workbook seed failed:', error);
  process.exit(1);
});
