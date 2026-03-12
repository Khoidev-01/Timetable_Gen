-- CreateEnum
CREATE TYPE "KieuGiamTru" AS ENUM ('PER_WEEK', 'PER_YEAR');

-- AlterTable
ALTER TABLE "giao_vien" ADD COLUMN     "dinh_muc_id" TEXT;

-- AlterTable
ALTER TABLE "kiem_nhiem" ADD COLUMN     "nhiem_vu_id" TEXT,
ALTER COLUMN "ten_nhiem_vu" DROP NOT NULL;

-- CreateTable
CREATE TABLE "dinh_muc_gio_day" (
    "id" TEXT NOT NULL,
    "ma_chuc_danh" TEXT NOT NULL,
    "ten_chuc_danh" TEXT NOT NULL,
    "so_tiet_nghia_vu" INTEGER NOT NULL DEFAULT 17,
    "mo_ta" TEXT,

    CONSTRAINT "dinh_muc_gio_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "danh_muc_nhiem_vu" (
    "id" TEXT NOT NULL,
    "ma_nhiem_vu" TEXT NOT NULL,
    "ten_nhiem_vu" TEXT NOT NULL,
    "so_tiet_giam_tru" INTEGER NOT NULL DEFAULT 0,
    "kieu_giam_tru" "KieuGiamTru" NOT NULL DEFAULT 'PER_WEEK',

    CONSTRAINT "danh_muc_nhiem_vu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dinh_muc_gio_day_ma_chuc_danh_key" ON "dinh_muc_gio_day"("ma_chuc_danh");

-- CreateIndex
CREATE UNIQUE INDEX "danh_muc_nhiem_vu_ma_nhiem_vu_key" ON "danh_muc_nhiem_vu"("ma_nhiem_vu");

-- AddForeignKey
ALTER TABLE "giao_vien" ADD CONSTRAINT "giao_vien_dinh_muc_id_fkey" FOREIGN KEY ("dinh_muc_id") REFERENCES "dinh_muc_gio_day"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiem_nhiem" ADD CONSTRAINT "kiem_nhiem_nhiem_vu_id_fkey" FOREIGN KEY ("nhiem_vu_id") REFERENCES "danh_muc_nhiem_vu"("id") ON DELETE SET NULL ON UPDATE CASCADE;
