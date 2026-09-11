-- Two teachers asking to trade a period, with the partner's answer and the admin's decision.
-- The timetable is not touched until an admin approves and the constraints are re-checked.

ALTER TYPE "NotificationCategory" ADD VALUE 'SWAP_REQUEST';

CREATE TYPE "SwapStatus" AS ENUM (
    'PENDING_PARTNER', 'PARTNER_REJECTED', 'PENDING_ADMIN', 'APPROVED', 'REJECTED', 'CANCELLED'
);

CREATE TABLE "swap_requests" (
    "id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "requester_teacher_id" TEXT NOT NULL,
    "requester_slot_id" TEXT NOT NULL,
    "partner_teacher_id" TEXT NOT NULL,
    "partner_slot_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING_PARTNER',
    "partner_note" TEXT,
    "admin_note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "overlay_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swap_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "swap_requests_semester_id_status_idx" ON "swap_requests"("semester_id", "status");
CREATE INDEX "swap_requests_partner_teacher_id_status_idx" ON "swap_requests"("partner_teacher_id", "status");
CREATE INDEX "swap_requests_requester_teacher_id_status_idx" ON "swap_requests"("requester_teacher_id", "status");

ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_semester_id_fkey"
    FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_requester_teacher_id_fkey"
    FOREIGN KEY ("requester_teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_partner_teacher_id_fkey"
    FOREIGN KEY ("partner_teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
