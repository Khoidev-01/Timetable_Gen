/*
  Warnings:

  - Added the required column `nam_hoc_id` to the `kiem_nhiem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "kiem_nhiem" ADD COLUMN     "nam_hoc_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "kiem_nhiem" ADD CONSTRAINT "kiem_nhiem_nam_hoc_id_fkey" FOREIGN KEY ("nam_hoc_id") REFERENCES "nam_hoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
