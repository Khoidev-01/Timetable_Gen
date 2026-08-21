-- CreateEnum
CREATE TYPE "TeacherRule" AS ENUM ('HOMEROOM', 'BGH', 'ASSIGNED');

-- CreateTable
CREATE TABLE "fixed_period_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject_code" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "grade_level" INTEGER,
    "main_session" INTEGER,
    "teacher_rule" "TeacherRule" NOT NULL DEFAULT 'HOMEROOM',
    "is_locked" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fixed_period_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fixed_period_rules_is_active_day_of_week_period_idx"
    ON "fixed_period_rules"("is_active", "day_of_week", "period");
