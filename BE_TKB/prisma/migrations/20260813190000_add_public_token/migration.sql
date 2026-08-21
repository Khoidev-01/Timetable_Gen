-- AlterTable
ALTER TABLE "generated_timetables" ADD COLUMN "public_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "generated_timetables_public_token_key" ON "generated_timetables"("public_token");
