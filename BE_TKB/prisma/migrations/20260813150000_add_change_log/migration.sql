-- CreateEnum
CREATE TYPE "ChangeAction" AS ENUM ('MOVE', 'SWAP', 'CASCADE_SWAP', 'LOCK', 'UNLOCK', 'PUBLISH', 'REVERT');

-- CreateTable
CREATE TABLE "timetable_change_logs" (
    "id" TEXT NOT NULL,
    "timetable_id" TEXT NOT NULL,
    "slot_id" TEXT,
    "actor_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "action" "ChangeAction" NOT NULL,
    "description" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "reverted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timetable_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timetable_change_logs_timetable_id_created_at_idx"
    ON "timetable_change_logs"("timetable_id", "created_at");

-- AddForeignKey
ALTER TABLE "timetable_change_logs" ADD CONSTRAINT "timetable_change_logs_timetable_id_fkey"
    FOREIGN KEY ("timetable_id") REFERENCES "generated_timetables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
