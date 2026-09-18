const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const RESET_MIGRATION_ID = '20260918_reset_all_data_keep_admin';
const RESET_LOCK_ID = 20260918;

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

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_app_data_migrations" (
      "id" TEXT PRIMARY KEY,
      "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const applied = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT pg_advisory_xact_lock(${RESET_LOCK_ID})::text AS "lock"`,
      );

      const existing = await tx.$queryRawUnsafe(
        `SELECT "id" FROM "_app_data_migrations" WHERE "id" = $1`,
        RESET_MIGRATION_ID,
      );
      if (existing.length > 0) return false;

      console.log(
        `[data-migration] Applying ${RESET_MIGRATION_ID}: deleting all data except admin`,
      );
      await resetAllDataKeepAdmin(tx);
      await tx.$executeRawUnsafe(
        `INSERT INTO "_app_data_migrations" ("id") VALUES ($1)`,
        RESET_MIGRATION_ID,
      );
      return true;
    },
    { timeout: 120_000 },
  );

  console.log(
    applied
      ? `[data-migration] Applied ${RESET_MIGRATION_ID}`
      : `[data-migration] Already applied ${RESET_MIGRATION_ID}, skipping`,
  );
}

main()
  .catch((error) => {
    console.error('[data-migration] Failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
