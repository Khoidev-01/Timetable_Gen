-- AlterTable
ALTER TABLE "classes"
ADD COLUMN "combination_code" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "student_count" INTEGER;

-- AlterTable
ALTER TABLE "semesters"
ADD COLUMN "term_order" INTEGER NOT NULL DEFAULT 1;

-- Normalize existing semester ordering if current data is already present
UPDATE "semesters"
SET "term_order" = CASE
    WHEN LOWER(name) LIKE '%hk1%' OR LOWER(name) LIKE '%hoc ky 1%' THEN 1
    WHEN LOWER(name) LIKE '%hk2%' OR LOWER(name) LIKE '%hoc ky 2%' THEN 2
    ELSE "term_order"
END;

-- AlterTable
ALTER TABLE "teachers"
ADD COLUMN "department" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Dang_day',
ADD COLUMN "workload_reduction" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "curriculum_combinations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "grade_level" INTEGER NOT NULL,
    "elective_subject_code_1" TEXT NOT NULL,
    "elective_subject_code_2" TEXT NOT NULL,
    "elective_subject_code_3" TEXT NOT NULL,
    "elective_subject_code_4" TEXT NOT NULL,
    "special_topic_code_1" TEXT NOT NULL,
    "special_topic_code_2" TEXT NOT NULL,
    "special_topic_code_3" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "curriculum_combinations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_combinations_code_key" ON "curriculum_combinations"("code");
