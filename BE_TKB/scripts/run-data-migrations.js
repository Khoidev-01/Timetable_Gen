const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const happyCaseData = require('./data/happy-case-school-data.json');
const happyCaseSubmissions = require('./data/happy-case-department-submissions.json');

const prisma = new PrismaClient();

const RESET_MIGRATION_ID = '20260918_reset_all_data_keep_admin';
const SEED_MIGRATION_ID = '20260918_seed_happy_case_resources';
const SESSION_CONFIGURATION_MIGRATION_ID =
  '20260918_sync_happy_case_session_configuration';
const DEPARTMENT_SUBMISSIONS_MIGRATION_ID =
  '20260918_seed_happy_case_department_submissions';
const DATA_MIGRATION_LOCK_ID = 20260918;
const SCHOOL_DAYS = [2, 3, 4, 5, 6, 7];

const HAPPY_CASE_REST_RULES = [
  ...SCHOOL_DAYS.flatMap((day) =>
    [6, 7].map((period) => ({
      name: 'Nghỉ - không học',
      subject_code: 'NGHI',
      day_of_week: day,
      period,
      main_session: 0,
      teacher_rule: 'ASSIGNED',
      is_locked: true,
    })),
  ),
  ...[4, 5].map((period) => ({
    name: 'Nghỉ - không học',
    subject_code: 'NGHI',
    day_of_week: 5,
    period,
    main_session: 0,
    teacher_rule: 'ASSIGNED',
    is_locked: true,
  })),
  ...SCHOOL_DAYS.flatMap((day) =>
    [4, 5].map((period) => ({
      name: 'Nghỉ - không học',
      subject_code: 'NGHI',
      day_of_week: day,
      period,
      main_session: 1,
      teacher_rule: 'ASSIGNED',
      is_locked: true,
    })),
  ),
  ...[9, 10].map((period) => ({
    name: 'Nghỉ - không học',
    subject_code: 'NGHI',
    day_of_week: 5,
    period,
    main_session: 1,
    teacher_rule: 'ASSIGNED',
    is_locked: true,
  })),
].map((rule, index) => ({ ...rule, sort_order: index + 7 }));

async function resetAllDataKeepAdmin(tx) {
  // The administrator may have been linked to a teacher profile in old data.
  // Clear that optional link before removing all teacher records.
  await tx.user.updateMany({
    where: { username: 'admin', role: 'ADMIN' },
    data: { teacher_profile_id: null },
  });

  await tx.authSession.deleteMany();
  await tx.authAccount.deleteMany();
  await tx.authVerification.deleteMany();
  await tx.authUser.deleteMany();

  await tx.timetableChangeLog.deleteMany();
  await tx.timetableSlot.deleteMany();
  await tx.swapRequest.deleteMany();
  await tx.scheduleOverlay.deleteMany();
  await tx.generatedTimetable.deleteMany();
  await tx.teacherBusyRequest.deleteMany();
  await tx.notification.deleteMany();
  await tx.teachingAssignment.deleteMany();
  await tx.teacherConstraint.deleteMany();
  await tx.assignmentConsolidation.deleteMany();
  await tx.departmentSubmission.deleteMany();

  // Keep exactly the canonical administrator account. If it does not exist,
  // seed-admin.js creates it immediately after this migration finishes.
  await tx.user.deleteMany({
    where: {
      OR: [{ username: { not: 'admin' } }, { role: { not: 'ADMIN' } }],
    },
  });

  await tx.class.deleteMany();
  await tx.teacher.deleteMany();
  await tx.room.deleteMany();
  await tx.semester.deleteMany();
  await tx.academicYear.deleteMany();
  await tx.curriculumCombination.deleteMany();
  await tx.fixedPeriodRule.deleteMany();
  await tx.constraintSetting.deleteMany();
  await tx.knowledgeChunk.deleteMany();
  await tx.subject.deleteMany();
}

async function seedHappyCaseResources(tx) {
  const initialPassword = process.env.TEACHER_INITIAL_PASSWORD || '123456';
  const passwordHash = await bcrypt.hash(initialPassword, 10);

  const year = await tx.academicYear.create({
    data: {
      name: happyCaseData.academicYear.name,
      start_date: new Date(happyCaseData.academicYear.startDate),
      end_date: new Date(happyCaseData.academicYear.endDate),
      weeks: happyCaseData.academicYear.weeks,
      status: 'ACTIVE',
      semesters: {
        create: [
          { name: 'HK1', is_current: true, term_order: 1 },
          { name: 'HK2', is_current: false, term_order: 2 },
        ],
      },
    },
  });

  await tx.subject.createMany({
    data: happyCaseData.subjects.map((subject) => ({
      code: subject.code,
      name: subject.name,
      color: subject.color,
      is_special: subject.isSpecial,
      is_practice: subject.isPractice,
    })),
  });

  await tx.room.createMany({
    data: happyCaseData.rooms.map((room) => ({
      name: room.name,
      type: room.type,
      floor: room.floor,
      capacity: room.capacity,
    })),
  });
  const rooms = await tx.room.findMany();
  const roomByName = new Map(rooms.map((room) => [room.name, room]));

  await tx.teacher.createMany({
    data: happyCaseData.teachers.map((teacher) => ({
      code: teacher.code,
      full_name: teacher.fullName,
      short_name: teacher.shortName,
      phone: teacher.phone,
      department: teacher.department,
      position: teacher.position,
      major_subject: teacher.majorSubject,
      teachable_grades: JSON.stringify(teacher.teachableGrades),
      status: teacher.status,
      max_periods_per_week: teacher.maxPeriodsPerWeek,
      workload_reduction: teacher.workloadReduction,
      notes: teacher.notes,
    })),
  });
  const teachers = await tx.teacher.findMany();
  const teacherByCode = new Map(
    teachers.map((teacher) => [teacher.code, teacher]),
  );

  await tx.curriculumCombination.createMany({
    data: happyCaseData.combinations.map((combination) => ({
      code: combination.code,
      grade_level: combination.gradeLevel,
      elective_subject_code_1: combination.electiveSubjects[0],
      elective_subject_code_2: combination.electiveSubjects[1],
      elective_subject_code_3: combination.electiveSubjects[2],
      elective_subject_code_4: combination.electiveSubjects[3],
      notes: combination.notes,
    })),
  });

  await tx.class.createMany({
    data: happyCaseData.classes.map((schoolClass) => ({
      name: schoolClass.name,
      grade_level: schoolClass.gradeLevel,
      main_session: schoolClass.mainSession,
      student_count: schoolClass.studentCount,
      combination_code: schoolClass.combinationCode,
      notes: schoolClass.notes,
      fixed_room_id: roomByName.get(schoolClass.roomName)?.id,
      homeroom_teacher_id: teacherByCode.get(schoolClass.homeroomTeacherCode)
        ?.id,
    })),
  });

  await tx.user.createMany({
    data: happyCaseData.teachers.map((teacher) => ({
      username: teacher.code.toLowerCase(),
      password_hash: passwordHash,
      role: 'TEACHER',
      teacher_profile_id: teacherByCode.get(teacher.code).id,
    })),
  });

  await tx.fixedPeriodRule.createMany({
    data: [
      {
        name: 'Chào cờ đầu tuần',
        subject_code: 'CHAO_CO',
        day_of_week: 2,
        period: 1,
        main_session: 0,
        teacher_rule: 'HOMEROOM',
        is_locked: true,
        sort_order: 1,
      },
      {
        name: 'GVCN dạy tiết 2 Thứ 2',
        subject_code: 'GVCN_TEACHING',
        day_of_week: 2,
        period: 2,
        main_session: 0,
        teacher_rule: 'HOMEROOM',
        is_locked: false,
        sort_order: 2,
      },
      {
        name: 'Sinh hoạt cuối tuần',
        subject_code: 'SH_CUOI_TUAN',
        day_of_week: 7,
        period: 5,
        main_session: 0,
        teacher_rule: 'HOMEROOM',
        is_locked: true,
        sort_order: 3,
      },
      {
        name: 'Chào cờ đầu tuần',
        subject_code: 'CHAO_CO',
        day_of_week: 2,
        period: 6,
        main_session: 1,
        teacher_rule: 'HOMEROOM',
        is_locked: true,
        sort_order: 4,
      },
      {
        name: 'GVCN dạy tiết 2 Thứ 2',
        subject_code: 'GVCN_TEACHING',
        day_of_week: 2,
        period: 7,
        main_session: 1,
        teacher_rule: 'HOMEROOM',
        is_locked: false,
        sort_order: 5,
      },
      {
        name: 'Sinh hoạt cuối tuần',
        subject_code: 'SH_CUOI_TUAN',
        day_of_week: 7,
        period: 10,
        main_session: 1,
        teacher_rule: 'HOMEROOM',
        is_locked: true,
        sort_order: 6,
      },
      ...HAPPY_CASE_REST_RULES,
    ],
  });

  console.log(
    `[data-migration] Seeded ${year.name}: ${happyCaseData.classes.length} classes, ` +
      `${happyCaseData.teachers.length} teachers/accounts, ${happyCaseData.rooms.length} rooms, ` +
      `${happyCaseData.subjects.length} subjects`,
  );
}

async function syncHappyCaseSessionConfiguration(tx) {
  for (const teacher of happyCaseData.teachers) {
    await tx.teacher.updateMany({
      where: { code: teacher.code },
      data: {
        max_periods_per_week: teacher.maxPeriodsPerWeek,
        workload_reduction: teacher.workloadReduction,
      },
    });
  }

  await tx.fixedPeriodRule.deleteMany({
    where: {
      subject_code: 'NGHI',
      OR: [
        { main_session: 0, period: { in: [6, 7] } },
        { main_session: 0, day_of_week: 5, period: { in: [4, 5] } },
        { main_session: 1, period: { in: [4, 5] } },
        { main_session: 1, day_of_week: 5, period: { in: [9, 10] } },
      ],
    },
  });
  await tx.fixedPeriodRule.createMany({ data: HAPPY_CASE_REST_RULES });

  console.log(
    `[data-migration] Synced ${happyCaseData.teachers.length} effective teacher loads and ` +
      `${HAPPY_CASE_REST_RULES.length} morning/afternoon rest cells`,
  );
}

// Every department except Tổ Toán starts as "already submitted" so the demo only needs the
// Tổ Toán head to upload. The rows and issues were produced through the real template/submit
// path by scripts/build-department-submissions.ts.
async function seedHappyCaseDepartmentSubmissions(tx) {
  const year = await tx.academicYear.findFirst({ orderBy: { name: 'desc' } });
  if (!year) throw new Error('No academic year to attach department submissions to');

  let seeded = 0;
  for (const submission of happyCaseSubmissions) {
    const alreadySubmitted = await tx.departmentSubmission.count({
      where: { year_id: year.id, department: submission.department },
    });
    if (alreadySubmitted > 0) continue;

    const head = await tx.teacher.findUnique({
      where: { code: submission.headTeacherCode },
      include: { user: true },
    });
    if (!head?.user || head.department !== submission.department) {
      throw new Error(
        `${submission.headTeacherCode} is not the head of ${submission.department}`,
      );
    }

    const saved = await tx.departmentSubmission.create({
      data: {
        year_id: year.id,
        department: submission.department,
        submitted_by: head.user.id,
        head_teacher_id: head.id,
        file_name: submission.fileName,
        rows: submission.rows,
        issues: submission.issues,
      },
    });
    const filled = submission.rows.filter((row) => row.hk1TeacherCode).length;
    await tx.notification.create({
      data: {
        category: 'SYSTEM',
        title: `${submission.department} đã nộp phân công`,
        message: `${head.full_name} nộp ${filled}/${submission.rows.length} dòng có giáo viên.`,
        metadata: {
          submissionId: saved.id,
          department: submission.department,
          yearId: year.id,
        },
      },
    });
    seeded++;
  }

  console.log(
    `[data-migration] Seeded ${seeded}/${happyCaseSubmissions.length} department submissions for ${year.name}`,
  );
}

async function runDataMigration(id, description, migrate) {
  const applied = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT pg_advisory_xact_lock(${DATA_MIGRATION_LOCK_ID})::text AS "lock"`,
      );

      const existing = await tx.$queryRawUnsafe(
        `SELECT "id" FROM "_app_data_migrations" WHERE "id" = $1`,
        id,
      );
      if (existing.length > 0) return false;

      console.log(`[data-migration] Applying ${id}: ${description}`);
      await migrate(tx);
      await tx.$executeRawUnsafe(
        `INSERT INTO "_app_data_migrations" ("id") VALUES ($1)`,
        id,
      );
      return true;
    },
    { timeout: 120_000 },
  );

  console.log(
    applied
      ? `[data-migration] Applied ${id}`
      : `[data-migration] Already applied ${id}, skipping`,
  );
}

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_app_data_migrations" (
      "id" TEXT PRIMARY KEY,
      "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runDataMigration(
    RESET_MIGRATION_ID,
    'deleting all data except admin',
    resetAllDataKeepAdmin,
  );
  await runDataMigration(
    SEED_MIGRATION_ID,
    'seeding complete happy-case school resources',
    seedHappyCaseResources,
  );
  await runDataMigration(
    SESSION_CONFIGURATION_MIGRATION_ID,
    'syncing happy-case session rules and effective teacher loads',
    syncHappyCaseSessionConfiguration,
  );
  await runDataMigration(
    DEPARTMENT_SUBMISSIONS_MIGRATION_ID,
    'marking every department except Tổ Toán as submitted',
    seedHappyCaseDepartmentSubmissions,
  );
}

main()
  .catch((error) => {
    console.error('[data-migration] Failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
