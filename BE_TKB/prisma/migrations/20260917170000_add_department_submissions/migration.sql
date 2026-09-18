-- Tong hop phan cong: to truong nop bang phan cong cua to, admin tong hop va phan cong tu dong.
CREATE TABLE "department_submissions" (
    "id" TEXT NOT NULL,
    "year_id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "head_teacher_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "issues" JSONB NOT NULL,
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "department_submissions_year_id_department_is_latest_idx" ON "department_submissions"("year_id", "department", "is_latest");

ALTER TABLE "department_submissions" ADD CONSTRAINT "department_submissions_year_id_fkey" FOREIGN KEY ("year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "assignment_consolidations" (
    "id" TEXT NOT NULL,
    "year_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "workbook" BYTEA NOT NULL,
    "report" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_consolidations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assignment_consolidations_year_id_created_at_idx" ON "assignment_consolidations"("year_id", "created_at");

ALTER TABLE "assignment_consolidations" ADD CONSTRAINT "assignment_consolidations_year_id_fkey" FOREIGN KEY ("year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
