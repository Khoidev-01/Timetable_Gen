-- CreateEnum
CREATE TYPE "OverlayType" AS ENUM ('HOLIDAY', 'ABSENCE', 'EXAM_WEEK', 'EVENT', 'MAKEUP', 'SWAP');

-- CreateEnum
CREATE TYPE "OverlayScope" AS ENUM ('SCHOOL', 'GRADE', 'CLASS', 'TEACHER');

-- CreateTable
CREATE TABLE "schedule_overlays" (
    "id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "type" "OverlayType" NOT NULL,
    "scope" "OverlayScope" NOT NULL DEFAULT 'SCHOOL',
    "scope_ref" TEXT,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 10,
    "payload" JSONB NOT NULL,
    "reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_overlays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_overlays_semester_id_date_from_date_to_idx"
    ON "schedule_overlays"("semester_id", "date_from", "date_to");

-- AddForeignKey
ALTER TABLE "schedule_overlays" ADD CONSTRAINT "schedule_overlays_semester_id_fkey"
    FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
